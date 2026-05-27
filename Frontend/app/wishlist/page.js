"use client";

import { useWishlist } from "../../context/WishlistContext";
import { useCart } from "../../context/CartContext";
import { ShoppingBag, Trash2, ArrowLeft, Heart, X, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "../../components/ui/Button";
import ProductImage from "../../components/ui/ProductImage";

export default function WishlistPage() {
  const { wishlistItems, removeFromWishlist, clearWishlist } = useWishlist();
  const { addToCart } = useCart();

  return (
    <div className="min-h-screen pt-32 pb-10 bg-brand-beige/20 selection:bg-brand-pink/30 font-sans">
      <div className="max-w-6xl mx-auto px-6 md:px-12">
        
        {wishlistItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-in fade-in duration-1000">
            <div className="relative mb-12 group">
              <div className="absolute inset-0 bg-brand-pink/20 rounded-full blur-3xl scale-150 group-hover:scale-110 transition-transform duration-700" />
              <div className="w-32 h-32 rounded-full bg-[#FDFBF7] flex items-center justify-center relative border border-brand-dark/5 shadow-2xl">
                <Heart size={48} className="text-brand-pink" strokeWidth={1.5} />
              </div>
            </div>
            <h1 className="font-serif text-5xl md:text-7xl font-bold text-brand-dark tracking-tighter mb-6 leading-none">
              Your Ritual is <span className="italic text-brand-pink">Empty.</span>
            </h1>
            <p className="text-sm text-brand-dark/50 mb-12 max-w-md mx-auto leading-relaxed">
              You haven't saved any formulas yet. Explore our curated selection of dermatological skincare and curate your perfect routine.
            </p>
            <Link href="/shop">
              <Button variant="primary" className="px-12 py-5 rounded-full shadow-2xl hover:scale-105 transition-transform text-xs font-black tracking-[0.2em] uppercase">
                Explore Collection
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Header for populated wishlist */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-brand-pink">
                  <Sparkles size={18} />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em]">Personal Collection</span>
                </div>
                <h1 className="font-serif text-6xl md:text-8xl font-bold text-brand-dark tracking-tighter leading-[0.8]">Your <br /><span className="italic text-brand-pink">Rituals.</span></h1>
                <p className="text-xs font-medium text-brand-dark/40 max-w-md leading-relaxed">
                  A curated selection of formulas waiting to transform your skin. Saved for your next self-care moment.
                </p>
              </div>
              
              <button 
                onClick={clearWishlist}
                className="group px-8 py-4 rounded-full border border-brand-dark/10 text-[10px] font-black tracking-widest uppercase text-brand-dark/40 hover:text-red-500 hover:border-red-500 transition-all flex items-center gap-3 bg-white shadow-sm"
              >
                <Trash2 size={14} className="group-hover:rotate-12 transition-transform" /> Clear All
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12">
              {wishlistItems.map((product) => (
                <div key={product.id} className="group relative flex flex-col h-full animate-in fade-in slide-in-from-bottom-8 duration-700">
                  {/* Image Container */}
                  <div className="relative aspect-[4/5] rounded-[2.5rem] overflow-hidden bg-white mb-8 shadow-[0_10px_50px_rgba(0,0,0,0.03)] border border-brand-dark/[0.03] group-hover:shadow-2xl group-hover:shadow-brand-dark/10 transition-all duration-1000">
                    <Link href={`/shop/${product.id}`} className="block w-full h-full relative overflow-hidden">
                      <ProductImage
                        src={product.image || product.img}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110"
                        iconSize={40}
                      />
                      <div className="absolute inset-0 bg-brand-dark/0 group-hover:bg-brand-dark/10 transition-colors duration-1000" />
                    </Link>
                    
                    {/* Remove Button */}
                    <button 
                      onClick={() => removeFromWishlist(product.id)}
                      className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/90 backdrop-blur-xl flex items-center justify-center text-brand-dark/20 hover:text-red-500 hover:scale-110 transition-all shadow-xl z-10"
                    >
                      <X size={18} />
                    </button>

                    <div className="absolute bottom-6 left-6 flex flex-col gap-2">
                      <span className="bg-brand-dark text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.3em] shadow-2xl">
                        {product.category}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 flex flex-col px-4">
                    <div className="flex justify-between items-start mb-4 gap-4">
                      <Link href={`/shop/${product.id}`} className="font-serif text-3xl font-bold text-brand-dark hover:text-brand-pink transition-all leading-[0.9]">
                        {product.name}
                      </Link>
                      <span className="font-serif text-2xl font-bold text-brand-pink shrink-0">₹{typeof product.price === 'number' ? product.price.toLocaleString('en-IN') : product.price}</span>
                    </div>
                    
                    <p className="text-[13px] text-brand-dark/40 font-medium leading-relaxed line-clamp-2 mb-10">
                      {product.description}
                    </p>

                    <div className="mt-auto space-y-6">
                      <button 
                        onClick={() => addToCart({ ...product, quantity: 1 })}
                        className="w-full bg-brand-dark text-white py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-brand-pink hover:-translate-y-1 transition-all shadow-xl active:scale-95 group"
                      >
                        <ShoppingBag size={16} className="group-hover:rotate-12 transition-transform" />
                        Add to Ritual
                      </button>

                      <Link 
                        href={`/shop/${product.id}`}
                        className="flex items-center gap-3 text-[10px] font-black tracking-[0.4em] uppercase text-brand-dark/20 hover:text-brand-pink transition-all group/link"
                      >
                        View Full Details <ArrowLeft size={16} className="rotate-180 group-hover/link:translate-x-2 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Bottom Link */}
        {/* <div className="pt-10 border-t border-brand-dark/5">
          <Link href="/shop" className="inline-flex items-center gap-3 text-[10px] font-black tracking-[0.3em] uppercase text-brand-dark hover:text-brand-pink transition-colors group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Continue Shopping
          </Link>
        </div> */}
      </div>
    </div>
  );
}
