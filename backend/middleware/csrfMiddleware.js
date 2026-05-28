const csrfTokenStore = require('../utils/csrfTokenStore');

/**
 * CSRF Protection Middleware
 * Generates CSRF tokens for GET requests and validates them for state-changing requests.
 * Uses the double-submit cookie pattern: the token is mirrored in a
 * non-httpOnly cookie that the frontend reads and echoes back via
 * `X-CSRF-Token` on every mutation.
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
 * Generate CSRF token for a session
 * Called on GET requests to form pages
 */
const generateCsrfToken = (req, res, next) => {
  // Generate session ID from user ID or IP address
  const sessionId = req.user ? req.user._id.toString() : req.ip;
  
  // Generate new CSRF token
  const token = csrfTokenStore.generate(sessionId);
  
  // Store session ID in request for later use
  req.sessionId = sessionId;
  req.csrfToken = token;
  
  // Set CSRF token in response header
  res.setHeader('X-CSRF-Token', token);
  
  // Set CSRF token in cookie. SameSite policy is computed per-environment
  // so cross-site Vercel <-> Render deploys can actually read/send it.
  res.cookie('XSRF-TOKEN', token, getXsrfCookieOptions());
  
  next();
};

/**
 * Validate CSRF token for state-changing requests
 * Checks token from request body, headers, or cookies
 */
const validateCsrfToken = (req, res, next) => {
  // Skip validation for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // In non-production environments the in-memory token store is wiped on
  // every backend restart, which makes prior browser cookies stale and
  // produces confusing 403s during local development. The real CSRF
  // protection in this app is the auth JWT cookie's `SameSite=Strict`
  // setting, so skip this layer outside production to avoid spurious
  // failures while iterating locally.
  if (String(process.env.NODE_ENV || '').toLowerCase() !== 'production') {
    return next();
  }

  // Skip validation for webhook endpoints
  if (req.path && req.path.includes('/webhook')) {
    return next();
  }

  // Skip validation for public marketing endpoints that intentionally accept
  // unauthenticated POSTs from guests (e.g. newsletter subscribe). The
  // browser hasn't been issued a CSRF cookie yet at the moment of the first
  // submission, so requiring one would lock guests out of the home page form.
  if (req.path && /\/promotions\/subscribe(?:\/|$)/.test(req.path)) {
    return next();
  }

  // Same exemption for the public support contact form. Visitors hit it
  // before any session/CSRF cookie has been issued.
  if (req.path && /\/support\/contact(?:\/|$)/.test(req.path)) {
    return next();
  }

  // Auth entry points (register / login / password reset) — the user does
  // not yet have a CSRF token at this point, so requiring one would lock
  // every new visitor out. These endpoints are still defended by:
  //   - global rate limiter (200 req / 15 min in production)
  //   - per-account 5-attempt lockout on login (see authMiddleware)
  //   - bcrypt-hashed credentials and email verification flow
  //   - SameSite=Strict on the auth cookie itself
  // Do NOT add other state-changing endpoints to this list — they should
  // continue to require a CSRF token.
  if (req.path && /\/auth\/(register|login|forgot-password|reset-password|resend-verification|verify-email)(?:\/|$)/.test(req.path)) {
    return next();
  }
  
  // Get session ID from user ID or IP address
  const sessionId = req.user ? req.user._id.toString() : req.ip;
  
  // Try to get CSRF token from multiple sources
  let token = null;
  
  // 1. Check request body (for form submissions)
  if (req.body && req.body._csrf) {
    token = req.body._csrf;
  }
  
  // 2. Check X-CSRF-Token header (for AJAX requests)
  if (!token && req.headers['x-csrf-token']) {
    token = req.headers['x-csrf-token'];
  }
  
  // 3. Check XSRF-TOKEN cookie
  if (!token && req.cookies && req.cookies['XSRF-TOKEN']) {
    token = req.cookies['XSRF-TOKEN'];
  }
  
  // If no token found, return 403 Forbidden
  if (!token) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_TOKEN_MISSING',
        message: 'CSRF token is missing',
      },
    });
  }
  
  // Validate token
  const isValid = csrfTokenStore.validate(sessionId, token);
  
  if (!isValid) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_TOKEN_INVALID',
        message: 'CSRF token is invalid or expired',
      },
    });
  }
  
  // Token is valid, proceed
  req.sessionId = sessionId;
  req.csrfToken = token;
  next();
};

/**
 * Revoke CSRF token on logout
 */
const revokeCsrfToken = (req, res, next) => {
  if (req.sessionId) {
    csrfTokenStore.revoke(req.sessionId);
  }
  
  // Clear CSRF token cookie
  // Match the cookie spec we used when setting it so the browser actually
  // discards it on logout (mismatched SameSite/secure attrs are silently
  // ignored by some browsers).
  res.clearCookie('XSRF-TOKEN', getXsrfCookieOptions());
  
  next();
};

module.exports = {
  generateCsrfToken,
  validateCsrfToken,
  revokeCsrfToken,
};
