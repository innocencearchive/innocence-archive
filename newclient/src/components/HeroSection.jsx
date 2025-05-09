
// src/components/HeroSection.jsx
// Assuming 'lucide-react', theme constants, and Logo are correctly imported in your project
import React, { useState } from 'react'; // Import useState
import { Link, useNavigate } from 'react-router-dom'; // Import useNavigate and Link
import { Search } from 'lucide-react';
// Make sure these imports point to your actual files/definitions
import { BRONZE_COLOR, BRONZE_BORDER, LIGHT_BRONZE_COLOR } from './themeconstants'; // Or '../components/themeconstants' depending on structure
import Logo from '../assets/current_logo.png'; // Or './assets/current_logo.png'

const HeroSection = () => {
  // --- Search State and Navigation ---
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  // --- Search Submit Handler ---
  const handleSearchSubmit = (event) => {
      event.preventDefault(); // Prevent default form submission
      if (searchTerm.trim()) {
          // Navigate to the search results page with the query parameter
          navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
      }
  };


  return (
    // Section container: Removed min-h-screen, added vertical padding (py-*)
    // Kept horizontal padding (px-*), background, flex layout, and top alignment
    <section className="w-full bg-black flex flex-col md:flex-row items-start justify-start p-4 md:p-8 lg:px-16 py-16 md:py-20 lg:py-24"> {/* REMOVED min-h-screen, ADDED py-* */}

      {/* Content Container (Left: Search & Text): Adjusted flex basis and padding */}
      {/* Removed justify-center as vertical centering is less relevant now */}
      <div className="w-full md:w-1/2 flex flex-col items-center md:items-start text-center md:text-left mb-10 md:mb-0 md:pr-8 lg:pr-16">
        {/* Text: Adjusted size and line height for responsiveness */}
        <h1
          className={`text-3xl sm:text-4xl lg:text-5xl xl:text-[4.25rem] ${LIGHT_BRONZE_COLOR} font-serif uppercase self-center md:self-start mb-6 md:mb-8`} // Added bottom margin
          style={{ lineHeight: '.9' }} // Keep line height for style
        >
           Stories <br />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;of the<br />&nbsp;&nbsp;Wrongfully<br /> &nbsp;&nbsp;&nbsp;&nbsp;Convicted<br />
        </h1>
        {/* Removed <br /><br /> */}

        {/* --- Search Form --- */}
        <form
          onSubmit={handleSearchSubmit}
          className={`w-full max-w-md bg-black rounded-full p-2 flex items-center border-2 ${BRONZE_BORDER} self-center md:self-start relative`}
        >
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
             <Search className={`w-6 h-6 ${BRONZE_COLOR} mr-2 flex-shrink-0`} />
          </span>
          <input
            type="search"
            placeholder="Search the Innocence Archive..."
            aria-label="Search the Innocence Archive"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none pl-10 pr-4 py-1"
          />
           <button type="submit" className="hidden">Search</button>
        </form>
        {/* --- End Search Form --- */}

        {/* --- Link Section --- */}
        {/* Added some top margin to space it from search bar */}
        <div className="mt-6 self-center md:self-start w-full max-w-md">
  <p className="text-sm text-gray-400">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Find a list of  {/* Slightly larger text size */}
                <Link
                    to="/search?type=BOOK" // Link to search results filtered by type BOOK
                    // *** Changed text color from BRONZE_COLOR to LIGHT_BRONZE_COLOR ***
                    className={`hover:text-amber-400 hover:underline transition-colors ${LIGHT_BRONZE_COLOR}`} // Styling for the link
                >
                    all the books on wrongful convictions
                </Link>
            </p>
            {/* Add more links here later if needed */}
        </div>
        {/* --- End Link Section --- */}

      </div>

      {/* Logo Container (Right): Adjusted flex basis and padding */}
      {/* Kept vertical centering for the logo within its column */}
      <div className="w-full md:w-1/2 flex justify-center items-center md:pl-8 lg:pl-16 mt-10 md:mt-0"> {/* Added top margin on small screens */}
        {/* Logo: Reduced max-height slightly as the section isn't full height anymore */}
        <img
          src={Logo}
          alt="Innocence Archive Logo"
          // Adjusted max-height values
          className="max-h-[50vh] md:max-h-[60vh] lg:max-h-[70vh] w-auto object-contain"
          onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/300x400/000000/af7a56?text=Logo+Error'; }}
        />
      </div>
    </section>
  );
};

export default HeroSection;


