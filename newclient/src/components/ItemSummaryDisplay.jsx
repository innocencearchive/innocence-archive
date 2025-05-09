/* ========================================================================== */
/* --- File: src/components/ItemSummaryDisplay.jsx (Refactored v1) ---      */
/* --- Displays the summary section for a Media Item ---                    */
/* ========================================================================== */
import React from 'react';
import { BRONZE_COLOR } from './themeconstants.js'; // Import bronze color constant

/**
 * Displays the summary/content section for a Media Item.
 * Designed to be placed inside a styled container (e.g., the bronze-bordered area in MediaItemPage).
 *
 * Props:
 * - summaryText: The summary text (string). Parent provides this from 'summaryNotes'.
 */
const ItemSummaryDisplay = ({ summaryText }) => {
    // Determine fallback text if summaryText is empty or null
    const displaySummary = summaryText || <span className="text-gray-400 italic">No summary available.</span>;

    return (
        // No outer container/section element - parent provides it (border, padding etc.)
        <div>
            {/* Apply bronze color to the heading */}
            <h2 className={`text-2xl font-semibold ${BRONZE_COLOR} mb-4`}>Summary</h2>
            {/* Use text-gray-300 for better contrast on black background */}
            {/* Removed prose classes, apply base styling directly or via parent */}
            <div className="text-gray-300 leading-relaxed space-y-4">
                {/* Display the summary text passed via props, handle line breaks */}
                {/* Wrap in a div to apply text styling */}
                <p className="whitespace-pre-wrap">{displaySummary}</p>
                {/* Potential future additions: transcript snippets, players */}
            </div>
        </div>
    );
};

export default ItemSummaryDisplay;
