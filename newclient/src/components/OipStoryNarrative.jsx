// src/components/OipStoryNarrative.jsx
import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react'; // Icons for loading/error states

/**
 * OipStoryNarrative Component
 * Displays the narrative text (notes/bio) for an Other Involved Person (OIP).
 * Designed to be used within a styled container (e.g., the main content area with border/padding).
 * Handles loading and error states. Assumes input text is a single string.
 *
 * Props:
 * - storyText: String containing the narrative/notes text.
 * - isLoading: Boolean indicating if the parent component is loading data.
 * - error: String containing an error message, or null/undefined.
 * - emptyMessage: String to display if storyText is empty (defaults if not provided).
 */
const OipStoryNarrative = ({
    storyText = '',
    isLoading = false,
    error = null,
    emptyMessage = "No profile notes or story available for this individual."
}) => {

    // Trim whitespace to check if text is truly empty
    const hasContent = storyText && storyText.trim().length > 0;

    return (
        <div className="narrative-container"> {/* Simple container */}

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center text-gray-400 text-sm py-8">
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    <span>Loading narrative...</span>
                </div>
            )}

            {/* Error State */}
            {!isLoading && error && (
                <div className="flex items-center text-red-400 text-sm py-4">
                   <AlertTriangle className="mr-2 flex-shrink-0 h-4 w-4" />
                   <span>Error: {typeof error === 'string' ? error : 'Could not load narrative.'}</span>
                </div>
            )}

            {/* Empty State (After loading, no error, but no text) */}
            {!isLoading && !error && !hasContent && (
                 <p className="text-sm text-gray-400 italic pl-1 py-4">{emptyMessage}</p>
            )}

            {/* Narrative Text Display */}
            {!isLoading && !error && hasContent && (
                <div className="prose prose-sm prose-invert max-w-none text-gray-300 whitespace-pre-wrap">
                    {/* Using whitespace-pre-wrap to respect newlines and spacing in the notes field */}
                    {/* Using prose classes for potential basic markdown-like styling if needed, otherwise just renders text */}
                    {storyText}
                </div>
            )}
        </div>
    );
};

export default OipStoryNarrative;
