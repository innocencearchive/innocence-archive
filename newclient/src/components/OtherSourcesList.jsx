/* ========================================================================== */
/* --- File: src/components/OtherSourcesList.jsx ---                        */
/* --- MODIFIED: Display headline if available, else source name ---        */
/* ========================================================================== */
import React from 'react';
import { Info, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';

// --- Import Theme Constants ---
import { BRONZE_COLOR } from './themeconstants';

/**
 * OtherSourcesList Component
 * Renders a list of other sources (e.g., URLs, headlines, source names).
 * Handles loading and error states.
 * Expects parent container to handle border, padding, and scrolling.
 *
 * Props:
 * - sources: An array of source objects, expected to have:
 * - id: Unique key for the list item.
 * - url: The URL to link to.
 * - headline: The headline of the article/source (optional).
 * - sourceName: The name of the source (e.g., "The Innocence Project") (optional, fallback).
 * - description: Optional description (not directly used in link text but available).
 * - isLoading: Boolean indicating if data is loading.
 * - error: String containing error message, or null/undefined if no error.
 */
const OtherSourcesList = ({ sources, isLoading, error }) => {
    // The title for this section is now passed from IndividualProfilePage or can be set here if static
    // For now, let's remove the static title from here as it's rendered in IndividualProfilePage.
    // const title = "Other Sources"; 

    return (
        <div>
            {/* The H3 title is now rendered in the parent component (IndividualProfilePage) */}
            {/* <h3 className={`text-xl font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
                <Info className="mr-2 flex-shrink-0" size={20} />
                {title}
            </h3> */}

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center text-gray-400 text-sm py-4">
                <Loader2 className="animate-spin mr-2" size={16} />
                <span>Loading sources...</span>
              </div>
            )}

            {/* Error State */}
            {!isLoading && error && (
              <div className="flex items-center text-red-400 text-sm py-4">
                 <AlertTriangle className="mr-2 flex-shrink-0" size={16} />
                 <span>Error loading sources: {error}</span>
              </div>
            )}

            {/* Empty State (after loading, no error) */}
            {!isLoading && !error && (!sources || sources.length === 0) && (
              <p className="text-sm text-gray-400 italic pl-1">
                No other sources listed for this individual.
              </p>
            )}

            {/* List Content */}
            {!isLoading && !error && sources && sources.length > 0 && (
                 <ul className="space-y-1 text-sm">
                     {sources.map((source) => {
                        // Determine the text to display for the link
                        const linkText = source.headline || source.sourceName || 'Unnamed Source';
                        const ariaLabelText = source.headline ? `Read article: ${source.headline}` : `Visit source: ${source.sourceName || source.url}`;

                        return (
                            <li key={source.id} className="py-1 border-b border-gray-700 last:border-b-0">
                                {source.url ? (
                                    <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-gray-300 hover:text-amber-400 transition-colors hover:underline inline-flex items-center group"
                                        aria-label={ariaLabelText}
                                    >
                                        {linkText}
                                        <ExternalLink size={12} className="inline ml-1.5 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                                    </a>
                                ) : (
                                    <span className="text-gray-300">
                                        {linkText}
                                        {/* Optionally indicate it's not a link if URL is missing */}
                                    </span>
                                )}
                                {/* You could also display source.description here if desired */}
                                {source.description && (
                                    <p className="text-xs text-gray-500 mt-0.5 pl-2">{source.description}</p>
                                )}
                            </li>
                        );
                     })}
                 </ul>
             )}
        </div>
    );
};

export default OtherSourcesList;
