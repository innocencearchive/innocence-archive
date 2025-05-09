/* ========================================================================== */
/* --- File: src/components/WorkSummaryDisplay.jsx ---                      */
/* --- Replaces old WorkSummary component for block layout ---              */
/* ========================================================================== */

import React from 'react';

// --- Import Theme Constants ---
// Ensure this path is correct relative to src/components/
import { BRONZE_COLOR } from './themeconstants';

/**
 * WorkSummaryDisplay Component
 * Displays the main summary text for a MediaWork within the designated main content
 * area in the block-based layout (expects parent div to provide border/padding).
 * @param {object} props - Component props.
 * @param {string} props.summaryText - The summary text to display. Should be mapped
 * from the schema's 'summaryNotes' field by the parent.
 */
const WorkSummaryDisplay = ({ summaryText }) => {
  // Render content directly, parent provides container styling (border, p-6, etc.)
  return (
    <div>
      {/* Apply bronze color to the heading */}
      <h2 className={`text-2xl font-semibold ${BRONZE_COLOR} mb-4`}>Summary</h2>
      {/* Display the summary text passed via props, handle empty/null case */}
      <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
        {summaryText || <span className="text-gray-400 italic">No summary available.</span>}
      </p>
    </div>
  );
};

export default WorkSummaryDisplay;
