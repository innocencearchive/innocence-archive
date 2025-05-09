/* ========================================================================== */
/* --- File: src/components/RelatedWrongfullyConvictedList.jsx ---          */
/* --- Displays list of related WC individuals for IndividualProfilePage ---*/
/* --- (No functional changes needed based on current data structure) ---   */
/* ========================================================================== */

import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Loader2, AlertTriangle } from 'lucide-react';

// --- Import Theme Constants ---
import { BRONZE_COLOR } from './themeconstants'; // Ensure path is correct

// --- Helper Function to Format Status ---
// Consider moving this to a shared utils file if used elsewhere
const formatStatus = (status) => {
    if (!status) return null; // Return null if no status to display
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

/**
 * RelatedWrongfullyConvictedList Component
 * Renders a list of other Wrongfully Convicted individuals related to the main profile subject.
 * Handles loading and error states. Includes status display.
 * Expects parent container to handle border, padding, and scrolling.
 *
 * Props:
 * - individuals: An array of Individual objects (should have id, firstName, lastName, status).
 * Currently represents individuals DIRECTLY related via M2M relation in the DB.
 * - isLoading: Boolean indicating if data is loading (passed from parent).
 * - error: String containing error message, or null/undefined if no error (passed from parent).
 */
const RelatedWrongfullyConvictedList = ({ individuals, isLoading, error }) => {
  const title = "Related Wrongfully Convicted Individuals";
  const linkPrefix = "/profile"; // Links to the full WC profile page

  return (
    <div>
      {/* List Heading */}
      <h3 className={`text-xl font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
        <Users className="mr-2 flex-shrink-0" size={20} />
        {title}
      </h3>

      {/* Loading State (Reflects parent page loading state) */}
      {isLoading && (
        <div className="flex items-center justify-center text-gray-400 text-sm py-4">
          <Loader2 className="animate-spin mr-2" size={16} />
          <span>Loading related info...</span> {/* Adjusted text slightly */}
        </div>
      )}

      {/* Error State (Reflects parent page error state) */}
      {!isLoading && error && (
        <div className="flex items-center text-red-400 text-sm py-4">
           <AlertTriangle className="mr-2 flex-shrink-0" size={16} />
           {/* Display the error passed from the parent */}
           <span>Error loading profile data: {typeof error === 'string' ? error : 'An error occurred'}</span>
        </div>
      )}

      {/* Empty State */}
      {/* This condition is now accurate as 'individuals' contains the combined direct relations */}
      {!isLoading && !error && (!individuals || individuals.length === 0) && (
        <p className="text-sm text-gray-400 italic pl-1">
          No directly related wrongfully convicted individuals listed.
        </p>
      )}

      {/* List Content */}
      {/* This mapping correctly displays the individuals passed down */}
      {!isLoading && !error && individuals && individuals.length > 0 && (
        <ul className="space-y-2 text-sm">
          {individuals.map(person => {
            // Defensive check for person object and id
            if (!person || typeof person.id === 'undefined') {
                console.warn("Skipping rendering related individual due to missing data:", person);
                return null; // Don't render if data is incomplete
            }

            const personName = person.firstName || person.lastName ? `${person.firstName || ''} ${person.lastName || ''}`.trim() : 'Unnamed Individual';
            const personStatus = formatStatus(person.status);

            // --- FUTURE ENHANCEMENT ---
            // If the 'person' object included a 'relationType' (e.g., 'direct', 'group'),
            // you could display it here. For example:
            // const relationInfo = person.relationType === 'group' ? ` (Member of ${person.groupName})` : '';
            // Then append `relationInfo` to the personName or display it on a separate line.
            // This requires backend API changes and updates to IndividualProfilePage.jsx first.

            return (
              <li key={person.id} className="py-1 border-b border-gray-700 last:border-b-0">
                <Link
                  to={`${linkPrefix}/${person.id}`}
                  className="text-gray-300 hover:text-amber-400 transition-colors block"
                >
                  {/* Displays Name */}
                  <div>{personName}</div>
                  {/* Displays Status if available */}
                  {personStatus && (
                    <div className="text-xs text-gray-400 mt-0.5">{personStatus}</div>
                  )}
                  {/* Placeholder for future relationship type display */}
                  {/* {relationInfo && <div className="text-xs text-gray-500 mt-0.5">{relationInfo}</div>} */}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default RelatedWrongfullyConvictedList;
