"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { apiUrl } from "../constants";

import { csrfFetch } from "../lib/csrf";
const AdminContext = createContext();

export const useAdmin = () => {
  return useContext(AdminContext);
};

export const AdminProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const safeReadJson = async (response) => {
    const contentType = response.headers.get("content-type") || "";
    try {
      if (contentType.includes("application/json")) return await response.json();
      const text = await response.text();
      return { message: text };
    } catch {
      try {
        const text = await response.text();
        return { message: text };
      } catch {
        return { message: "Request failed" };
      }
    }
  };

  useEffect(() => {
    const bootstrapAdmin = async () => {
      try {
        const response = await csrfFetch(apiUrl("/api/auth/me"), {
          credentials: "include",
        });

        if (response.ok) {
          const profile = await safeReadJson(response);
          if (profile.role === 'admin') {
            setAdmin(profile);
          } else {
            setAdmin(null);
          }
        } else {
          setAdmin(null);
        }
      } catch (error) {
        console.error("Failed to bootstrap admin auth", error);
        setAdmin(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrapAdmin();
  }, []);

  const adminLogin = useCallback(async (email, password) => {
    try {
      const response = await csrfFetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password })
      });

      const data = await safeReadJson(response);
      
      if (response.ok) {
        if (data.role === 'admin') {
          // Cookie is set; store admin profile in-memory
          setAdmin(data);
          return { success: true };
        } else {
          return { success: false, message: "Access denied. Admin only." };
        }
      } else {
        return { success: false, message: data.message || "Login failed" };
      }
    } catch (error) {
      console.error(error);
      return { success: false, message: "Login failed" };
    }
  }, []);

  const adminLogout = useCallback(() => {
    // Clear cookie on backend
    csrfFetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include" }).catch(() => {});
    setAdmin(null);
    try { localStorage.removeItem("ruvia_admin"); } catch {}
  }, []);

  const value = useMemo(() => ({
    admin,
    adminLogin,
    adminLogout,
    loading,
    isAuthenticated: !!admin
  }), [admin, adminLogin, adminLogout, loading]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};
