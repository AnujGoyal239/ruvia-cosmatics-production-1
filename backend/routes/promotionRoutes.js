const express = require('express');
const router = express.Router();

const { protect, admin } = require('../middleware/authMiddleware');
const {
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  validatePromotion,
  subscribeNewsletter,
  listActivePromotions,
} = require('../controllers/promotionController');

// Public validation endpoint (useful for checkout UI)
router.get('/validate/:code', validatePromotion);

// Public listing of active promotions. Used by the checkout coupon picker so
// customers can see (and click to apply) all currently-valid offers.
router.get('/active', listActivePromotions);

// Public newsletter subscribe — no auth, no CSRF token needed. Returns the
// welcome coupon code in the response and emails it to the subscriber.
router.post('/subscribe', subscribeNewsletter);

// Admin CRUD
router.get('/', protect, admin, listPromotions);
router.post('/', protect, admin, createPromotion);
router.put('/:id', protect, admin, updatePromotion);
router.delete('/:id', protect, admin, deletePromotion);

module.exports = router;

