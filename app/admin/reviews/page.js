"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { apiUrl } from "../../../constants";
import { Button } from "../../../components/ui/Button";
import { Search, Trash2, Star } from "lucide-react";

import { csrfFetch } from "../../../lib/csrf";
export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchReviews = useCallback(async () => {
    try {
      const response = await csrfFetch(apiUrl("/api/reviews/all"), { credentials: "include" });

      if (response.ok) {
        const data = await response.json();
        setReviews(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleDelete = async (reviewId) => {
    if (!confirm("Are you sure you want to delete this review?")) return;

    try {
      const response = await csrfFetch(apiUrl(`/api/reviews/${reviewId}`), {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        fetchReviews();
        toast.success("Review deleted successfully");
      } else {
        toast.error("Failed to delete review");
      }
    } catch (error) {
      console.error("Failed to delete review:", error);
      toast.error("Failed to delete review");
    }
  };

  const filteredReviews = reviews.filter(review =>
    review.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    review.comment?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-brand-dark">Loading reviews...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-brand-dark mb-2">Reviews</h1>
        <p className="text-brand-dark/60">Manage customer reviews</p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-dark/40" size={20} />
          <input
            type="text"
            placeholder="Search reviews..."
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
              <th className="text-left p-4 font-medium text-brand-dark">Customer</th>
              <th className="text-left p-4 font-medium text-brand-dark">Rating</th>
              <th className="text-left p-4 font-medium text-brand-dark">Review</th>
              <th className="text-left p-4 font-medium text-brand-dark">Date</th>
              <th className="text-left p-4 font-medium text-brand-dark">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReviews.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-8 text-center text-brand-dark/60">
                  No reviews found
                </td>
              </tr>
            ) : (
              filteredReviews.map((review) => (
                <tr key={review._id} className="border-t border-brand-dark/10">
                  <td className="p-4">
                    <div>
                      <p className="font-medium text-brand-dark">{review.name}</p>
                      <p className="text-sm text-brand-dark/60">{review.user?.email || "N/A"}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <Star size={16} className="text-yellow-400 fill-yellow-400" />
                      <span className="font-medium text-brand-dark">{review.rating}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="text-brand-dark max-w-md line-clamp-2">{review.comment}</p>
                  </td>
                  <td className="p-4 text-brand-dark/60">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleDelete(review._id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
