"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { apiUrl } from "../../../constants";
import { Button } from "../../../components/ui/Button";
import ProductImage from "../../../components/ui/ProductImage";
import { Plus, Edit, Trash2, Search } from "lucide-react";

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    category: "",
    description: "",
    countInStock: "",
    originalPrice: "",
    tag: "",
    concern: "",
    ingredients: "",
    usage: "",
    benefits: "",
  });

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch(apiUrl("/api/products"), { credentials: "include" });

      if (response.ok) {
        const data = await response.json();
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : [];
        setProducts(items);
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formDataObj = new FormData();
    Object.keys(formData).forEach(key => {
      formDataObj.append(key, formData[key]);
    });

    const url = editingProduct 
      ? apiUrl(`/api/products/${editingProduct._id}`)
      : apiUrl("/api/products");
    
    const method = editingProduct ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        credentials: "include",
        body: formDataObj,
      });

      if (response.ok) {
        setShowModal(false);
        setEditingProduct(null);
        setFormData({
          name: "", price: "", category: "", description: "",
          countInStock: "", originalPrice: "", tag: "",
          concern: "", ingredients: "", usage: "", benefits: "",
        });
        fetchProducts();
        toast.success("Product saved successfully");
      } else {
        toast.error("Failed to save product");
      }
    } catch (error) {
      console.error("Failed to save product:", error);
      toast.error("Failed to save product");
    }
  };

  const handleDelete = async (productId) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const response = await fetch(apiUrl(`/api/products/${productId}`), {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        fetchProducts();
        toast.success("Product deleted successfully");
      } else {
        toast.error("Failed to delete product");
      }
    } catch (error) {
      console.error("Failed to delete product:", error);
      toast.error("Failed to delete product");
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || "",
      price: product.price || "",
      category: product.category || "",
      description: product.description || "",
      countInStock: product.countInStock || "",
      originalPrice: product.originalPrice || "",
      tag: product.tag || "",
      concern: product.concern || "",
      ingredients: product.ingredients || "",
      usage: product.usage || "",
      benefits: product.benefits || "",
    });
    setShowModal(true);
  };

  const filteredProducts = products.filter(product =>
    product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-brand-dark">Loading products...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-brand-dark mb-2">Products</h1>
          <p className="text-brand-dark/60">Manage your product inventory</p>
        </div>
        <Button
          variant="primary"
          className="rounded-md"
          onClick={() => {
            setEditingProduct(null);
            setFormData({
              name: "", price: "", category: "", description: "",
              countInStock: "", originalPrice: "", tag: "",
              concern: "", ingredients: "", usage: "", benefits: "",
            });
            setShowModal(true);
          }}
        >
          <Plus size={20} className="mr-2" />
          Add Product
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-dark/40" size={20} />
          <input
            type="text"
            placeholder="Search products..."
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
              <th className="text-left p-4 font-medium text-brand-dark">Product</th>
              <th className="text-left p-4 font-medium text-brand-dark">Category</th>
              <th className="text-left p-4 font-medium text-brand-dark">Price</th>
              <th className="text-left p-4 font-medium text-brand-dark">Stock</th>
              <th className="text-left p-4 font-medium text-brand-dark">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product._id} className="border-t border-brand-dark/10">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-brand-dark/5 rounded-md overflow-hidden">
                      <ProductImage
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        iconSize={20}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-brand-dark">{product.name}</p>
                      <p className="text-sm text-brand-dark/60">{product.tag}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-brand-dark/60">{product.category}</td>
                <td className="p-4 font-medium text-brand-dark">₹{product.price}</td>
                <td className="p-4 text-brand-dark/60">{product.countInStock}</td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(product)}
                      className="p-2 text-brand-pink hover:bg-brand-pink/10 rounded-md transition-colors"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(product._id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="font-serif text-2xl font-bold text-brand-dark mb-6">
              {editingProduct ? "Edit Product" : "Add Product"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-brand-dark mb-2">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-3 border border-brand-dark/10 rounded-md focus:border-brand-pink focus:ring-1 focus:ring-brand-pink outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-dark mb-2">Category *</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-4 py-3 border border-brand-dark/10 rounded-md focus:border-brand-pink focus:ring-1 focus:ring-brand-pink outline-none"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-brand-dark mb-2">Price *</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    className="w-full px-4 py-3 border border-brand-dark/10 rounded-md focus:border-brand-pink focus:ring-1 focus:ring-brand-pink outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-dark mb-2">Stock *</label>
                  <input
                    type="number"
                    value={formData.countInStock}
                    onChange={(e) => setFormData({...formData, countInStock: e.target.value})}
                    className="w-full px-4 py-3 border border-brand-dark/10 rounded-md focus:border-brand-pink focus:ring-1 focus:ring-brand-pink outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-2">Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-3 border border-brand-dark/10 rounded-md focus:border-brand-pink focus:ring-1 focus:ring-brand-pink outline-none h-24"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-2">Image</label>
                <input
                  type="file"
                  onChange={(e) => setFormData({...formData, image: e.target.files[0]})}
                  className="w-full px-4 py-3 border border-brand-dark/10 rounded-md focus:border-brand-pink focus:ring-1 focus:ring-brand-pink outline-none"
                />
              </div>
              <div className="flex gap-4 justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-md"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="rounded-md">
                  {editingProduct ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
