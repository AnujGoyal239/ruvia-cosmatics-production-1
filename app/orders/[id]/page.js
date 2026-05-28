"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, MapPin, Package, ShieldCheck } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useCart } from "../../../context/CartContext";
import { apiUrl } from "../../../constants";
import { Button } from "../../../components/ui/Button";
import { downloadInvoicePdf } from "../../../lib/invoicePdf";
import { verifyOrderOwnership, handleAccessDenied } from "../../../utils/idorPrevention";

import { csrfFetch } from "../../../lib/csrf";
export default function OrderDetailsPage() {
  const { user, loading } = useAuth();
  const { addToCart, closeCart } = useCart();
  const router = useRouter();
  const params = useParams();
  const orderId = params.id;

  const [order, setOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/auth?redirect=/orders/${orderId}`);
    }
  }, [user, loading, router, orderId]);

  useEffect(() => {
    const loadOrder = async () => {
      if (!user || !orderId) return;

      try {
        setLoadingOrder(true);
        const response = await csrfFetch(apiUrl(`/api/orders/${orderId}`), {
          credentials: "include",
        });

        // Backend signaled access denied (e.g., IDOR attempt)
        if (response.status === 403) {
          await handleAccessDenied(
            router,
            "You do not have permission to access this order"
          );
          return;
        }

        const data = await response.json();
        if (response.ok) {
          // Frontend ownership verification - defense in depth against IDOR
          const currentUserId = user?._id || user?.id;
          if (!verifyOrderOwnership(data, currentUserId)) {
            await handleAccessDenied(
              router,
              "You do not have permission to access this order"
            );
            return;
          }
          setOrder(data);
        }
      } catch (error) {
        console.error("Failed to load order details", error);
      } finally {
        setLoadingOrder(false);
      }
    };

    loadOrder();
  }, [user, orderId, router]);

  const view = useMemo(() => {
    if (!order) return null;

    const items = (order.items || []).map((item) => ({
      id: item.product || item.id,
      name: item.name,
      price: Number(item.price || 0),
      qty: item.qty ?? item.quantity ?? 1,
      // Pass through whatever the backend stored. We never substitute a
      // hardcoded product image so the order page reflects real data only.
      img: item.img || item.image || null,
    }));

    const subtotal = Number(order.subtotal ?? order.total ?? 0);
    const shipping = Number(order.shippingFee ?? 0);
    const gst = Number(order.gst ?? 0);
    const total = Number(order.total ?? subtotal + shipping + gst);
    const status = (order.status || (order.isPaid ? "Delivered" : "Processing")).toLowerCase();

    return {
      id: order._id ? `ORD-${order._id.slice(-6).toUpperCase()}` : String(orderId || "").toUpperCase(),
      date: order.createdAt
        ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
        : "Recent",
      paymentMethod: order.paymentMethod || "COD",
      shippingAddress: order.shippingAddress || {},
      items,
      subtotal,
      shipping,
      gst,
      total,
      steps: [
        { label: "Placed", done: true },
        { label: "Shipped", done: status !== "processing" },
        { label: "Out for Delivery", done: status === "out for delivery" || status === "delivered" },
        { label: "Delivered", done: status === "delivered" },
      ],
    };
  }, [order, orderId]);

  if (loading || !user || loadingOrder) return null;

  if (!view) {
    return (
      <div className="min-h-screen pt-32 pb-20 bg-[#FDFBF7] flex items-center justify-center">
        <p className="text-sm font-medium text-brand-dark/50">Order not found.</p>
      </div>
    );
  }

  const handleBuyAgain = (item) => {
    addToCart({ id: item.id, name: item.name, price: item.price, img: item.img, quantity: item.qty });
    closeCart();
    router.push("/checkout");
  };

  const addressName = view.shippingAddress.firstName
    ? `${view.shippingAddress.firstName} ${view.shippingAddress.lastName || ""}`.trim()
    : user.name;

  const addressLine1 = view.shippingAddress.address || view.shippingAddress.street || "";
  const addressCityState = [view.shippingAddress.city, view.shippingAddress.state].filter(Boolean).join(", ");
  const addressPin = view.shippingAddress.pin || view.shippingAddress.zipCode || "";

  return (
    <div className="min-h-screen pt-32 pb-20 bg-[#FDFBF7] font-sans">
      <div className="container mx-auto px-4 md:px-12 max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 border-b border-brand-dark/10 pb-8">
          <div>
            <Link href="/orders" className="inline-flex items-center gap-2 text-[10px] font-black tracking-widest uppercase text-brand-dark/50 hover:text-brand-pink transition-colors mb-6">
              <ArrowLeft size={14} /> Back to Orders
            </Link>
            <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tighter text-brand-dark mb-2">Order #{view.id}</h1>
            <div className="flex items-center gap-3 text-[10px] font-black tracking-widest uppercase text-brand-dark/40 flex-wrap">
              <span>Placed on {view.date}</span>
              <span className="w-1 h-1 rounded-full bg-brand-dark/20" />
              <span className="text-[#52C234] flex items-center gap-1"><ShieldCheck size={14} /> Paid via {view.paymentMethod}</span>
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                await downloadInvoicePdf(order);
              } catch (e) {
                console.error("Invoice download failed:", e);
              }
            }}
            className="flex items-center gap-2 text-[10px] font-black tracking-widest uppercase text-brand-dark hover:text-brand-pink transition-colors bg-white px-6 py-3 rounded-md shadow-sm border border-brand-dark/10"
          >
            <Download size={14} /> Invoice
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-xl p-8 md:p-10 shadow-sm border border-brand-dark/10">
              <h2 className="font-serif text-2xl font-bold text-brand-dark mb-8">Delivery Status</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {view.steps.map((step) => (
                  <div key={step.label} className="text-center">
                    <div className={`w-7 h-7 mx-auto mb-3 rounded-full flex items-center justify-center border-2 ${step.done ? "bg-[#52C234] border-[#52C234] text-white" : "bg-white border-brand-dark/10 text-transparent"}`}>
                      {step.done ? <CheckCircle2 size={12} /> : null}
                    </div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${step.done ? "text-brand-dark" : "text-brand-dark/40"}`}>{step.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-8 md:p-10 shadow-sm border border-brand-dark/10">
              <h2 className="font-serif text-2xl font-bold text-brand-dark mb-2">Items in this shipment</h2>
              <p className="text-xs text-brand-dark/50 mb-8">{view.items.length} item(s)</p>

              <div className="space-y-5">
                {view.items.map((item) => (
                  <div key={item.id} className="flex flex-col sm:flex-row gap-5 p-5 rounded-xl bg-[#FDFBF7] border border-brand-dark/5 items-start sm:items-center">
                    <div className="w-20 h-20 shrink-0 bg-white rounded-md overflow-hidden border border-brand-dark/5 flex items-center justify-center">
                      {item.img ? (
                        <img
                          src={item.img}
                          alt={item.name}
                          className="w-full h-full object-cover mix-blend-multiply"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <Package size={26} className="text-brand-dark/30" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-serif text-lg md:text-xl font-bold text-brand-dark mb-1">{item.name}</h3>
                      <p className="text-[10px] font-black tracking-widest uppercase text-brand-dark/40 mb-2">Qty: {item.qty}</p>
                      <p className="font-serif text-lg md:text-xl font-bold text-brand-dark">₹{item.price.toLocaleString("en-IN")}</p>
                    </div>
                    <button onClick={() => handleBuyAgain(item)} className="bg-white hover:bg-brand-pink/5 text-brand-dark text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-md border border-brand-dark/10 hover:border-brand-pink transition-all shadow-sm w-full sm:w-auto">
                      Buy it again
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-sm border border-brand-dark/10">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-full bg-[#FDFBF7] flex items-center justify-center text-brand-dark border border-brand-dark/5">
                  <MapPin size={14} />
                </div>
                <h3 className="font-serif text-xl font-bold text-brand-dark">Shipping Info</h3>
              </div>
              <p className="text-sm font-bold text-brand-dark mb-2">{addressName}</p>
              <p className="text-xs text-brand-dark/60 font-medium leading-relaxed mb-5">
                {addressLine1 || "No address available"}
                {addressCityState ? (
                  <>
                    <br />
                    {addressCityState}
                  </>
                ) : null}
                {addressPin ? (
                  <>
                    <br />
                    {addressPin}
                  </>
                ) : null}
              </p>
              <div className="space-y-1 bg-[#FDFBF7] p-3 rounded-md border border-brand-dark/5">
                <p className="text-[10px] font-black tracking-widest uppercase text-brand-dark/50">Phone: <span className="text-brand-dark">{view.shippingAddress.phone || "N/A"}</span></p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-xl p-8 shadow-sm border border-brand-dark/10">
              <h2 className="font-serif text-xl font-bold text-brand-dark mb-6 border-b border-brand-dark/5 pb-3">Payment Summary</h2>
              <div className="space-y-4">
                <div className="flex justify-between text-xs font-medium text-brand-dark/60">
                  <span>Subtotal</span>
                  <span>₹{view.subtotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-xs font-medium text-brand-dark/60">
                  <span>Shipping</span>
                  <span>{view.shipping === 0 ? "FREE" : `₹${view.shipping.toLocaleString("en-IN")}`}</span>
                </div>
                <div className="flex justify-between text-[10px] font-black tracking-widest uppercase text-brand-dark/40 pt-2 border-t border-brand-dark/5">
                  <span>GST</span>
                  <span>₹{view.gst.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between items-end pt-4 border-t border-brand-dark/10">
                  <span className="text-xs font-black tracking-widest uppercase text-brand-dark">Total Paid</span>
                  <span className="font-serif text-3xl font-bold text-brand-dark">₹{view.total.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#FDFBF7] rounded-xl p-8 shadow-sm border border-brand-dark/10">
              <h3 className="font-serif text-xl font-bold text-brand-dark mb-2">Need Help?</h3>
              <p className="text-xs text-brand-dark/60 font-medium leading-relaxed mb-6">
                Have an issue with your order? Our support team can help with delivery, returns, and payment questions.
              </p>
              <Button variant="outline" className="w-full justify-center bg-white border-[#25D366] text-[#25D366] hover:bg-[#25D366] hover:text-white gap-2 text-[10px] uppercase tracking-widest font-black py-3 rounded-md">
                Support Chat
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
