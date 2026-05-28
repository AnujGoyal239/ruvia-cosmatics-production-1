"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { apiUrl } from "../../../constants";
import { Button } from "../../../components/ui/Button";
import { Search, Eye } from "lucide-react";

import { csrfFetch } from "../../../lib/csrf";
export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await csrfFetch(apiUrl("/api/orders/all"), {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        // Backend returns paginated { data: [...] }; older responses returned a raw array.
        const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        setOrders(list);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      const response = await csrfFetch(apiUrl(`/api/orders/${orderId}/status`), {
        method: "PUT",
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchOrders();
        setShowModal(false);
        toast.success("Order status updated successfully");
      } else {
        toast.error("Failed to update order status");
      }
    } catch (error) {
      console.error("Failed to update order status:", error);
      toast.error("Failed to update order status");
    }
  };

  const filteredOrders = orders.filter(order =>
    order._id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.user?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-brand-dark">Loading orders...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-brand-dark mb-2">Orders</h1>
        <p className="text-brand-dark/60">Manage and track customer orders</p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-dark/40" size={20} />
          <input
            type="text"
            placeholder="Search orders..."
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
              <th className="text-left p-4 font-medium text-brand-dark">Order ID</th>
              <th className="text-left p-4 font-medium text-brand-dark">Customer</th>
              <th className="text-left p-4 font-medium text-brand-dark">Total</th>
              <th className="text-left p-4 font-medium text-brand-dark">Status</th>
              <th className="text-left p-4 font-medium text-brand-dark">Payment</th>
              <th className="text-left p-4 font-medium text-brand-dark">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order._id} className="border-t border-brand-dark/10">
                <td className="p-4 font-medium text-brand-dark">{order._id.slice(-8)}</td>
                <td className="p-4 text-brand-dark/60">{order.user?.name || "N/A"}</td>
                <td className="p-4 font-medium text-brand-dark">₹{order.total}</td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                    order.status === 'Shipped' ? 'bg-blue-100 text-blue-700' :
                    order.status === 'Out for Delivery' ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td className="p-4 text-brand-dark/60">{order.paymentMethod}</td>
                <td className="p-4">
                  <button
                    onClick={() => {
                      setSelectedOrder(order);
                      setShowModal(true);
                    }}
                    className="p-2 text-brand-pink hover:bg-brand-pink/10 rounded-md transition-colors"
                  >
                    <Eye size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="font-serif text-2xl font-bold text-brand-dark mb-6">Order Details</h2>
            
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-brand-dark/60">Order ID</p>
                  <p className="font-medium text-brand-dark">{selectedOrder._id}</p>
                </div>
                <div>
                  <p className="text-sm text-brand-dark/60">Status</p>
                  <p className="font-medium text-brand-dark">{selectedOrder.status}</p>
                </div>
                <div>
                  <p className="text-sm text-brand-dark/60">Customer</p>
                  <p className="font-medium text-brand-dark">{selectedOrder.user?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-brand-dark/60">Total</p>
                  <p className="font-medium text-brand-dark">₹{selectedOrder.total}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-brand-dark/60 mb-2">Shipping Address</p>
                <p className="text-brand-dark">
                  {selectedOrder.shippingAddress?.address}, {selectedOrder.shippingAddress?.city}, {selectedOrder.shippingAddress?.zipCode}
                </p>
              </div>

              <div>
                <p className="text-sm text-brand-dark/60 mb-2">Items</p>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item, index) => (
                    <div key={index} className="flex justify-between p-3 bg-brand-dark/5 rounded-md">
                      <div>
                        <p className="font-medium text-brand-dark">{item.name}</p>
                        <p className="text-sm text-brand-dark/60">Qty: {item.qty}</p>
                      </div>
                      <p className="font-medium text-brand-dark">₹{item.price}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-brand-dark/10 pt-6">
              <p className="text-sm font-medium text-brand-dark mb-4">Update Status</p>
              <div className="flex gap-2 flex-wrap">
                {['Processing', 'Shipped', 'Out for Delivery', 'Delivered'].map((status) => (
                  <Button
                    key={status}
                    variant={selectedOrder.status === status ? "primary" : "secondary"}
                    className="rounded-md"
                    onClick={() => handleStatusUpdate(selectedOrder._id, status)}
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
