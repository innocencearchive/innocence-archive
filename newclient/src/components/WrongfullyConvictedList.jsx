/* ========================================================================== */
/* --- File: src/components/WrongfullyConvictedList.jsx ---                 */
/* --- Displays list of WC individuals (e.g., mentioned in media) ---       */
/* --- Renamed from IndividualsMentionedList, adds status display ---       */
/* ========================================================================== */

import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Loader2, AlertTriangle } from 'lucide-react';

// --- Import Theme Constants ---
import { BRONZE_COLOR } from './themeconstants';

// --- Helper Function to Format Status (Copied from IndividualProfilePage) ---
// Consider moving this to a shared utils file if used elsewhere
const formatStatus = (status) => {
    if (!status) return null; // Return null if no status to display
    // Example: CONVICTION_OVERTURNED -> Conviction Overturned
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

/**
 * WrongfullyConvictedList Component
 * Renders a list of Wrongfully Convicted individuals.
 * Handles loading and error states. Includes status display.
 * Expects parent container to handle border, padding, and scrolling.
 *
 * Props:
 * - individuals: An array of Individual objects (should have id, firstName, lastName, status).
 * - isLoading: Boolean indicating if data is loading.
 * - error: String containing error message, or null/undefined if no error.
 */
const WrongfullyConvictedList = ({
  individuals,
  isLoading,
  error,
  title = 'Wrongfully Convicted Individuals Mentioned',
}) => {
  const linkPrefix = '/profile'; // Links to the full WC profile page

  return (
    <div>
      {/* List Heading */}
      <h3 className={`text-xl font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
        <Users className="mr-2 flex-shrink-0" size={20} />
        <span>{title}</span>
        {!isLoading && !error && Array.isArray(individuals) && individuals.length > 0 && (
          <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-300">
            {individuals.length}
          </span>
        )}
      </h3>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center text-gray-400 text-sm py-4">
          <Loader2 className="animate-spin mr-2" size={16} />
          <span>Loading...</span>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="flex items-center text-red-400 text-sm py-4">
           <AlertTriangle className="mr-2 flex-shrink-0" size={16} />
           <span>Error: {error}</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && (!individuals || individuals.length === 0) && (
        <p className="text-sm text-gray-400 italic pl-1">
          No wrongfully convicted individuals listed for this item.
        </p>
      )}

      {/* List Content */}
      {!isLoading && !error && individuals && individuals.length > 0 && (
        <ul className="space-y-2 text-sm"> {/* Increased spacing slightly */}
          {individuals.map(person => {
            const personName = person.firstName || person.lastName ? `${person.firstName || ''} ${person.lastName || ''}`.trim() : 'Unnamed Individual';
            const personStatus = formatStatus(person.status); // Get formatted status

            return (
              <li key={person.id} className="py-1 border-b border-gray-700 last:border-b-0">
                <Link
                  to={`${linkPrefix}/${person.id}`}
                  className="text-gray-300 hover:text-amber-400 transition-colors block" // Make link block for easier clicking
                >
                  <div>{personName}</div>
                  {/* **NEW**: Display status if available */}
                  {personStatus && (
                    <div className="text-xs text-gray-400 mt-0.5">{personStatus}</div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default WrongfullyConvictedList;
