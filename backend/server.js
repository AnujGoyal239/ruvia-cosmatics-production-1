const express = require('express');
const dotenv = require('dotenv');

// Load environment variables as early as possible
dotenv.config();

// Validate required environment variables
const { validateEnvVars } = require('./config/envValidation');
validateEnvVars();

const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { sanitizeRequest } = require('./middleware/sanitizeMiddleware');
const { requestTimingMiddleware } = require('./middleware/requestTimingMiddleware');
const { apiVersionMiddleware } = require('./middleware/apiVersionMiddleware');
const { createRequestLogger } = require('./middleware/requestLoggingMiddleware');
const { validateCsrfToken, generateCsrfToken } = require('./middleware/csrfMiddleware');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const cartRoutes = require('./routes/cartRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const returnRoutes = require('./routes/returnRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const adminRoutes = require('./routes/adminRoutes');
const promotionRoutes = require('./routes/promotionRoutes');
const supportRoutes = require('./routes/supportRoutes');
const { protect } = require('./middleware/authMiddleware');
const { getOrderTracking } = require('./controllers/orderController');

// Connect to database
connectDB();

const app = express();

// Trust the first proxy in front of the app (e.g., load balancer, reverse proxy).
// Required so req.secure and req.headers['x-forwarded-proto'] reflect the real client protocol.
app.set('trust proxy', 1);

// HTTP -> HTTPS redirect (production only)
// Permanently redirect any non-HTTPS request to its HTTPS equivalent. Skipped in
// development/test so local HTTP workflows still work. Must run before any other
// middleware so insecure requests never reach downstream handlers.
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const isHttps = req.secure || forwardedProto === 'https';

  if (isHttps) {
    return next();
  }

  const host = req.headers.host;
  if (!host) {
    return next();
  }

  return res.redirect(301, `https://${host}${req.originalUrl}`);
});

// Security middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'https:', 'data:'],
      frameAncestors: ["'none'"],
      reportUri: ['/api/csp-report'],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));

// Dev/ops timing logs (disabled by default; enable with LOG_REQUESTS=true)
app.use(requestTimingMiddleware({ slowMs: 500 }));

// Request logging middleware
app.use(createRequestLogger({ env: process.env.NODE_ENV }));

// API version middleware
app.use(apiVersionMiddleware);

// Parse cookies
app.use(cookieParser());

// Sanitize request body, query, and params to prevent NoSQL injection
app.use(sanitizeRequest);

// CORS allowlist.
// `CORS_ORIGINS` is a comma-separated list of allowed origins. Each entry can
// be a literal origin (`https://ruvia.example.com`) or a wildcard pattern
// (`https://*.vercel.app`). Wildcards are matched as-glob: `*` matches any
// non-`/`-containing substring, anchored to the full origin.
const compileOriginMatcher = (entry) => {
  const trimmed = String(entry || '').trim();
  if (!trimmed) return null;
  if (!trimmed.includes('*')) {
    return (origin) => origin === trimmed;
  }
  // Escape regex specials except `*`, then turn `*` into `[^/]*`. Anchor.
  const escaped = trimmed.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  const re = new RegExp('^' + escaped + '$');
  return (origin) => re.test(origin);
};

const allowedOriginMatchers = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(compileOriginMatcher)
  .filter(Boolean);

const isOriginAllowed = (origin) => {
  // Same-origin / curl / server-to-server requests have no Origin header —
  // CORS doesn't apply to them. Allow through.
  if (!origin) return true;
  return allowedOriginMatchers.some((m) => m(origin));
};

const corsOptions = {
  origin: function (origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      // Returning `false` (instead of an Error) tells the cors package to
      // simply omit the Access-Control-Allow-Origin header. The browser
      // already blocks the response, and we don't pollute server logs with
      // 500 errors for routine cross-origin probes.
      callback(null, false);
    }
  },
  credentials: true,
  // Expose the CSRF token to the SPA. Without this, the browser hides the
  // header from JavaScript on cross-origin responses, so the SPA can't
  // mirror it back on subsequent mutations and every CSRF check fails.
  exposedHeaders: ['X-CSRF-Token'],
};
app.use(cors(corsOptions));

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Next.js dev + React StrictMode can trigger extra requests (double-invoked effects).
  // Keep production strict, but be more permissive in development to avoid blocking local testing.
  max: process.env.NODE_ENV === 'production' ? 200 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res /*, next */) => {
    // Always return JSON so the frontend can parse errors safely.
    res.status(429).json({
      message: 'Too many requests, please try again later.',
    });
  },
});
app.use(limiter);

// CSRF protection middleware (validate on state-changing requests)
app.use(validateCsrfToken);

// Webhook endpoint: use raw body parser to verify signature exactly
const paymentController = require('./controllers/paymentController');
const { webhookRateLimiter } = require('./middleware/paymentRateLimiter');
app.post('/api/payments/razorpay/webhook', webhookRateLimiter, express.raw({ type: 'application/json' }), paymentController.handleRazorpayWebhook);

// Body parser for regular JSON routes
app.use(express.json());

// CSRF token generation middleware (for GET requests)
app.use(generateCsrfToken);

// Mount Routes with /api/v1/ prefix
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/orders', orderRoutes);
// Safety net: ensure tracking endpoint exists even if router isn't refreshed
app.get('/api/v1/orders/:id/tracking', protect, getOrderTracking);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/returns', returnRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/promotions', promotionRoutes);
app.use('/api/v1/support', supportRoutes);

// Legacy unversioned aliases.
// The frontend currently calls `/api/*` (e.g. `/api/auth/me`, `/api/products`).
// Keep these mounts so the existing client keeps working alongside the
// versioned `/api/v1/*` paths.
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.get('/api/orders/:id/tracking', protect, getOrderTracking);
app.use('/api/payments', paymentRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/support', supportRoutes);

// CSP violation report endpoint
const { cspViolationHandler } = require('./middleware/cspViolationMiddleware');
app.post('/api/csp-report', express.json(), cspViolationHandler);

// Swagger API documentation
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  swaggerOptions: {
    url: '/api-docs.json',
  },
}));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Routes
app.get('/', (req, res) => {
  res.send('Ruvia Cosmetics API is running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Centralized error handler (last middleware)
const { errorHandler } = require('./middleware/errorMiddleware');
app.use(errorHandler);
