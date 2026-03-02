'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Minus,
  CheckCircle2, 
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Store,
  Clock,
  BellRing
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  description: string;
  image_url: string;
  is_new: number;
  is_available?: number;
  discount_price?: number;
}

interface CartItem extends MenuItem {
  quantity: number;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

export default function CustomerPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [orderNote, setOrderNote] = useState<string>('');
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [showCartDetails, setShowCartDetails] = useState(false);
  const [shopStatus, setShopStatus] = useState<'online' | 'offline'>('online');
  const [categories, setCategories] = useState<string[]>(['Semua']);
  const [activeOrder, setActiveOrder] = useState<{id: number, status: string} | null>(null);

  useEffect(() => {
    const savedOrder = localStorage.getItem('activeOrder');
    if (savedOrder) {
      const parsed = JSON.parse(savedOrder);
      fetch(`/api/orders/${parsed.id}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.status !== 'paid') {
            setActiveOrder({ id: Number(data.id), status: data.status });
          } else {
            localStorage.removeItem('activeOrder');
          }
        })
        .catch(() => localStorage.removeItem('activeOrder'));
    }

    fetch('/api/menu')
      .then(res => res.json())
      .then(setMenu)
      .catch(err => console.error("Failed to fetch menu:", err));

    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        const catNames = data.map((c: any) => c.name);
        setCategories(['Semua', ...catNames]);
      })
      .catch(err => console.error("Failed to fetch categories:", err));

    fetchShopStatus();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'SHOP_STATUS_UPDATED') {
          setShopStatus(data.status);
        }
        if (data.type === 'CATEGORIES_UPDATED') {
          fetch('/api/categories')
            .then(res => res.json())
            .then(data => {
              const catNames = data.map((c: any) => c.name);
              setCategories(['Semua', ...catNames]);
            });
        }
        if (data.type === 'ORDER_STATUS_CHANGED') {
          const savedOrder = localStorage.getItem('activeOrder');
          if (savedOrder) {
            const parsed = JSON.parse(savedOrder);
            // FIX: Gunakan Number() untuk memastikan perbandingan ID aman (string vs number)
            if (Number(data.orderId) === Number(parsed.id)) {
              setActiveOrder({ id: Number(data.orderId), status: data.status });
              if (data.status === 'served') {
                playNotification();
                if ('vibrate' in navigator) {
                  navigator.vibrate([200, 100, 200]);
                }
              }
            }
          }
        }
      } catch (e) {
        console.error("WS Message Error:", e);
      }
    };

    return () => ws.close();
  }, []);

  const playNotification = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(e => console.log('Audio play failed:', e));
  };

  const fetchShopStatus = async () => {
    try {
      const res = await fetch('/api/shop-status');
      const data = await res.json();
      setShopStatus(data.status);
    } catch (e) {
      console.error("Failed to fetch shop status");
    }
  };

  const addToCart = (item: MenuItem) => {
    if (item.is_available === 0) return;
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      const price = item.discount_price || item.price;
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1, price } : i);
      }
      return [...prev, { ...item, quantity: 1, price }];
    });
  };

  const removeFromCart = (id: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === id);
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.id !== id);
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const placeOrder = async () => {
    if (!customerName.trim()) {
      alert('Mohon masukkan nama pemesan');
      return;
    }
    setIsOrdering(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customerName,
          orderNote,
          items: cart 
        })
      });
      const data = await res.json();
      if (data.success) {
        setCart([]);
        setOrderSuccess(true);
        setCustomerName('');
        setOrderNote('');
        setActiveOrder({ id: Number(data.orderId), status: 'pending' });
        localStorage.setItem('activeOrder', JSON.stringify({ id: data.orderId }));
        setTimeout(() => setOrderSuccess(false), 3000);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsOrdering(false);
    }
  };

  const filteredMenu = selectedCategory === 'Semua' ? menu : menu.filter(item => item.category === selectedCategory);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Offline Overlay */}
      <AnimatePresence>
        {shopStatus === 'offline' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md"
            >
              <div className="bg-black text-white w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-black/20">
                <Store size={40} />
              </div>
              <h1 className="text-4xl font-black tracking-tight mb-4">Warkop Sedang Tutup</h1>
              <p className="text-gray-500 text-lg mb-8 leading-relaxed">
                Terima kasih sudah berkunjung! Saat ini kami sedang beristirahat. Silakan kembali lagi nanti saat jam operasional kami.
              </p>
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 rounded-2xl text-gray-600 font-bold">
                <Clock size={20} />
                Buka Kembali Besok Pagi
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Order Status Notification */}
      <AnimatePresence mode="wait">
        {activeOrder && (
          <motion.div
            key={activeOrder.status} // FIX: Tambahkan key agar animasi terpicu ulang saat status berubah
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-4 left-4 right-4 z-[90] pointer-events-none"
          >
            <div className="bg-white/90 backdrop-blur-xl border border-black/5 shadow-2xl rounded-3xl p-4 flex items-center gap-4 max-w-lg mx-auto pointer-events-auto">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                activeOrder.status === 'served' 
                  ? 'bg-emerald-500 text-white animate-bounce' 
                  : 'bg-amber-500 text-white animate-pulse'
              }`}>
                {activeOrder.status === 'served' ? <BellRing size={24} /> : <Clock size={24} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-black truncate">
                  {activeOrder.status === 'served' ? 'Pesanan Siap Diambil!' : 'Pesanan Sedang Disiapkan'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {activeOrder.status === 'served' 
                    ? 'Silakan menuju meja kasir untuk mengambil pesanan Anda.' 
                    : 'Mohon tunggu sebentar ya, kami sedang meracik pesanan Anda.'}
                </p>
              </div>
              {activeOrder.status === 'served' && (
                <button 
                  onClick={() => {
                    setActiveOrder(null);
                    localStorage.removeItem('activeOrder');
                  }}
                  className="bg-black text-white text-[10px] font-bold px-3 py-2 rounded-xl uppercase tracking-wider"
                >
                  Selesai
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto pb-32 px-4 sm:px-6 lg:px-8">
        <header className="py-8 sm:py-12 bg-transparent">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <motion.h1 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl sm:text-5xl font-black tracking-tight mb-2"
              >
                WarkopGen-Z
              </motion.h1>
              <p className="text-gray-500 text-sm sm:text-base">Silakan pilih menu favorit Anda untuk pengalaman kuliner terbaik</p>
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar md:pb-0">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all shadow-sm ${selectedCategory === cat ? 'bg-black text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredMenu.map((item, idx) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-3xl p-5 flex flex-col gap-4 shadow-sm border border-black/5 hover:shadow-md transition-shadow group"
            >
              <div className={`relative overflow-hidden rounded-2xl aspect-[4/3] ${item.is_available === 0 ? 'grayscale' : ''}`}>
                <img 
                  src={item.image_url} 
                  alt={item.name} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                {item.is_new === 1 && (
                  <div className="absolute top-3 left-3 bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg shadow-emerald-500/30 animate-pulse">
                    NEW
                  </div>
                )}
                {item.discount_price && (
                  <div className="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg shadow-red-500/30">
                    PROMO
                  </div>
                )}
                {item.is_available === 0 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white font-black text-xl uppercase tracking-widest border-2 border-white px-4 py-1">Sold Out</span>
                  </div>
                )}
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                  {item.category}
                </div>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="mb-4">
                  <h3 className="font-bold text-xl mb-1">{item.name}</h3>
                  <p className="text-gray-400 text-sm line-clamp-2 leading-relaxed">{item.description}</p>
                </div>
                <div className="mt-auto flex justify-between items-center">
                  <div className="flex flex-col">
                    {item.discount_price ? (
                      <>
                        <span className="font-black text-xl text-black">{formatCurrency(item.discount_price)}</span>
                        <span className="text-xs text-gray-400 line-through">{formatCurrency(item.price)}</span>
                      </>
                    ) : (
                      <span className="font-black text-xl text-black">{formatCurrency(item.price)}</span>
                    )}
                  </div>
                  <button 
                    disabled={item.is_available === 0}
                    onClick={() => addToCart(item)}
                    className="bg-black text-white p-3 rounded-2xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-black/10 disabled:opacity-20 disabled:scale-100"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {cart.length > 0 && (
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="fixed bottom-6 left-4 right-4 md:left-auto md:right-8 md:w-[400px] bg-black text-white rounded-3xl shadow-2xl z-40 border border-white/10 overflow-hidden"
            >
              {/* Cart Header / Toggle */}
              <button 
                onClick={() => setShowCartDetails(!showCartDetails)}
                className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <ShoppingBag size={24} />
                  </div>
                  <div className="text-left">
                    <span className="block text-xs text-gray-400 uppercase font-bold tracking-widest">Keranjang</span>
                    <span className="font-bold text-lg">{cart.reduce((a, b) => a + b.quantity, 0)} Pesanan</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="block text-xs text-gray-400 uppercase font-bold tracking-widest">Total</span>
                    <span className="font-black text-2xl text-white">{formatCurrency(cartTotal)}</span>
                  </div>
                  {showCartDetails ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                </div>
              </button>

              {/* Cart Details */}
              <AnimatePresence>
                {showCartDetails && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-6 pb-6 border-t border-white/10"
                  >
                    <div className="max-h-[300px] overflow-y-auto py-4 space-y-4 no-scrollbar">
                      {cart.map((item) => (
                        <div key={item.id} className="flex justify-between items-center">
                          <div className="flex-1">
                            <h4 className="font-bold text-sm">{item.name}</h4>
                            <p className="text-xs text-gray-400">{formatCurrency(item.price)}</p>
                          </div>
                          <div className="flex items-center gap-3 bg-white/10 rounded-xl p-1">
                            <button 
                              onClick={() => removeFromCart(item.id)}
                              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="font-bold text-sm min-w-[20px] text-center">{item.quantity}</span>
                            <button 
                              onClick={() => addToCart(item)}
                              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-3 pt-4 border-t border-white/10">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Atas Nama</label>
                          <input 
                            type="text" 
                            placeholder="Nama Anda..."
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="w-full bg-white/10 border border-white/10 rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-white/20 placeholder:text-gray-600 font-bold text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Catatan (Opsional)</label>
                          <textarea 
                            placeholder="Contoh: Kopi kurang gula..."
                            value={orderNote}
                            onChange={(e) => setOrderNote(e.target.value)}
                            className="w-full bg-white/10 border border-white/10 rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-white/20 placeholder:text-gray-600 font-bold text-white h-20 resize-none"
                          />
                        </div>
                      </div>
                      <button 
                        onClick={placeOrder}
                        disabled={isOrdering || !customerName.trim()}
                        className="bg-white hover:bg-gray-100 text-black px-8 py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 disabled:opacity-20 disabled:cursor-not-allowed shadow-lg shadow-white/10"
                      >
                        {isOrdering ? (
                          <div className="w-6 h-6 border-4 border-black/20 border-t-black rounded-full animate-spin" />
                        ) : (
                          <>Kirim Pesanan <ChevronRight size={20} /></>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {orderSuccess && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-3xl p-8 text-center max-w-xs w-full"
              >
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h2 className="text-2xl font-bold mb-2">Pesanan Terkirim!</h2>
                <p className="text-gray-500">Mohon tunggu sebentar, pesanan Anda sedang disiapkan.</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}