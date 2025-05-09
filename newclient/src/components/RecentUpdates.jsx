// src/components/RecentUpdates.jsx
import React from 'react';
// Removed unused ExternalLink import
import { History } from 'lucide-react'; // Keep History icon
import { Link } from 'react-router-dom'; // Keep Link for internal navigation

/**
 * RecentUpdates Component
 *
 * Displays a list of recent site updates.
 * Handles different types of updates and links accordingly.
 *
 * @param {object} props - Component props.
 * @param {Array} [props.updates=[]] - An array of update objects fetched from the backend.
 */
const RecentUpdates = ({ updates = [] }) => { // Default to empty array

  // Helper function to format date (optional but recommended)
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      // Example: Display as MM/DD/YYYY
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch (e) {
      console.error("Error formatting date:", e);
      return dateString; // Return original string if formatting fails
    }
  };

  // Helper function to determine the link destination
  const getLinkDestination = (update) => {
    if (!update.relatedId) return null; // No ID, no internal link

    switch (update.updateType) {
      case 'PROFILE':
        return `/profile/${update.relatedId}`;
      case 'MEDIA_ITEM': // Assuming links go to individual items
        return `/item/${update.relatedId}`;
      case 'ORGANIZATION': // Corrected from ORG
        return `/organization/${update.relatedId}`;
      // Add cases for MEDIA_WORK if needed: return `/work/${update.relatedId}`;
      default:
        return null; // Unknown type or no link needed
    }
  };

  return (
    <section aria-labelledby="updates-title" className="py-8 px-4 md:px-8">
      <h2 id="updates-title" className="text-xl font-semibold text-gray-50 mb-4 text-center">Recent Updates</h2>
      {/* Check if updates array has content */}
      {updates && updates.length > 0 ? (
        <ul className="max-w-2xl mx-auto space-y-2 text-sm">
          {updates.map(update => {
            const internalLink = getLinkDestination(update);
            const displayDate = formatDate(update.date);

            // Ensure update has an ID for the key
            if (typeof update.id === 'undefined') {
                console.warn("RecentUpdates item missing ID:", update);
                return null;
            }

            return (
              <li key={update.id} className="flex justify-between items-center text-gray-300">
                <div className="flex items-center mr-2"> {/* Wrap text content */}
                  <History size={14} className="mr-2 flex-shrink-0 text-gray-400" /> {/* Icon styling */}
                  {/* Render internal Link if applicable */}
                  {internalLink ? (
                    <Link to={internalLink} className="hover:text-amber-500 hover:underline">
                      {update.text ?? 'Update details missing.'}
                    </Link>
                  ) : // Render external link if applicable
                  update.externalLink ? (
                    <a
                      href={update.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-amber-500 hover:underline"
                    >
                      {update.text ?? 'Update details missing.'}
                      {/* Optionally add an external link icon here */}
                    </a>
                  ) : (
                    // Otherwise, just render text
                    <span>{update.text ?? 'Update details missing.'}</span>
                  )}
                </div>
                {/* Display formatted date */}
                {displayDate && (
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-4 whitespace-nowrap">
                        {displayDate}
                    </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        // Fallback message if no updates
        <p className="text-center text-gray-400 text-sm italic">No recent updates.</p>
      )}
    </section>
  );
};

export default RecentUpdates;
