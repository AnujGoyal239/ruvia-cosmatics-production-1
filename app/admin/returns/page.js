"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { apiUrl } from "../../../constants";
import { Button } from "../../../components/ui/Button";
import { Search, Eye, X } from "lucide-react";

import { csrfFetch } from "../../../lib/csrf";
// Backend enum (see backend/models/returnModel.js). Keep this in sync with
// the server — sending a value outside this list returns 400.
const STATUS_OPTIONS = ["Pending", "Approved", "Refunded", "Rejected"];

// Render a "ORD-XXXXXX" style ID from a populated `order` object or a raw id.
const formatOrderRef = (orderField) => {
  if (!orderField) return "N/A";
  const id = typeof orderField === "string" ? orderField : orderField?._id;
  if (!id) return "N/A";
  return `ORD-${String(id).slice(-6).toUpperCase()}`;
};

// Currency helper consistent with the rest of the app.
const inr = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const formatDateTime = (dt) => {
  try {
    const d = dt ? new Date(dt) : null;
    if (!d) return "—";
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

const statusPill = (status) => {
  switch (status) {
    case "Approved":
      return "bg-green-100 text-green-700";
    case "Rejected":
      return "bg-red-100 text-red-700";
    case "Refunded":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-yellow-100 text-yellow-700";
  }
};

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchReturns = useCallback(async () => {
    try {
      const response = await csrfFetch(apiUrl("/api/returns"), { credentials: "include" });

      if (response.ok) {
        const data = await response.json();
        setReturns(Array.isArray(data) ? data : []);
      } else {
        toast.error("Failed to load returns");
      }
    } catch (error) {
      console.error("Failed to fetch returns:", error);
      toast.error("Failed to load returns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const handleStatusUpdate = async (returnId, newStatus) => {
    if (!STATUS_OPTIONS.includes(newStatus)) return;
    try {
      setUpdatingStatus(true);
      const response = await csrfFetch(apiUrl(`/api/returns/${returnId}/status`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Failed to update return status");
      }

      // Optimistically update the row in place so the UI reflects the
      // change without waiting for the next list fetch.
      setReturns((prev) =>
        prev.map((r) => (r._id === returnId ? { ...r, status: newStatus } : r))
      );
      setSelectedReturn((prev) =>
        prev && prev._id === returnId ? { ...prev, status: newStatus } : prev
      );

      toast.success(
        newStatus === "Approved"
          ? "Return approved. Customer notified."
          : newStatus === "Rejected"
          ? "Return rejected. Customer notified."
          : newStatus === "Refunded"
          ? "Refund logged. Customer notified."
          : "Return status updated."
      );
      setShowModal(false);
    } catch (error) {
      console.error("Failed to update return status:", error);
      toast.error(error.message || "Failed to update return status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredReturns = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return returns;
    return returns.filter((ret) => {
      const orderId =
        typeof ret?.order === "string" ? ret.order : ret?.order?._id || "";
      return (
        ret._id?.toLowerCase().includes(q) ||
        orderId?.toLowerCase?.().includes(q) ||
        ret.user?.name?.toLowerCase?.().includes(q) ||
        ret.user?.email?.toLowerCase?.().includes(q) ||
        ret.reason?.toLowerCase?.().includes(q)
      );
    });
  }, [returns, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-brand-dark">Loading returns...</div>
      </div>
    );
  }

  const orderItems = Array.isArray(selectedReturn?.order?.items)
    ? selectedReturn.order.items
    : [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-brand-dark mb-2">Returns</h1>
        <p className="text-brand-dark/60">
          Manage customer return requests. Approving, refunding, or rejecting a
          return automatically emails the customer.
        </p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-dark/40"
            size={20}
          />
          <input
            type="text"
            placeholder="Search by customer, email, order or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-brand-dark/10 rounded-md focus:border-brand-pink focus:ring-1 focus:ring-brand-pink outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-brand-dark/10 overflow-hidden">
        <table className="w-full">
          <thead className="bg-brand-dark/5">
            <tr>
              <th className="text-left p-4 font-medium text-brand-dark">Return</th>
              <th className="text-left p-4 font-medium text-brand-dark">Customer</th>
              <th className="text-left p-4 font-medium text-brand-dark">Order</th>
              <th className="text-left p-4 font-medium text-brand-dark">Reason</th>
              <th className="text-left p-4 font-medium text-brand-dark">Submitted</th>
              <th className="text-left p-4 font-medium text-brand-dark">Status</th>
              <th className="text-right p-4 font-medium text-brand-dark">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReturns.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-brand-dark/60">
                  No return requests found
                </td>
              </tr>
            ) : (
              filteredReturns.map((ret) => (
                <tr key={ret._id} className="border-t border-brand-dark/10">
                  <td className="p-4 font-medium text-brand-dark">
                    {ret._id?.slice(-8) || "—"}
                  </td>
                  <td className="p-4">
                    <div className="text-brand-dark font-medium">
                      {ret.user?.name || "N/A"}
                    </div>
                    <div className="text-xs text-brand-dark/50">
                      {ret.user?.email || ""}
                    </div>
                  </td>
                  <td className="p-4 text-brand-dark/70">
                    <div>{formatOrderRef(ret.order)}</div>
                    {ret.order?.total ? (
                      <div className="text-xs text-brand-dark/50">
                        {inr(ret.order.total)}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-4 text-brand-dark/70 max-w-xs">
                    <span className="line-clamp-2">{ret.reason || "—"}</span>
                  </td>
                  <td className="p-4 text-brand-dark/60 text-sm">
                    {formatDateTime(ret.createdAt)}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${statusPill(
                        ret.status
                      )}`}
                    >
                      {ret.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => {
                        setSelectedReturn(ret);
                        setShowModal(true);
                      }}
                      className="p-2 text-brand-pink hover:bg-brand-pink/10 rounded-md transition-colors"
                      title="View details"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && selectedReturn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full border border-brand-dark/10 flex items-center justify-center text-brand-dark hover:bg-brand-dark/5 transition-all"
              aria-label="Close"
            >
              <X size={16} />
            </button>

            <h2 className="font-serif text-2xl font-bold text-brand-dark mb-1">
              Return Details
            </h2>
            <p className="text-xs text-brand-dark/50 mb-6">
              Submitted {formatDateTime(selectedReturn.createdAt)}
            </p>

            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-brand-dark/60">Return ID</p>
                  <p className="font-medium text-brand-dark break-all">
                    {selectedReturn._id}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-brand-dark/60">Status</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusPill(
                      selectedReturn.status
                    )}`}
                  >
                    {selectedReturn.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-brand-dark/60">Customer</p>
                  <p className="font-medium text-brand-dark">
                    {selectedReturn.user?.name || "N/A"}
                  </p>
                  <p className="text-xs text-brand-dark/50">
                    {selectedReturn.user?.email || ""}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-brand-dark/60">Order</p>
                  <p className="font-medium text-brand-dark">
                    {formatOrderRef(selectedReturn.order)}
                  </p>
                  {selectedReturn.order?.total ? (
                    <p className="text-xs text-brand-dark/50">
                      {inr(selectedReturn.order.total)} •{" "}
                      {selectedReturn.order?.paymentMethod || "—"}
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <p className="text-sm text-brand-dark/60 mb-2">Reason for Return</p>
                <p className="text-brand-dark whitespace-pre-wrap">
                  {selectedReturn.reason || "—"}
                </p>
              </div>

              {orderItems.length > 0 && (
                <div>
                  <p className="text-sm text-brand-dark/60 mb-2">Order items</p>
                  <div className="border border-brand-dark/10 rounded-md divide-y divide-brand-dark/10">
                    {orderItems.map((it, idx) => (
                      <div
                        key={`${it.product || it.name}-${idx}`}
                        className="flex items-center justify-between p-3 text-sm"
                      >
                        <div className="text-brand-dark">{it.name}</div>
                        <div className="text-brand-dark/60">
                          {it.qty || 1} × {inr(it.price)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-brand-dark/10 pt-6">
              <p className="text-sm font-medium text-brand-dark mb-3">
                Update status
              </p>
              <p className="text-xs text-brand-dark/50 mb-4">
                Setting Approved, Refunded, or Rejected sends an automatic email
                to the customer.
              </p>
              <div className="flex gap-2 flex-wrap">
                {STATUS_OPTIONS.map((status) => (
                  <Button
                    key={status}
                    variant={
                      selectedReturn.status === status ? "primary" : "secondary"
                    }
                    className="rounded-md"
                    disabled={
                      updatingStatus || selectedReturn.status === status
                    }
                    onClick={() =>
                      handleStatusUpdate(selectedReturn._id, status)
                    }
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                variant="secondary"
                className="rounded-md"
                onClick={() => setShowModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
