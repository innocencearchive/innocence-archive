/* ========================================================================== */
/* --- File: src/components/RelatedOrganizationsList.jsx (Refactored v1) ---*/
/* --- Displays list of related organizations ---                           */
/* ========================================================================== */
import React from 'react';
import { Link } from 'react-router-dom';
import { Building, Loader2, AlertTriangle } from 'lucide-react'; // Keep Building, add Loader2, AlertTriangle
import { BRONZE_COLOR } from './themeconstants';

/**
 * RelatedOrganizationsList Component
 * Renders a list of related organizations.
 * Handles loading and error states.
 * Expects parent container to handle border, padding, and scrolling.
 *
 * Props:
 * - organizations: An array of Organization objects (should have id, name).
 * - isLoading: Boolean indicating if data is loading.
 * - error: String containing error message, or null/undefined if no error.
 */
const RelatedOrganizationsList = ({ organizations, isLoading, error }) => {
  const title = "Related Organizations";

  const renderContent = () => {
      if (isLoading) {
          return (
              <div className="flex items-center justify-center text-gray-400 text-sm py-4">
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  <span>Loading related organizations...</span>
              </div>
          );
      }

      if (error) {
          return (
              <div className="flex items-center text-red-400 text-sm py-4">
                 <AlertTriangle className="mr-2 flex-shrink-0 h-4 w-4" />
                 <span>Error: {error}</span>
              </div>
          );
      }

      if (!organizations || organizations.length === 0) {
          return <p className="text-sm text-gray-400 italic pl-1 py-4">No related organizations listed.</p>;
      }

      return (
          <ul className="space-y-2 text-sm"> {/* Removed list-disc, list-inside, ml-5 */}
              {organizations.map(org => {
                  // Ensure org has an ID before rendering link
                  if (typeof org.id === 'undefined') {
                      console.warn("RelatedOrganizationsList item missing ID:", org);
                      // Render name without link if ID is missing
                      return <li key={org.name || Math.random()} className="text-gray-300">{org.name ?? 'Unnamed Organization'}</li>;
                  }
                  return (
                      <li key={org.id}>
                          <Link
                              to={`/organization/${org.id}`} // Assumes route is /organization/:id
                              className="text-gray-300 hover:text-amber-400 transition-colors hover:underline"
                          >
                              {org.name ?? 'Unnamed Organization'}
                          </Link>
                      </li>
                  );
              })}
          </ul>
      );
  };

  return (
    // No outer container/section - parent provides it
    <div>
        <h4 className={`text-md font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
            <Building className="mr-2 h-4 w-4" />
            {title}
        </h4>
        {renderContent()}
    </div>
  );
};

export default RelatedOrganizationsList;
