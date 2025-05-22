// src/contexts/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../apiClient'; // Your API client

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Stores user object { id, email, role, etc. }
  const [token, setToken] = useState(localStorage.getItem('authToken')); // Load token from localStorage
  const [isLoading, setIsLoading] = useState(true); // To check initial auth status
  const [authError, setAuthError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // This effect runs once on mount to check if there's a valid token
    // and potentially fetch user data if token exists.
    // For simplicity, we're not re-validating the token with the backend here on initial load,
    // but in a more robust app, you might want to verify the token against a '/me' endpoint.
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      // Update apiClient headers if token is found on initial load
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

      // Set the token for all subsequent apiClient requests
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${receivedToken}`;

      console.log('Login successful, user role:', userData.role);
      // Navigate based on role or to a default admin page
      // For now, let's assume admins go to /adminsettings
      if (userData.role === 'ADMIN' || userData.role === 'EDITOR') {
        navigate('/adminsettings'); // Or a general admin dashboard
      } else {
        navigate('/'); // Or a user-specific dashboard if you had one
      }
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
    navigate('/login'); // Redirect to login page after logout
    console.log('User logged out.');
  };

  // The value provided to consumers of this context
  const value = {
    user,
    token,
    isAuthenticated: !!token, // True if token exists
    isLoading, // For UI to show loading state during login or initial check
    authError, // To display login errors
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
