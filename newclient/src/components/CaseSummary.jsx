/* ========================================================================== */
/* --- File: src/components/CaseSummary.jsx ---                             */
/* ========================================================================== */

// Refactored to act as a full-height introductory block content
import React from 'react';
import { BRONZE_COLOR } from './themeconstants'; // Assuming path is correct relative to this file

/**
 * Refactored CaseSummary Component
 * Designed to be placed within a full-height block container.
 * Displays a prominent heading and centered summary text.
 *
 * @param {object} props - Component props.
 * @param {string} [props.summary=''] - The summary text to display.
 */
const CaseSummary = ({ summary = '' }) => (
  // Removed outer section and background. Assumes parent provides container/padding.
  // Added text-center and max-width for readability
  <div className="w-full max-w-4xl mx-auto text-center"> {/* Constrain width */}
    <h2 className={`text-3xl md:text-4xl font-semibold ${BRONZE_COLOR} mb-6`}>
      Case Summary
    </h2>
    {/* Increased text size and line height for prominence */}
    <p className="text-lg md:text-xl text-gray-200 leading-relaxed">
        {summary}
    </p>
  </div>
);

// Ensure this component is exported if it's in its own file
export default CaseSummary; // Uncomment this line when saving as CaseSummary.jsx
