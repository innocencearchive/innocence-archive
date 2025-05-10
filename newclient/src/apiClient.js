// newclient/src/apiClient.js
import axios from 'axios';

// Determine the base URL for the API.
// For Vite, environment variables prefixed with VITE_ are exposed to the client-side code.
// import.meta.env.VITE_API_URL will be set by Render during the build process for production.
// For local development, if VITE_API_URL is not set in your .env file,
// it can fall back to your local backend URL or an empty string if you rely on Vite's proxy.

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'; // Default for local dev if not using proxy for root
                                                                       // or if VITE_API_URL is not set.
                                                                       // If your local backend is at /api and proxied,
                                                                       // you might use '' and append '/api' later,
                                                                       // or set VITE_API_URL to 'http://localhost:3000/api'

// Create an Axios instance with the base URL
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // You can add other default settings here, like headers
  // headers: {
  //   'Content-Type': 'application/json',
  //   // 'Authorization': `Bearer ${yourAuthToken}` // If you use token authentication
  // }
});

/**
 * You can also add interceptors for request or response handling globally.
 * For example, to handle errors:
 */
apiClient.interceptors.response.use(
  (response) => response, // Simply return the response if it's successful
  (error) => {
    // Handle errors globally
    // You might want to log them, redirect to an error page, etc.
    console.error('API call error:', error.response || error.message || error);

    // It's important to return a rejected promise so that the calling code's .catch() still works
    return Promise.reject(error);
  }
);

export default apiClient;
