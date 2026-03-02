import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CustomerPage from './pages/CustomerPage';
import CashierPage from './pages/CashierPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Customer View as Default */}
        <Route path="/" element={<CustomerPage />} />
        <Route path="/menu" element={<CustomerPage />} />
        
        {/* Cashier View on separate path */}
        <Route path="/cashier" element={<CashierPage />} />
        <Route path="/admin" element={<CashierPage />} />
        
        {/* Fallback to Menu */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
