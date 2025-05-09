import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Search, BookOpen, Film, Mic, Newspaper, Building, BarChart3, Info, History, ArrowLeft, AlertCircle } from 'lucide-react';

import { BRONZE_BG } from './themeconstants'; // Adjust path if needed

const SearchBar = () => (
  <section aria-label="Search Archive" className="py-8 px-4 md:px-8 bg-gray-800">
    <label htmlFor="search-archive" className="block text-lg font-semibold text-gray-100 mb-2">
      Search the Archive
    </label>
    <div className="flex">
      <input
        type="search"
        id="search-archive"
        placeholder="Search by name, state, contributing factor..."
        className="flex-grow p-3 rounded-l-md bg-gray-700 text-gray-50 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-400"
      />
      <button
        type="submit"
        className={`p-3 ${BRONZE_BG} hover:bg-amber-700 text-black rounded-r-md flex items-center justify-center transition duration-150 ease-in-out`}
        aria-label="Search"
      >
        <Search size={24} />
      </button>
    </div>
  </section>
);

export default SearchBar;