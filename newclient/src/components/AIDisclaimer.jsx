// src/components/AIDisclaimer.jsx
import React from 'react';
import { AlertTriangle } from 'lucide-react'; // Or a different icon like Bot

const AIDisclaimer = ({ className = '' }) => {
  return (
    <div className={`flex items-start p-3 rounded-md bg-yellow-900/40 border border-yellow-700/60 text-yellow-300 text-xs my-4 ${className}`}>
      <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-yellow-400" />
      <span>
        Please note: The data displayed on this page have been collected and summarized by AI. While efforts are made for accuracy, please confirm information from a reliable source.
      </span>
    </div>
  );
};

export default AIDisclaimer;
