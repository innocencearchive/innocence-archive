// src/components/FeaturedMediaModule.jsx
import React from 'react';
// Removed unused ExternalLink, Info imports
import { Link } from 'react-router-dom'; // Use Link for internal routing
import { BookOpen, Film, Mic } from 'lucide-react'; // Keep needed icons
import ModuleCard from './ModuleCard'; // Assuming it's in the same directory

/**
 * FeaturedMediaModule Component
 *
 * Displays links to featured media items (book, film, podcast) within a ModuleCard.
 * Expects a 'media' object prop containing potential MediaItem objects for each type.
 *
 * @param {object} props - Component props.
 * @param {object} [props.media={ book: null, podcast: null, film: null }] - Object containing the latest book, podcast, and film MediaItem objects (or null).
 */
const FeaturedMediaModule = ({ media = { book: null, podcast: null, film: null } }) => {
  const { book, podcast, film } = media; // Destructure for easier access

  // Determine if there's any media content to display
  const hasContent = book || podcast || film;

  return (
    <ModuleCard
      title="Featured Media"
      icon={BookOpen} // Using BookOpen as a general icon, could be dynamic
      // Link to a general media page, or remove if not applicable
      seeMoreLink="/media"
      seeMoreText="More Media Resources"
    >
      {/* Check if there is any media item to display */}
      {hasContent ? (
        <ul className="space-y-2 text-sm">
          {/* Display Book if available */}
          {book && book.id && ( // Check for book and its ID
            <li className="flex items-start">
              <BookOpen size={14} className="inline mr-2 mt-0.5 flex-shrink-0 text-gray-400" />
              <Link to={`/item/${book.id}`} className="hover:text-amber-500 hover:underline">
                <strong className="text-gray-200">Book:</strong>
                <span className="ml-1 text-gray-300">
                  "{book.work?.title ?? book.itemTitle ?? 'Untitled Book'}"
                  {book.work?.creatorName && ` by ${book.work.creatorName}`}
                </span>
              </Link>
            </li>
          )}

          {/* Display Film/Doc/Series if available */}
          {film && film.id && ( // Check for film and its ID
            <li className="flex items-start">
              <Film size={14} className="inline mr-2 mt-0.5 flex-shrink-0 text-gray-400" />
              <Link to={`/item/${film.id}`} className="hover:text-amber-500 hover:underline">
                <strong className="text-gray-200">Film/Series:</strong>
                <span className="ml-1 text-gray-300">
                  "{film.work?.title ?? film.itemTitle ?? 'Untitled Film/Series'}"
                  {/* Show creator or network as subtitle */}
                  {(film.work?.creatorName || film.work?.publisherOrNetwork) &&
                   ` (${film.work.creatorName || film.work.publisherOrNetwork})`}
                </span>
              </Link>
            </li>
          )}

          {/* Display Podcast if available */}
          {podcast && podcast.id && ( // Check for podcast and its ID
            <li className="flex items-start">
              <Mic size={14} className="inline mr-2 mt-0.5 flex-shrink-0 text-gray-400" />
              <Link to={`/item/${podcast.id}`} className="hover:text-amber-500 hover:underline">
                <strong className="text-gray-200">Podcast:</strong>
                <span className="ml-1 text-gray-300">
                  "{podcast.work?.title ?? 'Podcast Series'}": {podcast.itemTitle ?? 'Episode'}
                </span>
              </Link>
            </li>
          )}
        </ul>
      ) : (
        // Fallback message if no featured media items were found/provided
        <p className="text-gray-400 text-sm italic">No featured media available currently.</p>
      )}
    </ModuleCard>
  );
};

export default FeaturedMediaModule;
