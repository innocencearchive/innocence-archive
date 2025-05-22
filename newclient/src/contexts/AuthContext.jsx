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
  const location = useLocation(); // Get current location to access state passed by ProtectedRoute


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

 // src/contexts/AuthContext.jsx
// ...
import { useNavigate, useLocation } from 'react-router-dom'; // Add useLocation

// ... inside AuthProvider


const login = async (email, password) => {
  // ... (existing login logic: try block)
  try {
    const response = await apiClient.post('/auth/login', { email, password });
    const { token: receivedToken, user: userData } = response.data;

    // ... (store token and user data)

    console.log('Login successful, user role:', userData.role);

    // --- NEW: Redirect logic ---
    const from = location.state?.from?.pathname || (userData.role === 'ADMIN' || userData.role === 'EDITOR' ? '/admin' : '/');
    // If 'from' state exists (passed by ProtectedRoute), redirect there.
    // Otherwise, redirect based on role or to a default page.
    navigate(from, { replace: true });

  } catch (error) {
    // ... (existing error handling)
  } finally {
    setIsLoading(false);
  }
};
// ...

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
