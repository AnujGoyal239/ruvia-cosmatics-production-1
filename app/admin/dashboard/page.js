"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useAdmin } from "../../../context/AdminContext";
import { apiUrl } from "../../../constants";
import { csrfFetch } from "../../../lib/csrf";
import {
  Activity,
  ArrowUpRight,
  BadgeIndianRupee,
  Package,
  ShoppingCart,
  Star,
  Truck,
  TriangleAlert,
} from "lucide-react";

const DashboardCharts = dynamic(() => import("../../../components/admin/DashboardCharts"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      <div className="xl:col-span-8 bg-white rounded-xl shadow-sm border border-brand-dark/10 p-6">
        <div className="h-5 w-40 bg-brand-dark/10 rounded animate-pulse mb-3" />
        <div className="h-80 bg-brand-dark/5 rounded-lg animate-pulse" />
      </div>
      <div className="xl:col-span-4 grid grid-cols-1 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-brand-dark/10 p-6">
          <div className="h-5 w-32 bg-brand-dark/10 rounded animate-pulse mb-3" />
          <div className="h-64 bg-brand-dark/5 rounded-lg animate-pulse" />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-brand-dark/10 p-6">
          <div className="h-5 w-32 bg-brand-dark/10 rounded animate-pulse mb-3" />
          <div className="h-56 bg-brand-dark/5 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  ),
});

export default function AdminDashboardPage() {
  const { admin } = useAdmin();
  const [range, setRange] = useState("30d"); // 7d | 30d | 90d
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await csrfFetch(apiUrl(`/api/admin/dashboard?range=${encodeURIComponent(range)}`), {
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "Failed to load dashboard");
        setData(json);
      } catch (e) {
        console.error("Admin dashboard load failed:", e);
        setError(e.message || "Failed to load dashboard");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [range]);

  const kpis = data?.kpis;
  const rangeDays = data?.rangeDays || 30;
  const series = data?.charts?.ordersRevenueByDay || [];
  const ordersByStatus = data?.charts?.ordersByStatus || [];
  const paymentBreakdown = data?.charts?.paymentBreakdown || [];
  const lowStock = data?.lists?.lowStock || [];
  const recentOrders = data?.lists?.recentOrders || [];

  const currency = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const kpiCards = useMemo(() => {
    return [
      {
        title: "Revenue",
        value: currency(kpis?.revenueInRange),
        sub: `Last ${rangeDays} days`,
        icon: BadgeIndianRupee,
        accent: "bg-brand-pink/10 text-brand-pink",
      },
      {
        title: "Orders",
        value: String(kpis?.ordersInRange ?? 0),
        sub: "In selected range",
        icon: ShoppingCart,
        accent: "bg-emerald-500/10 text-emerald-600",
      },
      {
        title: "AOV",
        value: currency(kpis?.aovInRange),
        sub: "Average order value",
        icon: Activity,
        accent: "bg-indigo-500/10 text-indigo-600",
      },
      {
        title: "Low stock",
        value: String(kpis?.lowStockCount ?? 0),
        sub: "Needs restock",
        icon: TriangleAlert,
        accent: "bg-orange-500/10 text-orange-600",
      },
    ];
  }, [kpis, rangeDays]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 bg-brand-dark/10 rounded-md animate-pulse" />
          <div className="h-4 w-64 bg-brand-dark/10 rounded-md animate-pulse mt-3" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-brand-dark/10 p-6">
              <div className="h-4 w-24 bg-brand-dark/10 rounded animate-pulse mb-4" />
              <div className="h-8 w-32 bg-brand-dark/10 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-brand-dark">Dashboard</h1>
          <p className="text-brand-dark/60 mt-1">
            Welcome back, <span className="font-medium text-brand-dark">{admin?.name || "Admin"}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[10px] font-black tracking-widest uppercase text-brand-dark/40">Range</div>
          <div className="inline-flex bg-white border border-brand-dark/10 rounded-lg p-1 shadow-sm">
            {[
              { key: "7d", label: "7D" },
              { key: "30d", label: "30D" },
              { key: "90d", label: "90D" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setRange(opt.key)}
                className={`px-3 py-2 rounded-md text-[10px] font-black tracking-widest uppercase transition-colors ${
                  range === opt.key ? "bg-brand-dark text-white" : "text-brand-dark/60 hover:bg-brand-dark/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {kpiCards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.title} className="bg-white rounded-xl shadow-sm border border-brand-dark/10 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black tracking-widest uppercase text-brand-dark/40">{c.title}</div>
                  <div className="mt-2 text-3xl font-black tracking-tight text-brand-dark">{c.value}</div>
                  <div className="mt-2 text-xs text-brand-dark/50 font-medium">{c.sub}</div>
                </div>
                <div className={`p-3 rounded-xl ${c.accent}`}>
                  <Icon size={22} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <DashboardCharts
        series={series}
        ordersByStatus={ordersByStatus}
        paymentBreakdown={paymentBreakdown}
        currency={currency}
      />

      {/* Lists */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 bg-white rounded-xl shadow-sm border border-brand-dark/10 overflow-hidden">
          <div className="p-6 flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl font-bold text-brand-dark">Recent orders</h2>
              <p className="text-xs text-brand-dark/50 font-medium">Latest 8 orders</p>
            </div>
            <a
              href="/admin/orders"
              className="inline-flex items-center gap-2 text-[10px] font-black tracking-widest uppercase text-brand-pink hover:text-brand-dark transition-colors"
            >
              View all <ArrowUpRight size={14} />
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-brand-dark/5">
                <tr>
                  <th className="text-left p-4 text-xs font-black tracking-widest uppercase text-brand-dark/60">Order</th>
                  <th className="text-left p-4 text-xs font-black tracking-widest uppercase text-brand-dark/60">Customer</th>
                  <th className="text-left p-4 text-xs font-black tracking-widest uppercase text-brand-dark/60">Total</th>
                  <th className="text-left p-4 text-xs font-black tracking-widest uppercase text-brand-dark/60">Status</th>
                  <th className="text-left p-4 text-xs font-black tracking-widest uppercase text-brand-dark/60">Payment</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-brand-dark/50 text-sm">
                      No orders found yet.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((o) => (
                    <tr key={o._id} className="border-t border-brand-dark/10">
                      <td className="p-4 font-medium text-brand-dark">{String(o._id).slice(-8).toUpperCase()}</td>
                      <td className="p-4 text-brand-dark/60">{o.user?.name || "N/A"}</td>
                      <td className="p-4 font-black text-brand-dark">{currency(o.total)}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-2 text-xs font-medium text-brand-dark/70">
                          <Truck size={14} className="text-brand-dark/40" />
                          {o.status || "Processing"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-2 text-xs font-medium text-brand-dark/70">
                          <BadgeIndianRupee size={14} className="text-brand-dark/40" />
                          {o.paymentMethod || "N/A"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-4 grid grid-cols-1 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-brand-dark/10 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl font-bold text-brand-dark">Inventory alerts</h2>
                <p className="text-xs text-brand-dark/50 font-medium">Low stock items</p>
              </div>
              <Package size={18} className="text-brand-dark/40" />
            </div>

            <div className="mt-4 space-y-3">
              {lowStock.length === 0 ? (
                <div className="text-sm text-brand-dark/50">No low stock items.</div>
              ) : (
                lowStock.map((p) => (
                  <div key={p._id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-brand-dark/10">
                    <div className="min-w-0">
                      <div className="font-medium text-brand-dark truncate">{p.name}</div>
                      <div className="text-[10px] font-black tracking-widest uppercase text-brand-dark/40">
                        {p.category || "Product"} • {p.id}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-orange-600">{p.countInStock} left</div>
                      <div className="text-[10px] font-black tracking-widest uppercase text-brand-dark/40">{currency(p.price)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-brand-dark/10 p-6">
            <h2 className="font-serif text-xl font-bold text-brand-dark">Quick actions</h2>
            <p className="text-xs text-brand-dark/50 font-medium">Operate faster</p>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <a href="/admin/products" className="group p-4 rounded-xl border border-brand-dark/10 hover:border-brand-pink hover:bg-brand-pink/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-black text-brand-dark">Manage products</div>
                    <div className="text-xs text-brand-dark/50">Create, edit, inventory</div>
                  </div>
                  <Package className="text-brand-dark/30 group-hover:text-brand-pink transition-colors" size={18} />
                </div>
              </a>

              <a href="/admin/orders" className="group p-4 rounded-xl border border-brand-dark/10 hover:border-brand-pink hover:bg-brand-pink/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-black text-brand-dark">Process orders</div>
                    <div className="text-xs text-brand-dark/50">Status + fulfillment</div>
                  </div>
                  <ShoppingCart className="text-brand-dark/30 group-hover:text-brand-pink transition-colors" size={18} />
                </div>
              </a>

              <a href="/admin/returns" className="group p-4 rounded-xl border border-brand-dark/10 hover:border-brand-pink hover:bg-brand-pink/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-black text-brand-dark">Handle returns</div>
                    <div className="text-xs text-brand-dark/50">Approve/reject, ops</div>
                  </div>
                  <Truck className="text-brand-dark/30 group-hover:text-brand-pink transition-colors" size={18} />
                </div>
              </a>

              <a href="/admin/reviews" className="group p-4 rounded-xl border border-brand-dark/10 hover:border-brand-pink hover:bg-brand-pink/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-black text-brand-dark">Moderate reviews</div>
                    <div className="text-xs text-brand-dark/50">Quality control</div>
                  </div>
                  <Star className="text-brand-dark/30 group-hover:text-brand-pink transition-colors" size={18} />
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
