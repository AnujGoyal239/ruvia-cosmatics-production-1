"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, ChevronDown, Star, ShoppingBag, ArrowRight, X, Heart } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import { Button } from "../../components/ui/Button";
import ProductImage from "../../components/ui/ProductImage";
import { apiUrl } from "../../constants";

export default function ShopPage() {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedConcern, setSelectedConcern] = useState("All");
  const [sortBy, setSortBy] = useState("Featured");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(apiUrl("/api/products"));
        const data = await res.json();
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.products)
              ? data.products
              : [];
        setProducts(items);
      } catch (error) {
        console.error("Failed to fetch products", error);
      }
    };
    fetchProducts();
  }, []);

  const slides = useMemo(() => {
    return products.slice(0, 3).map((product, index) => ({
      title: product.name,
      desc: product.description,
      tag: product.tag || product.category,
      bg: ["bg-[#FF9A9E]/10", "bg-brand-olive/10", "bg-brand-pink/10"][index] || "bg-brand-dark/10",
      img: product.image,
      cta: "View Product",
      id: product.id,
    }));
  }, [products]);

  useEffect(() => {
    if (!slides.length) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const categories = ["All", ...new Set(products.map(p => p.category))];
  const concerns = ["All", ...new Set(products.map(p => p.concern))];

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
      const matchesConcern = selectedConcern === "All" || p.concern === selectedConcern;
      return matchesSearch && matchesCategory && matchesConcern;
    });

    if (sortBy === "Price: Low to High") result.sort((a, b) => a.price - b.price);
    if (sortBy === "Price: High to Low") result.sort((a, b) => b.price - a.price);
    if (sortBy === "Top Rated") result.sort((a, b) => b.rating - a.rating);

    return result;
  }, [products, searchQuery, selectedCategory, selectedConcern, sortBy]);

  return (
    <div className="min-h-screen pb-10 bg-[#FDFBF7] selection:bg-brand-pink/30 overflow-x-hidden">
      
      {/* ══════ REFINED LUXURY HERO SLIDER ══════ */}
      <div className="w-full relative h-[65vh] min-h-125 overflow-hidden group">
        <div 
          className="h-full flex transition-transform duration-1500 ease-[cubic-bezier(0.19,1,0.22,1)]"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {slides.map((slide, idx) => (
            <div 
              key={idx}
              className="min-w-full h-full relative flex items-center"
            >
              {/* Background Image with Overlay */}
              <div className="absolute inset-0 z-0">
                <img 
                  src="/images/hero-bg.png" 
                  alt="Hero Background" 
                  className="w-full h-full object-cover transition-transform duration-4000 ease-out group-hover:scale-105"
                  onError={(e) => { e.target.src = slide.img }}
                />
                <div className="absolute inset-0 bg-linear-to-r from-brand-dark/70 via-brand-dark/20 to-transparent" />
              </div>

              <div className="container mx-auto px-6 md:px-12 relative z-10">
                <div className="max-w-3xl space-y-6">
                  <div className="overflow-hidden">
                    <span className={`inline-block px-5 py-1.5 rounded-full bg-brand-pink text-white text-[9px] font-black uppercase tracking-[0.4em] shadow-2xl transition-transform duration-1000 delay-300 ${idx === currentSlide ? 'translate-y-0' : 'translate-y-full'}`}>
                      {slide.tag}
                    </span>
                  </div>
                  <h2 className={`font-serif text-5xl md:text-7xl font-bold tracking-tight text-white leading-[1.1] transition-all duration-1000 delay-500 ${idx === currentSlide ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
                    {slide.title}
                  </h2>
                  <p className={`text-white/70 text-base md:text-xl font-medium max-w-xl leading-relaxed transition-all duration-1000 delay-700 ${idx === currentSlide ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                    {slide.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Navigation Arrows (Amazon Style) */}
        <button 
          onClick={() => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)}
          className="absolute left-0 top-0 bottom-0 w-20 flex items-center justify-center bg-transparent hover:bg-white/5 text-white transition-all opacity-0 group-hover:opacity-100 z-40"
        >
          <ChevronDown size={40} className="rotate-90 opacity-50 hover:opacity-100" />
        </button>
        <button 
          onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
          className="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center bg-transparent hover:bg-white/5 text-white transition-all opacity-0 group-hover:opacity-100 z-40"
        >
          <ChevronDown size={40} className="-rotate-90 opacity-50 hover:opacity-100" />
        </button>
        
        {/* Progress Navigation (Refined) */}
        <div className="absolute bottom-12 left-6 md:left-12 flex items-center gap-6 z-30">
          <div className="flex gap-3">
            {slides.map((_, i) => (
              <button 
                key={i}
                onClick={() => setCurrentSlide(i)}
                className="group py-3"
              >
                <div className={`h-0.5 transition-all duration-700 ${i === currentSlide ? 'w-16 bg-white' : 'w-8 bg-white/20 group-hover:bg-white/40'}`} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-12 mt-10">
        
        {/* Perfect Alignment Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-12 border-b border-brand-dark/5 pb-16">
          <div className="max-w-2xl">
            <h1 className="font-serif text-7xl md:text-[8rem] font-bold tracking-tighter text-brand-dark mb-8 leading-[0.8]">
              Scientific <br /><span className="text-brand-pink italic">Rituals.</span>
            </h1>
            <p className="text-brand-dark/30 text-[11px] font-black uppercase tracking-[0.4em] leading-relaxed max-w-lg">
              Precision skincare for the modern ritual. <br />Experience the convergence of nature and clinical science.
            </p>
          </div>
          
          <div className="w-full lg:w-auto flex flex-col sm:flex-row items-center gap-4">
            <div className="relative group w-full sm:w-96">
              <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                <Search size={18} className="text-brand-dark/20 group-focus-within:text-brand-pink transition-colors" />
              </div>
              <input 
                type="text" 
                placeholder="Find your formula..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-18 pl-16 pr-8 bg-white border border-brand-dark/5 rounded-[1.25rem] text-sm focus:outline-none focus:border-brand-dark/10 transition-all shadow-sm focus:shadow-2xl focus:shadow-brand-dark/5 placeholder:text-brand-dark/20"
              />
            </div>
            <button 
              onClick={() => setIsFilterOpen(true)}
              className="w-full sm:w-auto h-18 flex items-center justify-center gap-5 px-12 rounded-[1.25rem] bg-brand-dark text-white text-[11px] font-black uppercase tracking-[0.25em] hover:bg-brand-pink transition-all shadow-2xl shadow-brand-dark/10 group active:scale-95"
            >
              <SlidersHorizontal size={18} className="group-hover:rotate-180 transition-transform duration-700" />
              Filter & Sort
            </button>
          </div>
        </div>

        {/* Note: Old Filter Drawer is removed. Side Panel will be added below. */}

        {/* Product Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 md:gap-x-8 gap-y-8 md:gap-y-16">
          {filteredProducts.map((product) => (
            <div key={product.id} className="group flex flex-col h-full">
              {/* Image Container */}
              <div className="relative aspect-square rounded-3xl md:rounded-4xl overflow-hidden bg-white mb-4 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-brand-dark/3 group-hover:shadow-2xl group-hover:shadow-brand-dark/5 transition-all duration-700">
                <Link href={`/shop/${product.id}`} className="block w-full h-full relative overflow-hidden">
                  <ProductImage
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    iconSize={40}
                  />
                  <div className="absolute inset-0 bg-brand-dark/0 group-hover:bg-brand-dark/5 transition-colors duration-700" />
                </Link>
                
                {/* Floating Badges */}
                <div className="absolute top-3 left-3 md:top-6 md:left-6 flex flex-col gap-1 md:gap-2">
                  <span className="bg-white/90 backdrop-blur-md px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[7px] md:text-[8px] font-black uppercase tracking-widest text-brand-dark shadow-sm">
                    {product.category}
                  </span>
                  {product.rating > 4.8 && (
                    <span className="bg-brand-pink px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[7px] md:text-[8px] font-black uppercase tracking-widest text-white shadow-sm">
                      Best Seller
                    </span>
                  )}
                </div>

                {/* Wishlist Toggle */}
                <button 
                  onClick={() => toggleWishlist(product)}
                  className="absolute top-3 right-3 md:top-6 md:right-6 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-brand-dark hover:bg-brand-pink hover:text-white transition-all shadow-xl z-10"
                >
                  <Heart size={18} className={isInWishlist(product.id) ? "fill-brand-pink text-brand-pink" : "transition-transform group-active:scale-90"} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col px-1 md:px-2">
                <div className="flex justify-between items-start mb-1 md:mb-2 gap-2">
                  <Link href={`/shop/${product.id}`} className="font-serif text-lg md:text-2xl font-bold text-brand-dark hover:text-brand-pink transition-colors leading-tight flex-1 line-clamp-2 md:line-clamp-none">
                    {product.name}
                  </Link>
                  <span className="font-serif text-base md:text-xl font-bold text-brand-dark shrink-0">₹{typeof product.price === 'number' ? product.price.toLocaleString('en-IN') : product.price}</span>
                </div>
                
                <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                  <div className="flex items-center gap-0.5 md:gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={10} className={i < Math.floor(product.rating) ? "fill-brand-pink text-brand-pink" : "text-brand-dark/10"} />
                    ))}
                  </div>
                  <span className="text-[8px] md:text-[10px] font-black text-brand-dark/30 tracking-widest uppercase">({product.reviews})</span>
                </div>
                
                <p className="hidden md:block text-xs text-brand-dark/50 font-medium leading-relaxed line-clamp-2 mb-6">
                  {product.description}
                </p>
                
                <div className="mt-auto space-y-4">
                  {/* Permanent Add to Bag Button */}
                  <button 
                    onClick={() => addToCart({ ...product, quantity: 1 })}
                    className="w-full bg-brand-dark text-white py-3 md:py-4 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-pink transition-colors shadow-lg active:scale-95"
                  >
                    <ShoppingBag size={12} className="md:w-3.5 md:h-3.5" />
                    Add to Bag
                  </button>

                  <Link 
                    href={`/shop/${product.id}`}
                    className="flex items-center gap-2 text-[8px] md:text-[10px] font-black tracking-[0.2em] uppercase text-brand-dark/40 group-hover:text-brand-pink transition-colors"
                  >
                    View Details <ArrowRight size={12} className="md:w-3.5 md:h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredProducts.length === 0 && (
          <div className="py-40 text-center bg-white rounded-[3rem] border border-dashed border-brand-dark/10 shadow-inner">
            <div className="w-20 h-20 bg-[#FDFBF7] rounded-3xl flex items-center justify-center mx-auto mb-6 text-brand-dark/20">
              <Search size={32} />
            </div>
            <h3 className="font-serif text-3xl font-bold text-brand-dark mb-2">No formulas found</h3>
            <p className="text-brand-dark/40 text-sm font-medium uppercase tracking-widest">Try adjusting your filters or search query.</p>
          </div>
        )}

      </div>

      {/* ══════ FILTER SIDE PANEL ══════ */}
      <div className={`fixed inset-0 z-200 transition-opacity duration-500 ${isFilterOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" onClick={() => setIsFilterOpen(false)} />
        <div className={`absolute top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${isFilterOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="h-full flex flex-col p-10 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-12">
              <h2 className="font-serif text-3xl font-bold text-brand-dark">Filter & Sort</h2>
              <button onClick={() => setIsFilterOpen(false)} className="w-10 h-10 rounded-full bg-[#FDFBF7] border border-brand-dark/5 flex items-center justify-center text-brand-dark hover:bg-brand-pink hover:text-white transition-all">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-12 flex-1">
              {/* Category Section */}
              <div className="space-y-6">
                <h4 className="text-[10px] font-black tracking-[0.3em] uppercase text-brand-dark/30">Category</h4>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map(cat => (
                    <button 
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`text-left px-5 py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${selectedCategory === cat ? 'bg-brand-dark text-white border-brand-dark shadow-lg shadow-brand-dark/10' : 'bg-[#FDFBF7] text-brand-dark/60 border-brand-dark/5 hover:border-brand-pink'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Concern Section */}
              <div className="space-y-6">
                <h4 className="text-[10px] font-black tracking-[0.3em] uppercase text-brand-dark/30">Skin Concern</h4>
                <div className="grid grid-cols-2 gap-2">
                  {concerns.map(con => (
                    <button 
                      key={con}
                      onClick={() => setSelectedConcern(con)}
                      className={`text-left px-5 py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${selectedConcern === con ? 'bg-brand-dark text-white border-brand-dark shadow-lg shadow-brand-dark/10' : 'bg-[#FDFBF7] text-brand-dark/60 border-brand-dark/5 hover:border-brand-pink'}`}
                    >
                      {con}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort Section */}
              <div className="space-y-6">
                <h4 className="text-[10px] font-black tracking-[0.3em] uppercase text-brand-dark/30">Sort By</h4>
                <div className="space-y-2">
                  {["Featured", "Price: Low to High", "Price: High to Low", "Top Rated"].map(option => (
                    <button 
                      key={option}
                      onClick={() => setSortBy(option)}
                      className={`w-full text-left px-5 py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${sortBy === option ? 'bg-brand-pink/5 text-brand-pink border-brand-pink/20' : 'bg-[#FDFBF7] text-brand-dark/60 border-brand-dark/5 hover:border-brand-pink'}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-12 mt-12 border-t border-brand-dark/5 space-y-4">
              <button 
                onClick={() => { setSelectedCategory("All"); setSelectedConcern("All"); setSortBy("Featured"); setSearchQuery(""); }}
                className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-brand-dark/40 hover:text-brand-pink transition-colors text-center"
              >
                Reset All Filters
              </button>
              <Button onClick={() => setIsFilterOpen(false)} variant="primary" className="w-full justify-center py-6 shadow-2xl shadow-brand-dark/10">
                Show {filteredProducts.length} Results
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
