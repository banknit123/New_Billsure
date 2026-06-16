import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from '@/components/ui/sonner';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import LandingPage from './pages/LandingPage';
import LegalPage from './pages/LegalPage';

export const API = process.env.REACT_APP_BACKEND_URL + '/api';

export const axiosInstance = axios.create();

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      axiosInstance.get(`${API}/auth/me`).then(res => {
        setUser(res.data);
      }).catch(() => {
        localStorage.removeItem('token');
        delete axiosInstance.defaults.headers.common['Authorization'];
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axiosInstance.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await axiosInstance.get(`${API}/auth/me`);
      setUser(res.data);
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={user ? (user.is_admin ? <Navigate to="/admin" /> : <Navigate to="/dashboard" />) : <LandingPage />} />
          <Route path="/login" element={user ? (user.is_admin ? <Navigate to="/admin" /> : <Navigate to="/dashboard" />) : <Login />} />
          <Route path="/register" element={user ? (user.is_admin ? <Navigate to="/admin" /> : <Navigate to="/dashboard" />) : <Register />} />
          <Route
            path="/dashboard/*"
            element={user ? <Dashboard /> : <Navigate to="/login" />}
          />
          <Route
            path="/admin/*"
            element={user?.is_admin ? <AdminDashboard /> : <Navigate to="/login" />}
          />
          <Route path="/legal/:section" element={<LegalPage />} />
        </Routes>
        <Toaster richColors />
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;
