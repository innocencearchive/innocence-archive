import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react'; // Import icons needed


const PageNavigationButtons = ({ navigate }) => {
	
	 // Basic check if navigate function was passed (optional but good practice)
  if (!navigate) {
    console.warn("PageNavigationButtons: 'navigate' prop is missing!");
    // You could return null or a disabled button here if needed
  }
  return (
      <nav aria-label="Page Navigation" className="mt-10 flex justify-between items-center">
         <button
        // 2. Use the received 'navigate' prop in the onClick handler
        onClick={() => navigate ? navigate(-1) : console.error('Navigate function not available')}
        disabled={!navigate} // Disable if navigate wasn't passed
        className="inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 transition-colors"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back
      </button>
         {/* Placeholder for potential future actions like 'Suggest Correction' */}
         <button
            onClick={() => alert('Suggest correction feature coming soon!')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-amber-100 bg-amber-700 hover:bg-amber-800 transition-colors"
            >
            <AlertCircle size={16} className="mr-2" />
            Suggest Correction
        </button>
      </nav>
  );
};
  
  export default PageNavigationButtons;
