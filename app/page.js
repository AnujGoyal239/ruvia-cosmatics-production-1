"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Star, ArrowRight, Play, ChevronRight, ChevronLeft, Droplets, FlaskConical, Sparkles, CheckCircle2, Plus, Minus, Microscope, MapPin, Zap, Gift } from "lucide-react";
import { toast } from "sonner";


import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { Button } from "../components/ui/Button";
import { AnimatedHeading } from "../components/ui/AnimatedHeading";
import { steps, apiUrl } from "../constants";

import { csrfFetch } from "../lib/csrf";
export default function Home() {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const router = useRouter();
  const [catalog, setCatalog] = useState([]);

  // Newsletter / welcome-coupon form state. The form is open to guests:
  // submitting it issues a 15% off promo code (default WELCOME15) and
  // emails it to the address provided. No login required.
  const [subscribeEmail, setSubscribeEmail] = useState("");
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [subscribeSuccess, setSubscribeSuccess] = useState(null); // { code, percentOff }

  const handleNewsletterSubmit = async (event) => {
    event.preventDefault();
    const email = subscribeEmail.trim();
    if (!email) {
      toast.error("Enter your email to claim the coupon.");
      return;
    }

    try {
      setSubscribeLoading(true);
      const res = await csrfFetch(apiUrl("/api/promotions/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Could not send the coupon. Try again.");
      }

      setSubscribeSuccess({
        code: data.code || "WELCOME15",
        percentOff: data.percentOff || 15,
      });
      setSubscribeEmail("");
      toast.success(
        `${data.percentOff || 15}% off coupon ${data.code || "WELCOME15"} sent to ${email}.`
      );
    } catch (err) {
      console.error("Newsletter subscribe failed:", err);
      toast.error(err.message || "Could not send the coupon. Try again.");
    } finally {
      setSubscribeLoading(false);
    }
  };

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const res = await csrfFetch(apiUrl("/api/products"));
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : null;
        if (items) setCatalog(items);
      } catch (e) {
        // Silent: homepage should still work without backend
      }
    };
    loadCatalog();
  }, []);

  const resolveCatalogProduct = (product) => {
    if (!product) return null;
    // Prefer id match
    const byId = catalog.find((p) => String(p.id) === String(product.id));
    if (byId) return byId;
    // Fallback to name match for legacy hardcoded homepage products (p1, p2...)
    const byName = catalog.find((p) => String(p.name || "").toLowerCase() === String(product.name || "").toLowerCase());
    return byName || null;
  };

  const handleAddToCart = (product, e) => {
    if (e) e.preventDefault();
    const resolved = resolveCatalogProduct(product);
    if (!resolved) {
      // If backend catalog isn't available / doesn't contain this product,
      // avoid adding an invalid id (causes /api/cart and /api/orders 400s).
      router.push("/shop");
      return;
    }
    addToCart({
      id: resolved.id,
      name: resolved.name,
      price: resolved.price,
      img: resolved.image,
      image: resolved.image, // compatibility with checkout mapping (ci.image || ci.img)
      quantity: 1,
    });
  };

  const mainRef = useRef(null);
  const sliderRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);
  const [activeFaq, setActiveFaq] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);
  const [showStickyCta, setShowStickyCta] = useState(false);

  const checkScroll = () => {
    if (sliderRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
      setCanScrollPrev(scrollLeft > 10);
      setCanScrollNext(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const slider = sliderRef.current;
    if (slider) {
      slider.addEventListener('scroll', checkScroll);
      return () => slider.removeEventListener('scroll', checkScroll);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowStickyCta(window.scrollY > window.innerHeight * 0.8);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      // Hero Animation
      gsap.from(".hero-title span", {
        y: 100,
        opacity: 0,
        stagger: 0.12,
        duration: 1.8,
        ease: "power4.out",
        delay: 0.2
      });

      // Section Entrance Animations
      const sections = gsap.utils.toArray(".reveal-section");
      sections.forEach((section) => {
        gsap.from(section, {
          y: 60,
          opacity: 0,
          duration: 1.2,
          scrollTrigger: {
            trigger: section,
            start: "top 90%",
            once: true
          }
        });
      });

      // Horizontal Tickers (Press & Testimonials)
      gsap.to(".ticker-track", {
        xPercent: -50,
        repeat: -1,
        duration: 30,
        ease: "none"
      });



      // Parallax for editorial images
      const parallaxImages = gsap.utils.toArray(".parallax-img");
      if (parallaxImages.length > 0) {
        parallaxImages.forEach((img) => {
          gsap.to(img, {
            y: -80,
            ease: "none",
            scrollTrigger: {
              trigger: img.closest(".parallax-container") || img,
              start: "top bottom",
              end: "bottom top",
              scrub: true
            }
          });
        });
      }

    }, mainRef);

    return () => ctx.revert();
  }, []);

  const slide = (direction) => {
    if (sliderRef.current) {
      const firstCard = sliderRef.current.querySelector('.product-card');
      const cardWidth = firstCard ? firstCard.offsetWidth : 400;
      const gap = window.innerWidth < 768 ? 32 : 48; // md:gap-12 is 48px, gap-8 is 32px
      const scrollAmount = direction === "next" ? cardWidth + gap : -(cardWidth + gap);
      sliderRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div ref={mainRef} className="relative overflow-hidden">
      {/* HERO SECTION — VIDEO-IN-CARD ON DARK BG */}
      <section className="relative w-full bg-brand-dark text-brand-beige pt-32 pb-12 md:pt-36 md:pb-16 px-6 md:px-12 overflow-hidden">
        {/* Soft ambient glows so the dark bg isn't flat */}
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-brand-pink/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-brand-pink/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto flex flex-col items-center gap-10">
          {/* Centered video card */}
          <div className="relative w-full aspect-video md:aspect-[16/8] rounded-[2rem] md:rounded-[3rem] overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] border border-white/10">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            >
              <source src="https://res.cloudinary.com/dsokrcmrp/video/upload/v1780054564/ruvia_site/hero_video.mp4" type="video/mp4" />
            </video>
            {/* Bottom soft fade for any caption text we add later */}
            <div className="absolute inset-0 bg-linear-to-t from-brand-dark/30 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <Button variant="secondary" className="shadow-xl" onClick={() => router.push("/shop")}>
              Shop Bestsellers — ₹1,299 Onwards
            </Button>
            <Button variant="outline" className="text-white border-white/40 hover:bg-white hover:text-brand-dark" onClick={() => router.push("/shop")}>
              What Does My Skin Need? — Free Quiz
            </Button>
          </div>

          {/* Trust strip */}
          <div className="flex items-center gap-3 opacity-70">
            <span className="text-[8px] md:text-[9px] text-brand-beige font-black tracking-[0.3em] uppercase">Free Shipping</span>
            <div className="w-1 h-1 rounded-full bg-brand-pink" />
            <span className="text-[8px] md:text-[9px] text-brand-beige font-black tracking-[0.3em] uppercase">30-Day Full Refund</span>
          </div>
        </div>
      </section>

      {/* OFFERS SECTION (Ghar Soaps / Mamaearth Style GenZ Vibe) */}
      {/*
      <section className="py-6 md:py-10 bg-white relative z-20 md:-mt-10 rounded-t-4xl md:rounded-t-[3rem] shadow-[0_-15px_40px_rgba(0,0,0,0.08)]">
        <div className="container mx-auto px-4 md:px-12">
          <div className="flex items-center gap-4 mb-6">
            <span className="text-[10px] md:text-xs uppercase tracking-[0.3em] font-black text-brand-dark flex items-center gap-2"><Sparkles size={14} className="text-brand-pink" /> Trending Offers</span>
            <div className="flex-1 h-px bg-brand-dark/10" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="group relative overflow-hidden rounded-4xl p-6 bg-linear-to-br from-[#FF9A9E]/20 to-[#FECFEF]/40 hover:from-[#FF9A9E]/30 hover:to-[#FECFEF]/60 transition-all duration-500 border border-[#FF9A9E]/20">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#FF9A9E]/30 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700" />
              <div className="flex justify-between items-start mb-8">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <Gift className="text-brand-pink" size={24} />
                </div>
                <span className="bg-white text-brand-pink text-[9px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full shadow-sm">Festive Drop</span>
              </div>
              <h3 className="font-serif text-3xl font-bold tracking-tighter text-brand-dark mb-1">The Glow Up Kit</h3>
              <p className="text-brand-dark/60 text-xs font-bold tracking-wide uppercase mb-6">Flat 40% Off + Free Jade Roller</p>
              <Button variant="primary" className="w-full justify-center py-6 text-[10px]" onClick={() => router.push("/shop")}>Claim Festival Offer</Button>
            </div>

            <div className="group relative overflow-hidden rounded-4xl p-6 bg-linear-to-br from-[#A1C4FD]/20 to-[#C2E9FB]/40 hover:from-[#A1C4FD]/30 hover:to-[#C2E9FB]/60 transition-all duration-500 border border-[#A1C4FD]/20">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#A1C4FD]/30 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700" />
              <div className="flex justify-between items-start mb-8">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <Zap className="text-[#66A6FF]" size={24} />
                </div>
                <span className="bg-white text-[#66A6FF] text-[9px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full shadow-sm">Flash Sale</span>
              </div>
              <h3 className="font-serif text-3xl font-bold tracking-tighter text-brand-dark mb-1">Buy 1 Get 1 Free</h3>
              <p className="text-brand-dark/60 text-xs font-bold tracking-wide uppercase mb-6">On All Vitamin C Serums Today</p>
              <Button onClick={() => router.push("/shop")} className="w-full bg-brand-dark text-white rounded-full py-6 text-[10px] font-black uppercase tracking-widest hover:bg-[#66A6FF] transition-colors">Shop B1G1 Now</Button>
            </div>

            <div className="group relative overflow-hidden rounded-4xl p-6 bg-linear-to-br from-[#D4FC79]/20 to-[#96E6A1]/40 hover:from-[#D4FC79]/30 hover:to-[#96E6A1]/60 transition-all duration-500 border border-[#96E6A1]/20">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#96E6A1]/30 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700" />
              <div className="flex justify-between items-start mb-8">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <MapPin className="text-[#52C234]" size={24} />
                </div>
                <span className="bg-white text-[#52C234] text-[9px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full shadow-sm">Mumbai & NCR</span>
              </div>
              <h3 className="font-serif text-3xl font-bold tracking-tighter text-brand-dark mb-1">Humidity Shield</h3>
              <p className="text-brand-dark/60 text-xs font-bold tracking-wide uppercase mb-6">Extra 15% Off For Coastal Cities</p>
              <Button onClick={() => router.push("/shop")} className="w-full bg-brand-dark text-white rounded-full py-6 text-[10px] font-black uppercase tracking-widest hover:bg-[#52C234] transition-colors">Unlock City Code</Button>
            </div>
          </div>
        </div>
      </section>
      */}

      {/* PRESS TICKER */}
      <div className="bg-brand-nude/30 py-10 md:py-14 border-y border-brand-pink/20 overflow-hidden">
        <p className="text-center text-[9px] md:text-[10px] uppercase tracking-[0.5em] font-black text-brand-dark/40 mb-2">Recommended by 200+ dermatologists across India</p>
        <p className="text-center text-[8px] uppercase tracking-[0.4em] font-bold text-brand-dark/20 mb-8">As seen in</p>
        <div className="ticker-track flex whitespace-nowrap gap-16 md:gap-32 items-center opacity-70 brightness-90">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-center gap-16 md:gap-32">
              <span className="font-serif text-2xl md:text-5xl font-black italic tracking-tighter uppercase">VOGUE</span>
              <span className="font-serif text-2xl md:text-5xl font-black tracking-tighter uppercase">ELLE</span>
              <span className="font-serif text-2xl md:text-5xl font-black italic tracking-tighter uppercase">FORBES</span>
              <span className="font-serif text-2xl md:text-5xl font-black tracking-tighter uppercase">BYRDIE</span>
            </div>
          ))}
        </div>
      </div>

      {/* PRODUCT SLIDER */}
      <section className="reveal-section py-5 bg-white overflow-hidden">
        <div className="container mx-auto px-4 md:px-12">
          <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-8">
            <div className="max-w-xxl text-left w-full md:w-auto">
              <span className="text-[10px] uppercase tracking-[0.5em] font-black text-brand-olive mb-6 block opacity-50">What 50,000+ Women Reorder</span>
              <AnimatedHeading className="font-serif text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-4 text-brand-dark">They Tried. They Stayed.</AnimatedHeading>
              <p className="text-brand-dark/40 text-[10px] md:text-xs font-bold tracking-widest uppercase">87% repurchase rate. That's not marketing. That's results.</p>
            </div>

            <div className="flex gap-4 w-full md:w-auto justify-end">
              <button
                onClick={() => slide("prev")}
                disabled={!canScrollPrev}
                className={`w-14 h-14 md:w-20 md:h-20 rounded-full border border-brand-dark/10 flex items-center justify-center transition-all duration-500 ${!canScrollPrev ? 'opacity-10 cursor-not-allowed' : 'hover:bg-brand-olive hover:text-white opacity-100'}`}
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={() => slide("next")}
                disabled={!canScrollNext}
                className={`w-14 h-14 md:w-20 md:h-20 rounded-full border border-brand-dark/10 flex items-center justify-center transition-all duration-500 ${!canScrollNext ? 'opacity-10 cursor-not-allowed' : 'hover:bg-brand-olive hover:text-white opacity-100'}`}
              >
                <ChevronRight size={24} />
              </button>
            </div>
          </div>

          <div
            ref={sliderRef}
            onScroll={checkScroll}
            className="flex gap-8 md:gap-12 overflow-x-auto no-scrollbar pb-10 px-0 snap-x snap-mandatory scroll-smooth"
          >
            {(() => {
              // Curated bestsellers: client-picked order. We match by name
              // (case-insensitive, lightly normalised) so the list survives
              // small punctuation differences between this list and the DB
              // copy. Each entry is mapped onto the matching DB product so
              // ids, prices, and Cloudinary images stay authoritative.
              const bestsellerNames = [
                'Ruvia Cosmetic Omega Glow Cleanser',
                'Ruvia Cosmetic Rice & Potato Luminance Bath Soap Bar',
                'Ruvia Cosmetics All in One Glass Skin Body Bath',
                'Ruvia Cosmetic Organic Neem Leaf Powder',
                'Ruvia Cosmetics Organic Rose Petal Powder',
                'Ruvia Cosmetic Organic Papaya Powder',
                'Ruvia Cosmetics Mogra Grapes Soap',
              ];
              const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
              const bestsellers = bestsellerNames
                .map((wanted) => catalog.find((p) => norm(p.name) === norm(wanted)))
                .filter(Boolean);
              return bestsellers.map((p, idx) => ({
                id: p.id,
                name: p.name,
                price: Number(p.price || 0),
                mrp: Number(p.mrp || Math.round((Number(p.price || 0) * 1.3))),
                cat:
                  idx === 0
                    ? '🔥 Bestseller'
                    : p.category
                    ? `★ ${String(p.category).toUpperCase()}`
                    : '★ Pick',
                image: p.image,
                hook: p.shortDescription || p.description || '',
                rating: p.rating ? Number(p.rating).toFixed(1) : '4.8',
                reviews: p.numReviews
                  ? `${Number(p.numReviews).toLocaleString('en-IN')}`
                  : '',
              }));
            })().map((prod, idx) => (
              <div key={prod.id || idx} className="min-w-[260px] md:min-w-[320px] group product-card snap-center product-focus">
                <div className="relative rounded-[2rem] md:rounded-[3rem] overflow-hidden aspect-square mb-6 bg-brand-nude border border-brand-pink/20 transition-all duration-700">
                  <img src={prod.image} alt={prod.name} className="w-full h-full object-cover transition-transform duration-[1.5s] group-hover:scale-110 brightness-[1.05]" />
                  <div className="absolute top-5 left-5">
                    <span className="bg-white/90 text-brand-pink px-4 py-2 rounded-full text-[9px] font-black tracking-widest uppercase shadow-sm border border-brand-pink/10">
                      {prod.cat}
                    </span>
                  </div>
                  <div className="absolute bottom-5 left-5 right-5 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-700">
                    <Button variant="secondary" className="w-full justify-center text-white font-black text-[9px] py-4" onClick={(e) => handleAddToCart(prod, e)}>Add to Bag — ₹{prod.price.toLocaleString("en-IN")}</Button>
                  </div>
                </div>
                <div className="px-2">
                  <div className="flex justify-between items-start mb-1 gap-3">
                    <h3 className="font-serif text-xl md:text-2xl font-bold tracking-tighter text-brand-dark leading-tight line-clamp-2">{prod.name}</h3>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-sm font-black tracking-widest text-brand-pink">₹{prod.price.toLocaleString('en-IN')}</span>
                      {prod.mrp && prod.mrp > prod.price ? (
                        <span className="text-[9px] font-bold tracking-wider text-brand-dark/30 line-through">₹{prod.mrp.toLocaleString('en-IN')}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex gap-0.5 text-brand-pink">
                      {[...Array(5)].map((_, j) => <Star key={j} size={10} fill="currentColor" />)}
                    </div>
                    <span className="text-[9px] font-black tracking-wider text-brand-dark/40">{prod.rating}{prod.reviews ? ` (${prod.reviews} reviews)` : ""}</span>
                  </div>
                  {prod.hook ? (
                    <p className="text-[10px] font-bold tracking-wide text-brand-dark/50 uppercase line-clamp-2">{prod.hook}</p>
                  ) : null}
                </div>
              </div>
            ))}

            {catalog && catalog.length === 0 ? (
              <div className="min-w-[260px] md:min-w-[320px] snap-center flex items-center justify-center py-24 text-brand-dark/40 text-[10px] font-black tracking-widest uppercase">
                Loading bestsellers...
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* BEFORE & AFTER RESULTS (Social Proof) */}
      <section className="reveal-section py-5 bg-brand-beige">
        <div className="container mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center parallax-container">
          <div className="relative rounded-[3rem] md:rounded-[4.5rem] overflow-hidden aspect-square shadow-2xl border-8 border-white">
            <img src="/images/results.png" alt="Clinical Results" className="w-full h-full object-cover parallax-img scale-125" />
            <div className="absolute top-10 left-10 bg-white/20 backdrop-blur-md px-6 py-3 rounded-full text-[10px] font-black text-white uppercase tracking-widest border border-white/20">Before</div>
            <div className="absolute top-10 right-10 bg-brand-pink px-6 py-3 rounded-full text-[10px] font-black text-brand-dark uppercase tracking-widest shadow-xl after-side-glow border border-white/40">After 28 Days</div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.5em] font-black text-brand-olive mb-2 block">Unedited. Unfiltered. Real Women.</span>
            <AnimatedHeading className="font-serif text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-8 text-brand-dark">They Didn't Believe It Either</AnimatedHeading>
            <div className="space-y-12">
              {[
                { label: "SKIN FELT TIGHTER", value: "+42%", desc: "That bounce you had in your 20s? Women got it back in 4 weeks." },
                { label: "STOPPED USING FOUNDATION", value: "98%", desc: "98 out of 100 women ditched foundation within one month." },
                { label: "POLLUTION COULDN'T TOUCH THEM", value: "+60%", desc: "Metro city dust, auto smoke, hard water — skin stayed clear." }
              ].map((stat, i) => (
                <div key={i} className="flex items-start gap-8 border-b border-brand-dark/10 pb-8 last:border-0">
                  <span className="font-serif text-4xl md:text-6xl font-bold text-brand-pink">{stat.value}</span>
                  <div>
                    <h4 className="text-[10px] font-black tracking-[0.2em] mb-2 uppercase">{stat.label}</h4>
                    <p className="text-xs font-medium text-brand-dark/50 leading-relaxed max-w-xs">{stat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* THE RITUAL */}
      {/*
      <section className="reveal-section py-5 md:py-10 bg-brand-dark text-brand-beige overflow-hidden">
        <div className="container mx-auto px-6 md:px-12">
          <div className="flex items-center gap-6 mb-5 md:mb-10 justify-center lg:justify-start">
            <span className="text-[10px] uppercase tracking-[0.8em] font-black text-brand-pink">How It Works</span>
            <div className="w-12 h-px bg-brand-pink/30" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="order-2 lg:order-1">
              <div className="hidden lg:flex flex-col gap-10 sticky top-40">
                {steps.map((s, i) => (
                  <div
                    key={i}
                    onMouseEnter={() => setActiveStep(i)}
                    onClick={() => setActiveStep(i)}
                    className={`cursor-pointer transition-all duration-700 group flex items-start gap-8 ${activeStep === i ? "opacity-100 translate-x-4" : "opacity-20 hover:opacity-40"}`}
                  >
                    <span className="font-serif text-6xl font-black italic text-brand-pink leading-none shrink-0">0{i + 1}</span>
                    <div className="pt-2">
                      <h3 className="text-lg font-black tracking-[0.3em] uppercase mb-3">{s.title}</h3>
                      <p className={`text-xs text-brand-beige/50 leading-relaxed transition-all duration-700 max-w-xs ${activeStep === i ? "opacity-100" : "opacity-0"}`}>
                        {s.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="lg:hidden flex justify-between items-center bg-white/5 backdrop-blur-xl rounded-full p-2 border border-white/10 mt-1">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveStep(i)}
                    className={`grow py-4 rounded-full text-[10px] font-black tracking-[0.3em] transition-all duration-500 ${activeStep === i ? "bg-brand-pink text-brand-dark shadow-xl" : "text-white/40"}`}
                  >
                    0{i + 1}
                  </button>
                ))}
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="relative max-w-lg mx-auto lg:max-w-none">
                <div className="relative aspect-4/5 rounded-[2.5rem] md:rounded-[4rem] overflow-hidden shadow-2xl border-4 md:border-8 border-white/5">
                  <img
                    src={steps[activeStep].img}
                    alt={steps[activeStep].title}
                    className="w-full h-full object-cover transition-all duration-1000"
                    key={activeStep}
                  />

                  <div className="absolute bottom-4 md:bottom-8 left-4 md:left-8 right-4 md:right-8">
                    <div className="bg-brand-dark/50 backdrop-blur-2xl p-6 md:p-8 rounded-2xl md:rounded-3xl border border-white/10">
                      <span className="text-brand-pink text-[9px] font-black tracking-[0.5em] uppercase block mb-2">Phase 0{activeStep + 1}</span>
                      <h3 className="text-2xl md:text-4xl font-serif font-bold italic tracking-tighter mb-2">{steps[activeStep].title}</h3>
                      <p className="text-[10px] md:text-xs text-brand-beige/60 leading-relaxed max-w-sm">{steps[activeStep].desc}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      */}

      {/* OUR LABORATORY SECTION */}
      <section className="reveal-section py-5 md:py-10 bg-white">
        <div className="container mx-auto px-6 md:px-12 flex flex-col items-center text-center">
          <span className="text-[10px] uppercase tracking-[0.5em] font-black text-brand-olive mb-10 opacity-50">Why Other Products Fail You</span>
          <AnimatedHeading className="font-serif text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-8 text-center justify-center text-brand-dark">Your Serum Evaporates. Ours Doesn't.</AnimatedHeading>

          <div className="relative w-full max-w-6xl aspect-15/10 rounded-[3rem] md:rounded-[5rem] overflow-hidden shadow-2xl border-8 border-brand-beige mb-10 group soft-glow">
            <img src="/images/lab.png" alt="Laboratory" className="w-full h-full object-cover transition-transform duration-[4s] group-hover:scale-105" />
            <div className="absolute inset-0 bg-brand-dark/10 group-hover:bg-transparent transition-all duration-1000" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-left max-w-6xl w-full">
            {[
              { icon: <Droplets />, title: "It Actually Goes In", desc: "Most serums sit on your face and evaporate. Ours uses molecules 10x smaller — your skin absorbs it, not your pillow." },
              { icon: <FlaskConical />, title: "Doctor-Level Doses", desc: "Not 0.5% Vitamin C for marketing. We use the exact % dermatologists prescribe. The real amount. Not the label amount." },
              { icon: <Sparkles />, title: "Won't Clog Your Pores", desc: "Cold-pressed Indian botanicals. No silicones. No mineral oil. Your skin breathes. Your pores stay clear." }
            ].map((f, i) => (
              <div key={i} className={`group relative bg-brand-beige/40 backdrop-blur-sm border border-brand-dark/5 p-10 md:p-12 rounded-[3.5rem] transition-all duration-700 hover:bg-white hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.08)] hover:-translate-y-4 flex flex-col items-center text-center ${i === 2 ? 'md:col-span-2 lg:col-span-1' : ''}`}>
                {/* Decorative Step Number */}
                <span className="absolute top-10 right-12 text-[10px] font-black tracking-[0.4em] text-brand-olive/20 group-hover:text-brand-pink transition-colors">0{i + 1}</span>

                {/* Icon Container with Floating Animation */}
                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-10 shadow-sm border border-brand-dark/5 group-hover:bg-brand-pink group-hover:text-brand-dark transition-all duration-500 transform group-hover:rotate-12">
                  {f.icon}
                </div>

                {/* Content */}
                <h3 className="font-serif text-2xl md:text-3xl font-bold mb-6 tracking-tighter uppercase leading-none">{f.title}</h3>
                <p className="text-xs md:text-sm font-medium text-brand-dark/50 leading-relaxed group-hover:text-brand-dark transition-colors duration-500">{f.desc}</p>

                {/* Subtle Glow Effect */}
                <div className="absolute inset-0 bg-brand-pink/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-[3.5rem] pointer-events-none" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOUNDER'S NOTE & VALUES */}
      <section className="reveal-section py-10 md:py-20 bg-brand-beige relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-pink/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="container mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="relative aspect-[4/3] rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden shadow-2xl bg-brand-beige">
            {/*
              Landscape 4:3 frame keeps the founder's full upper body and
              the on-photo credit ribbon visible without a tall white
              letterbox underneath. `object-cover object-center` crops
              evenly when the source ratio isn't an exact match.
            */}
            <img
              src="/images/founder.jpeg"
              alt="Dr. Chitra Bhati, Founder of Ruvia Cosmetics"
              className="w-full h-full object-cover object-center"
            />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.5em] font-black text-brand-olive mb-8 block">The Real Problem</span>
            <AnimatedHeading className="font-serif text-3xl md:text-5xl font-bold tracking-tight leading-[1.1] mb-8 text-brand-dark">It's Not Your Skin. It's Your Products.</AnimatedHeading>
            <p className="text-brand-dark/70 text-sm md:text-base font-medium leading-relaxed mb-12 max-w-xl">
              "You've wasted money on products made for European weather. Your skin lives in Indian humidity, Delhi pollution, hard water, and 40°C summers. That's why nothing worked. We built every Ruvia formula inside India, tested on 500+ Indian women, for the exact conditions your skin faces every single day."
            </p>
            <div className="grid grid-cols-2 gap-10">
              <div className="flex flex-col gap-4">
                <CheckCircle2 className="text-brand-olive" size={24} />
                <span className="text-[10px] font-black tracking-widest uppercase">Tested on Indian Skin Types</span>
              </div>
              <div className="flex flex-col gap-4">
                <CheckCircle2 className="text-brand-olive" size={24} />
                <span className="text-[10px] font-black tracking-widest uppercase">30-Day Money Back Guarantee</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SUSTAINABILITY SECTION */}
      <section className="reveal-section py-5 md:py-10 bg-brand-nude">
        <div className="container mx-auto px-6 md:px-12 flex flex-col md:flex-row items-center gap-8 md:gap-16 text-center md:text-left">
          <div className="w-full md:w-1/3">
            <h2 className="font-serif text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] text-brand-olive">What's Not In It.</h2>
          </div>
          <div className="w-full md:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
              <span className="text-[8px] font-black tracking-widest uppercase text-brand-olive">Banned from Our Lab</span>
              <p className="text-xs font-bold tracking-tight text-brand-dark/60 leading-relaxed uppercase">No parabens. No sulphates. No silicones. No mineral oil. No synthetic fragrance. 2,000+ irritants excluded.</p>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-[8px] font-black tracking-widest uppercase text-brand-olive">What Goes In</span>
              <p className="text-xs font-bold tracking-tight text-brand-dark/60 leading-relaxed uppercase">Cold-pressed Indian botanicals. Dermatologist-approved actives. Glass packaging. Zero compromise.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CLINICAL INGREDIENTS - AUTO-SCROLLING MARQUEE */}
      <section className="py-5 bg-brand-dark overflow-hidden border-y border-white/10">
        <div className="marquee-wrapper">
          <div className="marquee-track">
            {[
              "HYALURONIC ACID 2.0", "NIACINAMIDE", "SQUALANE",
              "VITAMIN C", "CERAMIDE COMPLEX", "PEPTIDE FUSION",
              "HYALURONIC ACID 2.0", "NIACINAMIDE", "SQUALANE",
              "VITAMIN C", "CERAMIDE COMPLEX", "PEPTIDE FUSION"
            ].map((ing, i) => (
              <span key={i} className="marquee-item">
                <span className="marquee-dot" />
                {ing}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* LAB INSIGHTS (FAQ) */}
      <section className="reveal-section py-5 md:py-10 bg-brand-beige overflow-hidden">
        <div className="container mx-auto px-6 md:px-12">
          {/* Full-Width Header */}
          <div className="mb-5 md:mb-10">
            <span className="text-[10px] uppercase tracking-[0.5em] font-black text-brand-olive opacity-40 mb-6 block">Common Questions</span>
            <AnimatedHeading className="font-serif text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] text-brand-dark mb-8">We Answer</AnimatedHeading>
          </div>

          {/* Two-column content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-20 items-start">
            {/* Questions */}
            <div>
              <div className="space-y-0">
                {[
                  { q: "I've tried 10+ products. Why would this work?", a: "Because those products weren't made for Indian conditions. Ruvia is formulated for Indian humidity, pollution, and hard water. Every formula is tested on 500+ Indian women before it ships. If it still doesn't work for you — full refund. No questions.", meta: "Made for India" },
                  { q: "How fast will I see something?", a: "You'll feel softer skin within 48 hours. By Day 14, people start noticing. By Day 21, you'll skip foundation on purpose. That's not a claim — that's what 98% of our users reported.", meta: "Visible by Day 21" },
                  { q: "My skin is very sensitive. Will it react?", a: "We excluded 2,000+ known irritants. Every product is pH-balanced and non-comedogenic. We built this for the most reactive Indian skin types. If it irritates you, we'll refund you. Period.", meta: "Sensitive-Skin Safe" },
                  { q: "What if I waste my money?", a: "You won't. We have a 30-day no-questions-asked refund policy. Use the full bottle. If you don't see a difference, we refund every rupee to your account. We take the risk so you don't have to.", meta: "30-Day Full Refund" }
                ].map((faq, i) => (
                  <div
                    key={i}
                    className="border-b border-brand-olive/10"
                  >
                    <button
                      onClick={() => setActiveFaq(i === activeFaq ? -1 : i)}
                      className="w-full flex justify-between items-center py-8 text-left group"
                    >
                      <div className="flex items-center gap-5">
                        <span className={`font-serif text-2xl md:text-3xl font-bold italic transition-colors duration-500 ${activeFaq === i ? "text-brand-pink" : "text-brand-olive"}`}>
                          0{i + 1}
                        </span>
                        <span className={`text-xs md:text-sm font-bold tracking-[0.15em] uppercase transition-colors duration-500 ${activeFaq === i ? "text-brand-dark" : "text-brand-dark/40 group-hover:text-brand-dark/70"}`}>
                          {faq.q}
                        </span>
                      </div>
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-500 ${activeFaq === i ? "border-brand-pink bg-brand-pink rotate-45" : "border-brand-olive"}`}>
                        <Plus size={14} className={`transition-colors ${activeFaq === i ? "text-white" : "text-brand-olive"}`} />
                      </div>
                    </button>
                    <div className={`overflow-hidden transition-all duration-700 ease-in-out ${activeFaq === i ? "max-h-60 opacity-100 pb-8" : "max-h-0 opacity-0"}`}>
                      <div className="pl-14">
                        <p className="text-xs md:text-sm text-brand-dark/60 leading-relaxed mb-5 max-w-lg">
                          {faq.a}
                        </p>
                        <span className="inline-block px-4 py-2 bg-brand-olive/5 rounded-full text-[8px] font-black tracking-widest uppercase text-brand-olive">
                          {faq.meta}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual */}
            <div className="lg:sticky lg:top-32">
              <div className="relative aspect-square rounded-[3rem] overflow-hidden shadow-2xl group border-8 border-white soft-glow">
                <img src="/images/faq.png" alt="Ruvia Formula" className="w-full h-full object-cover transition-transform duration-[3s] group-hover:scale-110" />
                <div className="absolute inset-0 bg-linear-to-t from-brand-dark/70 via-brand-dark/10 to-transparent" />

                {/* Top Label */}
                <div className="absolute top-8 left-8">
                  <div className="bg-white/10 backdrop-blur-xl px-5 py-3 rounded-full border border-white/20 flex items-center gap-3">
                    <Microscope className="text-brand-pink" size={16} />
                    <span className="text-white text-[9px] font-black tracking-[0.3em] uppercase">Active Scan</span>
                  </div>
                </div>

                {/* Bottom Stats */}
                <div className="absolute bottom-8 left-8 right-8">
                  <div className="bg-white/10 backdrop-blur-xl p-6 rounded-2xl border border-white/20">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-white text-[9px] font-black tracking-[0.3em] uppercase">Efficacy</span>
                      <span className="text-brand-pink text-sm font-black">98.4%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-pink rounded-full" style={{ width: '98.4%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>



      {/* SOCIAL GRID SECTION - REFINED V2 */}
      <section className="reveal-section py-5 md:py-10 bg-white overflow-hidden">
        <div className="container mx-auto px-6 md:px-12">
          {/* Header Section */}
          <div className="flex flex-col items-center text-center mb-20 md:mb-32">
            <div className="flex items-center gap-4 mb-8">
              <span className="text-[10px] uppercase tracking-[0.5em] font-black text-brand-olive opacity-40">Community</span>
              <div className="w-8 h-px bg-brand-olive/20" />
              <span className="text-[10px] uppercase tracking-[0.3em] font-black text-brand-olive/60">120K+ Members</span>
            </div>

            <AnimatedHeading className="font-serif text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-10 text-center justify-center text-brand-dark">
              Join @ruvia.glow
            </AnimatedHeading>

            <Button
              variant="outline"
              className="px-16 py-6 border-2 border-brand-olive"
              onClick={() => window.open('https://chat.whatsapp.com/ESh66ooZodX45vLIcAwWeB?mode=gi_t', '_blank', 'noopener,noreferrer')}
            >
              See 50,000+ Bare Skin Transformations
            </Button>
          </div>

          {/* Grid Section */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-10 relative">
            <div className="absolute inset-0 bg-brand-pink/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="group relative aspect-square rounded-4xl md:rounded-[4rem] overflow-hidden shadow-xl transition-all duration-700 hover:-translate-y-4">
              <img src="/images/social1.png" alt="Social 1" className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110" />
              <div className="absolute inset-0 bg-brand-dark/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center backdrop-blur-sm">
                <span className="text-white text-[10px] font-black tracking-widest uppercase">View Ritual</span>
              </div>
            </div>

            <div className="group relative aspect-square rounded-4xl md:rounded-[4rem] overflow-hidden shadow-xl transition-all duration-700 mt-8 md:mt-24 hover:-translate-y-4">
              <img src="/images/social2.png" alt="Social 2" className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110" />
              <div className="absolute inset-0 bg-brand-dark/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center backdrop-blur-sm">
                <span className="text-white text-[10px] font-black tracking-widest uppercase">Shop Look</span>
              </div>
            </div>

            <div className="group relative aspect-square rounded-4xl md:rounded-[4rem] overflow-hidden shadow-xl transition-all duration-700 hover:-translate-y-4">
              <img src="/images/results.png" alt="Social 3" className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110" />
              <div className="absolute inset-0 bg-brand-dark/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center backdrop-blur-sm">
                <span className="text-white text-[10px] font-black tracking-widest uppercase">The Result</span>
              </div>
            </div>

            <div className="group relative aspect-square rounded-4xl md:rounded-[4rem] overflow-hidden shadow-xl transition-all duration-700 mt-8 md:mt-24 hover:-translate-y-4">
              <img src="/images/hero.png" alt="Social 4" className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110" />
              <div className="absolute inset-0 bg-brand-dark/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center backdrop-blur-sm">
                <span className="text-white text-[10px] font-black tracking-widest uppercase">The Lab</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA - REFINED */}
      {/*
      <section className="reveal-section py-5 md:py-10 bg-brand-dark text-brand-beige text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none" />
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-brand-pink/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="container mx-auto px-6 md:px-12 relative z-10">
          <AnimatedHeading className="font-serif text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-6 text-center justify-center max-w-4xl mx-auto">Every day you wait is a day your skin doesn't get better.</AnimatedHeading>
          <p className="text-brand-beige/60 text-[10px] md:text-xs font-bold tracking-[0.3em] uppercase mb-12 max-w-lg mx-auto">15% off your first order. 30-day money-back guarantee. Zero risk. The only thing you lose is the skin you have right now.</p>

          <div className="flex flex-col items-center max-w-3xl mx-auto">
            <form
              onSubmit={handleNewsletterSubmit}
              className="w-full flex flex-col md:flex-row items-center gap-4 md:gap-0 bg-white/10 backdrop-blur-2xl rounded-[2.5rem] md:rounded-full p-3 border border-white/20 hover:border-brand-pink/50 transition-all group shadow-2xl"
            >
              <input
                type="email"
                required
                value={subscribeEmail}
                onChange={(e) => setSubscribeEmail(e.target.value)}
                placeholder="YOUR BEST EMAIL"
                disabled={subscribeLoading}
                className="w-full bg-transparent px-10 py-5 md:py-0 text-white focus:outline-none placeholder-white/30 text-[10px] md:text-[12px] font-black tracking-[0.4em] uppercase disabled:opacity-50"
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={subscribeLoading}
                className="w-full md:w-auto px-16 py-6 shadow-2xl hover:text-white cta-glow disabled:opacity-60"
              >
                {subscribeLoading ? "Sending..." : "Yes — Give Me 15% Off"}
              </Button>
            </form>

            {subscribeSuccess?.code ? (
              <div className="mt-6 px-6 py-4 rounded-2xl bg-brand-pink/15 border border-brand-pink/30 text-center max-w-xl">
                <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-brand-beige">
                  Coupon emailed
                </p>
                <p className="mt-2 text-brand-beige text-sm">
                  Use <span className="font-bold tracking-widest">{subscribeSuccess.code}</span> at checkout for {subscribeSuccess.percentOff}% off your first order.
                </p>
              </div>
            ) : null}

            <div className="mt-12 flex flex-col md:flex-row items-center gap-6 opacity-40">
              <p className="text-[9px] tracking-widest uppercase font-black leading-loose max-w-xs md:max-w-none text-brand-beige">
                50,000+ women already in • Free shipping • COD available
              </p>
              <div className="hidden md:block w-px h-4 bg-brand-beige/50" />
              <p className="text-[9px] tracking-widest uppercase font-black text-brand-beige">
                Unsubscribe anytime. We respect your inbox.
              </p>
            </div>
          </div>
        </div>
      </section>
      */}

      {/* STICKY MOBILE CTA BAR */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 md:hidden transition-all duration-500 ${showStickyCta ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
        <div className="bg-brand-dark/95 backdrop-blur-xl border-t border-brand-pink/20 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[9px] font-black tracking-wider text-brand-pink uppercase">Free shipping</span>
            <span className="text-[8px] font-bold tracking-wider text-white/50 uppercase">Starts at ₹1,299</span>
          </div>
          <Button variant="secondary" className="py-3 px-8 text-[9px] shadow-xl" onClick={() => router.push("/shop")}>Shop Bestsellers</Button>
        </div>
      </div>
    </div>
  );
}
