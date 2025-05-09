import React from 'react';
import { Link } from 'react-router-dom';
// Removed unused import: import getTypeIcon from './getTypeIcon';
import { BRONZE_COLOR } from './themeconstants.js'; // Assuming this is defined
import { Mic, Tv, BookOpen as BookIcon, Film as FilmIcon, FileText } from 'lucide-react'; // Import relevant icons

/**
 * Displays a single MediaItem in a list.
 * Uses fields from the MediaItem schema model.
 * Determines the correct link destination based on item type.
 *
 * Props:
 * - item: A MediaItem object (fetched from the API, **MUST include workId**).
 */
const ItemListItem = ({ item }) => {

  // --- Determine Display Title ---
  // Use schema field 'itemTitle', provide fallback
  const displayTitle = item.itemTitle ?? 'Untitled Item';

  // --- Format Release Date ---
  // Use schema field 'releaseDate', format if it exists
  let displayDate = null;
  if (item.releaseDate) {
    try {
      // Format the ISO date string/object from Prisma into a readable format
      displayDate = new Date(item.releaseDate).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
      });
    } catch (e) {
      console.error("Error formatting date:", item.releaseDate, e);
      // Keep displayDate null if formatting fails
    }
  }

  // --- Determine Icon based on MediaItemType ---
  // Use schema field 'itemMediaType' and the enum values from schema.prisma
  let ItemIcon = FileText; // Default icon
  switch (item.itemMediaType) {
    case 'PODCAST_EPISODE':
      ItemIcon = Mic;
      break;
    case 'TV_EPISODE':
      ItemIcon = Tv;
      break;
    case 'BOOK_CONTENT': // For standalone book content
    case 'BOOK_CHAPTER': // For future use
      ItemIcon = BookIcon;
      break;
    case 'FILM_CONTENT': // For standalone film content
    case 'DOCUMENTARY_CONTENT': // For standalone documentary content
      ItemIcon = FilmIcon;
      break;
    // Add cases for OTHER, UNKNOWN, or specific types if needed
    default:
      ItemIcon = FileText; // Default icon
  }


  // --- Determine Link Path ---
  let linkPath = '#'; // Default to '#' if logic fails
  const itemType = item.itemMediaType;
  const itemId = item.id;
  const workId = item.workId; // **Crucial: Assumes item object includes workId**

  if (typeof itemId === 'undefined') {
    console.warn("ItemListItem received item without ID:", item);
    // Return an error list item or null if preferred
    return <li className="py-2 text-red-500">Item data is missing ID.</li>;
  }

  // Check if it's a type that should use the combined page
  if (itemType === 'BOOK_CONTENT' || itemType === 'FILM_CONTENT' || itemType === 'DOCUMENTARY_CONTENT') {
    if (typeof workId !== 'undefined') {
      linkPath = `/combined/${workId}`; // Link to CombinedMediaPage using WORK ID
    } else {
      // Log an error if workId is missing for combined types
      console.error(`ItemListItem: Missing workId for combined type (${itemType}) item ID ${itemId}. Cannot generate correct link.`);
      // Optionally, you could link to the item page as a fallback, but it might be confusing
      // linkPath = `/item/${itemId}`;
    }
  } else {
    // For all other types (episodes, chapters, etc.), link to the standard item page
    linkPath = `/item/${itemId}`; // Link to MediaItemPage using ITEM ID
  }

  return (
    <li className="py-2 border-b border-gray-700 last:border-b-0">
      {/* Use the dynamically determined linkPath */}
      <Link
        to={linkPath}
        className="flex justify-between items-center hover:text-amber-500 transition-colors"
      >
        {/* Left side: Icon and Title */}
        <span className="flex items-center mr-2 min-w-0"> {/* Added min-w-0 for better truncation */}
           {/* Render the determined icon */}
          <ItemIcon size={14} className="inline mr-2 flex-shrink-0" />
          {/* Display itemTitle */}
          {/* Ensure truncation works well */}
          <span className="truncate flex-grow">{displayTitle}</span>
        </span>

        {/* Right side: Formatted Date (if available) */}
        {displayDate && (
            <span className="text-xs text-gray-400 flex-shrink-0 ml-2 whitespace-nowrap"> {/* Added whitespace-nowrap */}
                {displayDate}
            </span>
        )}
      </Link>
    </li>
  );
};

export default ItemListItem;
