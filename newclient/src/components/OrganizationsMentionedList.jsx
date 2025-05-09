/* ========================================================================== */
/* --- File: src/components/OrganizationsMentionedList.jsx ---              */
/* --- Displays list of organizations for MediaWorkPage Learn More block ---*/
/* ========================================================================== */

import React from 'react';
import { Link } from 'react-router-dom';
import { Building, Loader2, AlertTriangle } from 'lucide-react'; // Using Building icon

// --- Import Theme Constants ---
import { BRONZE_COLOR } from './themeconstants';

/**
 * OrganizationsMentionedList Component
 * Renders a list of organizations mentioned in a media work.
 * Handles loading and error states.
 * Expects parent container to handle border, padding, and scrolling.
 *
 * Props:
 * - organizations: An array of Organization objects (should have id, name).
 * - isLoading: Boolean indicating if data is loading.
 * - error: String containing error message, or null/undefined if no error.
 */
const OrganizationsMentionedList = ({ organizations, isLoading, error }) => {
  const title = "Related Organizations Mentioned";
  const linkPrefix = "/organization"; // Link destination prefix

  return (
    <div>
      {/* List Heading */}
      <h3 className={`text-xl font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
        <Building className="mr-2 flex-shrink-0" size={20} />
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
      {!isLoading && !error && (!organizations || organizations.length === 0) && (
        <p className="text-sm text-gray-400 italic pl-1">
          No organizations mentioned.
        </p>
      )}

      {/* List Content */}
      {!isLoading && !error && organizations && organizations.length > 0 && (
        <ul className="space-y-1 text-sm">
          {organizations.map(org => (
            <li key={org.id} className="py-1 border-b border-gray-700 last:border-b-0">
              <Link
                to={`${linkPrefix}/${org.id}`}
                className="text-gray-300 hover:text-amber-400 transition-colors"
              >
                {org.name || 'Unnamed Organization'}
              </Link>
              {/* Optional: Add type if available */}
              {/* {org.type && <span className="text-xs text-gray-500 ml-1">({org.type})</span>} */}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default OrganizationsMentionedList;
