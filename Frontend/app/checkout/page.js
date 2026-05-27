"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { apiUrl } from "../../constants";
import { ArrowLeft, Check, CheckCircle2, ChevronDown, ChevronRight, CreditCard, HelpCircle, MapPin, Plus, ShieldCheck, Smartphone, Tag, User as UserIcon, Wallet, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import ProductImage from "../../components/ui/ProductImage";
import { getSafeRedirectUrl } from "../../utils/redirectValidation";

export default function CheckoutPage() {
  const { user, loading: authLoading, addresses } = useAuth();
  const { cartItems, getCartTotal, closeCart, clearCart } = useCart();
  const router = useRouter();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  
  // Stepper State
  const [activeStep, setActiveStep] = useState(2); // 1: Account, 2: Address, 3: Payment
  
  // Address State
  const [selectedAddressId, setSelectedAddressId] = useState(addresses?.[0]?.id || "");
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [formData, setFormData] = useState({ firstName: "", lastName: "", phone: "", address: "", city: "", pin: "" });

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState("upi"); // upi, card, cod
  const [paymentData, setPaymentData] = useState({ upiId: "", cardNumber: "", expiry: "", cvv: "", cardName: "" });

  // Coupon / promo state (server-authoritative pricing via /api/orders/quote)
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null); // { code, type, ... }
  const [quote, setQuote] = useState(null); // { subtotal, discount, gst, shippingFee, total }
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  // Available coupons surfaced to the user inside the Apply Coupon modal.
  // Loaded from `/api/promotions/active` the first time the modal opens, so
  // we don't add a request on every checkout view.
  const [availableCoupons, setAvailableCoupons] = useState(null); // null = not loaded yet
  const [couponsLoading, setCouponsLoading] = useState(false);

  useEffect(() => {
    if (!couponOpen) return;
    if (availableCoupons !== null) return;
    let cancelled = false;
    (async () => {
      try {
        setCouponsLoading(true);
        const res = await fetch(apiUrl("/api/promotions/active"));
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          // Soft-fail: the manual code-entry path still works.
          setAvailableCoupons([]);
          return;
        }
        setAvailableCoupons(Array.isArray(data?.items) ? data.items : []);
      } catch (err) {
        if (!cancelled) setAvailableCoupons([]);
      } finally {
        if (!cancelled) setCouponsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [couponOpen, availableCoupons]);

  useEffect(() => {
    closeCart();
    if (!authLoading && !user) {
      // Validate the post-auth redirect target through the whitelist before
      // embedding it as a query parameter, to prevent open-redirect attacks
      // if this value is ever sourced dynamically in the future.
      const safeRedirect = getSafeRedirectUrl("/checkout", "/checkout");
      router.push(`/auth?redirect=${encodeURIComponent(safeRedirect)}`);
    }
  }, [user, authLoading, router, closeCart]);

  if (authLoading || !user) return null;

  if (cartItems.length === 0 && !success) {
    return (
      <div className="min-h-screen pt-32 pb-20 flex flex-col items-center justify-center text-center bg-[#FDFBF7]">
        <h1 className="font-serif text-4xl font-bold mb-4 text-brand-dark">Your Cart is Empty</h1>
        <p className="text-sm text-brand-dark/50 mb-8 max-w-sm">Looks like you haven't added anything to your cart yet.</p>
        <Link href="/">
          <Button variant="primary" className="px-8 py-3 rounded-md">Continue Shopping</Button>
        </Link>
      </div>
    );
  }

  const validateAddress = () => {
    // If user selected a saved address, validate that it's complete
    if (selectedAddressId && !showNewAddressForm) {
      const addr = addresses.find(a => a.id === selectedAddressId);
      const nextErrors = {};
      if (!addr) nextErrors.address = "Select a delivery address";
      if (addr) {
        if (!String(addr.firstName || "").trim()) nextErrors.firstName = "Required";
        if (!String(addr.lastName || "").trim()) nextErrors.lastName = "Required";
        if (!String(addr.phone || "").trim() || !/^\d{10}$/.test(String(addr.phone || "").trim())) nextErrors.phone = "Enter 10 digit number";
        if (!String(addr.address || "").trim()) nextErrors.address = "Address is required";
        if (!String(addr.city || "").trim()) nextErrors.city = "City is required";
        if (!String(addr.pin || "").trim() || !/^\d{6}$/.test(String(addr.pin || "").trim())) nextErrors.pin = "Enter 6 digit PIN";
      }
      setErrors(nextErrors);
      // If saved address is incomplete, force user to add/edit address
      if (Object.keys(nextErrors).length > 0) {
        toast.error("Please complete your delivery address before placing the order.");
        setActiveStep(2);
        setShowNewAddressForm(true);
        setSelectedAddressId("");
        // Pre-fill what we can
        setFormData({
          firstName: addr?.firstName || "",
          lastName: addr?.lastName || "",
          phone: addr?.phone || "",
          address: addr?.address || "",
          city: addr?.city || "",
          pin: addr?.pin || "",
        });
        return false;
      }
      return true;
    }
    
    let newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = "Required";
    if (!formData.lastName.trim()) newErrors.lastName = "Required";
    if (!formData.phone.trim() || !/^\d{10}$/.test(formData.phone)) newErrors.phone = "Enter 10 digit number";
    if (!formData.address.trim()) newErrors.address = "Address is required";
    if (!formData.city.trim()) newErrors.city = "City is required";
    if (!formData.pin.trim() || !/^\d{6}$/.test(formData.pin)) newErrors.pin = "Enter 6 digit PIN";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePayment = () => {
    let newErrors = {};
    if (paymentMethod === "upi") {
      if (!paymentData.upiId.trim() || !paymentData.upiId.includes("@")) newErrors.upiId = "Enter a valid UPI ID";
    } else if (paymentMethod === "card") {
      if (!paymentData.cardNumber.trim() || paymentData.cardNumber.length < 16) newErrors.cardNumber = "Enter 16 digit card number";
      if (!paymentData.expiry.trim() || !/^\d{2}\/\d{2}$/.test(paymentData.expiry)) newErrors.expiry = "Use MM/YY";
      if (!paymentData.cvv.trim() || paymentData.cvv.length < 3) newErrors.cvv = "Invalid CVV";
      if (!paymentData.cardName.trim()) newErrors.cardName = "Name is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    // Always validate address before placing order
    if (!validateAddress()) return;
    if (paymentMethod !== "cod" && !validatePayment()) return;

    if (!user) {
      toast.error('You must be logged in to place an order');
      return;
    }

    setIsProcessing(true);

    try {
      // Prepare order payload
      const items = cartItems.map(ci => ({ id: ci.id, name: ci.name, price: ci.price, qty: ci.quantity, img: ci.image || ci.img }));
      const orderPaymentMethod = paymentMethod === 'cod' ? 'COD' : (paymentMethod === 'upi' ? 'UPI' : 'Razorpay');

      const shippingAddress = selectedAddressId && !showNewAddressForm
        ? (addresses.find(a => a.id === selectedAddressId) || {})
        : { firstName: formData.firstName, lastName: formData.lastName, phone: formData.phone, address: formData.address, city: formData.city, pin: formData.pin };

      const payload = {
        items,
        shippingAddress,
        paymentMethod: orderPaymentMethod,
        // Pricing is calculated server-side (subtotal, discount/promos, GST, shipping, total).
        promoCode: appliedPromo?.code || undefined,
      };

      const res = await fetch(apiUrl("/api/orders"), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create order');
      }

      // If COD, we're done
      if (paymentMethod === 'cod') {
        setSuccess(true);
        clearCart();
        setIsProcessing(false);
        return;
      }

      // Use Razorpay for card/upi payment flows
      if (paymentMethod === 'card' || paymentMethod === 'upi') {
        // Create Razorpay order on backend and attach internal order id
        const rpRes = await fetch(apiUrl("/api/payments/razorpay"), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: "include",
          body: JSON.stringify({ orderId: data._id }),
        });
        const rpData = await rpRes.json();
        if (!rpRes.ok) throw new Error(rpData.message || 'Razorpay order creation failed');

        // Load Razorpay checkout script
        const loadRazorpay = () => new Promise((resolve) => {
          if (typeof window === 'undefined') return resolve(false);
          if (window.Razorpay) return resolve(true);
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });

        const ok = await loadRazorpay();
        if (!ok) throw new Error('Failed to load Razorpay SDK');

        const options = {
          key: rpData.key,
          amount: rpData.razorpayOrder.amount, // in paise
          currency: rpData.razorpayOrder.currency,
          name: 'Ruvia Cosmetics',
          description: 'Order Payment',
          order_id: rpData.razorpayOrder.id,
          prefill: {
            name: user.name || '',
            email: user.email || '',
            contact: shippingAddress.phone || ''
          },
          handler: async function(response) {
            try {
              // Verify payment on backend
              const verifyRes = await fetch(apiUrl("/api/payments/razorpay/verify"), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: "include",
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  orderId: data._id
                }),
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok) throw new Error(verifyData.message || 'Verification failed');
              setSuccess(true);
              clearCart();
            } catch (err) {
              console.error('Payment verification failed', err);
              toast.error(err.message || 'Payment verification failed');
            } finally {
              setIsProcessing(false);
            }
          },
          modal: {
            ondismiss: function() {
              setIsProcessing(false);
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
        return;
      }

    } catch (err) {
      console.error('Checkout error:', err);
      toast.error(err.message || 'Checkout failed');
      setIsProcessing(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen pt-32 pb-20 flex flex-col items-center justify-center text-center bg-[#FDFBF7]">
        <div className="w-20 h-20 bg-[#52C234]/10 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={40} className="text-[#52C234]" />
        </div>
        <h1 className="font-serif text-4xl font-bold mb-3 text-brand-dark">Order Placed Successfully!</h1>
        <p className="text-sm text-brand-dark/60 mb-8">We've sent a confirmation email to <span className="font-medium text-brand-dark">{user.email}</span>.</p>
        <Link href="/orders">
          <Button variant="primary" className="px-8 py-3 rounded-md">Track Order</Button>
        </Link>
      </div>
    );
  }

  // Client-side estimate (server will compute authoritative totals)
  const localSubtotal = getCartTotal();
  const subtotal = quote?.subtotal ?? localSubtotal;
  const discount = quote?.discount ?? 0;
  const gst = quote?.gst ?? Math.round(Math.max(0, subtotal - discount) * 0.18);
  const shippingFee = quote?.shippingFee ?? (Math.max(0, subtotal - discount) > 500 ? 0 : 50);
  const finalTotal = quote?.total ?? (Math.max(0, subtotal - discount) + gst + shippingFee);

  const applyCoupon = async (codeOverride) => {
    const code = String(codeOverride ?? couponCode ?? "").trim();
    if (!code) {
      setCouponError("Enter a coupon code");
      return;
    }
    setCouponLoading(true);
    setCouponError("");
    try {
      // 1) Validate promo (nice UX messaging)
      const vRes = await fetch(apiUrl(`/api/promotions/validate/${encodeURIComponent(code)}`), {
        credentials: "include",
      });
      const vData = await vRes.json().catch(() => ({}));
      if (!vRes.ok) throw new Error(vData?.message || "Invalid coupon code");

      // 2) Quote totals with promo (server-authoritative)
      const quoteItems = cartItems.map((ci) => ({ id: ci.id, qty: ci.quantity }));
      const qRes = await fetch(apiUrl("/api/orders/quote"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items: quoteItems, promoCode: code }),
      });
      const qData = await qRes.json().catch(() => ({}));
      if (!qRes.ok) throw new Error(qData?.message || "Failed to apply coupon");

      setAppliedPromo({ code: vData.code || code, type: vData.type });
      setQuote(qData);
      setCouponCode(String(vData.code || code).toUpperCase());
      setCouponOpen(false);
      toast.success(`Coupon applied: ${String(vData.code || code).toUpperCase()}`);
    } catch (err) {
      console.error("Apply coupon failed:", err);
      setAppliedPromo(null);
      setQuote(null);
      setCouponError(err?.message || "Failed to apply coupon");
      toast.error(err?.message || "Failed to apply coupon");
    } finally {
      setCouponLoading(false);
    }
  };

  const clearCoupon = () => {
    setAppliedPromo(null);
    setQuote(null);
    setCouponCode("");
    setCouponError("");
    toast("Coupon removed");
  };

  const handleAddressSelect = (id) => {
    setSelectedAddressId(id);
    setShowNewAddressForm(false);
  };

  const handleContinueToPayment = () => {
    if (validateAddress()) {
      setActiveStep(3);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-20 bg-brand-beige/20 font-sans selection:bg-brand-pink/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Branding / Trust Header */}
        <div className="flex justify-between items-center py-4 mb-6 border-b border-brand-dark/10">
          <Link href="/" className="font-serif text-3xl font-bold tracking-tighter text-brand-dark">Ruvia.</Link>
          <div className="hidden sm:flex items-center gap-6 text-[10px] font-black tracking-widest uppercase text-brand-dark/50">
            <span className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-[#52C234]"/> 100% Secure</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-[#52C234]"/> Genuine Products</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left Column: Stepper Flow */}
          <div className="flex-1 space-y-4">
            
            {/* Step 1: Account */}
            <div className={`bg-white border rounded-lg overflow-hidden transition-all duration-300 ${activeStep === 1 ? 'border-brand-pink shadow-[0_4px_20px_-4px_rgba(255,154,158,0.3)]' : 'border-brand-dark/10 shadow-sm'}`}>
              <div className="flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-[#FDFBF7] transition-colors" onClick={() => setActiveStep(1)}>
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${activeStep > 1 ? 'bg-[#52C234]/10 text-[#52C234]' : 'bg-brand-dark text-brand-pink'}`}>
                    {activeStep > 1 ? <Check size={16} /> : "1"}
                  </div>
                  <div>
                    <h2 className="font-serif text-xl font-bold text-brand-dark">Account</h2>
                    {activeStep > 1 && <p className="text-[10px] font-black tracking-widest uppercase text-brand-dark/50 mt-1">{user.name} • {user.email}</p>}
                  </div>
                </div>
                {activeStep > 1 && <Button variant="outline" className="text-[10px] uppercase tracking-widest font-black px-4 py-1.5 rounded-md border-brand-dark/20 text-brand-dark">Change</Button>}
              </div>
              {activeStep === 1 && (
                <div className="px-6 pb-6 pt-2 border-t border-brand-dark/5 bg-white">
                  <p className="text-sm font-medium text-brand-dark/60 mb-4">You are securely logged in.</p>
                  <Button variant="primary" className="rounded-md" onClick={() => setActiveStep(2)}>Continue</Button>
                </div>
              )}
            </div>

            {/* Step 2: Delivery Address */}
            <div className={`bg-white border rounded-lg overflow-hidden transition-all duration-300 ${activeStep === 2 ? 'border-brand-pink shadow-[0_4px_20px_-4px_rgba(255,154,158,0.3)]' : 'border-brand-dark/10 shadow-sm'}`}>
              <div className="flex items-center gap-4 p-4 sm:p-6 cursor-pointer hover:bg-[#FDFBF7] transition-colors" onClick={() => setActiveStep(2)}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${activeStep > 2 ? 'bg-[#52C234]/10 text-[#52C234]' : activeStep === 2 ? 'bg-brand-dark text-brand-pink' : 'bg-brand-dark/5 text-brand-dark/30'}`}>
                  {activeStep > 2 ? <Check size={16} /> : "2"}
                </div>
                <h2 className={`font-serif text-xl font-bold ${activeStep >= 2 ? 'text-brand-dark' : 'text-brand-dark/40'}`}>Delivery Address</h2>
              </div>
              
              {activeStep === 2 && (
                <div className="px-4 sm:px-6 pb-6 pt-2 border-t border-brand-dark/5 bg-white">
                  
                  {/* Saved Addresses Grid */}
                  {addresses && addresses.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      {addresses.map((addr) => (
                        <div 
                          key={addr.id} 
                          onClick={() => handleAddressSelect(addr.id)}
                          className={`relative border rounded-lg p-5 cursor-pointer transition-colors ${selectedAddressId === addr.id && !showNewAddressForm ? 'border-brand-pink bg-brand-pink/5' : 'border-brand-dark/10 hover:border-brand-dark/30 bg-[#FDFBF7]'}`}
                        >
                          {selectedAddressId === addr.id && !showNewAddressForm && (
                            <div className="absolute top-4 right-4 text-[#52C234]"><CheckCircle2 size={18} className="fill-[#52C234]/10"/></div>
                          )}
                          <p className="font-serif text-lg font-bold text-brand-dark mb-1">{addr.firstName} {addr.lastName}</p>
                          <p className="text-sm font-medium text-brand-dark/60 leading-snug mb-3 pr-6 line-clamp-2">
                            {addr.address}, {addr.city}, {addr.pin}
                          </p>
                          <p className="text-[10px] tracking-widest uppercase font-black text-brand-dark/50">Mobile: <span className="text-brand-dark">{addr.phone}</span></p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Address Toggle */}
                  <button 
                    onClick={() => { setShowNewAddressForm(true); setSelectedAddressId(""); }}
                    className={`flex items-center gap-2 text-[10px] font-black tracking-widest uppercase text-brand-pink hover:text-brand-dark transition-colors mb-6 ${showNewAddressForm ? 'hidden' : 'block'}`}
                  >
                    <Plus size={16} /> Add New Address
                  </button>

                  {/* New Address Form */}
                  {(showNewAddressForm || addresses?.length === 0) && (
                    <div className="bg-[#FDFBF7] p-5 rounded-lg border border-brand-dark/10 mb-6 space-y-4 shadow-inner shadow-brand-dark/2">
                      <h3 className="font-bold text-brand-dark text-sm mb-2">Enter new delivery address</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <input 
                            type="text" 
                            placeholder="First Name" 
                            className={`w-full px-4 py-2.5 bg-white border rounded-md text-sm focus:border-brand-pink focus:ring-1 focus:ring-brand-pink outline-none transition-all ${errors.firstName ? 'border-red-400' : 'border-brand-dark/10'}`}
                            value={formData.firstName}
                            onChange={(e) => {
                              setFormData({...formData, firstName: e.target.value});
                              if (errors.firstName) setErrors({...errors, firstName: ""});
                            }}
                          />
                          {errors.firstName && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.firstName}</p>}
                        </div>
                        <div className="space-y-1">
                          <input 
                            type="text" 
                            placeholder="Last Name" 
                            className={`w-full px-4 py-2.5 bg-white border rounded-md text-sm focus:border-brand-pink focus:ring-1 focus:ring-brand-pink outline-none transition-all ${errors.lastName ? 'border-red-400' : 'border-brand-dark/10'}`}
                            value={formData.lastName}
                            onChange={(e) => {
                              setFormData({...formData, lastName: e.target.value});
                              if (errors.lastName) setErrors({...errors, lastName: ""});
                            }}
                          />
                          {errors.lastName && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.lastName}</p>}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <input 
                          type="tel" 
                          placeholder="Mobile Number (10 digits)" 
                          className={`w-full px-4 py-2.5 bg-white border rounded-md text-sm focus:border-brand-pink focus:ring-1 focus:ring-brand-pink outline-none transition-all ${errors.phone ? 'border-red-400' : 'border-brand-dark/10'}`}
                          value={formData.phone}
                          onChange={(e) => {
                            setFormData({...formData, phone: e.target.value});
                            if (errors.phone) setErrors({...errors, phone: ""});
                          }}
                        />
                        {errors.phone && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.phone}</p>}
                      </div>
                      <div className="space-y-1">
                        <input 
                          type="text" 
                          placeholder="Flat, House no., Building, Company, Apartment" 
                          className={`w-full px-4 py-2.5 bg-white border rounded-md text-sm focus:border-brand-pink focus:ring-1 focus:ring-brand-pink outline-none transition-all ${errors.address ? 'border-red-400' : 'border-brand-dark/10'}`}
                          value={formData.address}
                          onChange={(e) => {
                            setFormData({...formData, address: e.target.value});
                            if (errors.address) setErrors({...errors, address: ""});
                          }}
                        />
                        {errors.address && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.address}</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <input 
                            type="text" 
                            placeholder="City" 
                            className={`w-full px-4 py-2.5 bg-white border rounded-md text-sm focus:border-brand-pink focus:ring-1 focus:ring-brand-pink outline-none transition-all ${errors.city ? 'border-red-400' : 'border-brand-dark/10'}`}
                            value={formData.city}
                            onChange={(e) => {
                              setFormData({...formData, city: e.target.value});
                              if (errors.city) setErrors({...errors, city: ""});
                            }}
                          />
                          {errors.city && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.city}</p>}
                        </div>
                        <div className="space-y-1">
                          <input 
                            type="text" 
                            placeholder="PIN Code" 
                            className={`w-full px-4 py-2.5 bg-white border rounded-md text-sm focus:border-brand-pink focus:ring-1 focus:ring-brand-pink outline-none transition-all ${errors.pin ? 'border-red-400' : 'border-brand-dark/10'}`}
                            value={formData.pin}
                            onChange={(e) => {
                              setFormData({...formData, pin: e.target.value});
                              if (errors.pin) setErrors({...errors, pin: ""});
                            }}
                          />
                          {errors.pin && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.pin}</p>}
                        </div>
                      </div>
                    </div>
                  )}

                  <Button variant="primary" className="rounded-md w-full sm:w-auto px-8" onClick={handleContinueToPayment}>Deliver Here</Button>
                </div>
              )}
            </div>

            {/* Step 3: Payment */}
            <div className={`bg-white border rounded-lg overflow-hidden transition-all duration-300 ${activeStep === 3 ? 'border-brand-pink shadow-[0_4px_20px_-4px_rgba(255,154,158,0.3)]' : 'border-brand-dark/10 shadow-sm'}`}>
              <div className="flex items-center gap-4 p-4 sm:p-6 hover:bg-[#FDFBF7] transition-colors cursor-pointer" onClick={() => activeStep >= 3 && setActiveStep(3)}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${activeStep === 3 ? 'bg-brand-dark text-brand-pink' : 'bg-brand-dark/5 text-brand-dark/30'}`}>
                  3
                </div>
                <h2 className={`font-serif text-xl font-bold ${activeStep === 3 ? 'text-brand-dark' : 'text-brand-dark/40'}`}>Payment Options</h2>
              </div>
              
              {activeStep === 3 && (
                <div className="px-4 sm:px-6 pb-6 pt-2 border-t border-brand-dark/5 bg-white">
                  <div className="border border-brand-dark/10 rounded-lg overflow-hidden">
                    
                    {/* UPI Option */}
                    <div className="border-b border-brand-dark/10">
                      <label className={`flex items-center p-5 cursor-pointer hover:bg-[#FDFBF7] transition-colors ${paymentMethod === 'upi' ? 'bg-brand-pink/10' : ''}`}>
                        <input type="radio" name="payment" value="upi" checked={paymentMethod === 'upi'} onChange={() => setPaymentMethod('upi')} className="w-4 h-4 text-brand-dark focus:ring-brand-pink border-brand-dark/20 accent-brand-dark" />
                        <div className="ml-3 flex items-center gap-3">
                          <Smartphone size={20} className={paymentMethod === 'upi' ? 'text-brand-pink' : 'text-brand-dark/50'}/>
                          <span className="font-bold text-sm text-brand-dark">UPI App or ID</span>
                        </div>
                      </label>
                      {paymentMethod === 'upi' && (
                        <div className="p-5 bg-brand-pink/5 pl-12 border-t border-brand-pink/10">
                          <p className="text-xs font-medium text-brand-dark/60 mb-4">Enter your UPI ID or select an app.</p>
                          <input 
                            type="text" 
                            placeholder="e.g. username@upi" 
                            className={`w-full sm:w-2/3 px-4 py-3 mb-1 bg-white border rounded-md text-sm focus:border-brand-pink focus:ring-1 focus:ring-brand-pink outline-none transition-all ${errors.upiId ? 'border-red-400' : 'border-brand-dark/10'}`}
                            value={paymentData.upiId}
                            onChange={(e) => {
                              setPaymentData({...paymentData, upiId: e.target.value});
                              if (errors.upiId) setErrors({...errors, upiId: ""});
                            }}
                          />
                          {errors.upiId && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1 mb-4">{errors.upiId}</p>}
                          <div className="flex gap-2 mb-4">
                            <span className="px-4 py-2 bg-white text-brand-dark border border-brand-dark/10 rounded-md text-[10px] font-black uppercase tracking-widest cursor-pointer hover:border-brand-pink">GPay</span>
                            <span className="px-4 py-2 bg-white text-brand-dark border border-brand-dark/10 rounded-md text-[10px] font-black uppercase tracking-widest cursor-pointer hover:border-brand-pink">PhonePe</span>
                            <span className="px-4 py-2 bg-white text-brand-dark border border-brand-dark/10 rounded-md text-[10px] font-black uppercase tracking-widest cursor-pointer hover:border-brand-pink">Paytm</span>
                          </div>
                          <Button variant="primary" className="w-full sm:w-auto px-10 rounded-md shadow-md shadow-brand-dark/10" onClick={handlePayment} disabled={isProcessing}>
                            {isProcessing ? "Processing..." : `Pay ₹${finalTotal.toLocaleString('en-IN')}`}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Card Option */}
                    <div className="border-b border-brand-dark/10">
                      <label className={`flex items-center p-5 cursor-pointer hover:bg-[#FDFBF7] transition-colors ${paymentMethod === 'card' ? 'bg-brand-pink/10' : ''}`}>
                        <input type="radio" name="payment" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} className="w-4 h-4 text-brand-dark focus:ring-brand-pink border-brand-dark/20 accent-brand-dark" />
                        <div className="ml-3 flex items-center gap-3">
                          <CreditCard size={20} className={paymentMethod === 'card' ? 'text-brand-pink' : 'text-brand-dark/50'}/>
                          <span className="font-bold text-sm text-brand-dark">Credit / Debit Card</span>
                        </div>
                      </label>
                      {paymentMethod === 'card' && (
                        <div className="p-5 bg-brand-pink/5 pl-12 border-t border-brand-pink/10">
                          <div className="space-y-4 mb-4 sm:w-3/4">
                            <div className="space-y-1">
                              <input 
                                type="text" 
                                placeholder="Card Number" 
                                className={`w-full px-4 py-3 bg-white border rounded-md text-sm focus:border-brand-pink focus:ring-1 focus:ring-brand-pink outline-none transition-all ${errors.cardNumber ? 'border-red-400' : 'border-brand-dark/10'}`}
                                value={paymentData.cardNumber}
                                onChange={(e) => {
                                  setPaymentData({...paymentData, cardNumber: e.target.value});
                                  if (errors.cardNumber) setErrors({...errors, cardNumber: ""});
                                }}
                              />
                              {errors.cardNumber && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.cardNumber}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <input 
                                  type="text" 
                                  placeholder="MM/YY" 
                                  className={`w-full px-4 py-3 bg-white border rounded-md text-sm focus:border-brand-pink focus:ring-1 focus:ring-brand-pink outline-none transition-all ${errors.expiry ? 'border-red-400' : 'border-brand-dark/10'}`}
                                  value={paymentData.expiry}
                                  onChange={(e) => {
                                    setPaymentData({...paymentData, expiry: e.target.value});
                                    if (errors.expiry) setErrors({...errors, expiry: ""});
                                  }}
                                />
                                {errors.expiry && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.expiry}</p>}
                              </div>
                              <div className="space-y-1">
                                <input 
                                  type="text" 
                                  placeholder="CVV" 
                                  className={`w-full px-4 py-3 bg-white border rounded-md text-sm focus:border-brand-pink focus:ring-1 focus:ring-brand-pink outline-none transition-all ${errors.cvv ? 'border-red-400' : 'border-brand-dark/10'}`}
                                  value={paymentData.cvv}
                                  onChange={(e) => {
                                    setPaymentData({...paymentData, cvv: e.target.value});
                                    if (errors.cvv) setErrors({...errors, cvv: ""});
                                  }}
                                />
                                {errors.cvv && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.cvv}</p>}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <input 
                                type="text" 
                                placeholder="Name on Card" 
                                className={`w-full px-4 py-3 bg-white border rounded-md text-sm focus:border-brand-pink focus:ring-1 focus:ring-brand-pink outline-none transition-all ${errors.cardName ? 'border-red-400' : 'border-brand-dark/10'}`}
                                value={paymentData.cardName}
                                onChange={(e) => {
                                  setPaymentData({...paymentData, cardName: e.target.value});
                                  if (errors.cardName) setErrors({...errors, cardName: ""});
                                }}
                              />
                              {errors.cardName && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.cardName}</p>}
                            </div>
                          </div>
                          <Button variant="primary" className="w-full sm:w-auto px-10 rounded-md shadow-md shadow-brand-dark/10" onClick={handlePayment} disabled={isProcessing}>
                            {isProcessing ? "Processing..." : `Pay ₹${finalTotal.toLocaleString('en-IN')}`}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* COD Option */}
                    <div>
                      <label className={`flex items-center p-5 cursor-pointer hover:bg-[#FDFBF7] transition-colors ${paymentMethod === 'cod' ? 'bg-brand-pink/10' : ''}`}>
                        <input type="radio" name="payment" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} className="w-4 h-4 text-brand-dark focus:ring-brand-pink border-brand-dark/20 accent-brand-dark" />
                        <div className="ml-3 flex items-center gap-3">
                          <Wallet size={20} className={paymentMethod === 'cod' ? 'text-brand-pink' : 'text-brand-dark/50'}/>
                          <span className="font-bold text-sm text-brand-dark">Cash on Delivery</span>
                        </div>
                      </label>
                      {paymentMethod === 'cod' && (
                        <div className="p-5 bg-brand-pink/5 pl-12 border-t border-brand-pink/10">
                          <p className="text-xs font-medium text-brand-dark/60 mb-4">Pay via cash or UPI when the order arrives at your doorstep.</p>
                          <Button variant="primary" className="w-full sm:w-auto px-10 rounded-md shadow-md shadow-brand-dark/10" onClick={handlePayment} disabled={isProcessing}>
                            {isProcessing ? "Processing..." : `Place Order`}
                          </Button>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Order Summary & Coupons */}
          <div className="w-full lg:w-95 xl:w-105 shrink-0 space-y-4">
            
            {/* Coupon Block */}
            <div
              className="bg-white border border-brand-dark/10 rounded-lg p-5 shadow-sm flex items-center justify-between cursor-pointer hover:border-brand-pink transition-colors group"
              onClick={() => setCouponOpen(true)}
            >
              <div className="flex items-center gap-3">
                <Tag size={20} className="text-brand-dark/40 group-hover:text-brand-pink transition-colors" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-brand-dark">Apply Coupon</span>
                  {appliedPromo?.code ? (
                    <span className="text-[10px] font-black tracking-widest uppercase text-[#52C234] mt-1">
                      Applied: {appliedPromo.code}
                    </span>
                  ) : null}
                </div>
              </div>
              <ChevronRight size={18} className="text-brand-dark/20 group-hover:text-brand-dark transition-colors" />
            </div>

            {/* Coupon Modal */}
            {couponOpen && (
              <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
                <div
                  className="absolute inset-0 bg-brand-dark/60 backdrop-blur-md"
                  onClick={() => setCouponOpen(false)}
                />
                <div className="relative bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-brand-dark/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-serif text-2xl font-bold text-brand-dark">Apply Coupon</h3>
                    <button
                      onClick={() => setCouponOpen(false)}
                      className="w-10 h-10 rounded-full border border-brand-dark/10 flex items-center justify-center text-brand-dark hover:bg-brand-pink hover:text-white transition-all"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <p className="text-xs text-brand-dark/60 mb-4">
                    Enter a coupon code. Discount is calculated on the server and will reflect at checkout.
                  </p>

                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                      placeholder="e.g. SAVE10"
                      className="flex-1 px-4 py-3 bg-[#FDFBF7] border border-brand-dark/10 rounded-md text-sm font-bold tracking-widest uppercase outline-none focus:border-brand-pink"
                    />
                    <Button
                      variant="primary"
                      className="rounded-md px-6"
                      onClick={() => applyCoupon()}
                      disabled={couponLoading}
                    >
                      {couponLoading ? "Applying..." : "Apply"}
                    </Button>
                  </div>
                  {couponError ? (
                    <p className="mt-2 text-[10px] font-black tracking-widest uppercase text-red-500">{couponError}</p>
                  ) : null}

                  {/* Available coupons list — populated from /api/promotions/active */}
                  <div className="mt-6">
                    <p className="text-[10px] font-black tracking-widest uppercase text-brand-dark/40 mb-3">
                      Available Coupons
                    </p>
                    {couponsLoading ? (
                      <p className="text-xs text-brand-dark/50">Loading offers...</p>
                    ) : availableCoupons && availableCoupons.length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {availableCoupons.map((c) => {
                          const isActive = appliedPromo?.code === c.code;
                          return (
                            <div
                              key={c.code}
                              className={`flex items-center justify-between gap-3 p-3 rounded-md border ${
                                isActive
                                  ? "border-[#52C234]/40 bg-[#52C234]/5"
                                  : "border-brand-dark/10 bg-[#FDFBF7]"
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-black tracking-widest uppercase text-brand-dark">
                                  {c.code}
                                </p>
                                <p className="text-[11px] text-brand-dark/60 truncate">
                                  {c.summary}
                                  {c.minSubtotal
                                    ? ` • Min ₹${Number(c.minSubtotal).toLocaleString("en-IN")}`
                                    : ""}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={couponLoading || isActive}
                                onClick={() => {
                                  setCouponCode(c.code);
                                  setCouponError("");
                                  applyCoupon(c.code);
                                }}
                                className={`text-[10px] font-black tracking-widest uppercase px-3 py-2 rounded-md transition-colors ${
                                  isActive
                                    ? "bg-[#52C234] text-white cursor-default"
                                    : "bg-brand-dark text-white hover:bg-brand-pink disabled:opacity-50"
                                }`}
                              >
                                {isActive ? "Applied" : "Apply"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-brand-dark/50">No active coupons right now.</p>
                    )}
                  </div>

                  {appliedPromo?.code ? (
                    <div className="mt-5 flex items-center justify-between bg-[#52C234]/10 border border-[#52C234]/20 rounded-md p-3">
                      <div className="text-[10px] font-black tracking-widest uppercase text-[#52C234]">
                        Current: {appliedPromo.code}
                      </div>
                      <button
                        onClick={clearCoupon}
                        className="text-[10px] font-black tracking-widest uppercase text-brand-dark hover:text-brand-pink"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Order Summary Block */}
            <div className="bg-white border border-brand-dark/10 rounded-lg p-6 shadow-sm sticky top-24">
              <h3 className="font-bold text-lg text-brand-dark mb-4 border-b border-brand-dark/5 pb-3">Order Summary</h3>
              
              <div className="space-y-4 mb-6">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex gap-4 items-center">
                    <div className="w-14 h-14 bg-[#FDFBF7] rounded-md border border-brand-dark/5 shrink-0 overflow-hidden relative">
                      <ProductImage
                        src={item.image || item.img}
                        alt={item.name}
                        className="w-full h-full object-cover mix-blend-multiply"
                        iconSize={22}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-serif text-sm font-bold text-brand-dark line-clamp-1">{item.name}</p>
                      <p className="text-[10px] font-black tracking-widest uppercase text-brand-dark/40">Qty: {item.quantity}</p>
                    </div>
                    <span className="text-sm font-bold text-brand-dark">
                      {typeof item.price === 'number' ? `₹${item.price.toLocaleString('en-IN')}` : item.price}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-brand-dark/5 pt-5 space-y-3">
                <div className="flex justify-between text-xs font-medium text-brand-dark/60">
                  <span>Sub Total</span>
                  <span>₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                {discount > 0 ? (
                  <div className="flex justify-between text-xs font-bold text-[#52C234]">
                    <span>Discount</span>
                    <span>- ₹{discount.toLocaleString('en-IN')}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-xs font-medium text-brand-dark/60">
                  <span>GST (18%)</span>
                  <span>₹{gst.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-xs font-medium text-brand-dark/60">
                  <span>Shipping</span>
                  <span className={shippingFee === 0 ? "text-[#52C234] font-bold tracking-widest uppercase" : "text-brand-dark font-bold"}>
                    {shippingFee === 0 ? "FREE" : `₹${shippingFee.toLocaleString('en-IN')}`}
                  </span>
                </div>
                <div className="flex justify-between items-end pt-4 border-t border-brand-dark/10 mt-2">
                  <span className="font-bold text-sm text-brand-dark uppercase tracking-widest">To Pay</span>
                  <span className="font-serif text-2xl font-bold text-brand-dark">₹{finalTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {discount > 0 ? (
                <div className="mt-6 p-4 bg-[#52C234]/10 rounded-md border border-[#52C234]/20 text-center">
                  <p className="text-xs font-bold tracking-widest uppercase text-[#52C234]">You will save ₹{discount.toLocaleString('en-IN')} on this order</p>
                </div>
              ) : null}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
