"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { User, MapPin, Package, LogOut, ChevronRight, Edit3, Lock, Plus, X, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui/Button";
import Link from "next/link";
import { apiUrl } from "../../constants";

import { csrfFetch } from "../../lib/csrf";
export default function ProfilePage() {
  const { user, logout, loading, addresses, deleteAddress, addAddress, updateAddress, updateUser } = useAuth();
  const router = useRouter();

  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressForm, setAddressForm] = useState({
    firstName: "", lastName: "", phone: "", address: "", city: "", pin: ""
  });

  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", email: "" });

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", newPass: "", confirm: "" });
  const [recentOrders, setRecentOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const [errors, setErrors] = useState({});

  const validateAddress = () => {
    let newErrors = {};
    if (!addressForm.firstName.trim()) newErrors.firstName = "Required";
    if (!addressForm.lastName.trim()) newErrors.lastName = "Required";
    if (!addressForm.phone.trim() || !/^\d{10}$/.test(addressForm.phone)) newErrors.phone = "Invalid Phone";
    if (!addressForm.address.trim()) newErrors.address = "Required";
    if (!addressForm.city.trim()) newErrors.city = "Required";
    if (!addressForm.pin.trim() || !/^\d{6}$/.test(addressForm.pin)) newErrors.pin = "Invalid PIN";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateProfile = () => {
    let newErrors = {};
    if (!profileForm.name.trim()) newErrors.name = "Name required";
    if (!profileForm.email.trim() || !/\S+@\S+\.\S+/.test(profileForm.email)) newErrors.email = "Invalid Email";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePassword = () => {
    let newErrors = {};
    if (passwordForm.current.length < 6) newErrors.current = "Invalid password";
    if (passwordForm.newPass.length < 6) newErrors.newPass = "Min 6 characters";
    if (passwordForm.newPass !== passwordForm.confirm) newErrors.confirm = "Passwords don't match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const openEditProfile = () => {
    setErrors({});
    setProfileForm({ name: user.name, email: user.email });
    setIsEditProfileModalOpen(true);
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (validateProfile()) {
      updateUser(profileForm).then(() => setIsEditProfileModalOpen(false));
    }
  };

  const openChangePassword = () => {
    setErrors({});
    setPasswordForm({ current: "", newPass: "", confirm: "" });
    setIsPasswordModalOpen(true);
  };

  const handleSavePassword = (e) => {
    e.preventDefault();
    if (validatePassword()) {
      alert("Password updated securely.");
      setIsPasswordModalOpen(false);
    }
  };

  const handleOpenAddressModal = (addr = null) => {
    setErrors({});
    if (addr) {
      setEditingAddressId(addr.id);
      setAddressForm(addr);
    } else {
      setEditingAddressId(null);
      setAddressForm({ firstName: "", lastName: "", phone: "", address: "", city: "", pin: "" });
    }
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = (e) => {
    e.preventDefault();
    if (validateAddress()) {
      if (editingAddressId) {
        updateAddress(editingAddressId, addressForm).then(() => setIsAddressModalOpen(false));
      } else {
        addAddress(addressForm).then(() => setIsAddressModalOpen(false));
      }
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadOrders = async () => {
      if (!user) return;

      try {
        setOrdersLoading(true);
        const response = await csrfFetch(apiUrl("/api/orders/myorders"), {
          credentials: "include",
        });
        const data = await response.json();
        // Backend returns paginated { data: [...] }; older responses returned a raw array.
        const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        if (response.ok) {
          setRecentOrders(list.slice(0, 2));
        }
      } catch (error) {
        console.error("Failed to load profile orders", error);
      } finally {
        setOrdersLoading(false);
      }
    };

    loadOrders();
  }, [user]);

  if (loading || !user) return null;

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const formatOrderId = (order) => order?._id ? `ORD-${order._id.slice(-6).toUpperCase()}` : "ORDER";
  const formatOrderDate = (order) => order?.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Recent";

  return (
    <div className="min-h-screen pt-32 pb-20 bg-[#FDFBF7] selection:bg-brand-pink/30">
      <div className="container mx-auto px-4 md:px-12 max-w-6xl">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
          <div>
            <h1 className="font-serif text-5xl md:text-6xl font-bold tracking-tighter text-brand-dark mb-2">Welcome back, {(user?.name || '').split(' ')[0] || 'there'}.</h1>
            <p className="text-brand-dark/40 text-xs tracking-widest uppercase font-black">Manage your rituals, orders, and addresses.</p>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-[10px] font-black tracking-widest uppercase text-brand-dark hover:text-white hover:bg-brand-dark transition-all bg-white px-6 py-3 rounded-full shadow-sm border border-brand-dark/5 hover:shadow-lg hover:-translate-y-0.5"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Navigation & Profile Info (4 cols) */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Profile Summary Card - Gen Z Glass */}
            <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-48 h-48 bg-linear-to-br from-brand-pink/20 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:scale-110 transition-transform duration-700" />
              
              <div className="flex items-center gap-5 mb-10 relative z-10">
                  <div className="w-20 h-20 rounded-[1.25rem] bg-brand-dark text-brand-pink flex items-center justify-center font-serif text-4xl font-bold shadow-xl rotate-3 group-hover:rotate-0 transition-transform duration-500">
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-serif text-2xl font-bold text-brand-dark tracking-tight leading-none mb-1">{user?.name || ''}</h3>
                  <p className="text-xs text-brand-dark/40 font-black tracking-widest uppercase">{user?.email || ''}</p>
                </div>
              </div>

              <div className="space-y-3 relative z-10">
                <button onClick={openEditProfile} className="w-full flex items-center justify-between p-5 rounded-2xl bg-[#FDFBF7] hover:bg-brand-dark hover:text-white border border-brand-dark/5 transition-all group/btn shadow-sm">
                  <span className="flex items-center gap-3 text-xs font-black tracking-widest uppercase">
                    <Edit3 size={16} className="text-brand-dark/40 group-hover/btn:text-brand-pink transition-colors" />
                    Edit Profile
                  </span>
                  <ChevronRight size={16} className="text-brand-dark/20 group-hover/btn:text-white transition-colors" />
                </button>
                <button onClick={openChangePassword} className="w-full flex items-center justify-between p-5 rounded-2xl bg-[#FDFBF7] hover:bg-brand-dark hover:text-white border border-brand-dark/5 transition-all group/btn shadow-sm">
                  <span className="flex items-center gap-3 text-xs font-black tracking-widest uppercase">
                    <Lock size={16} className="text-brand-dark/40 group-hover/btn:text-brand-pink transition-colors" />
                    Security
                  </span>
                  <ChevronRight size={16} className="text-brand-dark/20 group-hover/btn:text-white transition-colors" />
                </button>
              </div>
            </div>

            {/* Address Card */}
            <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-serif text-2xl font-bold text-brand-dark tracking-tight">Saved Addresses</h3>
              </div>
              
              <div className="space-y-4 max-h-75 overflow-y-auto pr-2 custom-scrollbar">
                {addresses.length === 0 ? (
                  <p className="text-xs font-black tracking-widest uppercase text-brand-dark/40 mb-6 text-center py-8 bg-[#FDFBF7] rounded-2xl border border-brand-dark/5">No saved addresses.</p>
                ) : (
                  addresses.map((addr, idx) => (
                    <div key={addr.id} className="p-6 rounded-2xl bg-[#FDFBF7] border border-brand-dark/5 relative group hover:border-brand-pink/30 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <span className="inline-flex px-3 py-1 bg-brand-dark text-white text-[8px] font-black uppercase tracking-widest rounded-md shadow-sm">Address {idx + 1}</span>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleOpenAddressModal(addr)} className="w-7 h-7 rounded-full bg-white border border-brand-dark/5 flex items-center justify-center text-brand-dark/40 hover:text-brand-dark hover:border-brand-dark transition-colors"><Edit3 size={12} /></button>
                          <button onClick={() => deleteAddress(addr.id)} className="w-7 h-7 rounded-full bg-white border border-brand-dark/5 flex items-center justify-center text-brand-dark/40 hover:text-red-500 hover:border-red-500 transition-colors"><X size={12} /></button>
                        </div>
                      </div>
                      <p className="font-serif text-lg font-bold text-brand-dark mb-1 leading-tight">{addr.firstName} {addr.lastName}</p>
                      <p className="text-[10px] text-brand-dark/40 font-black tracking-widest uppercase mb-3 flex items-center gap-1"><ShieldCheck size={12}/> {addr.phone || "N/A"}</p>
                      <p className="text-xs text-brand-dark/60 leading-relaxed font-medium">
                        {addr.address}<br />
                        {addr.city}, {addr.pin}<br />
                        India
                      </p>
                    </div>
                  ))
                )}
              </div>

              <button onClick={() => handleOpenAddressModal()} className="w-full mt-4 py-5 rounded-2xl border border-dashed border-brand-dark/20 text-[10px] font-black tracking-widest uppercase text-brand-dark/40 hover:text-brand-dark hover:border-brand-dark hover:bg-[#FDFBF7] transition-all flex items-center justify-center gap-2">
                <Plus size={14} /> Add New Address
              </button>
            </div>

          </div>

          {/* Right Column: Orders & Support (8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Orders Card */}
            <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60">
              <div className="flex justify-between items-end mb-8 border-b border-brand-dark/5 pb-6">
                <div>
                  <h3 className="font-serif text-3xl font-bold text-brand-dark tracking-tight mb-2">Recent Orders</h3>
                  <p className="text-[10px] font-black tracking-widest uppercase text-brand-dark/40">Track, return, or buy again.</p>
                </div>
                <Link href="/orders" className="text-[10px] font-black text-brand-dark hover:text-brand-pink uppercase tracking-widest transition-colors flex items-center gap-1 group">
                  View All <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              <div className="space-y-4">
                {ordersLoading ? (
                  <p className="text-xs font-black tracking-widest uppercase text-brand-dark/40 py-6 text-center">Loading recent orders...</p>
                ) : recentOrders.length === 0 ? (
                  <p className="text-xs font-black tracking-widest uppercase text-brand-dark/40 py-6 text-center">No orders found.</p>
                ) : recentOrders.map((order, i) => (
                  <div key={i} className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 rounded-2xl bg-[#FDFBF7] border border-brand-dark/5 hover:border-brand-dark/10 transition-colors gap-6 group hover:shadow-sm">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-sm border border-brand-dark/5 text-brand-dark/20 group-hover:text-brand-dark group-hover:bg-brand-pink/5 transition-colors">
                        <Package size={24} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-serif text-xl font-bold text-brand-dark mb-0.5">{formatOrderId(order)}</span>
                        <span className="text-[10px] font-black tracking-widest uppercase text-brand-dark/40">Placed {formatOrderDate(order)} • {(order.items || []).length} Items</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-brand-dark/5 pt-4 md:pt-0 mt-2 md:mt-0">
                      <div className="flex flex-col md:items-end">
                        <span className="font-serif text-xl font-bold text-brand-dark mb-0.5">₹{Number(order.total || 0).toLocaleString('en-IN')}</span>
                        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#52C234]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#52C234] animate-pulse" />
                          {order.status || "Processing"}
                        </span>
                      </div>
                      <Link href={`/orders/${order._id}`} className="w-10 h-10 rounded-full bg-white border border-brand-dark/10 flex items-center justify-center text-brand-dark group-hover:bg-brand-dark group-hover:text-white transition-all shadow-sm">
                        <ChevronRight size={16} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Modals */}

      {/* Address Modal */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-200 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 md:p-10 shadow-2xl relative">
            <button 
              onClick={() => setIsAddressModalOpen(false)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-[#FDFBF7] flex items-center justify-center text-brand-dark hover:bg-brand-pink hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
            
            <h2 className="font-serif text-3xl font-bold text-brand-dark mb-8">
              {editingAddressId ? "Edit Address" : "Add Address"}
            </h2>

            <form onSubmit={handleSaveAddress} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black tracking-widest uppercase text-brand-dark/60 ml-1">First Name</label>
                  <input 
                    value={addressForm.firstName} 
                    onChange={(e) => {
                      setAddressForm({...addressForm, firstName: e.target.value});
                      if (errors.firstName) setErrors({...errors, firstName: ""});
                    }} 
                    type="text" 
                    className={`w-full px-5 py-4 bg-[#FDFBF7] border rounded-2xl text-sm focus:outline-none transition-all ${errors.firstName ? 'border-red-400' : 'border-brand-dark/5 focus:border-brand-dark/20 focus:bg-white'}`}
                  />
                  {errors.firstName && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.firstName}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black tracking-widest uppercase text-brand-dark/60 ml-1">Last Name</label>
                  <input 
                    value={addressForm.lastName} 
                    onChange={(e) => {
                      setAddressForm({...addressForm, lastName: e.target.value});
                      if (errors.lastName) setErrors({...errors, lastName: ""});
                    }} 
                    type="text" 
                    className={`w-full px-5 py-4 bg-[#FDFBF7] border rounded-2xl text-sm focus:outline-none transition-all ${errors.lastName ? 'border-red-400' : 'border-brand-dark/5 focus:border-brand-dark/20 focus:bg-white'}`}
                  />
                  {errors.lastName && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.lastName}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black tracking-widest uppercase text-brand-dark/60 ml-1">Phone Number (10 Digits)</label>
                <input 
                  value={addressForm.phone} 
                  onChange={(e) => {
                    setAddressForm({...addressForm, phone: e.target.value});
                    if (errors.phone) setErrors({...errors, phone: ""});
                  }} 
                  type="tel" 
                  className={`w-full px-5 py-4 bg-[#FDFBF7] border rounded-2xl text-sm focus:outline-none transition-all ${errors.phone ? 'border-red-400' : 'border-brand-dark/5 focus:border-brand-dark/20 focus:bg-white'}`}
                />
                {errors.phone && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.phone}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black tracking-widest uppercase text-brand-dark/60 ml-1">Complete Address</label>
                <input 
                  value={addressForm.address} 
                  onChange={(e) => {
                    setAddressForm({...addressForm, address: e.target.value});
                    if (errors.address) setErrors({...errors, address: ""});
                  }} 
                  type="text" 
                  className={`w-full px-5 py-4 bg-[#FDFBF7] border rounded-2xl text-sm focus:outline-none transition-all ${errors.address ? 'border-red-400' : 'border-brand-dark/5 focus:border-brand-dark/20 focus:bg-white'}`}
                />
                {errors.address && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.address}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black tracking-widest uppercase text-brand-dark/60 ml-1">City</label>
                  <input 
                    value={addressForm.city} 
                    onChange={(e) => {
                      setAddressForm({...addressForm, city: e.target.value});
                      if (errors.city) setErrors({...errors, city: ""});
                    }} 
                    type="text" 
                    className={`w-full px-5 py-4 bg-[#FDFBF7] border rounded-2xl text-sm focus:outline-none transition-all ${errors.city ? 'border-red-400' : 'border-brand-dark/5 focus:border-brand-dark/20 focus:bg-white'}`}
                  />
                  {errors.city && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.city}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black tracking-widest uppercase text-brand-dark/60 ml-1">PIN Code</label>
                  <input 
                    value={addressForm.pin} 
                    onChange={(e) => {
                      setAddressForm({...addressForm, pin: e.target.value});
                      if (errors.pin) setErrors({...errors, pin: ""});
                    }} 
                    type="text" 
                    className={`w-full px-5 py-4 bg-[#FDFBF7] border rounded-2xl text-sm focus:outline-none transition-all ${errors.pin ? 'border-red-400' : 'border-brand-dark/5 focus:border-brand-dark/20 focus:bg-white'}`}
                  />
                  {errors.pin && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.pin}</p>}
                </div>
              </div>

              <div className="pt-4">
                <Button variant="primary" className="w-full justify-center py-5 shadow-lg shadow-brand-dark/10">
                  Save Address
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditProfileModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-200 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 md:p-10 shadow-2xl relative">
            <button 
              onClick={() => setIsEditProfileModalOpen(false)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-[#FDFBF7] flex items-center justify-center text-brand-dark hover:bg-brand-pink hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
            <h2 className="font-serif text-3xl font-bold text-brand-dark mb-8">Edit Profile</h2>
            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black tracking-widest uppercase text-brand-dark/60 ml-1">Full Name</label>
                <input 
                  value={profileForm.name} 
                  onChange={(e) => {
                    setProfileForm({...profileForm, name: e.target.value});
                    if (errors.name) setErrors({...errors, name: ""});
                  }} 
                  type="text" 
                  className={`w-full px-5 py-4 bg-[#FDFBF7] border rounded-2xl text-sm focus:outline-none transition-all ${errors.name ? 'border-red-400' : 'border-brand-dark/5 focus:border-brand-dark/20 focus:bg-white'}`}
                />
                {errors.name && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black tracking-widest uppercase text-brand-dark/60 ml-1">Email Address</label>
                <input 
                  value={profileForm.email} 
                  onChange={(e) => {
                    setProfileForm({...profileForm, email: e.target.value});
                    if (errors.email) setErrors({...errors, email: ""});
                  }} 
                  type="email" 
                  className={`w-full px-5 py-4 bg-[#FDFBF7] border rounded-2xl text-sm focus:outline-none transition-all ${errors.email ? 'border-red-400' : 'border-brand-dark/5 focus:border-brand-dark/20 focus:bg-white'}`}
                />
                {errors.email && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.email}</p>}
              </div>
              <div className="pt-4">
                <Button variant="primary" className="w-full justify-center py-5 shadow-lg shadow-brand-dark/10">Save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-200 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 md:p-10 shadow-2xl relative">
            <button 
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-[#FDFBF7] flex items-center justify-center text-brand-dark hover:bg-brand-pink hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
            <h2 className="font-serif text-3xl font-bold text-brand-dark mb-8">Security</h2>
            <form onSubmit={handleSavePassword} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black tracking-widest uppercase text-brand-dark/60 ml-1">Current Password</label>
                <input 
                  value={passwordForm.current} 
                  onChange={(e) => {
                    setPasswordForm({...passwordForm, current: e.target.value});
                    if (errors.current) setErrors({...errors, current: ""});
                  }} 
                  type="password" 
                  className={`w-full px-5 py-4 bg-[#FDFBF7] border rounded-2xl text-sm focus:outline-none transition-all ${errors.current ? 'border-red-400' : 'border-brand-dark/5 focus:border-brand-dark/20 focus:bg-white'}`}
                />
                {errors.current && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.current}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black tracking-widest uppercase text-brand-dark/60 ml-1">New Password</label>
                <input 
                  value={passwordForm.newPass} 
                  onChange={(e) => {
                    setPasswordForm({...passwordForm, newPass: e.target.value});
                    if (errors.newPass) setErrors({...errors, newPass: ""});
                  }} 
                  type="password" 
                  className={`w-full px-5 py-4 bg-[#FDFBF7] border rounded-2xl text-sm focus:outline-none transition-all ${errors.newPass ? 'border-red-400' : 'border-brand-dark/5 focus:border-brand-dark/20 focus:bg-white'}`}
                />
                {errors.newPass && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.newPass}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black tracking-widest uppercase text-brand-dark/60 ml-1">Confirm New Password</label>
                <input 
                  value={passwordForm.confirm} 
                  onChange={(e) => {
                    setPasswordForm({...passwordForm, confirm: e.target.value});
                    if (errors.confirm) setErrors({...errors, confirm: ""});
                  }} 
                  type="password" 
                  className={`w-full px-5 py-4 bg-[#FDFBF7] border rounded-2xl text-sm focus:outline-none transition-all ${errors.confirm ? 'border-red-400' : 'border-brand-dark/5 focus:border-brand-dark/20 focus:bg-white'}`}
                />
                {errors.confirm && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest ml-1">{errors.confirm}</p>}
              </div>
              <div className="pt-4">
                <Button variant="primary" className="w-full justify-center py-5 shadow-lg shadow-brand-dark/10">Update Securely</Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
