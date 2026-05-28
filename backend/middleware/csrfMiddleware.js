const crypto = require('crypto');
const csrfTokenStore = require('../utils/csrfTokenStore');

/**
 * CSRF protection — stateless double-submit cookie pattern.
 *
 * How it works:
 *   1. On every safe request (GET / HEAD / OPTIONS) the server mints a
 *      fresh random token, mirrors it into a non-httpOnly `XSRF-TOKEN`
 *      cookie, and exposes it via the `X-CSRF-Token` response header.
 *   2. The SPA reads the cookie via `document.cookie` and echoes it back
 *      on every state-changing request as the `X-CSRF-Token` header.
 *   3. On a state-changing request the middleware verifies that the token
 *      from the request (header / body / cookie) matches the value the
 *      browser is sending in the `XSRF-TOKEN` cookie.
 *
 * Why stateless: an in-memory token store would key tokens by
 * `req.user._id || req.ip`. On a multi-instance host (or when a CDN edge
 * rewrites the client IP, as Vercel does) the validation lookup never
 * matches and every mutation 403s. The double-submit pattern doesn't need
 * server-side state — a third-party site cannot read the cookie, so it
 * cannot forge the matching header. This is the standard approach
 * recommended by OWASP for SPA + cross-site API deployments.
 *
 * The legacy `csrfTokenStore.generate()` call is kept so existing callers
 * (e.g. `getCsrfToken` admin endpoint) keep working without code churn,
 * but the validator no longer reads from the store.
 */

/**
 * Cookie options for the XSRF-TOKEN cookie. In production we deploy the
 * frontend on Vercel and the backend on Render — different sites — so the
 * browser will only attach the cookie back to the API (and let
 * `document.cookie` read it from the frontend) when it is set with
 * `SameSite=None; Secure`. In local development we keep `lax` so plain
 * HTTP localhost works.
 */
const getXsrfCookieOptions = () => {
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  return {
    // Allow the SPA to read the token via document.cookie.
    httpOnly: false,
    // SameSite=None mandates Secure; the browser drops the cookie otherwise.
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  };
};

/**
 * Constant-time string comparison for token validation. Falls back to plain
 * equality when the inputs differ in length (timingSafeEqual would throw).
 */
const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
};

/**
 * Mint a CSRF token for the current request and mirror it into the
 * XSRF-TOKEN cookie + X-CSRF-Token response header. Idempotent: when a
 * cookie is already present, we reuse its value instead of rotating on
 * every GET, so the token the SPA already cached stays valid.
 */
const generateCsrfToken = (req, res, next) => {
  let token = req.cookies && req.cookies['XSRF-TOKEN'];
  if (!token || token.length < 32) {
    token = crypto.randomBytes(32).toString('hex');
    res.cookie('XSRF-TOKEN', token, getXsrfCookieOptions());
    // Keep the legacy in-memory store in sync for any code path that still
    // relies on it (the admin csrf-token endpoint regenerates separately).
    try {
      csrfTokenStore.generate(req.user ? req.user._id.toString() : req.ip);
    } catch {
      /* best-effort */
    }
  }

  res.setHeader('X-CSRF-Token', token);
  req.csrfToken = token;
  next();
};

/**
 * Validate CSRF token for state-changing requests using the double-submit
 * pattern: the token in the request (header or body) must match the value
 * carried in the XSRF-TOKEN cookie.
 */
const validateCsrfToken = (req, res, next) => {
  // Skip validation for safe methods.
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // In non-production environments we skip CSRF validation altogether so
  // local iteration isn't blocked by stale cookies after backend restarts.
  // Production cross-site deploy still uses the SameSite=None auth cookie
  // for session security; the double-submit check below is the additional
  // CSRF defense in depth.
  if (String(process.env.NODE_ENV || '').toLowerCase() !== 'production') {
    return next();
  }

  // Skip validation for webhook endpoints — Razorpay et al. cannot send a
  // browser cookie or our custom header.
  if (req.path && req.path.includes('/webhook')) {
    return next();
  }

  // Public marketing endpoints accept unauthenticated POSTs from guests
  // before any cookie is issued.
  if (req.path && /\/promotions\/subscribe(?:\/|$)/.test(req.path)) {
    return next();
  }
  if (req.path && /\/support\/contact(?:\/|$)/.test(req.path)) {
    return next();
  }

  // Auth entry points are guarded by other layers (rate limit, account
  // lockout, password policy). The user has no CSRF cookie yet on the
  // first request to these endpoints, so requiring one would lock new
  // visitors out.
  if (
    req.path &&
    /\/auth\/(register|login|forgot-password|reset-password|resend-verification|verify-email)(?:\/|$)/.test(req.path)
  ) {
    return next();
  }

  // Read the token from header / body and the trusted copy from the cookie.
  const cookieToken =
    req.cookies && req.cookies['XSRF-TOKEN'] ? String(req.cookies['XSRF-TOKEN']) : null;

  let submittedToken = null;
  if (req.body && req.body._csrf) submittedToken = String(req.body._csrf);
  if (!submittedToken && req.headers['x-csrf-token']) {
    submittedToken = String(req.headers['x-csrf-token']);
  }

  if (!cookieToken || !submittedToken) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_TOKEN_MISSING',
        message: 'CSRF token is missing',
      },
    });
  }

  if (!safeEqual(cookieToken, submittedToken)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_TOKEN_INVALID',
        message: 'CSRF token is invalid',
      },
    });
  }

  req.csrfToken = cookieToken;
  next();
};

/**
 * Revoke CSRF token on logout. Clears the XSRF-TOKEN cookie using the same
 * options it was set with so the browser actually discards it.
 */
const revokeCsrfToken = (req, res, next) => {
  res.clearCookie('XSRF-TOKEN', getXsrfCookieOptions());
  next();
};

module.exports = {
  generateCsrfToken,
  validateCsrfToken,
  revokeCsrfToken,
};
