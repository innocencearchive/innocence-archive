// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// This component wraps around routes that require authentication.
// It checks if the user is authenticated using AuthContext.
// If authenticated, it renders the children (the protected page).
// If not, it redirects to the login page, passing the current location
// so the user can be redirected back after successful login.

// You can also extend this to check for specific roles if needed.
// For example: const ProtectedRoute = ({ children, requiredRole }) => { ... }
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation(); // Gets the current location

  if (isLoading) {
    // Show a loading indicator while authentication status is being determined
    // This prevents a flash of the login page or the protected content
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <svg className="animate-spin h-10 w-10 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="ml-3 text-gray-300">Loading authentication status...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // User is not authenticated, redirect to login page.
    // Pass the current location in 'state' so after login,
    // the user can be redirected back to the page they were trying to access.
    console.log('ProtectedRoute: User not authenticated. Redirecting to login.');
    return <Navigate to="/login" state={{ from: location }} replace />;
    // 'replace' prop ensures the login page replaces the current entry in history,
    // so the back button works as expected after login.
  }

  // User is authenticated, render the requested component (children)
  return children;
};

export default ProtectedRoute;
