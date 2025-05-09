// src/components/Header.jsx
import React, { useState } from 'react'; // Import useState
import { Link, useNavigate } from 'react-router-dom'; // Import useNavigate
import { Search } from 'lucide-react';

// Import the logo image
import smallLogo from '../assets/small_logo.png'; // Ensure this path is correct

// Import color constants
import { LIGHT_BRONZE_COLOR, BRONZE_COLOR, LIGHT_BRONZE_BORDER } from './themeconstants';

/**
 * Header Component
 * Displays the site logo, title, and a functional search input.
 * Navigates to the search results page on submit.
 */
const Header = () => {
    // State for the search input value
    const [searchTerm, setSearchTerm] = useState('');
    // Hook for navigation
    const navigate = useNavigate();

    // Define hex color for the rule
    const ruleColor = '#cd9a78'; // Example using light bronze hex

    // Handle search form submission
    const handleSearchSubmit = (event) => {
        event.preventDefault(); // Prevent default form submission
        if (searchTerm.trim()) {
            // Navigate to the search results page with the query parameter
            navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
            // Optionally clear the search bar after submission
            // setSearchTerm('');
        }
    };

    return (
        <header className="bg-black pt-4 pb-0 px-4 sm:px-6 lg:px-8 w-full relative">
            <div className="flex items-center justify-between mb-4">
                {/* Link wrapping logo and title */}
                <Link to="/" className="flex items-center no-underline hover:opacity-90 transition-opacity duration-150">
                    {/* Logo Image */}
                    <img
                        src={smallLogo}
                        alt="The Innocence Archive logo"
                        className="h-10 w-auto mr-3"
                        onError={(e) => { /* Error handling as before */
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                            const placeholder = document.createElement('div');
                            placeholder.textContent = 'Logo';
                            placeholder.className = `${LIGHT_BRONZE_COLOR} h-10 w-10 flex items-center justify-center mr-3 border border-dashed`;
                            placeholder.style.borderColor = LIGHT_BRONZE_BORDER;
                            e.target.parentNode.insertBefore(placeholder, e.target);
                        }}
                    />
                    {/* Site Title */}
                    <span className={`font-serif ${LIGHT_BRONZE_COLOR} uppercase text-xl md:text-2xl`}>
                        The Innocence Archive
                    </span>
                </Link>

                {/* Search Form Area */}
                {/* Wrap input in a form for onSubmit handling */}
                <form onSubmit={handleSearchSubmit} className="flex items-center relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        {/* Search Icon */}
                        <Search className={`w-5 h-5 ${BRONZE_COLOR}`} />
                    </span>
                    <input
                        type="search"
                        placeholder="Search..."
                        aria-label="Search site"
                        value={searchTerm} // Control the input value
                        onChange={(e) => setSearchTerm(e.target.value)} // Update state on change
                        // Styling remains largely the same
                        className={`w-48 md:w-64 bg-gray-800 border border-gray-700 ${BRONZE_COLOR} placeholder-gray-500 text-sm rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-[${ruleColor}] focus:border-transparent`}
                    />
                    {/* Hidden submit button for accessibility/enter key submission, or add a visible button */}
                    <button type="submit" className="hidden">Search</button>
                </form>
            </div>

            {/* Bronze Rule */}
            <div
                className="w-full h-[1px]"
                style={{ backgroundColor: ruleColor }}
            ></div>
        </header>
    );
};

export default Header;
