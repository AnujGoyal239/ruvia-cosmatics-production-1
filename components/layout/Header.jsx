"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ShoppingBag, ArrowRight, User, Search, Heart } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import { apiUrl } from "../../constants";

import { csrfFetch } from "../../lib/csrf";
const navItems = [
  { label: "Home", href: "/", tag: null },
  { label: "Products", href: "/shop", tag: "New" },
  { label: "Support", href: "/support", tag: null },
  { label: "Orders", href: "/orders", tag: null },
];

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredLink, setHoveredLink] = useState(-1);
  const [products, setProducts] = useState([]);
  const { user } = useAuth();
  const { toggleCart, getCartCount } = useCart();
  const { wishlistItems } = useWishlist();
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen || searchOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [mobileMenuOpen, searchOpen]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await csrfFetch(apiUrl("/api/products"));
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : [];
        setProducts(items);
      } catch (error) {
        console.error("Failed to load header products", error);
      }
    };

    loadProducts();
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* ══════ HEADER BAR ══════ */}
      <header
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-700 ${
          isScrolled || !isHomePage
            ? "bg-brand-dark/95 backdrop-blur-md py-4 shadow-xl border-b border-white/5" 
            : "bg-transparent py-10"
        }`}
      >
        <div className="container mx-auto px-6 md:px-12 flex justify-between items-center relative">
          <Link 
            href="/" 
            className={`font-serif text-3xl font-bold tracking-tighter transition-all duration-500 text-white z-10`}
          >
            RUVIA<span className="text-brand-pink">.</span>
          </Link>

          {/* Desktop Nav (Centered) */}
          <nav className="hidden lg:flex gap-10 items-center absolute left-1/2 -translate-x-1/2">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`text-xs uppercase tracking-widest font-bold font-sans transition-all duration-500 hover:text-brand-pink text-white`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Icons (Right) */}
          <div className="hidden lg:flex items-center gap-8 z-10">
            <button onClick={() => setSearchOpen(true)} className="text-white hover:text-brand-pink transition-colors">
              <Search size={18} />
            </button>
            <Link href="/wishlist" className="text-white hover:text-brand-pink transition-colors relative">
              <Heart size={18} className={wishlistItems.length > 0 ? "fill-brand-pink text-brand-pink" : ""} />
              {wishlistItems.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-brand-pink text-[8px] font-black text-white rounded-full flex items-center justify-center shadow-sm">
                  {wishlistItems.length}
                </span>
              )}
            </Link>
            <Link href={user ? "/profile" : "/auth"} className={`flex items-center gap-2 transition-colors duration-500 hover:text-brand-pink text-white`}>
               <User size={18} />
            </Link>
            <button onClick={toggleCart} className={`flex items-center gap-3 transition-colors duration-500 hover:text-brand-pink text-white`}>
               <ShoppingBag size={18} />
               <span className="text-[10px] font-black tracking-widest uppercase">Bag ({getCartCount()})</span>
            </button>
          </div>

          {/* Mobile Actions & Toggle */}
          <div className={`flex lg:hidden items-center gap-5 transition-all duration-500 ${mobileMenuOpen ? "opacity-0 pointer-events-none" : "opacity-100"} text-white z-10`}>
            <button onClick={() => setSearchOpen(true)} className="hover:text-brand-pink transition-colors">
              <Search size={22} />
            </button>
            <Link href="/wishlist" className="hover:text-brand-pink transition-colors relative">
              <Heart size={22} className={wishlistItems.length > 0 ? "fill-brand-pink text-brand-pink" : ""} />
              {wishlistItems.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-brand-pink text-[9px] font-black text-white rounded-full flex items-center justify-center shadow-sm">
                  {wishlistItems.length}
                </span>
              )}
            </Link>
            <Link href={user ? "/profile" : "/auth"} className="hover:text-brand-pink transition-colors">
              <User size={22} />
            </Link>
            <button onClick={toggleCart} className="hover:text-brand-pink transition-colors relative">
              <ShoppingBag size={22} />
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-brand-pink text-[9px] font-black text-white rounded-full flex items-center justify-center shadow-sm">{getCartCount()}</span>
            </button>
            <button onClick={() => setMobileMenuOpen(true)} className="ml-2 hover:text-brand-pink transition-colors">
              <Menu size={28} />
            </button>
          </div>
        </div>
      </header>

      {/* ══════ SEARCH OVERLAY ══════ */}
      <div className={`fixed inset-0 z-[200] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${searchOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        <div className="absolute inset-0 bg-brand-dark backdrop-blur-2xl" />
        <div className="relative h-full flex flex-col container mx-auto px-6 md:px-12 pt-32">
          <button 
            onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
            className="absolute top-10 right-10 w-12 h-12 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-brand-pink hover:border-brand-pink hover:text-brand-dark transition-all"
          >
            <X size={20} />
          </button>

          <div className="max-w-4xl mx-auto w-full">
            <input 
              type="text" 
              autoFocus={searchOpen}
              placeholder="Search products, rituals, help..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-b-2 border-white/20 py-8 text-3xl md:text-5xl font-serif font-bold text-white focus:outline-none focus:border-brand-pink transition-colors placeholder:text-white/40"
            />
            
            <div className="mt-12">
              <h4 className="text-[10px] font-black tracking-[0.4em] uppercase text-brand-pink mb-8">
                {searchQuery ? "Search Results" : "Trending Now"}
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(searchQuery ? filteredProducts : products.slice(0, 4)).map((item) => (
                  <Link 
                    key={item.id} 
                    href={`/shop/${item.id}`} 
                    onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                    className="flex justify-between items-center p-6 bg-white/10 rounded-2xl hover:bg-brand-pink transition-all group border border-white/5"
                  >
                    <div>
                      <p className="text-sm font-bold text-white">{item.name}</p>
                      <p className="text-[10px] font-black tracking-widest uppercase text-white/50 group-hover:text-white/80">{item.category}</p>
                    </div>
                    <ArrowRight size={18} className="text-white opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Link>
                ))}
              </div>

              {searchQuery && filteredProducts.length === 0 && (
                <div className="text-center py-20">
                  <p className="text-white/60 text-sm font-medium">No results found for "{searchQuery}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════ OFFCANVAS — MOBILE MENU ══════ */}

      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm lg:hidden z-[110] transition-opacity duration-500 ${
          mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Panel — slides from right */}
      <div className={`fixed top-0 right-0 bottom-0 w-full max-w-[420px] bg-brand-olive lg:hidden z-[111] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        mobileMenuOpen ? "translate-x-0" : "translate-x-full"
      }`}>
        <div className="h-full flex flex-col px-8 py-10 relative overflow-y-auto overflow-x-hidden">

          {/* Decorative background letter */}
          <div className="fixed bottom-0 right-0 font-serif text-[18rem] font-black text-white/[0.02] italic leading-none select-none pointer-events-none">
            R
          </div>

          {/* Top bar: Logo + Close */}
          <div className="flex justify-between items-center mb-16 relative z-10">
            <span className="font-serif text-2xl font-bold text-white tracking-tighter">
              RUVIA<span className="text-brand-pink">.</span>
            </span>
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="w-11 h-11 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-brand-pink hover:border-brand-pink hover:text-brand-dark transition-all duration-400"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 flex flex-col justify-center gap-1 relative z-10">
            {navItems.map((item, i) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                onMouseEnter={() => setHoveredLink(i)}
                onMouseLeave={() => setHoveredLink(-1)}
                className={`group flex items-center gap-5 py-5 border-b border-white/[0.06] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  mobileMenuOpen ? "translate-x-0 opacity-100" : "translate-x-16 opacity-0"
                }`}
                style={{ 
                  transitionDelay: mobileMenuOpen ? `${200 + i * 70}ms` : `${(navItems.length - i) * 30}ms`
                }}
              >
                {/* Number */}
                <span className={`text-[10px] font-black tracking-[0.2em] w-6 shrink-0 transition-colors duration-300 ${
                  hoveredLink === i ? "text-brand-pink" : "text-white/20"
                }`}>
                  0{i + 1}
                </span>

                {/* Label */}
                <span className={`font-serif text-[2rem] font-bold tracking-tight transition-all duration-400 ${
                  hoveredLink === i ? "text-brand-pink translate-x-2" : hoveredLink !== -1 ? "text-white/30" : "text-white"
                }`}>
                  {item.label}
                </span>

                {/* Tag badge */}
                {item.tag && (
                  <span className="ml-auto px-3 py-1 rounded-full bg-brand-pink/20 text-brand-pink text-[8px] font-black tracking-[0.15em] uppercase shrink-0">
                    {item.tag}
                  </span>
                )}

                {/* Arrow on hover */}
                <ArrowRight 
                  size={16} 
                  className={`shrink-0 transition-all duration-400 ${
                    hoveredLink === i ? "text-brand-pink opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
                  } ${!item.tag ? "ml-auto" : ""}`}
                />
              </Link>
            ))}
          </nav>

          {/* Bottom section */}
          <div className={`relative z-10 transition-all duration-700 ${
            mobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`} style={{ transitionDelay: mobileMenuOpen ? "600ms" : "0ms" }}>
            
            {/* Quick action */}
            <div className="flex gap-4 mb-8">
              <Link href={user ? "/profile" : "/auth"} onClick={() => setMobileMenuOpen(false)} className="flex-1 flex items-center justify-center gap-2 py-4 rounded-full bg-white/10 text-white border border-white/20 text-[10px] font-black tracking-[0.25em] uppercase hover:bg-white/20 transition-colors duration-400">
                <User size={14} />
                {user ? "Profile" : "Sign In"}
              </Link>
              <button className="flex-1 flex items-center justify-center gap-2 py-4 rounded-full bg-brand-pink text-brand-dark text-[10px] font-black tracking-[0.25em] uppercase hover:bg-white transition-colors duration-400">
                <ShoppingBag size={14} />
                Bag (0)
              </button>
            </div>

            <div className="h-px bg-white/10 mb-6" />

            <div className="flex justify-between items-center">
              {/* Cities */}
              <div className="flex gap-3 items-center">
                {["NYC", "PARIS", "LDN"].map((city, i) => (
                  <span key={city} className="flex items-center gap-3">
                    <span className="text-[8px] font-black tracking-[0.3em] uppercase text-white/40">{city}</span>
                    {i < 2 && <span className="w-[3px] h-[3px] rounded-full bg-brand-pink/50" />}
                  </span>
                ))}
              </div>

              {/* Social icons */}
              <div className="flex gap-3">
                {[
                  <svg key="ig" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>,
                  <svg key="tt" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.67a8.2 8.2 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>,
                  <svg key="tw" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
                ].map((icon, i) => (
                  <a key={i} href="#" className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:bg-brand-pink hover:text-brand-dark hover:border-brand-pink transition-all duration-400">
                    {icon}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
