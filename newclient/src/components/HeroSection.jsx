// src/components/HeroSection.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { BRONZE_COLOR, BRONZE_BORDER, LIGHT_BRONZE_COLOR } from './themeconstants';
import Logo from '../assets/current_logo.png';
import BrowseCollectionsBox from './BrowseCollectionsBox';

const HeroSection = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const handleSearchSubmit = (event) => {
      event.preventDefault();
      if (searchTerm.trim()) {
          navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
      }
  };

  return (
    // Main section: flex-col for mobile (Logo on top), md:flex-row for larger screens
    <section className="w-full bg-black flex flex-col md:flex-row items-center md:items-start justify-start p-4 md:p-8 lg:px-16 py-16 md:py-20 lg:py-24">
      
      {/* Logo Container: Order 1 on mobile, Order 2 (right side) on medium+ */}
      <div className="w-full md:w-1/2 flex justify-center items-center md:pl-8 lg:pl-16 order-1 md:order-2 mb-10 md:mb-0">
        <img
          src={Logo}
          alt="Innocence Archive Logo"
          className="max-h-[40vh] sm:max-h-[50vh] md:max-h-[60vh] lg:max-h-[70vh] w-auto object-contain"
          onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/300x400/000000/af7a56?text=Logo+Error'; }}
        />
      </div>

      {/* Left Column (Text, Search, Browse): Order 2 on mobile, Order 1 (left side) on medium+ */}
      <div className="w-full md:w-1/2 flex flex-col items-center md:items-start text-center md:text-left md:pr-8 lg:pr-16 order-2 md:order-1">
        <h1
          className={`text-3xl sm:text-4xl lg:text-5xl xl:text-[4.25rem] ${LIGHT_BRONZE_COLOR} font-serif uppercase self-center md:self-start mb-6 md:mb-8`}
          style={{ lineHeight: '.9' }}
        >
           Stories <br />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;of the<br />&nbsp;Wrongfully<br /> &nbsp;&nbsp;&nbsp;&nbsp;Convicted<br />
        </h1>

        {/* Search Form */}
        <form
          onSubmit={handleSearchSubmit}
          className={`w-full max-w-md bg-black rounded-full p-2 flex items-center border-2 ${BRONZE_BORDER} self-center md:self-start relative mb-8`}
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
        {/* End Search Form */}

        {/* Browse Collections Section */}
        <div className="self-center md:self-start w-full max-w-md">
            <BrowseCollectionsBox /> {/* This component will need the "Documentaries" to "Podcasts" change */}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
