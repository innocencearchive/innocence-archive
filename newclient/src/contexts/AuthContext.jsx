// src/contexts/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // MOVED TO TOP WITH OTHER IMPORTS
import apiClient from '../apiClient'; // Your API client

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  // Hooks must be called at the top level of the component or custom hook
  const navigate = useNavigate();
  const location = useLocation(); // Get current location to access state passed by ProtectedRoute

  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    }
    setIsLoading(false);
  }, []);

  const login = async (email, password) => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { token: receivedToken, user: userData } = response.data;

      localStorage.setItem('authToken', receivedToken);
      localStorage.setItem('authUser', JSON.stringify(userData));

      setToken(receivedToken);
      setUser(userData);

      apiClient.defaults.headers.common['Authorization'] = `Bearer ${receivedToken}`;

      console.log('Login successful, user role:', userData.role);

      // Redirect logic using the 'location' hook instance from AuthProvider scope
      const from = location.state?.from?.pathname || (userData.role === 'ADMIN' || userData.role === 'EDITOR' ? '/admin' : '/');
      navigate(from, { replace: true });

    } catch (error) {
      console.error('Login failed:', error.response?.data?.message || error.message);
      const errorMessage = error.response?.data?.message || 'Login failed. Please check your credentials.';
      setAuthError(errorMessage);
      setUser(null);
      setToken(null);
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      delete apiClient.defaults.headers.common['Authorization'];
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    delete apiClient.defaults.headers.common['Authorization'];
    navigate('/login');
    console.log('User logged out.');
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token,
    isLoading,
    authError,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
