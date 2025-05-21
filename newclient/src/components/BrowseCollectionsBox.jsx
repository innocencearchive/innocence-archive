// src/components/BrowseCollectionsBox.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Film as FilmIcon, Clapperboard } from 'lucide-react'; // Using FilmIcon for "Films"
import { BRONZE_BORDER, BRONZE_COLOR } from './themeconstants'; // Assuming themeconstants.js is in the same components folder

const BrowseCollectionsBox = () => {
  const collections = [
    { name: 'Books', type: 'BOOK', icon: BookOpen, path: '/search?type=BOOK' },
    { name: 'Films', type: 'FILM', icon: FilmIcon, path: '/search?type=FILM' },
    { name: 'Documentaries', type: 'DOCUMENTARY', icon: Clapperboard, path: '/search?type=DOCUMENTARY' },
    // Future: Add PODCAST_SERIES, etc.
  ];

  return (
    <div className={`border ${BRONZE_BORDER} rounded-lg p-6 shadow-lg bg-gray-800/30 backdrop-blur-sm`}> {/* Added background for better visibility if Hero is complex */}
      <h2 className={`text-2xl md:text-3xl ${BRONZE_COLOR} mb-6 text-center font-serif font-bold tracking-wider uppercase`}>
        Browse Collections
      </h2>
      <div className="space-y-3">
        {collections.map((collection) => {
          const IconComponent = collection.icon;
          return (
            <Link
              key={collection.type}
              to={collection.path}
              className="flex items-center p-3 bg-gray-700/50 hover:bg-gray-600/70 rounded-md transition-colors duration-150 group"
              aria-label={`Browse all ${collection.name}`}
            >
              <IconComponent className={`w-6 h-6 mr-3 ${BRONZE_COLOR} group-hover:text-amber-300 transition-colors`} />
              <span className="text-gray-100 group-hover:text-white text-lg">
                {collection.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default BrowseCollectionsBox;
