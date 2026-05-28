"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { apiUrl } from "../constants";

import { csrfFetch } from "../lib/csrf";
const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);

  const safeReadJson = useCallback(async (response) => {
    const contentType = response.headers.get("content-type") || "";
    try {
      if (contentType.includes("application/json")) return await response.json();
      const text = await response.text();
      return { message: text };
    } catch (e) {
      // Some error responses are not JSON (e.g., proxies, rate limiters). Avoid crashing the app.
      try {
        const text = await response.text();
        return { message: text };
      } catch {
        return { message: "Request failed" };
      }
    }
  }, []);

  const normalizeUser = (data) => data ? {
    ...data,
  } : null;

  const normalizeAddress = useCallback((address = {}) => ({
    id: address._id || address.id || `${Date.now()}`,
    firstName: address.firstName || "",
    lastName: address.lastName || "",
    phone: address.phone || "",
    address: address.address || address.street || "",
    city: address.city || "",
    pin: address.pin || address.zipCode || "",
  }), []);

  const loadProfile = useCallback(async () => {
    // Cookie-based auth (httpOnly cookie set by backend on login/register)
    const response = await csrfFetch(apiUrl("/api/auth/me"), {
      credentials: "include",
    });

    // Not logged in is not an "exceptional" case during bootstrap
    if (response.status === 401) return null;
    // Avoid crashing UI if rate-limited during development refresh cycles
    if (response.status === 429) return null;

    if (!response.ok) {
      const data = await safeReadJson(response);
      throw new Error(data?.message || "Failed to load user profile");
    }

    return safeReadJson(response);
  }, [safeReadJson]);

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const profile = await loadProfile();
        if (!profile) {
          setUser(null);
          setAddresses([]);
          return;
        }
        
        const nextUser = {
          _id: profile._id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          phone: profile.phone,
        };

        setUser(nextUser);
        setAddresses((profile.addresses || []).map(normalizeAddress));
      } catch (error) {
        console.error("Failed to bootstrap auth", error);
        setUser(null);
        setAddresses([]);
      } finally {
        setLoading(false);
      }
    };

    bootstrapAuth();
  }, [loadProfile, normalizeAddress]);

  const saveAddresses = useCallback(async (newAddresses) => {
    if (!user) {
      setAddresses(newAddresses);
      return;
    }

    const response = await csrfFetch(apiUrl("/api/auth/profile"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        name: user.name,
        email: user.email,
        phone: user.phone,
        addresses: newAddresses,
      }),
    });

    const data = await safeReadJson(response);
    if (!response.ok) {
      throw new Error(data.message || "Failed to save addresses");
    }

    const nextAddresses = (data.addresses || []).map(normalizeAddress);
    setAddresses(nextAddresses);
    setUser((current) => current ? { ...current, ...data } : current);
    return nextAddresses;
  }, [user, safeReadJson, normalizeAddress]);

  const login = useCallback(async (email, password) => {
    try {
      const response = await csrfFetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await safeReadJson(response);
      if (response.ok) {
        // Cookie is now set by backend; fetch the canonical profile
        const profile = await loadProfile();
        if (profile) {
          setUser({
            _id: profile._id,
            name: profile.name,
            email: profile.email,
            role: profile.role,
            phone: profile.phone,
          });
          setAddresses((profile.addresses || []).map(normalizeAddress));
        } else {
          // Fallback (shouldn't happen if cookie was set)
          setUser(normalizeUser(data));
        }
        return true;
      } else {
        toast.error(data.message || "Login failed");
        return false;
      }
    } catch (error) {
      console.error(error);
      return false;
    }
  }, [safeReadJson, loadProfile, normalizeAddress]);

  const signup = useCallback(async (name, email, password) => {
    try {
      const response = await csrfFetch(apiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password }),
      });
      const data = await safeReadJson(response);
      if (response.ok) {
        const profile = await loadProfile();
        if (profile) {
          setUser({
            _id: profile._id,
            name: profile.name,
            email: profile.email,
            role: profile.role,
            phone: profile.phone,
          });
          setAddresses((profile.addresses || []).map(normalizeAddress));
        } else {
          setUser(normalizeUser(data));
        }
        return true;
      } else {
        toast.error(data.message || "Signup failed");
        return false;
      }
    } catch (error) {
      console.error(error);
      return false;
    }
  }, [safeReadJson, loadProfile, normalizeAddress]);

  const logout = useCallback(async () => {
    try {
      await csrfFetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include" });
    } catch (error) {
      console.error("Logout error:", error);
    }
    // Backward-compat cleanup (older builds stored auth in localStorage)
    try {
      localStorage.removeItem("ruvia_user");
      localStorage.removeItem("ruvia_admin");
    } catch {}
    setUser(null);
    setAddresses([]);
  }, []);

  const addAddress = useCallback(async (addr) => {
    const response = await csrfFetch(apiUrl("/api/auth/address"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ address: addr }),
    });

    const data = await safeReadJson(response);
    if (!response.ok) {
      throw new Error(data.message || "Failed to add address");
    }

    const nextAddresses = (data || []).map(normalizeAddress);
    setAddresses(nextAddresses);
    return nextAddresses;
  }, [safeReadJson, normalizeAddress]);

  const updateAddress = useCallback(async (id, updated) => {
    const nextAddresses = addresses.map(a => a.id === id ? { ...a, ...updated, id } : a);
    return saveAddresses(nextAddresses);
  }, [addresses, saveAddresses]);

  const deleteAddress = useCallback(async (id) => {
    const response = await csrfFetch(apiUrl(`/api/auth/address/${id}`), {
      method: "DELETE",
      headers: {
      },
      credentials: "include",
    });

    const data = await safeReadJson(response);
    if (!response.ok) {
      throw new Error(data.message || "Failed to remove address");
    }

    const nextAddresses = (data || []).map(normalizeAddress);
    setAddresses(nextAddresses);
    return nextAddresses;
  }, [safeReadJson, normalizeAddress]);

  const updateUser = useCallback(async (updatedFields) => {
    const response = await csrfFetch(apiUrl("/api/auth/profile"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        name: updatedFields.name,
        email: updatedFields.email,
        phone: updatedFields.phone || user.phone,
        addresses,
      }),
    });

    const data = await safeReadJson(response);
    if (!response.ok) {
      throw new Error(data.message || "Failed to update profile");
    }

    const nextUser = { ...user, ...data };
    setUser(nextUser);
    if (data.addresses) {
      setAddresses((data.addresses || []).map(normalizeAddress));
    }
    return true;
  }, [safeReadJson, user, addresses, normalizeAddress]);

  const value = useMemo(() => ({
    user,
    login,
    signup,
    logout,
    updateUser,
    loading,
    addresses,
    addAddress,
    updateAddress,
    deleteAddress
  }), [
    user,
    login,
    signup,
    logout,
    updateUser,
    loading,
    addresses,
    addAddress,
    updateAddress,
    deleteAddress,
  ]);

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};
