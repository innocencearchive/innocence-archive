/* ========================================================================== */
/* --- File: src/components/OtherInvolvedPersonsList.jsx ---                */
/* --- Displays list of OIPs (lawyers, witnesses, etc.) ---                 */
/* --- Adapted from old RelatedPeopleList, used on Profile/Media pages ---  */
/* ========================================================================== */

import React from 'react';
import { Link } from 'react-router-dom';
// Using Users icon for now, could use Briefcase or other based on context if needed
import { Users, Loader2, AlertTriangle } from 'lucide-react';

// --- Import Theme Constants ---
import { BRONZE_COLOR } from './themeconstants';

// --- Helper Function to Format Role ---
// Consider moving this to a shared utils file
const formatRole = (role) => {
    if (!role) return null; // Return null if no role
    // Example: LAWYER_DEFENSE -> Lawyer (Defense)
    return role.split('_')
               .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
               .join(' ');
};

/**
 * OtherInvolvedPersonsList Component
 * Renders a list of Other Involved Persons (non-WC individuals).
 * Handles loading and error states. Includes role display.
 * Expects parent container to handle border, padding, and scrolling.
 *
 * Props:
 * - people: An array of InvolvedPerson objects (should have id, firstName, lastName, role).
 * - isLoading: Boolean indicating if data is loading.
 * - error: String containing error message, or null/undefined if no error.
 */
const OtherInvolvedPersonsList = ({ people, isLoading, error }) => {
  const title = "Other Involved Persons";
  // Link destination prefix for OIP profiles (adjust if needed)
  const linkPrefix = "/person";

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

      {/* Empty State */}
      {!isLoading && !error && (!people || people.length === 0) && (
        <p className="text-sm text-gray-400 italic pl-1">
          No other individuals listed.
        </p>
      )}

      {/* List Content */}
      {!isLoading && !error && people && people.length > 0 && (
        <ul className="space-y-2 text-sm">
          {people.map(person => {
            const personName = person.firstName || person.lastName ? `${person.firstName || ''} ${person.lastName || ''}`.trim() : 'Unnamed Person';
            const personRole = formatRole(person.role); // Get formatted role

            return (
              <li key={person.id} className="py-1 border-b border-gray-700 last:border-b-0">
                {/* Link to the specific OIP page */}
                <Link
                  to={`${linkPrefix}/${person.id}`}
                  className="text-gray-300 hover:text-amber-400 transition-colors block"
                >
                  <div>{personName}</div>
                  {/* Display role if available */}
                  {personRole && (
                    <div className="text-xs text-gray-400 mt-0.5">{personRole}</div>
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

export default OtherInvolvedPersonsList;
