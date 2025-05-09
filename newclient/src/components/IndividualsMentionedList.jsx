/* ========================================================================== */
/* --- File: src/components/IndividualsMentionedList.jsx ---                */
/* --- Displays list of individuals for MediaWorkPage Learn More block ---  */
/* ========================================================================== */

import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Loader2, AlertTriangle } from 'lucide-react'; // Added Loader2 and AlertTriangle

// --- Import Theme Constants ---
import { BRONZE_COLOR } from './themeconstants';

/**
 * IndividualsMentionedList Component
 * Renders a list of individuals mentioned in a media work.
 * Handles loading and error states.
 * Expects parent container to handle border, padding, and scrolling.
 *
 * Props:
 * - individuals: An array of Individual objects (should have id, firstName, lastName).
 * - isLoading: Boolean indicating if data is loading.
 * - error: String containing error message, or null/undefined if no error.
 */
const IndividualsMentionedList = ({ individuals, isLoading, error }) => {
  const title = "Individuals Mentioned";
  const linkPrefix = "/profile"; // Link destination prefix

  return (
    <div>
      {/* List Heading */}
      <h3 className={`text-xl font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
        <Users className="mr-2 flex-shrink-0" size={20} />
        {title}
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

      {/* Empty State (after loading, no error) */}
      {!isLoading && !error && (!individuals || individuals.length === 0) && (
        <p className="text-sm text-gray-400 italic pl-1">
          No individuals mentioned.
        </p>
      )}

      {/* List Content */}
      {!isLoading && !error && individuals && individuals.length > 0 && (
        <ul className="space-y-1 text-sm">
          {individuals.map(person => (
            <li key={person.id} className="py-1 border-b border-gray-700 last:border-b-0">
              <Link
                to={`${linkPrefix}/${person.id}`}
                className="text-gray-300 hover:text-amber-400 transition-colors"
              >
                {/* Display name, handle missing names */}
                {person.firstName || person.lastName ? `${person.firstName || ''} ${person.lastName || ''}`.trim() : 'Unnamed Individual'}
              </Link>
              {/* Optional: Add role if available in data */}
              {/* {person.role && <span className="text-xs text-gray-500 ml-1">({person.role})</span>} */}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default IndividualsMentionedList;
