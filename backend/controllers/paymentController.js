const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/orderModel');
const auditLogger = require('../utils/auditLogger');

// Timeout (ms) for external Razorpay API calls
const RAZORPAY_API_TIMEOUT_MS = 5000;

/**
 * Wrap a promise with a timeout. If the promise does not settle within `ms`
 * milliseconds, the returned promise rejects with a TimeoutError carrying
 * `code: 'TIMEOUT'`.
 *
 * @param {Promise} promise - The promise to race against the timeout
 * @param {number} ms - Timeout in milliseconds
 * @param {string} label - A label used in the error message for diagnostics
 * @returns {Promise} A promise that resolves with the original value or rejects on timeout
 */
const withTimeout = (promise, ms, label = 'operation') => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.code = 'TIMEOUT';
      err.name = 'TimeoutError';
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

// Initialize Razorpay if credentials are present
let razorpay = null;
try {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  } else {
    console.warn('Razorpay keys not set — payment creation will be disabled');
  }
} catch (e) {
  console.warn('Razorpay initialization failed:', e.message);
  razorpay = null;
}

// @desc    Create Razorpay Order
// @route   POST /api/payments/razorpay
// @access  Private
const createRazorpayOrder = async (req, res) => {
  const ipAddress = req.ip;
  const userId = req.user?._id;
  try {
    const { orderId } = req.body;
    if (!razorpay) {
      auditLogger.logPayment({
        userId,
        orderId: orderId || null,
        amount: null,
        method: 'Razorpay',
        status: 'failure',
        reason: 'razorpay_not_configured',
        ipAddress,
      });
      return res.status(503).json({ message: 'Payments are disabled (Razorpay not configured)' });
    }
    if (!orderId) {
      auditLogger.logPayment({
        userId,
        orderId: null,
        amount: null,
        method: 'Razorpay',
        status: 'failure',
        reason: 'missing_order_id',
        ipAddress,
      });
      return res.status(400).json({ message: 'orderId is required' });
    }

    const order = await Order.findById(orderId).populate('user', 'email name role');
    if (!order) {
      auditLogger.logPayment({
        userId,
        orderId,
        amount: null,
        method: 'Razorpay',
        status: 'failure',
        reason: 'order_not_found',
        ipAddress,
      });
      return res.status(404).json({ message: 'Order not found' });
    }

    // Authorization check: only order owner or admin can initiate payment
    if (String(order.user?._id) !== String(req.user._id) && req.user.role !== 'admin') {
      auditLogger.logPayment({
        userId,
        orderId,
        amount: Number(order.total || 0),
        method: 'Razorpay',
        status: 'failure',
        reason: 'not_authorized',
        ipAddress,
      });
      return res.status(403).json({ message: 'Not authorized to pay for this order' });
    }

    if (order.isPaid) {
      auditLogger.logPayment({
        userId,
        orderId,
        amount: Number(order.total || 0),
        method: 'Razorpay',
        status: 'failure',
        reason: 'order_already_paid',
        ipAddress,
      });
      return res.status(400).json({ message: 'Order is already paid' });
    }

    const amount = Number(order.total || 0);
    if (!amount || amount <= 0) {
      auditLogger.logPayment({
        userId,
        orderId,
        amount,
        method: 'Razorpay',
        status: 'failure',
        reason: 'invalid_amount',
        ipAddress,
      });
      return res.status(400).json({ message: 'Invalid order amount' });
    }

    const options = {
      amount: Math.round(amount * 100), // Razorpay expects amount in paise
      currency: 'INR',
      receipt: `receipt_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      notes: { orderId: orderId || '' }
    };

    const rpOrder = await withTimeout(
      razorpay.orders.create(options),
      RAZORPAY_API_TIMEOUT_MS,
      'razorpay.orders.create'
    );
    if (!rpOrder) {
      auditLogger.logPayment({
        userId,
        orderId,
        amount,
        method: 'Razorpay',
        status: 'failure',
        reason: 'razorpay_order_creation_failed',
        ipAddress,
      });
      return res.status(500).json({ message: 'Failed to create Razorpay order' });
    }

    // Save the razorpay order id on that order for reconciliation
    try {
      await Order.findByIdAndUpdate(orderId, {
        $set: {
          'paymentResult.razorpay_order_id': rpOrder.id,
          'razorpayOrderId': rpOrder.id
        }
      });
    } catch (e) {
      console.warn('Could not attach razorpay order id to Order', e.message);
    }

    auditLogger.logPayment({
      userId,
      orderId,
      amount,
      method: 'Razorpay',
      status: 'initiated',
      transactionId: rpOrder.id,
      ipAddress,
    });

    res.json({ razorpayOrder: rpOrder, key: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    console.error('createRazorpayOrder error', error);

    // Handle timeout errors gracefully - return 504 Gateway Timeout
    if (error && (error.code === 'TIMEOUT' || error.name === 'TimeoutError')) {
      auditLogger.logPayment({
        userId,
        orderId: req.body?.orderId || null,
        amount: null,
        method: 'Razorpay',
        status: 'failure',
        reason: 'razorpay_timeout',
        ipAddress,
      });
      return res.status(504).json({
        success: false,
        error: {
          code: 'GATEWAY_TIMEOUT',
          message: 'Payment provider did not respond in time. Please try again.',
        },
      });
    }

    auditLogger.logPayment({
      userId,
      orderId: req.body?.orderId || null,
      amount: null,
      method: 'Razorpay',
      status: 'failure',
      reason: error.message || 'unknown_error',
      ipAddress,
    });
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify Razorpay Payment signature
// @route   POST /api/payments/razorpay/verify
// @access  Private
const verifyRazorpayPayment = async (req, res) => {
  const ipAddress = req.ip;
  const userId = req.user?._id;
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      auditLogger.logPayment({
        userId,
        orderId: orderId || null,
        amount: null,
        method: 'Razorpay',
        status: 'failure',
        reason: 'missing_parameters',
        ipAddress,
      });
      return res.status(400).json({ message: 'Missing parameters' });
    }

    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(sign.toString()).digest('hex');

    if (razorpay_signature !== expectedSign) {
      auditLogger.logPayment({
        userId,
        orderId: orderId || null,
        amount: null,
        method: 'Razorpay',
        status: 'failure',
        reason: 'invalid_signature',
        transactionId: razorpay_payment_id,
        ipAddress,
      });
      return res.status(400).json({ message: 'Invalid signature' });
    }

    // Mark order as paid
    let order;
    if (orderId) order = await Order.findById(orderId);
    if (!order) order = await Order.findOne({ 'paymentResult.razorpay_order_id': razorpay_order_id }) || await Order.findOne({ razorpayOrderId: razorpay_order_id });

    if (order) {
      // Verify user owns the order
      if (String(order.user) !== String(req.user._id) && req.user.role !== 'admin') {
        auditLogger.logPayment({
          userId,
          orderId: order._id,
          amount: Number(order.total || 0),
          method: 'Razorpay',
          status: 'failure',
          reason: 'not_authorized',
          transactionId: razorpay_payment_id,
          ipAddress,
        });
        return res.status(403).json({ message: 'Not authorized' });
      }

      order.isPaid = true;
      order.paidAt = Date.now();
      order.paymentResult = {
        id: razorpay_payment_id,
        status: 'COMPLETED',
        update_time: new Date().toISOString(),
        email_address: order.user?.email || ''
      };
      await order.save();

      auditLogger.logPayment({
        userId,
        orderId: order._id,
        amount: Number(order.total || 0),
        method: 'Razorpay',
        status: 'success',
        transactionId: razorpay_payment_id,
        ipAddress,
      });
    } else {
      auditLogger.logPayment({
        userId,
        orderId: orderId || null,
        amount: null,
        method: 'Razorpay',
        status: 'failure',
        reason: 'order_not_found',
        transactionId: razorpay_payment_id,
        ipAddress,
      });
    }

    res.json({ message: 'Payment verified and order updated', orderId: order ? order._id : null });
  } catch (error) {
    console.error('verifyRazorpayPayment error', error);
    auditLogger.logPayment({
      userId,
      orderId: req.body?.orderId || null,
      amount: null,
      method: 'Razorpay',
      status: 'failure',
      reason: error.message || 'unknown_error',
      transactionId: req.body?.razorpay_payment_id || null,
      ipAddress,
    });
    res.status(500).json({ message: error.message });
  }
};

// Razorpay webhook handler with idempotency and timestamp validation
const WebhookEvent = require('../models/webhookEventModel');
const handleRazorpayWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    let raw = req.body;

    // Validate timestamp (5 minute window)
    const timestamp = req.headers['x-razorpay-timestamp'];
    if (!timestamp) {
      return res.status(400).json({ message: 'Missing timestamp' });
    }

    const now = Math.floor(Date.now() / 1000);
    const webhookTime = parseInt(timestamp, 10);
    const timeDiff = Math.abs(now - webhookTime);

    if (timeDiff > 300) { // 5 minute window
      console.warn('Webhook timestamp too old:', timeDiff, 'seconds');
      return res.status(400).json({ message: 'Webhook expired' });
    }

    // Determine raw string to compute signature and hash
    const rawBuffer = Buffer.isBuffer(raw) ? raw : Buffer.from(JSON.stringify(raw || {}));
    const rawHash = crypto.createHash('sha256').update(rawBuffer).digest('hex');

    // Idempotency: if we've already processed this exact payload hash, return 200
    const exists = await WebhookEvent.findOne({ hash: rawHash });
    if (exists) {
      console.log('Duplicate webhook received:', rawHash);
      return res.json({ ok: true });
    }

    // Verify signature
    const signature = req.headers['x-razorpay-signature'];
    const expected = crypto.createHmac('sha256', secret).update(rawBuffer).digest('hex');
    if (expected !== signature) {
      console.warn('Invalid webhook signature');
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const payload = JSON.parse(rawBuffer.toString('utf8'));
    // Process payload
    await processRazorpayPayload(payload, rawHash, req.ip);

    // Record processed hash
    try {
      await WebhookEvent.create({ hash: rawHash, event: payload.event });
    } catch (e) {
      console.warn('Could not record webhook event hash', e.message);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Razorpay webhook error', err);
    res.status(500).json({ message: 'Webhook handling failed' });
  }
};

// Helper to process parsed Razorpay payload and reconcile orders
const processRazorpayPayload = async (payload, rawHash, ipAddress) => {
  try {
    const event = payload.event;
    const paymentEntity = payload?.payload?.payment?.entity;
    const orderEntity = payload?.payload?.order?.entity;

    const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id;
    const notesOrderId = orderEntity?.notes?.orderId || null;

    // Try to find our internal Order
    let order = null;
    if (notesOrderId) {
      const OrderModel = require('../models/orderModel');
      order = await OrderModel.findById(notesOrderId);
    }
    if (!order && razorpayOrderId) {
      const OrderModel = require('../models/orderModel');
      order = await OrderModel.findOne({ razorpayOrderId: razorpayOrderId }) || await OrderModel.findOne({ 'paymentResult.razorpay_order_id': razorpayOrderId });
    }

    if (!order) {
      console.log('Razorpay webhook: could not find internal Order for', razorpayOrderId || notesOrderId);
      auditLogger.logPayment({
        userId: null,
        orderId: notesOrderId || null,
        amount: paymentEntity?.amount ? paymentEntity.amount / 100 : null,
        method: 'Razorpay',
        status: 'failure',
        reason: 'webhook_order_not_found',
        transactionId: paymentEntity?.id || null,
        ipAddress,
      });
      return;
    }

    // For successful payment events, mark order paid
    if (event && (event === 'payment.captured' || event === 'payment.authorized' || event === 'order.paid')) {
      order.isPaid = true;
      order.paidAt = Date.now();
      order.paymentResult = {
        id: paymentEntity?.id || '',
        status: paymentEntity?.status || 'captured',
        update_time: new Date().toISOString(),
        email_address: order.user?.email || ''
      };
      await order.save();
      console.log('Order marked paid via Razorpay webhook:', order._id.toString());

      auditLogger.logPayment({
        userId: order.user?._id || order.user,
        orderId: order._id,
        amount: Number(order.total || 0),
        method: 'Razorpay',
        status: 'success',
        transactionId: paymentEntity?.id || null,
        reason: `webhook:${event}`,
        ipAddress,
      });
    }
  } catch (err) {
    console.error('processRazorpayPayload error', err);
  }
};

// @desc    Diagnostic: report Razorpay credential health (no secrets leaked)
// @route   GET /api/payments/razorpay/diag
// @access  Public (safe — only reveals length, prefix, suffix, and char codes of edge characters)
const razorpayDiag = async (req, res) => {
  const id = process.env.RAZORPAY_KEY_ID || '';
  const secret = process.env.RAZORPAY_KEY_SECRET || '';

  const charProfile = (s) => {
    if (!s) return null;
    return {
      length: s.length,
      first6: s.slice(0, 6),
      last4: s.slice(-4),
      // List char codes for every position so we can detect look-alike chars
      // (e.g. capital-I 73 vs lowercase-l 108 vs digit-1 49)
      charCodes: Array.from(s).map((c, i) => ({ i, c, code: c.charCodeAt(0) })),
      hasLeadingSpace: /^\s/.test(s),
      hasTrailingSpace: /\s$/.test(s),
      hasInternalWhitespace: /\s/.test(s.trim()),
    };
  };

  res.json({
    initialized: !!razorpay,
    keyId: charProfile(id),
    keySecretMeta: secret
      ? {
          length: secret.length,
          first2: secret.slice(0, 2),
          last2: secret.slice(-2),
          hasLeadingSpace: /^\s/.test(secret),
          hasTrailingSpace: /\s$/.test(secret),
        }
      : null,
  });
};

module.exports = {
  createRazorpayOrder,
  verifyRazorpayPayment,
  handleRazorpayWebhook,
  razorpayDiag,
};
