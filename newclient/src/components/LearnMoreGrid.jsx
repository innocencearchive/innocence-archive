// src/components/LearnMoreGrid.jsx
import React from 'react';
import { BookOpen, Mic, Newspaper, Film } from 'lucide-react'; // Assuming Newspaper might be used later

import MediaCard from './MediaCard'; // Assuming it's in the same directory

/**
 * LearnMoreGrid Component
 *
 * Displays related media items grouped by type (Books, Films, Podcasts).
 * Expects an array of MediaItem objects, each including its parent 'work'.
 *
 * @param {object} props - Component props.
 * @param {Array} [props.mediaItems=[]] - An array of MediaItem objects, including nested 'work' data.
 */
const LearnMoreGrid = ({ mediaItems = [] }) => { // Default to empty array

  // --- Grouping Logic ---
  // Filter the mediaItems array based on the parent work's type.
  // Assumes each 'item' has 'item.work.workType' available from the backend include.

  const books = mediaItems.filter(item => item.work?.workType === 'BOOK');

  const films = mediaItems.filter(item =>
    item.work?.workType === 'FILM' ||
    item.work?.workType === 'DOCUMENTARY' ||
    item.work?.workType === 'DOCUSERIES' ||
    item.work?.workType === 'TV_SERIES' // Grouping TV Series under Films/Docs for now
  );

  const podcasts = mediaItems.filter(item => item.work?.workType === 'PODCAST_SERIES');

  // TODO: Determine how to categorize 'Articles' or 'OTHER' types if needed.
  // const articles = mediaItems.filter(item => ???);


  // --- Console Logs for Debugging ---
  console.log("LearnMoreGrid received mediaItems:", mediaItems);
  console.log("Filtered Books:", books);
  // Optional: Log other filters too
  console.log("Filtered Films:", films);
  console.log("Filtered Podcasts:", podcasts);


  // --- Check if any media exists ---
  const hasMedia = books.length > 0 || films.length > 0 || podcasts.length > 0;
  // We'll still render the section header even if no media is found for now


  // --- Render Component ---
  return (
    <section aria-labelledby="learn-more-title" className="mt-10">
      <h2 id="learn-more-title" className="text-2xl font-semibold text-gray-50 mb-6 text-center border-t border-gray-700 pt-8">Learn More About This Case</h2>

      {/* Render grid only if there is media, otherwise maybe a message */}
      {hasMedia ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">

          {/* Conditionally render MediaCard for Books */}
          {books.length > 0 && (
            <MediaCard
              title="Books"
              icon={BookOpen}
              items={books}
            />
          )}

          {/* Conditionally render MediaCard for Films & Documentaries */}
          {films.length > 0 && (
            <MediaCard
              title="Films & Documentaries"
              icon={Film}
              items={films}
            />
          )}

          {/* Conditionally render MediaCard for Podcasts */}
          {podcasts.length > 0 && (
            <MediaCard
              title="Podcasts"
              icon={Mic}
              items={podcasts}
            />
          )}

          {/* Removed Articles card - add back if logic is determined */}

        </div>
      ) : (
        // Optional: Message when no media items are found
        <p className="text-center text-gray-400">No related media found for this case.</p>
      )}
    </section>
  );
};

export default LearnMoreGrid;
