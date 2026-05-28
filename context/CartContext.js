"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { apiUrl } from "../constants";
import { useAuth } from "./AuthContext";

import { csrfFetch } from "../lib/csrf";
const CartContext = createContext();

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const stored = localStorage.getItem("ruvia_cart");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to load cart", e);
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const syncRef = useRef(null);
  const { user, loading: authLoading } = useAuth();

  // Save to local storage whenever cart changes and debounce server sync
  useEffect(() => {
    try {
      localStorage.setItem("ruvia_cart", JSON.stringify(cartItems));
    } catch (e) {
      console.error("Failed to save cart", e);
    }
    if (syncRef.current) clearTimeout(syncRef.current);
    syncRef.current = setTimeout(() => {
      if (typeof window !== "undefined") {
        // Avoid spamming 401s when the user is not authenticated
        if (!user || authLoading) return;
        // Cookie-based auth (if user is logged in, cookie will be sent)
        csrfFetch(apiUrl("/api/cart"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ items: cartItems }),
        }).catch((err) => console.error("Cart sync failed:", err));
      }
    }, 800);
  }, [cartItems, user, authLoading]);

  // On login/load, try to fetch server cart and merge
  useEffect(() => {
    const trySyncFromServer = async () => {
      if (!user || authLoading) return;
      try {
        const res = await csrfFetch(apiUrl("/api/cart"), {
          method: "GET",
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data && Array.isArray(data.items)) {
          setCartItems((prev) => {
            const merged = [...prev];
            data.items.forEach((si) => {
              const idx = merged.findIndex((li) => li.id === si.id);
              if (idx === -1) merged.push(si);
              else merged[idx] = { ...merged[idx], quantity: si.qty || si.quantity || merged[idx].quantity };
            });
            return merged;
          });
        }
      } catch (err) {
        console.error("Failed to load server cart", err);
      }
    };

    trySyncFromServer();
  }, [user, authLoading]);

  const toggleCart = useCallback(() => setIsCartOpen((p) => !p), []);
  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  const addToCart = useCallback((product) => {
    const qty = product.quantity || 1;
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + qty } : item
        );
      }
      return [...prev, { ...product, quantity: qty }];
    });
    openCart();
  }, [openCart]);

  const removeFromCart = useCallback((id) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id, delta) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQuantity = item.quantity + delta;
            return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  }, []);

  const getCartTotal = useCallback(() => {
    return cartItems.reduce((total, item) => {
      const priceVal =
        typeof item.price === "string" ? parseInt(item.price.replace(/[^\d]/g, ""), 10) || 0 : item.price;
      return total + priceVal * item.quantity;
    }, 0);
  }, [cartItems]);

  const getCartCount = useCallback(
    () => cartItems.reduce((count, item) => count + item.quantity, 0),
    [cartItems]
  );

  const clearCart = useCallback(() => {
    setCartItems([]);
    csrfFetch(apiUrl("/api/cart"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ items: [] }),
    }).catch(() => {});
  }, []);

  const value = useMemo(() => ({
    cartItems,
    isCartOpen,
    toggleCart,
    openCart,
    closeCart,
    addToCart,
    removeFromCart,
    updateQuantity,
    getCartTotal,
    getCartCount,
    clearCart,
  }), [
    cartItems,
    isCartOpen,
    toggleCart,
    openCart,
    closeCart,
    addToCart,
    removeFromCart,
    updateQuantity,
    getCartTotal,
    getCartCount,
    clearCart,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}
