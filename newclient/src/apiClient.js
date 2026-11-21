// src/apiClient.js
import axios from 'axios';

// Determine the base URL for the API.
// For Vite, environment variables prefixed with VITE_ are exposed to the client-side code.
// import.meta.env.VITE_API_URL will be set by Render during the build process for production.
// For local development, if VITE_API_URL is not set in your .env file,
// it can fall back to your local backend URL.
// Your existing logic for API_BASE_URL is good.
// Ensure your VITE_API_URL for local dev points to http://localhost:3001/api
// and for production on Render, it points to your deployed backend service URL.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Create an Axios instance with the base URL
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json', // Added default Content-Type
  },
});

// --- NEW: Request Interceptor to add JWT token ---
// This interceptor will run before each request is sent.
apiClient.interceptors.request.use(
  (config) => {
    // Retrieve the token from localStorage (AuthContext will manage putting it there)
    const token = localStorage.getItem('authToken');
    if (token) {
      // If a token exists, add it to the Authorization header
      config.headers['Authorization'] = `Bearer ${token}`;
      console.log('apiClient: Token added to request headers.');
    } else {
      console.log('apiClient: No token found, request sent without Authorization header.');
    }
    return config; // Continue with the request configuration
  },
  (error) => {
    // Handle request error
    console.error('apiClient: Error in request interceptor:', error);
    return Promise.reject(error);
  }
);

// --- Your existing Response Interceptor ---
// This interceptor handles responses globally.
apiClient.interceptors.response.use(
  (response) => response, // Simply return the response if it's successful
  (error) => {
    // Handle errors globally
    console.error('API call error in response interceptor:', error.response || error.message || error);

    if (error.response && error.response.status === 401) {
      const requestUrl = error.config?.url || '';
      const isLoginAttempt = requestUrl.includes('/auth/login');
      if (!isLoginAttempt) {
        console.warn('API call returned 401 Unauthorized. Clearing expired session and redirecting to /login.');
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        if (window.location.pathname !== '/login') {
          window.location.assign('/login');
        }
      }
    }

    // It's important to return a rejected promise so that the calling code's .catch() still works
    return Promise.reject(error);
  }
);

export default apiClient;
