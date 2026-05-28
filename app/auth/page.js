"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/Button";
import { ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { getSafeRedirectUrl } from "../../utils/redirectValidation";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  
  const { login, signup, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Validate the redirect query parameter against an allowed-paths whitelist
  // to prevent open-redirect / unvalidated-redirect attacks. Only relative
  // paths matching the whitelist are allowed; otherwise fall back to /profile.
  const rawRedirect = searchParams?.get("redirect");
  const redirectUrl = getSafeRedirectUrl(rawRedirect, "/profile");

  useEffect(() => {
    if (!loading && user) {
      router.push(redirectUrl);
    }
  }, [user, loading, router, redirectUrl]);

  const validate = () => {
    let errors = {};
    if (!email) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = "Please enter a valid email";
    }
    
    if (!password) {
      errors.password = "Password is required";
    } else if (!isLogin) {
      // Registration policy mirrors the backend (see authController):
      //   - min 12 characters
      //   - lowercase, uppercase, digit, and one of @$!%*?&
      // Login itself doesn't re-enforce policy here — old accounts created
      // before policy tightening still need to log in.
      if (password.length < 12) {
        errors.password = "Password must be at least 12 characters";
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(password)) {
        errors.password =
          "Must include lowercase, uppercase, digit, and a special character (@$!%*?&)";
      }
    }

    if (!isLogin && !name.trim()) {
      errors.name = "Full name is required";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validate()) return;

    try {
      if (isLogin) {
        const ok = await login(email, password);
        if (!ok) {
          setError("Invalid credentials. Please try again.");
          return;
        }
        setSuccess("Successfully logged in!");
      } else {
        const ok = await signup(name, email, password);
        if (!ok) {
          // The AuthContext.signup helper already surfaces the backend
          // message via a toast (e.g. "Password must be at least 12
          // characters"). Avoid setting a generic inline error so the
          // user sees the actionable message and not a duplicate.
          return;
        }
        setSuccess("Account created successfully!");
      }
      // Redirect immediately after successful auth; the AuthContext will also redirect on user change
      router.push(redirectUrl);
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
    }
  };

  if (loading) return null;

  return (
    <div className="flex min-h-screen bg-white">
      
      {/* Left Side: Editorial Image (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-brand-nude items-end p-12 overflow-hidden">
        <img 
          src="/images/process1.png" 
          alt="Ruvia Aesthetics" 
          className="absolute inset-0 w-full h-full object-cover grayscale-[20%] transition-transform duration-[10s] hover:scale-105"
        />
        {/* Soft overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        
        {/* Editorial Text */}
        <div className="relative z-10 max-w-lg text-white">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase mb-16 hover:text-brand-pink transition-colors">
            <ArrowLeft size={16} /> Back to Store
          </Link>
          <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md text-[10px] font-black uppercase tracking-[0.3em] rounded-full mb-6 border border-white/20">
            The Ritual
          </span>
          <h2 className="font-serif text-5xl font-bold tracking-tighter leading-tight mb-4">
            Bare skin has never looked this good.
          </h2>
          <p className="text-sm font-medium text-white/80 leading-relaxed max-w-md">
            Join 50,000+ women who stopped hiding behind foundation. Discover dermatologist-formulated routines that actually work for Indian skin.
          </p>
        </div>
      </div>

      {/* Right Side: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 md:px-24 py-12 relative overflow-y-auto">
        
        {/* Mobile Back Button */}
        <Link href="/" className="lg:hidden absolute top-8 left-8 inline-flex items-center gap-2 text-[10px] font-black tracking-widest uppercase text-brand-dark hover:text-brand-pink transition-colors">
          <ArrowLeft size={14} /> Back
        </Link>

        <div className="w-full max-w-md mx-auto">
          {/* Logo / Title */}
          <div className="mb-12">
            <h1 className="font-serif text-4xl font-bold tracking-tighter text-brand-dark mb-3">
              {isLogin ? "Welcome Back." : "Join the Club."}
            </h1>
            <p className="text-brand-dark/50 text-sm font-medium">
              {isLogin 
                ? "Enter your details to access your rituals and orders." 
                : "Create an account for early drops and exclusive access."}
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-8 p-4 bg-red-50/50 border border-red-100 rounded-2xl flex items-start gap-3">
              <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-700 text-xs font-bold leading-relaxed">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-8 p-4 bg-green-50/50 border border-green-100 rounded-2xl flex items-start gap-3">
              <CheckCircle2 size={18} className="text-green-600 shrink-0 mt-0.5" />
              <p className="text-green-700 text-xs font-bold leading-relaxed">{success}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-[10px] font-black tracking-widest uppercase text-brand-dark/60 ml-1">Full Name</label>
                <input
                  type="text"
                  placeholder="E.g. Sarah Ruvia"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) setFieldErrors({...fieldErrors, name: ""});
                  }}
                  className={`w-full px-5 py-4 bg-[#F9F9F9] border rounded-2xl text-sm font-medium focus:outline-none transition-all placeholder:text-brand-dark/30 ${fieldErrors.name ? 'border-red-400 focus:bg-white' : 'border-brand-dark/5 focus:border-brand-dark/20 focus:bg-white'}`}
                />
                {fieldErrors.name && <p className="text-[10px] text-red-500 font-bold ml-1 uppercase tracking-widest">{fieldErrors.name}</p>}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black tracking-widest uppercase text-brand-dark/60 ml-1">Email Address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors({...fieldErrors, email: ""});
                }}
                className={`w-full px-5 py-4 bg-[#F9F9F9] border rounded-2xl text-sm font-medium focus:outline-none transition-all placeholder:text-brand-dark/30 ${fieldErrors.email ? 'border-red-400 focus:bg-white' : 'border-brand-dark/5 focus:border-brand-dark/20 focus:bg-white'}`}
              />
              {fieldErrors.email && <p className="text-[10px] text-red-500 font-bold ml-1 uppercase tracking-widest">{fieldErrors.email}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-brand-dark/60">Password</label>
                {isLogin && <button type="button" className="text-[10px] font-black tracking-widest uppercase text-brand-dark hover:text-brand-pink transition-colors">Forgot?</button>}
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors({...fieldErrors, password: ""});
                }}
                className={`w-full px-5 py-4 bg-[#F9F9F9] border rounded-2xl text-sm font-medium focus:outline-none transition-all placeholder:text-brand-dark/30 ${fieldErrors.password ? 'border-red-400 focus:bg-white' : 'border-brand-dark/5 focus:border-brand-dark/20 focus:bg-white'}`}
              />
              {fieldErrors.password && <p className="text-[10px] text-red-500 font-bold ml-1 uppercase tracking-widest">{fieldErrors.password}</p>}
            </div>

            <Button type="submit" variant="primary" className="w-full justify-center py-5 mt-4">
              {isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          {/* Toggle Login/Signup */}
          <div className="mt-10 pt-8 border-t border-brand-dark/5 text-center">
            <p className="text-xs font-medium text-brand-dark/60">
              {isLogin ? "New to Ruvia?" : "Already part of the club?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                }}
                className="font-bold text-brand-dark hover:text-brand-pink transition-colors underline decoration-brand-dark/20 underline-offset-4"
              >
                {isLogin ? "Create an account" : "Sign in here"}
              </button>
            </p>
          </div>

          <p className="mt-8 text-center text-[10px] font-medium text-brand-dark/40 leading-relaxed max-w-xs mx-auto">
            By continuing, you agree to Ruvia's <a href="#" className="underline">Terms of Service</a> and <a href="#" className="underline">Privacy Policy</a>.
          </p>
        </div>

      </div>
    </div>
  );
}
