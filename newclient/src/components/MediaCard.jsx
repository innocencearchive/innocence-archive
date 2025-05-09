// src/components/MediaCard.jsx
import React from 'react';
// Removed unused ExternalLink import
import { Link } from 'react-router-dom'; // Use Link for internal routing
// Assuming theme constants are correctly imported
import { BRONZE_COLOR } from './themeConstants';

/**
 * MediaCard Component
 *
 * Displays a list of related MediaItem objects within a category (e.g., Books, Films).
 * Links each item to its specific MediaItem page.
 *
 * @param {object} props - Component props.
 * @param {string} props.title - The title for the card (e.g., "Books", "Podcasts").
 * @param {React.ElementType} props.icon - The icon component to display next to the title.
 * @param {Array} [props.items=[]] - An array of MediaItem objects, expected to include nested 'work' data.
 */
const MediaCard = ({ title, icon: Icon, items = [] }) => ( // Removed itemType and itemLinkPrefix props
  // Container for the card
  <div className="bg-gray-800 p-5 rounded-lg border border-gray-700 flex flex-col h-full">
    {/* Card Header with Icon and Title */}
    <h3 className={`text-lg font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
      {Icon && <Icon className="mr-2" size={20} />} {/* Render icon if provided */}
      {title}
    </h3>
    {/* Main content area for the list */}
    <div className="text-gray-300 text-sm flex-grow mb-3">
      {/* Check if items array has content */}
      {items && items.length > 0 ? (
        <ul className="space-y-2">
          {/* Map over the items array */}
          {items.map(item => {
            // --- Determine Display Text Logic ---
            // Use optional chaining (?.) extensively for safety, as nested data might be missing
            let displayTitle = item.itemTitle ?? item.work?.title ?? 'Untitled Item';
            let displaySubtitle = null;

            // Customize display based on the type of the parent work
            switch (item.work?.workType) {
              case 'BOOK':
                // For books, prefer the work title and author
                displayTitle = item.work?.title ?? displayTitle;
                displaySubtitle = item.work?.creatorName ? `by ${item.work.creatorName}` : null;
                break;
              case 'FILM':
              case 'DOCUMENTARY':
              case 'DOCUSERIES':
              case 'TV_SERIES':
                // For films/docs/series, prefer work title and director/creator
                displayTitle = item.work?.title ?? displayTitle;
                displaySubtitle = item.work?.creatorName ? `(${item.work.creatorName})` : null;
                break;
              case 'PODCAST_SERIES':
                // For podcasts, show "Series Title: Episode Title"
                displayTitle = `${item.work?.title ?? 'Podcast'}: ${item.itemTitle ?? 'Episode'}`;
                // Could add host: displaySubtitle = item.hostOrNarrator ? `(Host: ${item.hostOrNarrator})` : null;
                break;
              default:
                // Default uses itemTitle or workTitle if available
                break;
            }

            // Ensure item has an ID for key and link
            if (typeof item.id === 'undefined') {
                console.warn("MediaCard item missing ID:", item);
                return null; // Skip rendering item without ID
            }

            // --- Render List Item ---
            return (
              <li key={item.id}>
                {/* Use React Router Link to navigate to the specific MediaItem page */}
                <Link to={`/item/${item.id}`} className="hover:text-amber-500 hover:underline">
                  {/* Display the constructed title */}
                  {displayTitle}
                  {/* Display subtitle if available */}
                  {displaySubtitle && <span className="text-xs text-gray-400 ml-1">{displaySubtitle}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        // Fallback message if no items are passed
        <p className="text-gray-400 italic">No specific {title.toLowerCase()} resources found for this case yet.</p>
      )}
    </div>
    {/* Removed the "See all related..." link */}
  </div>
);

export default MediaCard;
