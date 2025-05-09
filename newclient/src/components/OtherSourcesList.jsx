/* ========================================================================== */
/* --- File: src/components/OtherSourcesList.jsx ---                        */
/* --- Reused from IndividualProfilePage, adapted for MediaWorkPage ---     */
/* ========================================================================== */
import React from 'react';
import { Info, ExternalLink, Loader2, AlertTriangle } from 'lucide-react'; // Added Loader2, AlertTriangle

// --- Import Theme Constants ---
import { BRONZE_COLOR } from './themeconstants';

/**
 * OtherSourcesList Component
 * Renders a list of other sources (e.g., URLs, descriptions).
 * Handles loading and error states.
 * Expects parent container to handle border, padding, and scrolling.
 *
 * Props:
 * - sources: An array of source objects (structure may vary, e.g., { id, description, url }).
 * - isLoading: Boolean indicating if data is loading.
 * - error: String containing error message, or null/undefined if no error.
 */
const OtherSourcesList = ({ sources, isLoading, error }) => {
    const title = "Other Sources";

    return (
        <div>
            {/* List Heading */}
            <h3 className={`text-xl font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
                <Info className="mr-2 flex-shrink-0" size={20} />
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
            {!isLoading && !error && (!sources || sources.length === 0) && (
              <p className="text-sm text-gray-400 italic pl-1">
                No other sources listed.
              </p>
            )}

            {/* List Content */}
            {!isLoading && !error && sources && sources.length > 0 && (
                 <ul className="space-y-1 text-sm">
                     {/* Iterate through the sources passed via props */}
                     {sources.map((source, index) => (
                         // Use source.id if available, otherwise index as fallback key
                         <li key={source.id || index} className="py-1 border-b border-gray-700 last:border-b-0">
                            {/* Check if a URL exists to make it a link */}
                            {source.url ? (
                                <a
                                    href={source.url}
                                    target="_blank" // Opens link in new tab
                                    rel="noopener noreferrer" // Security measure for target="_blank"
                                    // Apply styling to make the name look like a link
                                    className="text-gray-300 hover:text-amber-400 transition-colors hover:underline inline-flex items-center"
                                    // Add aria-label for accessibility
                                    aria-label={`Visit external source: ${source.name || source.url}`}
                                >
                                    {/* Display the source name */}
                                    {source.name || 'Unnamed Source'}
                                    {/* Keep the icon inside the link for clarity */}
                                    <ExternalLink size={12} className="inline ml-1.5 flex-shrink-0" />
                                </a>
                            ) : (
                                // If no URL, just display the name as plain text
                                <span className="text-gray-300">
                                    {source.name || 'Unnamed Source'}
                                    {/* Optionally add an icon or indicator that it's not a link */}
                                </span>
                            )}
                         </li>
                     ))}
                 </ul>
             )}
        </div>
    );
};

export default OtherSourcesList;
