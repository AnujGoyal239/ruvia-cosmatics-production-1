const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { createRazorpayOrder, verifyRazorpayPayment, handleRazorpayWebhook } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');
const { paymentInitiationRateLimiter } = require('../middleware/paymentRateLimiter');
const { handleValidationErrors } = require('../middleware/inputValidationMiddleware');

/**
 * Validation for POST /razorpay (payment initiation).
 * The endpoint accepts an `orderId` referencing an existing Order whose total
 * is computed server-side. An optional `amount` may be present in the body
 * (read by `paymentInitiationRateLimiter` for high-value detection); when
 * present we still validate it to keep callers honest.
 */
const validateRazorpayInitiation = [
  body('orderId')
    .exists({ checkFalsy: true })
    .withMessage('orderId is required')
    .bail()
    .isString()
    .withMessage('orderId must be a string')
    .bail()
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('Invalid orderId format'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01, max: 999999 })
    .withMessage('Amount must be a positive number no greater than 999999'),
  body('paymentMethod')
    .optional()
    .isIn(['Razorpay', 'COD', 'UPI'])
    .withMessage('Invalid payment method'),
  body('productId')
    .optional()
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('Invalid productId format'),
  handleValidationErrors,
];

/**
 * Validation for POST /razorpay/verify (signature verification).
 * Razorpay returns these three fields after a successful checkout. They
 * must all be non-empty strings; `orderId` is an optional internal id.
 */
const validateRazorpayVerification = [
  body('razorpay_order_id')
    .exists({ checkFalsy: true })
    .withMessage('razorpay_order_id is required')
    .bail()
    .isString()
    .withMessage('razorpay_order_id must be a string')
    .bail()
    .trim()
    .isLength({ min: 1, max: 128 })
    .withMessage('razorpay_order_id has invalid length'),
  body('razorpay_payment_id')
    .exists({ checkFalsy: true })
    .withMessage('razorpay_payment_id is required')
    .bail()
    .isString()
    .withMessage('razorpay_payment_id must be a string')
    .bail()
    .trim()
    .isLength({ min: 1, max: 128 })
    .withMessage('razorpay_payment_id has invalid length'),
  body('razorpay_signature')
    .exists({ checkFalsy: true })
    .withMessage('razorpay_signature is required')
    .bail()
    .isString()
    .withMessage('razorpay_signature must be a string')
    .bail()
    .trim()
    .isLength({ min: 1, max: 256 })
    .withMessage('razorpay_signature has invalid length'),
  body('orderId')
    .optional()
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('Invalid orderId format'),
  handleValidationErrors,
];

// Initiation: validate body first so malformed requests don't burn rate-limit
// slots, then the rate limiter can still inspect req.body.amount.
router.post(
  '/razorpay',
  protect,
  validateRazorpayInitiation,
  paymentInitiationRateLimiter,
  createRazorpayOrder
);

router.post(
  '/razorpay/verify',
  protect,
  validateRazorpayVerification,
  verifyRazorpayPayment
);

// Webhooks (do not protect with JWT)
// NOTE: webhook route is handled with a raw parser registered in server.js to preserve the exact body

module.exports = router;
