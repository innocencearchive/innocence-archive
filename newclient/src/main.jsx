// src/main.jsx or src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Your main App component (we'll modify this next)
import './index.css'; // Your main CSS file with Tailwind directives
import { BrowserRouter } from 'react-router-dom'; // Import BrowserRouter
import { AuthProvider } from './contexts/AuthContext'; // <<< IMPORT


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Wrap your App component with BrowserRouter */}
    <BrowserRouter>
	  <AuthProvider>
        <App />
	  </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
