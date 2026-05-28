/**
 * CSRF helper — reads the `XSRF-TOKEN` cookie set by the backend on GET
 * requests and produces fetch options that pass it back as the
 * `X-CSRF-Token` header on state-changing requests.
 *
 * Why this file exists:
 *   The backend runs `validateCsrfToken` on POST / PUT / DELETE / PATCH in
 *   production. The middleware accepts the token from a header, a body
 *   field, or the `XSRF-TOKEN` cookie. To keep auth flows working across
 *   different cookie storage policies (and to make CORS preflight
 *   well-defined), we always echo the token back in the
 *   `X-CSRF-Token` header on mutations.
 *
 * Public functions:
 *   getCsrfToken()
 *     Returns the current XSRF-TOKEN cookie value (or null on the server
 *     during SSR / when the cookie has not been issued yet).
 *
 *   withCsrf(options, { method })
 *     Returns a shallow-copied fetch options object with `credentials:
 *     "include"` and the `X-CSRF-Token` header set when the request method
 *     is mutating (POST / PUT / DELETE / PATCH). Safe to call for GET too;
 *     it will pass through unchanged.
 */

/**
 * Read a cookie value by name from `document.cookie`. Returns null in a
 * non-browser environment (SSR) or when the cookie is missing.
 */
const readCookie = (name) => {
  if (typeof document === "undefined") return null;
  const target = name + "=";
  const parts = document.cookie ? document.cookie.split(";") : [];
  for (let i = 0; i < parts.length; i++) {
    const c = parts[i].trim();
    if (c.indexOf(target) === 0) {
      return decodeURIComponent(c.substring(target.length));
    }
  }
  return null;
};

/**
 * Public: read the current CSRF token. Returns null if it isn't issued yet
 * (e.g. before any GET request in this browser session).
 */
export const getCsrfToken = () => readCookie("XSRF-TOKEN");

const MUTATING = new Set(["POST", "PUT", "DELETE", "PATCH"]);

/**
 * Wrap a fetch options object. Always sets `credentials: "include"` so the
 * auth cookie is sent. For mutating methods, attaches `X-CSRF-Token` from
 * the XSRF-TOKEN cookie if present.
 *
 * Usage:
 *   await fetch(apiUrl("/api/orders"), withCsrf({
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify(payload),
 *   }));
 */
export const withCsrf = (options = {}) => {
  const method = String(options.method || "GET").toUpperCase();
  const next = {
    ...options,
    credentials: options.credentials || "include",
    headers: { ...(options.headers || {}) },
  };

  if (MUTATING.has(method)) {
    const token = getCsrfToken();
    if (token && !next.headers["X-CSRF-Token"] && !next.headers["x-csrf-token"]) {
      next.headers["X-CSRF-Token"] = token;
    }
  }

  return next;
};

/**
 * Drop-in replacement for the global `fetch` that automatically applies
 * `withCsrf` to the second argument. Use this anywhere we previously called
 * `fetch(apiUrl(...), { ... })` for a state-changing request — the call
 * site just swaps `fetch` for `csrfFetch` and CSRF + credentials are
 * handled. Safe for GET / HEAD too (passes through unchanged).
 */
export const csrfFetch = (input, init) => fetch(input, withCsrf(init || {}));
