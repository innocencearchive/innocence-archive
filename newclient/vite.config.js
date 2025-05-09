import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss() // Usually handled by PostCSS
  ], // Comma added if server config follows (it does)
  server: { // Correctly placed as a top-level key
    proxy: {
      // Proxy /api requests to your backend server
      '/api': {
        target: 'http://localhost:3001', // Your backend server address
        changeOrigin: true, // Usually needed
        // secure: false, // Uncomment if backend is http
      }
      // No rewrite needed if backend routes are mounted with /api prefix
    }
  } // No comma needed after the last property in the object
});
