"use client";

import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import { X, Plus, Minus, ArrowRight, ShoppingBag, Trash2, Heart, AlertCircle } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "../ui/Button";
import ProductImage from "../ui/ProductImage";

export default function CartCanvas() {
  const { isCartOpen, closeCart, cartItems, updateQuantity, removeFromCart, getCartTotal, clearCart } = useCart();
  const { toggleWishlist, addToWishlist, isInWishlist } = useWishlist();
  const [itemToRemove, setItemToRemove] = useState(null); // stores the product object to confirm removal

  const handleCheckout = () => {
    closeCart();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] transition-opacity duration-500 ${
          isCartOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={closeCart}
      />

      {/* Slide-out Panel */}
      <div className={`fixed top-0 right-0 bottom-0 w-full max-w-[440px] bg-[#FDFBF7] z-[160] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col shadow-2xl ${
        isCartOpen ? "translate-x-0" : "translate-x-full"
      }`}>
        
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-6 border-b border-brand-dark/5 bg-white">
          <div className="flex items-center gap-3">
            <ShoppingBag size={20} className="text-brand-dark" />
            <h2 className="font-serif text-2xl font-bold tracking-tight text-brand-dark">Your Bag</h2>
          </div>
          <div className="flex items-center gap-6">
            {cartItems.length > 0 && (
              <button 
                onClick={clearCart}
                className="text-[9px] font-black tracking-widest uppercase text-red-500/60 hover:text-red-500 transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={12} /> Clear Bag
              </button>
            )}
            <button 
              onClick={closeCart}
              className="w-10 h-10 rounded-full border border-brand-dark/10 flex items-center justify-center text-brand-dark hover:bg-brand-pink hover:text-white hover:border-brand-pink transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Cart Items Area */}
        <div className="flex-1 overflow-y-auto p-8 no-scrollbar bg-[#FDFBF7]">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
              <ShoppingBag size={48} className="mb-4 text-brand-dark/20" />
              <p className="text-sm font-bold tracking-widest uppercase text-brand-dark">Your bag is empty.</p>
              <p className="text-xs mt-2 text-brand-dark/60">Ready to start your ritual?</p>
            </div>
          ) : (
            <div className="space-y-6">
               {cartItems.map(item => (
                 <div key={item.id} className="relative group/item">
                  <div className="flex gap-5 bg-white p-4 rounded-3xl shadow-sm border border-brand-dark/5">
                    <div className="w-24 h-28 shrink-0 bg-brand-beige rounded-2xl overflow-hidden border border-brand-dark/5">
                      <ProductImage
                        src={item.image || item.img}
                        alt={item.name}
                        className="w-full h-full object-cover mix-blend-multiply"
                        iconSize={28}
                      />
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-serif text-lg font-bold leading-tight text-brand-dark">{item.name}</h3>
                          <button onClick={() => setItemToRemove(item)} className="text-brand-dark/30 hover:text-red-500 transition-colors">
                            <X size={16} />
                          </button>
                        </div>
                        <span className="text-[10px] font-black tracking-widest uppercase text-brand-pink">
                          {typeof item.price === 'number' ? `₹${item.price.toLocaleString('en-IN')}` : item.price}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        {/* Quantity Selector */}
                        <div className="flex items-center gap-4 bg-[#F9F9F9] border border-brand-dark/5 rounded-full px-3 py-1.5">
                          <button 
                            onClick={() => updateQuantity(item.id, -1)}
                            className="text-brand-dark/60 hover:text-brand-dark transition-colors"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-xs font-black text-brand-dark w-4 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.id, 1)}
                            className="text-brand-dark/60 hover:text-brand-dark transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                 </div>
               ))}
            </div>
          )}
        </div>

        {/* Global Removal Confirmation Modal */}
        {itemToRemove && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-6">
            <div 
              className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm animate-in fade-in duration-500" 
              onClick={() => setItemToRemove(null)}
            />
            <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl border border-brand-dark/5 animate-in zoom-in fade-in duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-brand-pink/10 flex items-center justify-center mb-6">
                  <Heart size={28} className="text-brand-pink fill-brand-pink" />
                </div>
                
                <h4 className="font-serif text-3xl font-bold text-brand-dark mb-3">Save for later?</h4>
                <p className="text-xs text-brand-dark/40 font-medium leading-relaxed mb-10">
                  Keep this formula in your personal ritual collection to purchase it another time.
                </p>
                
                <div className="flex flex-col gap-3 w-full">
                  <button 
                    onClick={() => {
                      addToWishlist(itemToRemove);
                      removeFromCart(itemToRemove.id);
                      setItemToRemove(null);
                    }}
                    className="w-full flex items-center justify-center gap-3 py-4.5 bg-brand-pink text-white rounded-2xl hover:bg-brand-dark transition-all duration-500 shadow-xl shadow-brand-pink/20 group"
                  >
                    <Heart size={16} className="fill-white" />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">Move to Wishlist</span>
                  </button>
                  
                  <button 
                    onClick={() => {
                      removeFromCart(itemToRemove.id);
                      setItemToRemove(null);
                    }}
                    className="w-full py-5 text-[11px] font-black uppercase tracking-[0.2em] text-red-500 hover:bg-red-50 rounded-2xl transition-all duration-300"
                  >
                    Discard Entirely
                  </button>
                  
                  <button 
                    onClick={() => setItemToRemove(null)}
                    className="mt-4 text-[10px] font-black tracking-[0.3em] uppercase text-brand-dark/20 hover:text-brand-dark transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Footer / Checkout */}
        {cartItems.length > 0 && (
          <div className="bg-white p-8 border-t border-brand-dark/5 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] relative z-10">
            <div className="flex justify-between items-center mb-6">
              <span className="text-xs font-bold tracking-widest uppercase text-brand-dark/60">Subtotal</span>
              <span className="font-serif text-2xl font-bold text-brand-dark">
                ₹{getCartTotal().toLocaleString('en-IN')}
              </span>
            </div>
            
            <Link href="/checkout" onClick={handleCheckout} className="block w-full">
              <Button variant="primary" className="w-full justify-center group shadow-lg">
                <span className="text-[11px] font-black tracking-[0.2em] uppercase">Checkout Securely</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            
            <p className="text-center text-[9px] font-bold tracking-widest uppercase text-brand-dark/40 mt-4 flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Free Shipping on all orders
            </p>
          </div>
        )}
      </div>
    </>
  );
}
