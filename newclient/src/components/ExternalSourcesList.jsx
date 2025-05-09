/* ========================================================================== */
/* --- File: src/components/ExternalSourcesList.jsx (Refactored v1) ---     */
/* --- Displays list of external sources related to the organization ---    */
/* ========================================================================== */
import React from 'react';
import { LinkIcon, ExternalLink, Loader2, AlertTriangle } from 'lucide-react'; // Changed Info to LinkIcon
import { BRONZE_COLOR } from './themeconstants';

/**
 * ExternalSourcesList Component
 * Renders a list of external sources (e.g., URLs, descriptions).
 * Handles loading and error states.
 * Expects parent container to handle border, padding, and scrolling.
 *
 * Props:
 * - sources: An array of source objects (e.g., { id, description, url }).
 * - isLoading: Boolean indicating if data is loading.
 * - error: String containing error message, or null/undefined if no error.
 */
const ExternalSourcesList = ({ sources, isLoading, error }) => {
    const title = "External Sources";

    const renderContent = () => {
        if (isLoading) {
          return (
            <div className="flex items-center justify-center text-gray-400 text-sm py-4">
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
              <span>Loading external sources...</span>
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

        if (!sources || sources.length === 0) {
          return <p className="text-sm text-gray-400 italic pl-1 py-4">No external sources listed.</p>;
        }

        return (
             <ul className="space-y-2 text-sm"> {/* Increased spacing */}
                 {sources.map((source, index) => (
                     <li key={source.id || index} className="text-gray-300">
                         {/* Display description or URL */}
                         {source.description || source.url || 'Unnamed Source'}
                         {/* Add external link icon and link if URL exists */}
                         {source.url && (
                             <a
                                 href={source.url}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className={`ml-1.5 ${BRONZE_COLOR} hover:underline inline-flex items-center`} // Use bronze for external link
                                 aria-label={`Visit external source: ${source.description || source.url}`}
                             >
                                 <ExternalLink size={12} className="inline" />
                             </a>
                         )}
                     </li>
                 ))}
             </ul>
         );
    };

    return (
        // No outer container - parent provides it
        <div>
            <h4 className={`text-md font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
                <LinkIcon className="mr-2 h-4 w-4" /> {/* Changed icon */}
                {title}
            </h4>
            {renderContent()}
        </div>
    );
};

export default ExternalSourcesList;
