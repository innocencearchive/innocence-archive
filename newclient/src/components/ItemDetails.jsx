/* ========================================================================== */
/* --- File: src/components/ItemDetails.jsx (Refactored v1) ---             */
/* --- Displays metadata for a MediaItem within the sidebar ---           */
/* ========================================================================== */
import React from 'react';
import { ExternalLink } from 'lucide-react'; // Import icon for external links
import { BRONZE_COLOR } from './themeconstants.js'; // Import bronze color constant

// Helper function to display N/A for null/undefined/empty strings
const displayValue = (value, suffix = '') => {
  if (value === null || typeof value === 'undefined' || value === '') {
    return <span className="text-gray-400 italic">N/A</span>; // Style N/A
  }
  return `${value}${suffix}`;
};

// Helper function to format Date object/string
const formatDate = (dateString) => {
  if (!dateString) return <span className="text-gray-400 italic">N/A</span>; // Style N/A
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return <span className="text-red-400 italic">Invalid Date</span>; // Style error
  }
};

/**
 * Displays metadata specific to the MediaItem.
 * Designed to be placed inside a styled container (e.g., the gray sidebar in MediaItemPage).
 * Uses fields from the MediaItem schema model.
 *
 * Props:
 * - item: A MediaItem object (fetched from the API).
 */
const ItemDetails = ({ item }) => {
  // Ensure 'item' prop exists, provide fallback if not
  if (!item) {
    return (
      // Simple fallback message, no outer container needed here
      <div>
        <h3 className={`text-lg font-semibold ${BRONZE_COLOR} mb-3`}>Details</h3>
        <p className="text-sm text-gray-400">Details not available.</p>
      </div>
    );
  }

  return (
    // No outer container/aside element - parent provides it (bg-gray-800, padding etc.)
    <div>
      <h3 className={`text-lg font-semibold ${BRONZE_COLOR} mb-4 border-b border-gray-600 pb-2`}>Details</h3>
      <dl className="space-y-3 text-sm text-gray-300"> {/* Increased spacing slightly */}

        {/* Release Date */}
        <div>
          <dt className="font-semibold text-gray-400">Release Date:</dt>
          <dd className="ml-1">{formatDate(item.releaseDate)}</dd>
        </div>

        {/* Item Number (e.g., Episode/Chapter) */}
        {item.itemNumber && (
           <div>
            <dt className="font-semibold text-gray-400">Number:</dt>
            <dd className="ml-1">{item.itemNumber}</dd>
          </div>
        )}

        {/* Host / Narrator */}
        {item.hostOrNarrator && (
          <div>
            <dt className="font-semibold text-gray-400">Host/Narrator:</dt>
            <dd className="ml-1">{item.hostOrNarrator}</dd>
          </div>
        )}

        {/* Focus / Theme */}
        {item.focusOrTheme && (
           <div>
            <dt className="font-semibold text-gray-400">Focus/Theme:</dt>
            <dd className="ml-1 whitespace-pre-wrap">{item.focusOrTheme}</dd>
          </div>
        )}

         {/* Key Quotes */}
        {item.keyQuotes && (
           <div>
            <dt className="font-semibold text-gray-400">Key Quotes:</dt>
            <blockquote className="ml-1 mt-1 pl-3 italic border-l-2 border-gray-500 text-gray-400 whitespace-pre-wrap">
                {item.keyQuotes}
            </blockquote>
          </div>
        )}

        {/* Source URL */}
        {item.sourceUrl && (
          <div>
            <dt className="font-semibold text-gray-400">Source Link:</dt>
            <dd className="ml-1">
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center ${BRONZE_COLOR} hover:underline break-all`} // Use bronze color for link
              >
                <span>View Original Content</span>
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" /> {/* Slightly larger icon */}
              </a>
            </dd>
          </div>
        )}

      </dl>
    </div>
  );
};

export default ItemDetails;
