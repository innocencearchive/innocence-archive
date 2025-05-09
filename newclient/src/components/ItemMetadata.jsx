import React from 'react';
import { ExternalLink } from 'lucide-react'; // Import icon for external links
import { BRONZE_COLOR } from './themeconstants.js'; // Assuming this is defined

// Helper function to display N/A for null/undefined/empty strings
const displayValue = (value, suffix = '') => {
  if (value === null || typeof value === 'undefined' || value === '') {
    return 'N/A';
  }
  return `${value}${suffix}`;
};

// Helper function to format Date object/string
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return 'Invalid Date';
  }
};

/**
 * Displays metadata specific to the MediaItem.
 * Uses fields from the MediaItem schema model.
 *
 * Props:
 * - item: A MediaItem object (fetched from the API, potentially including relations).
 */
const ItemMetadata = ({ item }) => {
  // Ensure 'item' prop exists, provide fallback if not
  if (!item) {
    return (
      <aside aria-label="Item Metadata" className="p-4 border border-gray-700 rounded-lg bg-gray-800 mb-8">
        <h3 className={`text-lg font-semibold ${BRONZE_COLOR} mb-3`}>Details</h3>
        <p className="text-sm text-gray-400">Metadata not available.</p>
      </aside>
    );
  }

  return (
    <aside aria-label="Item Metadata" className="p-4 border border-gray-700 rounded-lg bg-gray-800 mb-8">
      <h3 className={`text-lg font-semibold ${BRONZE_COLOR} mb-3`}>Details</h3>
      <dl className="space-y-2 text-sm text-gray-300">

        {/* Release Date */}
        {/* Uses schema field: releaseDate (DateTime?) */}
        <div>
          <dt className="font-semibold">Release Date:</dt>
          <dd className="ml-1">{formatDate(item.releaseDate)}</dd>
        </div>

        {/* Item Number (e.g., Episode/Chapter) */}
        {/* Uses schema field: itemNumber (String?) */}
        {/* Display only if itemNumber exists */}
        {item.itemNumber && (
           <div>
            <dt className="font-semibold">Number:</dt>
            <dd className="ml-1">{item.itemNumber}</dd>
          </div>
        )}

        {/* Host / Narrator */}
        {/* Uses schema field: hostOrNarrator (String?) */}
        {/* Display only if hostOrNarrator exists */}
        {item.hostOrNarrator && (
          <div>
            <dt className="font-semibold">Host/Narrator:</dt>
            <dd className="ml-1">{item.hostOrNarrator}</dd>
          </div>
        )}

        {/* Focus / Theme */}
        {/* Uses schema field: focusOrTheme (String?) */}
        {item.focusOrTheme && (
           <div>
            <dt className="font-semibold">Focus/Theme:</dt>
            <dd className="ml-1 whitespace-pre-wrap">{item.focusOrTheme}</dd>
          </div>
        )}

         {/* Key Quotes */}
        {/* Uses schema field: keyQuotes (String?) */}
        {item.keyQuotes && (
           <div>
            <dt className="font-semibold">Key Quotes:</dt>
            {/* Use blockquote for semantic meaning */}
            <blockquote className="ml-1 mt-1 pl-3 italic border-l-2 border-gray-600 whitespace-pre-wrap">
                {item.keyQuotes}
            </blockquote>
          </div>
        )}

        {/* Source URL */}
        {/* Uses schema field: sourceUrl (String?) */}
        {item.sourceUrl && ( // Only display if field has content
          <div>
            <dt className="font-semibold">Source Link:</dt>
            <dd className="ml-1">
              <a
                href={item.sourceUrl}
                target="_blank" // Open in new tab
                rel="noopener noreferrer" // Security best practice
                className="inline-flex items-center text-amber-500 hover:text-amber-400 hover:underline break-all"
              >
                <span>View Original Content</span>
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </dd>
          </div>
        )}

        {/* Removed fields not in schema: guests, author, externalLink, transcriptLink */}
        {/* Removed conditional logic based on item.type for fields like episodeNumber, */}
        {/* instead just displaying fields if they exist on the item object. */}
        {/* You could add type-specific logic back if needed for certain fields. */}

      </dl>
    </aside>
  );
};

export default ItemMetadata;

