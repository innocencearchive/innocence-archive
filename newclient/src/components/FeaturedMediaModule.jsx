// src/components/FeaturedMediaModule.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Film, Mic } from 'lucide-react';
import ModuleCard from './ModuleCard';

/**
 * FeaturedMediaModule Component
 *
 * Displays links to featured media works (book, film/series, podcast series) within a ModuleCard.
 * Expects a 'media' object prop containing potential MediaWork objects for each type.
 *
 * @param {object} props - Component props.
 * @param {object} [props.media={ book: null, podcast: null, film: null }] - Object containing the featured book, podcast series, and film/docuseries MediaWork objects (or null).
 */
const FeaturedMediaModule = ({ media = { book: null, podcast: null, film: null } }) => {
  const { book, podcast, film } = media; // These are expected to be MediaWork objects

  const hasContent = book || podcast || film;

  return (
    <ModuleCard
      title="Featured Media"
      icon={BookOpen} // General icon
      seeMoreLink="/media" // Link to a general media listing or search page
      seeMoreText="More Media Resources"
    >
      {hasContent ? (
        <ul className="space-y-2 text-sm">
          {/* Display Book if available */}
          {book && book.id && (
            <li className="flex items-start">
              <BookOpen size={14} className="inline mr-2 mt-0.5 flex-shrink-0 text-gray-400" />
              {/* Ensure this route matches your MediaWorkPage route */}
              <Link to={`/mediaworks/${book.id}`} className="hover:text-amber-500 hover:underline">
                <strong className="text-gray-200">Book:</strong>
                <span className="ml-1 text-gray-300">
                  "{book.title ?? 'Untitled Book'}" {/* Direct title access */}
                  {book.creatorName && ` by ${book.creatorName}`}
                </span>
              </Link>
            </li>
          )}

          {/* Display Film/Doc/Series if available */}
          {film && film.id && (
            <li className="flex items-start">
              <Film size={14} className="inline mr-2 mt-0.5 flex-shrink-0 text-gray-400" />
              {/* Ensure this route matches your MediaWorkPage route */}
              <Link to={`/mediaworks/${film.id}`} className="hover:text-amber-500 hover:underline">
                <strong className="text-gray-200">
                  {/* Dynamically set label based on workType */}
                  {film.workType === 'FILM' || film.workType === 'DOCUMENTARY' ? 'Film/Doc:' : 'Series:'}
                </strong>
                <span className="ml-1 text-gray-300">
                  "{film.title ?? 'Untitled Film/Series'}" {/* Direct title access */}
                  {/* Display creator or publisher for non-book works */}
                  {(film.creatorName || (film.workType !== 'BOOK' && film.publisherOrNetwork)) &&
                   ` (${film.creatorName || film.publisherOrNetwork})`}
                </span>
              </Link>
            </li>
          )}

          {/* Display Podcast Series if available */}
          {podcast && podcast.id && (
            <li className="flex items-start">
              <Mic size={14} className="inline mr-2 mt-0.5 flex-shrink-0 text-gray-400" />
              {/* Ensure this route matches your MediaWorkPage route */}
              <Link to={`/mediaworks/${podcast.id}`} className="hover:text-amber-500 hover:underline">
                <strong className="text-gray-200">Podcast Series:</strong>
                <span className="ml-1 text-gray-300">
                  "{podcast.title ?? 'Untitled Podcast Series'}" {/* Direct title access */}
                  {(podcast.creatorName || podcast.publisherOrNetwork) &&
                    ` by ${podcast.creatorName || podcast.publisherOrNetwork}`}
                </span>
              </Link>
            </li>
          )}
        </ul>
      ) : (
        <p className="text-gray-400 text-sm italic">No featured media available currently.</p>
      )}
    </ModuleCard>
  );
};

export default FeaturedMediaModule;