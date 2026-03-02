import React, { useState, useEffect } from 'react';
import { 
  Utensils, 
  CheckCircle2, 
  Clock, 
  LayoutDashboard, 
  Receipt, 
  QrCode, 
  X, 
  Download,
  Plus,
  LogOut,
  Lock,
  Power,
  PowerOff,
  Settings,
  Users,
  Trash2,
  Printer,
  History,
  Minus,
  Upload,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Order {
  id: number;
  table_number: string;
  status: 'pending' | 'served' | 'paid' | 'unpaid';
  total_amount: number;
  created_at: string;
  customer_name?: string;
  order_note?: string;
  items: { name: string; quantity: number; price: number; status: 'pending' | 'served' }[];
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

export default function CashierPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<{username: string, role: string} | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [unpaidOrders, setUnpaidOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'unpaid' | 'history'>('active');
  const activeTabRef = React.useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    month: 'all',
    year: new Date().getFullYear().toString(),
    status: ''
  });
  const [showPaymentModal, setShowPaymentModal] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'unpaid' | null>(null);
  const [shopStatus, setShopStatus] = useState<'online' | 'offline'>('online');
  
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<number | null>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [newMenu, setNewMenu] = useState({
    name: '',
    price: '',
    category: '',
    description: '',
    image_url: '',
    is_available: 1,
    discount_price: ''
  });

  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    if (showSettingsModal) {
      fetchAdminUsers();
      fetchMenuItems();
    }
  }, [showSettingsModal]);
  const [adminUsers, setAdminUsers] = useState<{id: number, username: string, role: string}[]>([]);
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '', role: 'staff' });
  const [publicAppUrl, setPublicAppUrl] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmDeleteMenuId, setConfirmDeleteMenuId] = useState<number | null>(null);
  const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState<number | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<{id: number, name: string}[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  useEffect(() => {
    if (showSettingsModal) {
      fetchAdminUsers();
      fetchMenuItems();
      fetchCategories();
    }
  }, [showSettingsModal]);

  useEffect(() => {
    if (showAddMenuModal) {
      fetchCategories();
    }
  }, [showAddMenuModal]);

  useEffect(() => {
    const savedUser = localStorage.getItem('admin_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setIsLoggedIn(true);
      setCurrentUser(user);
    }

    if (isLoggedIn) {
      fetchActiveOrders();
      fetchUnpaidOrders();
      if (activeTab === 'history') fetchHistoryOrders();
      fetchShopStatus();
      fetchAdminUsers();
      fetchAppUrl();
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}`);
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_ORDER' || data.type === 'ORDER_UPDATED') {
          fetchActiveOrders();
          fetchUnpaidOrders();
          if (activeTabRef.current === 'history') fetchHistoryOrders();
        }
        if (data.type === 'SHOP_STATUS_UPDATED') {
          setShopStatus(data.status);
        }
        if (data.type === 'CATEGORIES_UPDATED') {
          fetchCategories();
          fetchMenuItems();
        }
      };
      return () => ws.close();
    }
  }, [isLoggedIn]);

  const fetchShopStatus = async () => {
    const res = await fetch('/api/shop-status');
    const data = await res.json();
    setShopStatus(data.status);
  };

  const toggleShopStatus = async () => {
    const newStatus = shopStatus === 'online' ? 'offline' : 'online';
    const res = await fetch('/api/admin/shop-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      setShopStatus(newStatus);
    }
  };

  const fetchAdminUsers = async () => {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    setAdminUsers(data);
  };

  const fetchAppUrl = async () => {
    const res = await fetch('/api/app-url');
    const data = await res.json();
    setPublicAppUrl(data.url);
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const requester = currentUser?.username || 'unknown';
    const res = await fetch(`/api/admin/users?requester=${encodeURIComponent(requester)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAdmin)
    });
    if (res.ok) {
      setNewAdmin({ username: '', password: '', role: 'staff' });
      fetchAdminUsers();
      alert('User baru berhasil ditambahkan!');
    } else {
      const data = await res.json();
      alert(data.message);
    }
  };

  const handleUpdateUserRole = async (id: number, newRole: string) => {
    const requester = currentUser?.username || 'unknown';
    const res = await fetch(`/api/admin/users/${id}/role?requester=${encodeURIComponent(requester)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole })
    });
    if (res.ok) {
      fetchAdminUsers();
    } else {
      const data = await res.json();
      alert(data.message);
    }
  };

  const handleDeleteAdmin = async (id: number) => {
    console.log('handleDeleteAdmin executing for ID:', id);
    const requester = currentUser?.username || 'unknown';
    console.log(`Attempting to delete admin ID: ${id}, Requester: ${requester}`);
    
    try {
      const res = await fetch(`/api/admin/users/${id}?requester=${encodeURIComponent(requester)}`, { 
        method: 'DELETE' 
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        console.log('Admin deleted successfully');
        setConfirmDeleteId(null);
        fetchAdminUsers();
        alert('Admin berhasil dihapus');
      } else {
        console.error('Failed to delete admin:', data.message);
        alert(data.message || 'Gagal menghapus admin');
        setConfirmDeleteId(null);
      }
    } catch (error) {
      console.error('Network error during delete:', error);
      alert('Terjadi kesalahan jaringan saat mencoba menghapus admin');
      setConfirmDeleteId(null);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      setIsLoggedIn(true);
      setCurrentUser(data.user);
      localStorage.setItem('admin_user', JSON.stringify(data.user));
    } else {
      setLoginError(data.message);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      if (activeTab === 'history') fetchHistoryOrders();
      if (activeTab === 'unpaid') fetchUnpaidOrders();
    }
  }, [activeTab, filters, isLoggedIn]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    localStorage.removeItem('admin_user');
  };

  const handlePrintReceipt = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = order.items.map(item => `
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px;">
        <span>${item.name} x${item.quantity}</span>
        <span>${formatCurrency(item.price * item.quantity)}</span>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Struk Pembayaran - ${order.id}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; width: 300px; margin: 0 auto; padding: 20px; color: #000; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
            .footer { text-align: center; margin-top: 20px; border-top: 1px dashed #000; padding-top: 10px; font-size: 10px; }
            .total { border-top: 1px solid #000; margin-top: 10px; padding-top: 10px; font-weight: bold; display: flex; justify-content: space-between; }
            .info { font-size: 10px; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 style="margin: 0;">KANTIN KANTOR</h2>
            <p style="font-size: 10px; margin: 5px 0 0 0;">Laporan Pembayaran Pesanan</p>
          </div>
          <div class="info">
            <div>Order ID: #${order.id}</div>
            <div>Waktu: ${new Date(order.created_at.replace(' ', 'T') + 'Z').toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</div>
            <div>Atas Nama: ${order.customer_name || 'Tanpa Nama'}</div>
          </div>
          <div style="border-bottom: 1px dashed #000; margin-bottom: 10px;"></div>
          ${itemsHtml}
          <div class="total">
            <span>TOTAL</span>
            <span>${formatCurrency(order.total_amount)}</span>
          </div>
          <div class="footer">
            <p>Terima kasih atas pesanan Anda!</p>
            <p>Semoga harimu menyenangkan</p>
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const fetchMenuItems = () => {
    fetch('/api/menu')
      .then(res => res.json())
      .then(setMenuItems);
  };

  const fetchCategories = async () => {
    console.log('[FRONTEND] Fetching categories...');
    const res = await fetch('/api/categories');
    const data = await res.json();
    console.log('[FRONTEND] Categories fetched:', data);
    setCategories(data);
    if (data.length > 0 && !newMenu.category) {
      setNewMenu(prev => ({ ...prev, category: data[0].name }));
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const requester = currentUser?.username || 'admin';
    const res = await fetch(`/api/admin/categories?requester=${encodeURIComponent(requester)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCategoryName })
    });
    if (res.ok) {
      setNewCategoryName('');
      fetchCategories();
    } else {
      const data = await res.json();
      alert(data.message || 'Gagal menambah kategori');
    }
  };

  const handleUpdateCategory = async (id: number) => {
    if (!editingCategoryName.trim()) return;
    const requester = currentUser?.username || 'admin';
    const res = await fetch(`/api/admin/categories/${id}?requester=${encodeURIComponent(requester)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingCategoryName })
    });
    if (res.ok) {
      setEditingCategoryId(null);
      setEditingCategoryName('');
      fetchCategories();
      fetchMenuItems();
    } else {
      const data = await res.json();
      alert(data.message || 'Gagal memperbarui kategori');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    const requester = currentUser?.username || 'admin';
    console.log(`[FRONTEND] Deleting category ID: ${id}, Requester: ${requester}`);
    const res = await fetch(`/api/admin/categories/${id}?requester=${encodeURIComponent(requester)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      setConfirmDeleteCategoryId(null);
      fetchCategories();
      fetchMenuItems();
    } else {
      const data = await res.json();
      alert(data.message || 'Gagal menghapus kategori');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Hanya file gambar yang diperbolehkan');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal 5MB');
      return;
    }

    setIsUploadingImage(true);
    const formData = new FormData();
    formData.append('image', file);
    const requester = currentUser?.username || 'unknown';

    try {
      const res = await fetch(`/api/admin/upload?requester=${encodeURIComponent(requester)}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setNewMenu(prev => ({ ...prev, image_url: data.imageUrl }));
      } else {
        alert(data.message || 'Gagal mengunggah gambar');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Terjadi kesalahan saat mengunggah gambar');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    const requester = currentUser?.username || 'unknown';
    const url = editingMenuId ? `/api/admin/menu/${editingMenuId}?requester=${encodeURIComponent(requester)}` : `/api/admin/menu?requester=${encodeURIComponent(requester)}`;
    const method = editingMenuId ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ...newMenu, 
        price: parseInt(newMenu.price),
        discount_price: newMenu.discount_price ? parseInt(newMenu.discount_price) : null
      })
    });
    const data = await res.json();
    if (data.success) {
      setShowAddMenuModal(false);
      setEditingMenuId(null);
      setNewMenu({ name: '', price: '', category: '', description: '', image_url: '', is_available: 1, discount_price: '' });
      fetchMenuItems();
      alert(editingMenuId ? 'Menu berhasil diperbarui!' : 'Menu berhasil ditambahkan!');
    } else {
      alert(data.message);
    }
  };

  const handleDeleteMenu = async (id: number) => {
    const requester = currentUser?.username || 'admin';
    console.log(`[FRONTEND] Deleting menu ID: ${id}, Requester: ${requester}`);
    const res = await fetch(`/api/admin/menu/${id}?requester=${encodeURIComponent(requester)}`, { method: 'DELETE' });
    if (res.ok) {
      console.log(`[FRONTEND] Menu ${id} deleted successfully`);
      setConfirmDeleteMenuId(null);
      fetchMenuItems();
    } else {
      const data = await res.json();
      console.error(`[FRONTEND] Failed to delete menu ${id}:`, data.message);
      alert(data.message || 'Gagal menghapus menu');
    }
  };

  const openEditMenu = (menu: any) => {
    setEditingMenuId(menu.id);
    setNewMenu({
      name: menu.name,
      price: menu.price.toString(),
      category: menu.category,
      description: menu.description || '',
      image_url: menu.image_url || '',
      is_available: menu.is_available ?? 1,
      discount_price: menu.discount_price ? menu.discount_price.toString() : ''
    });
    setShowAddMenuModal(true);
  };

  const fetchActiveOrders = () => {
    fetch('/api/cashier/orders')
      .then(res => res.json())
      .then(setActiveOrders);
  };

  const fetchUnpaidOrders = () => {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.month !== 'all') params.append('month', filters.month);
    if (filters.year !== 'all') params.append('year', filters.year);

    fetch(`/api/cashier/orders/unpaid?${params.toString()}`)
      .then(res => res.json())
      .then(setUnpaidOrders);
  };

  const fetchHistoryOrders = () => {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.month !== 'all') params.append('month', filters.month);
    if (filters.year !== 'all') params.append('year', filters.year);
    if (filters.status) params.append('status', filters.status);

    fetch(`/api/cashier/orders/history?${params.toString()}`)
      .then(res => res.json())
      .then(setHistoryOrders);
  };

  const updateOrderStatus = async (id: number, status: string, method?: string) => {
    await fetch(`/api/cashier/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status, 
        paymentMethod: method,
        processedBy: (status === 'paid' || status === 'unpaid') ? currentUser?.username : null
      })
    });
    fetchActiveOrders();
    fetchUnpaidOrders();
    setShowPaymentModal(null);
    setPaymentMethod(null);
  };

  const updateItemStatus = async (itemId: number, status: string) => {
    await fetch(`/api/cashier/order-items/${itemId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    fetchActiveOrders();
    fetchUnpaidOrders();
  };

  const removeItemFromOrder = async (itemId: number) => {
    if (confirm('Hapus item ini dari pesanan?')) {
      await fetch(`/api/cashier/order-items/${itemId}`, {
        method: 'DELETE'
      });
      fetchActiveOrders();
      fetchUnpaidOrders();
    }
  };

  const updateItemQuantity = async (itemId: number, action: 'increase' | 'decrease') => {
    const res = await fetch(`/api/cashier/order-items/${itemId}/quantity`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    if (res.ok) {
      fetchActiveOrders();
      fetchUnpaidOrders();
    } else {
      const data = await res.json();
      alert(data.message || 'Gagal memperbarui jumlah');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-black/5"
        >
          <div className="text-center mb-8">
            <div className="bg-black text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock size={32} />
            </div>
            <h1 className="text-3xl font-black tracking-tight">ADMIN LOGIN</h1>
            <p className="text-gray-500">WarkopGen-Z Management System</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Username</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-black/5 font-bold"
                placeholder="User"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-black/5 font-bold"
                placeholder="Password"
                required
              />
            </div>
            {loginError && <p className="text-red-500 text-sm font-bold text-center">{loginError}</p>}
            <button 
              type="submit"
              className="w-full bg-black text-white py-4 rounded-2xl font-black text-lg hover:bg-gray-800 transition-all shadow-lg shadow-black/10"
            >
              Masuk
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3">
              <LayoutDashboard size={32} className="shrink-0" />
              CASHIER DASHBOARD
            </h1>
            <p className="text-gray-500 font-medium text-sm md:text-base">Monitoring pesanan masuk secara real-time</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              onClick={toggleShopStatus}
              className={`flex-1 md:flex-none px-4 py-2 rounded-full text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                shopStatus === 'online' 
                ? 'bg-emerald-100 text-emerald-700' 
                : 'bg-red-100 text-red-700'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${
                shopStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
              }`} />
              {shopStatus === 'online' ? 'Sistem Online' : 'Sistem Offline'}
            </button>

            {currentUser && (
              <div className="flex items-center gap-3 bg-white border border-black/5 px-3 py-2 rounded-2xl shadow-sm">
                <div className="w-8 h-8 bg-black text-white rounded-xl flex items-center justify-center font-black text-xs shrink-0">
                  {currentUser.username.substring(0, 2).toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Petugas</p>
                  <p className="text-sm font-black leading-none">{currentUser.username}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              {isLoggedIn && (
                <button 
                  onClick={() => setShowSettingsModal(true)}
                  className="bg-white border border-black/10 text-black p-2.5 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                  title="Pengaturan"
                >
                  <Settings size={20} />
                </button>
              )}

              <button 
                onClick={handleLogout}
                className="bg-red-50 text-red-600 p-2.5 rounded-xl hover:bg-red-100 transition-colors"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </header>

        <div className="flex items-center gap-2 md:gap-4 mb-8 bg-white p-2 rounded-2xl border border-black/5 shadow-sm overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('active')}
            className={`flex-1 min-w-[120px] md:min-w-[140px] py-3 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 ${
              activeTab === 'active' ? 'bg-black text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            <Clock size={18} /> Aktif ({activeOrders.length})
          </button>
          <button 
            onClick={() => setActiveTab('unpaid')}
            className={`flex-1 min-w-[120px] md:min-w-[140px] py-3 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 ${
              activeTab === 'unpaid' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            <Receipt size={18} /> Cashbon ({unpaidOrders.length})
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 min-w-[120px] md:min-w-[140px] py-3 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 ${
              activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            <History size={18} /> Riwayat
          </button>
        </div>

        {activeTab !== 'active' && (
          <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm mb-8">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Dari Tanggal</label>
                <input 
                  type="date" 
                  value={filters.startDate}
                  onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black/5 font-bold text-sm"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Sampai Tanggal</label>
                <input 
                  type="date" 
                  value={filters.endDate}
                  onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black/5 font-bold text-sm"
                />
              </div>
              {!filters.startDate && !filters.endDate && (
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Bulan</label>
                  <select 
                    value={filters.month}
                    onChange={(e) => setFilters({...filters, month: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black/5 font-bold text-sm"
                  >
                    <option value="all">Semua Bulan</option>
                    {Array.from({length: 12}, (_, i) => (
                      <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('id-ID', {month: 'long'})}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Tahun</label>
                <select 
                  value={filters.year}
                  onChange={(e) => setFilters({...filters, year: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black/5 font-bold text-sm"
                >
                  {Array.from({length: 5}, (_, i) => {
                    const year = new Date().getFullYear() - i;
                    return <option key={year} value={year}>{year}</option>
                  })}
                </select>
              </div>
              {activeTab === 'history' && (
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Status</label>
                  <select 
                    value={filters.status}
                    onChange={(e) => setFilters({...filters, status: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black/5 font-bold text-sm"
                  >
                    <option value="">Semua Status</option>
                    <option value="paid">Lunas</option>
                    <option value="unpaid">Cashbon</option>
                  </select>
                </div>
              )}
              <button 
                onClick={() => setFilters({startDate: '', endDate: '', month: 'all', year: new Date().getFullYear().toString(), status: ''})}
                className="bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
              >
                Reset
              </button>
              <button 
                onClick={() => {
                  const params = new URLSearchParams();
                  if (filters.startDate) params.append('startDate', filters.startDate);
                  if (filters.endDate) params.append('endDate', filters.endDate);
                  if (!filters.startDate && !filters.endDate) {
                    if (filters.month !== 'all') params.append('month', filters.month);
                    if (filters.year !== 'all') params.append('year', filters.year);
                  }
                  if (filters.status) params.append('status', filters.status);
                  window.open(`/api/cashier/report?${params.toString()}`, '_blank');
                }}
                className="bg-black text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-sm"
              >
                <Download size={18} />
                Download Laporan
              </button>
          </div>
        </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <AnimatePresence mode="popLayout">
            {(activeTab === 'active' ? activeOrders : activeTab === 'unpaid' ? unpaidOrders : historyOrders).map((order) => (
              <motion.div 
                layout
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col ${
                  order.status === 'unpaid' ? 'border-red-100' : 
                  order.status === 'paid' ? 'border-emerald-100' : 'border-black/5'
                }`}
              >
                <div className={`p-5 border-b flex justify-between items-start ${
                  order.status === 'unpaid' ? 'bg-red-50/50 border-red-100' : 
                  order.status === 'paid' ? 'bg-emerald-50/30 border-emerald-50' : 'bg-gray-50/30 border-black/5'
                }`}>
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Atas Nama</span>
                    <h2 className="text-2xl font-black">{order.customer_name || 'Tanpa Nama'}</h2>
                    <p className="text-[10px] font-bold text-gray-400 mt-1">
                      {new Date(order.created_at.replace(' ', 'T') + 'Z').toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                    {order.order_note && (
                      <p className="text-[10px] text-amber-600 font-bold mt-1 bg-amber-50 px-2 py-1 rounded-lg">
                        Note: {order.order_note}
                      </p>
                    )}
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    order.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                    order.status === 'served' ? 'bg-blue-100 text-blue-700' : 
                    order.status === 'unpaid' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {order.status}
                  </div>
                </div>

                <div className="p-5 flex-1">
                  <div className="space-y-4">
                    {order.items.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between items-start text-sm group">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="flex items-center bg-gray-100 rounded-lg p-1">
                            {activeTab === 'active' && (
                              <button 
                                onClick={() => updateItemQuantity(item.id, 'decrease')}
                                className="p-1 hover:bg-white rounded-md transition-colors text-gray-500"
                                title="Kurangi"
                              >
                                <Minus size={12} />
                              </button>
                            )}
                            <span className="text-black font-bold px-2 min-w-[24px] text-center">{item.quantity}x</span>
                            {activeTab === 'active' && (
                              <button 
                                onClick={() => updateItemQuantity(item.id, 'increase')}
                                className="p-1 hover:bg-white rounded-md transition-colors text-gray-500"
                                title="Tambah"
                              >
                                <Plus size={12} />
                              </button>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-600 font-medium">{item.name}</span>
                            <span className="text-[10px] text-gray-400">{formatCurrency(item.price * item.quantity)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.status === 'pending' && activeTab === 'active' ? (
                            <button 
                              onClick={() => updateItemStatus(item.id, 'served')}
                              className="bg-amber-50 text-amber-600 px-2 py-1 rounded-lg text-[10px] font-bold uppercase hover:bg-amber-100 transition-colors"
                              title="Tandai Tersaji"
                            >
                              Sajikan
                            </button>
                          ) : (
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                              item.status === 'served' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                              {item.status}
                            </span>
                          )}
                          {activeTab === 'active' && (
                            <button 
                              onClick={() => removeItemFromOrder(item.id)}
                              className="text-gray-300 hover:text-red-500 p-1 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              title="Hapus Item"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 bg-gray-50/50 border-t border-black/5">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-gray-400 uppercase">Total Tagihan</span>
                    <span className="text-xl font-black text-black">{formatCurrency(order.total_amount)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {order.status === 'pending' && activeTab === 'active' && (
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'served')}
                        className="col-span-2 bg-black text-white py-3 rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                      >
                        <Utensils size={16} /> Tandai Disajikan
                      </button>
                    )}
                    {(order.status === 'served' || order.status === 'unpaid') && (
                      <button 
                        onClick={() => setShowPaymentModal(order)}
                        className={`col-span-2 py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
                          order.status === 'unpaid' 
                          ? 'bg-red-600 text-white hover:bg-red-700' 
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        <Receipt size={16} /> {order.status === 'unpaid' ? 'Selesaikan Cashbon' : 'Selesaikan Pembayaran'}
                      </button>
                    )}
                    {order.status === 'paid' && (
                      <button 
                        onClick={() => handlePrintReceipt(order)}
                        className="col-span-2 bg-gray-100 text-black py-3 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <Printer size={16} /> Cetak Ulang Struk
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {(activeTab === 'active' ? activeOrders : activeTab === 'unpaid' ? unpaidOrders : historyOrders).length === 0 && (
            <div className="col-span-full py-20 text-center">
              <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                {activeTab === 'active' ? <Clock size={32} /> : <Receipt size={32} />}
              </div>
              <h3 className="text-xl font-bold text-gray-400">
                {activeTab === 'active' ? 'Belum ada pesanan aktif' : 
                 activeTab === 'unpaid' ? 'Tidak ada tagihan cashbon' : 'Tidak ada riwayat pesanan'}
              </h3>
            </div>
          )}
        </div>

        {/* Payment Modal */}
        <AnimatePresence>
          {showPaymentModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl overflow-y-auto max-h-[95vh]"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black">Pembayaran</h2>
                  <button onClick={() => setShowPaymentModal(null)} className="text-gray-400 hover:text-black">
                    <X size={24} />
                  </button>
                </div>

                <div className="mb-6 p-4 bg-gray-50 rounded-2xl max-h-48 overflow-y-auto">
                  <div className="flex justify-between mb-2 border-b border-gray-200 pb-2">
                    <span className="text-gray-500 font-medium text-xs">Atas Nama</span>
                    <span className="font-bold text-sm">{showPaymentModal.customer_name || 'Tanpa Nama'}</span>
                  </div>
                  <div className="flex justify-between mb-4 border-b border-gray-200 pb-2">
                    <span className="text-gray-500 font-medium text-xs">Waktu</span>
                    <span className="font-bold text-[10px] text-gray-400">{new Date(showPaymentModal.created_at.replace(' ', 'T')).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rincian Pesanan</p>
                    {showPaymentModal.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-600">{item.name} <span className="text-[10px] font-bold">x{item.quantity}</span></span>
                        <span className="font-bold">{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="text-gray-500 font-medium">Total Tagihan</span>
                    <span className="font-black text-xl text-black">{formatCurrency(showPaymentModal.total_amount)}</span>
                  </div>
                </div>

                <div className="flex gap-2 mb-6">
                  <button 
                    onClick={() => handlePrintReceipt(showPaymentModal)}
                    className="flex-1 bg-gray-100 text-black py-3 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Printer size={16} /> Cetak Struk
                  </button>
                </div>

                <div className="space-y-3 mb-8">
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Pilih Metode</p>
                  <div className="grid grid-cols-3 gap-3">
                    <button 
                      onClick={() => setPaymentMethod('cash')}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                        paymentMethod === 'cash' ? 'border-black bg-black text-white' : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <Receipt size={24} />
                      <span className="text-[10px] font-bold uppercase">Tunai</span>
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('qris')}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                        paymentMethod === 'qris' ? 'border-black bg-black text-white' : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <QrCode size={24} />
                      <span className="text-[10px] font-bold uppercase">QRIS</span>
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('unpaid')}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                        paymentMethod === 'unpaid' ? 'border-red-600 bg-red-600 text-white' : 'border-red-100 bg-red-50 hover:border-red-200 text-red-600'
                      }`}
                    >
                      <Clock size={24} />
                      <span className="text-[10px] font-bold uppercase">Cashbon</span>
                    </button>
                  </div>
                </div>

                {paymentMethod === 'qris' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-8 text-center"
                  >
                    <div className="bg-white p-4 border-2 border-gray-100 rounded-2xl inline-block mb-2">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=PAYMENT_FOR_TABLE_${showPaymentModal.table_number}_AMOUNT_${showPaymentModal.total_amount}`} 
                        alt="QRIS Placeholder" 
                        className="w-32 h-32"
                      />
                    </div>
                    <p className="text-xs text-gray-400">Scan QR di atas untuk membayar</p>
                  </motion.div>
                )}

                <button 
                  disabled={!paymentMethod}
                  onClick={() => updateOrderStatus(
                    showPaymentModal.id, 
                    paymentMethod === 'unpaid' ? 'unpaid' : 'paid', 
                    paymentMethod!
                  )}
                  className={`w-full py-4 rounded-2xl font-black text-lg disabled:opacity-20 transition-all ${
                    paymentMethod === 'unpaid' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-black text-white hover:bg-gray-800'
                  }`}
                >
                  {paymentMethod === 'unpaid' ? 'Simpan sebagai Cashbon' : 'Konfirmasi Pembayaran'}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Action Button for Add Menu */}
        {isLoggedIn && (
          <button
            onClick={() => {
              setEditingMenuId(null);
              setNewMenu({ name: '', price: '', category: '', description: '', image_url: '', is_available: 1, discount_price: '' });
              setShowAddMenuModal(true);
            }}
            className="fixed bottom-6 right-6 md:bottom-8 md:right-8 bg-black text-white w-14 h-14 md:w-16 md:h-16 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 group"
            title="Tambah Menu Baru"
          >
            <Plus size={28} className="md:size-32 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        )}

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettingsModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 md:p-8 max-w-4xl w-full shadow-2xl overflow-y-auto max-h-[90vh]"
              >
                <div className="flex justify-between items-center mb-6 md:mb-8">
                  <h2 className="text-2xl md:text-3xl font-black">Pengaturan Sistem</h2>
                  <button onClick={() => setShowSettingsModal(null)} className="text-gray-400 hover:text-black">
                    <X size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                  {/* User Management */}
                  <section>
                    <div className="flex items-center gap-2 mb-6">
                      <Users className="text-gray-400" />
                      <h3 className="text-xl font-bold">Manajemen Admin</h3>
                    </div>
                    
                    {currentUser?.role === 'admin' ? (
                      <form onSubmit={handleAddAdmin} className="space-y-4 mb-8 bg-gray-50 p-6 rounded-2xl">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tambah User Baru</p>
                        <input 
                          type="text" 
                          placeholder="Username"
                          value={newAdmin.username}
                          onChange={(e) => setNewAdmin({...newAdmin, username: e.target.value})}
                          className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 focus:outline-none font-bold text-sm"
                          required
                        />
                        <input 
                          type="password" 
                          placeholder="Password"
                          value={newAdmin.password}
                          onChange={(e) => setNewAdmin({...newAdmin, password: e.target.value})}
                          className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 focus:outline-none font-bold text-sm"
                          required
                        />
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => setNewAdmin({...newAdmin, role: 'admin'})}
                            className={`flex-1 py-3 rounded-xl font-bold text-[10px] transition-all ${newAdmin.role === 'admin' ? 'bg-black text-white' : 'bg-white border border-gray-100 text-gray-400'}`}
                          >
                            ADMIN
                          </button>
                          <button 
                            type="button"
                            onClick={() => setNewAdmin({...newAdmin, role: 'staff'})}
                            className={`flex-1 py-3 rounded-xl font-bold text-[10px] transition-all ${newAdmin.role === 'staff' ? 'bg-black text-white' : 'bg-white border border-gray-100 text-gray-400'}`}
                          >
                            STAFF
                          </button>
                        </div>
                        <button type="submit" className="w-full bg-black text-white py-3 rounded-xl font-bold text-sm">
                          Tambah User
                        </button>
                      </form>
                    ) : (
                      <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl mb-8">
                        <p className="text-amber-700 text-xs font-bold">Hanya akun dengan level 'admin' yang dapat menambah user baru.</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Daftar User & Level</p>
                      {adminUsers.map(user => (
                        <div key={user.id} className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-xl">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{user.username}</span>
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${user.role === 'admin' ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>
                                {user.role}
                              </span>
                            </div>
                            {confirmDeleteId === user.id && (
                              <span className="text-[10px] text-red-500 font-bold animate-pulse">Yakin ingin menghapus?</span>
                            )}
                          </div>
                          
                          {user.username.toLowerCase() !== 'admin' && (
                            <div className="flex items-center gap-2">
                              {currentUser?.role === 'admin' && (
                                <select 
                                  value={user.role}
                                  onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                                  className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 text-[10px] font-bold focus:outline-none"
                                >
                                  <option value="admin">ADMIN</option>
                                  <option value="staff">STAFF</option>
                                </select>
                              )}
                              
                              {confirmDeleteId === user.id ? (
                                <>
                                  <button 
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setConfirmDeleteId(null);
                                    }}
                                    className="text-gray-400 hover:bg-gray-50 px-3 py-1 rounded-lg text-xs font-bold transition-all"
                                  >
                                    Batal
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDeleteAdmin(user.id);
                                    }}
                                    className="bg-red-500 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-600 transition-all shadow-sm active:scale-95"
                                  >
                                    Ya, Hapus
                                  </button>
                                </>
                              ) : (
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setConfirmDeleteId(user.id);
                                  }}
                                  className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center border border-transparent hover:border-red-200 active:scale-90"
                                  title="Hapus Admin"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* QR Code Generator */}
                  <section className="print:hidden">
                    <div className="flex items-center gap-2 mb-6">
                      <QrCode className="text-gray-400" />
                      <h3 className="text-xl font-bold">QR Code Menu</h3>
                    </div>
                    
                    <div className="bg-gray-50 p-6 rounded-2xl text-center">
                      <p className="text-sm text-gray-500 mb-6">QR Code ini mengarah langsung ke menu digital untuk pemesanan.</p>
                      
                      <div className="bg-white p-6 rounded-2xl border-2 border-dashed border-gray-200 inline-block mb-6">
                        <div id="printable-qr" className="bg-white p-4 inline-block">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${publicAppUrl || window.location.origin}`} 
                            alt="Menu QR"
                            className="w-40 h-40"
                          />
                          <p className="mt-4 font-black text-xl">MENU DIGITAL</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Scan untuk Pesan</p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <p className="text-[8px] text-gray-300 break-all max-w-[200px] mx-auto">
                            {publicAppUrl || window.location.origin}
                          </p>
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          const content = document.getElementById('printable-qr')?.innerHTML;
                          const win = window.open('', '', 'height=500,width=500');
                          win?.document.write(`<html><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;">${content}</body></html>`);
                          win?.document.close();
                          win?.print();
                        }}
                        className="w-full bg-black text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2"
                      >
                        <Printer size={20} /> Cetak QR Code
                      </button>
                    </div>
                  </section>

                  {/* Category Management */}
                  <section>
                    <div className="flex items-center gap-2 mb-6">
                      <Settings className="text-gray-400" />
                      <h3 className="text-xl font-bold">Manajemen Kategori</h3>
                    </div>

                    {isLoggedIn && (
                      <form onSubmit={handleAddCategory} className="space-y-4 mb-8 bg-gray-50 p-6 rounded-2xl">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tambah Kategori Baru</p>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Nama Kategori"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className="flex-1 bg-white border border-gray-100 rounded-xl px-4 py-3 focus:outline-none font-bold text-sm"
                            required
                          />
                          <button type="submit" className="bg-black text-white px-6 py-3 rounded-xl font-bold text-sm">
                            Tambah
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Daftar Kategori</p>
                      <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 no-scrollbar">
                        {categories.map(cat => (
                          <div key={cat.id} className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-xl group">
                            {editingCategoryId === cat.id ? (
                              <div className="flex-1 flex gap-2">
                                <input 
                                  type="text"
                                  value={editingCategoryName}
                                  onChange={(e) => setEditingCategoryName(e.target.value)}
                                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1 font-bold text-sm focus:outline-none"
                                  autoFocus
                                />
                                <button 
                                  onClick={() => handleUpdateCategory(cat.id)}
                                  className="bg-emerald-500 text-white px-3 py-1 rounded-lg text-xs font-bold"
                                >
                                  Simpan
                                </button>
                                <button 
                                  onClick={() => setEditingCategoryId(null)}
                                  className="text-gray-400 px-2 py-1"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="flex flex-col">
                                  <span className="font-bold">{cat.name}</span>
                                  {confirmDeleteCategoryId === cat.id && (
                                    <span className="text-[10px] text-red-500 font-bold animate-pulse">Hapus kategori ini?</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {confirmDeleteCategoryId === cat.id ? (
                                    <div className="flex items-center gap-1">
                                      <button 
                                        onClick={() => setConfirmDeleteCategoryId(null)}
                                        className="px-2 py-1 text-[10px] font-bold text-gray-400 hover:bg-gray-50 rounded"
                                      >
                                        Batal
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteCategory(cat.id)}
                                        className="px-2 py-1 text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 rounded"
                                      >
                                        Ya, Hapus
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <button 
                                        onClick={() => {
                                          setEditingCategoryId(cat.id);
                                          setEditingCategoryName(cat.name);
                                        }}
                                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                      >
                                        <Settings size={14} />
                                      </button>
                                      <button 
                                        onClick={() => setConfirmDeleteCategoryId(cat.id)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                                        title="Hapus Kategori"
                                      >
                                        <Trash2 size={16} />
                                        <span className="text-[10px] font-bold uppercase md:hidden">Hapus</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                  <section className="md:col-span-2 border-t border-gray-100 pt-12">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-2">
                          <Utensils className="text-gray-400" />
                          <h3 className="text-xl font-bold">Manajemen Menu</h3>
                        </div>
                        {isLoggedIn && (
                          <button 
                            onClick={() => {
                              setEditingMenuId(null);
                              setNewMenu({ name: '', price: '', category: '', description: '', image_url: '', is_available: 1, discount_price: '' });
                              setShowAddMenuModal(true);
                            }}
                            className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
                          >
                            <Plus size={14} /> Tambah Menu
                          </button>
                        )}
                      </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {menuItems.map(menu => (
                        <div key={menu.id} className={`bg-white border border-gray-100 rounded-2xl p-4 flex gap-4 items-center shadow-sm hover:shadow-md transition-all ${!menu.is_available ? 'opacity-50 grayscale' : ''}`}>
                          <div className="relative">
                            <img 
                              src={menu.image_url || "https://picsum.photos/seed/menu/100/100"} 
                              alt={menu.name}
                              className="w-16 h-16 rounded-xl object-cover bg-gray-50"
                            />
                            {!menu.is_available && (
                              <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                                <span className="text-[8px] font-black text-white uppercase tracking-widest">Sold Out</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{menu.name}</p>
                            <div className="flex items-center gap-2">
                              {menu.discount_price ? (
                                <>
                                  <p className="text-xs text-black font-black">{formatCurrency(menu.discount_price)}</p>
                                  <p className="text-[10px] text-gray-400 line-through">{formatCurrency(menu.price)}</p>
                                </>
                              ) : (
                                <p className="text-xs text-black font-black">{formatCurrency(menu.price)}</p>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">{menu.category}</p>
                          </div>
                          {isLoggedIn && (
                            <div className="flex flex-col gap-1">
                              {confirmDeleteMenuId === menu.id ? (
                                <div className="flex flex-col gap-1">
                                  <p className="text-[8px] font-bold text-red-500 text-center">Hapus?</p>
                                  <button 
                                    onClick={() => handleDeleteMenu(menu.id)}
                                    className="bg-red-500 text-white text-[10px] font-bold py-1 px-2 rounded hover:bg-red-600 transition-colors"
                                  >
                                    Ya
                                  </button>
                                  <button 
                                    onClick={() => setConfirmDeleteMenuId(null)}
                                    className="bg-gray-100 text-gray-400 text-[10px] font-bold py-1 px-2 rounded hover:bg-gray-200 transition-colors"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button 
                                    onClick={() => openEditMenu(menu)}
                                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit Menu"
                                  >
                                    <Settings size={16} />
                                  </button>
                                  <button 
                                    onClick={() => setConfirmDeleteMenuId(menu.id)}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Hapus Menu"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Menu Modal */}
        <AnimatePresence>
          {showAddMenuModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl overflow-y-auto max-h-[95vh]"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black">{editingMenuId ? 'Edit Menu' : 'Tambah Menu Baru'}</h2>
                  <button onClick={() => setShowAddMenuModal(false)} className="text-gray-400 hover:text-black">
                    <X size={24} />
                  </button>
                </div>

                  <form onSubmit={handleSaveMenu} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Nama Menu</label>
                      <input 
                        type="text" 
                        value={newMenu.name}
                        onChange={(e) => setNewMenu({...newMenu, name: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 font-bold"
                        placeholder="Contoh: Nasi Goreng Gila"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Harga (IDR)</label>
                      <input 
                        type="number" 
                        value={newMenu.price}
                        onChange={(e) => setNewMenu({...newMenu, price: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 font-bold"
                        placeholder="25000"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Harga Diskon (Opsional)</label>
                      <input 
                        type="number" 
                        value={newMenu.discount_price}
                        onChange={(e) => setNewMenu({...newMenu, discount_price: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 font-bold"
                        placeholder="20000"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Kategori</label>
                      <div className="relative">
                        <select 
                          value={newMenu.category}
                          onChange={(e) => setNewMenu({...newMenu, category: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 font-bold appearance-none"
                        >
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                          <Settings size={14} />
                        </div>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="flex items-center gap-3 cursor-pointer p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <input 
                          type="checkbox"
                          checked={newMenu.is_available === 1}
                          onChange={(e) => setNewMenu({...newMenu, is_available: e.target.checked ? 1 : 0})}
                          className="w-5 h-5 rounded-lg accent-black"
                        />
                        <div>
                          <p className="text-sm font-bold">Menu Tersedia</p>
                          <p className="text-[10px] text-gray-400">Matikan jika menu sedang sold out</p>
                        </div>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Deskripsi</label>
                    <textarea 
                      value={newMenu.description}
                      onChange={(e) => setNewMenu({...newMenu, description: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 font-bold h-24 resize-none"
                      placeholder="Jelaskan kelezatan menu ini..."
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Gambar Menu</label>
                    <div className="space-y-4">
                      {/* Preview */}
                      {newMenu.image_url && (
                        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-gray-100">
                          <img 
                            src={newMenu.image_url} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <button 
                            type="button"
                            onClick={() => setNewMenu({ ...newMenu, image_url: '' })}
                            className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingImage}
                          className="flex flex-col items-center justify-center gap-2 p-4 bg-gray-50 border border-dashed border-gray-200 rounded-2xl hover:bg-gray-100 transition-all disabled:opacity-50"
                        >
                          {isUploadingImage ? (
                            <Loader2 size={24} className="animate-spin text-gray-400" />
                          ) : (
                            <Upload size={24} className="text-gray-400" />
                          )}
                          <span className="text-[10px] font-bold uppercase tracking-widest">Upload File</span>
                        </button>
                        
                        <div className="flex flex-col gap-2">
                          <div className="relative flex-1">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                              <ImageIcon size={18} />
                            </div>
                            <input 
                              type="url" 
                              value={newMenu.image_url}
                              onChange={(e) => setNewMenu({...newMenu, image_url: e.target.value})}
                              className="w-full h-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 font-bold text-xs"
                              placeholder="Atau tempel URL gambar..."
                            />
                          </div>
                        </div>
                      </div>
                      <input 
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        className="hidden"
                        accept="image/*"
                      />
                    </div>
                  </div>
                  <button 
                    type="submit"
                    disabled={isUploadingImage}
                    className="w-full bg-black text-white py-4 rounded-2xl font-black text-lg hover:bg-gray-800 transition-all shadow-lg shadow-black/10 mt-4 disabled:opacity-50"
                  >
                    {isUploadingImage ? 'Mengunggah...' : (editingMenuId ? 'Perbarui Menu' : 'Simpan Menu')}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
