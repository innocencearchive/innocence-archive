/* ========================================================================== */
/* --- File: src/components/WorkDetails.jsx ---                             */
/* --- Replaces old WorkMetadata component for block layout ---             */
/* ========================================================================== */

import React from 'react';
import { ExternalLink } from 'lucide-react'; // Import icon for external links

// --- Import Theme Constants ---
// Ensure this path is correct relative to src/components/
import { BRONZE_COLOR } from './themeconstants';

// Helper function to display N/A for null/undefined/empty strings
const displayValue = (value, suffix = '') => {
  if (value === null || typeof value === 'undefined' || value === '') {
    return <span className="text-gray-400 italic">N/A</span>; // Style N/A differently
  }
  return `${value}${suffix}`;
};

/**
 * WorkDetails Component
 * Displays key metadata for a MediaWork within the designated sidebar area
 * in the block-based layout (expects parent div to provide background/padding).
 * @param {object} props - Component props.
 * @param {object} props.work - The MediaWork data object. Should contain fields like
 * publicationOrReleaseYear, publisherOrNetwork, focusOrTheme,
 * availabilityNotes, sourceUrl, creatorName.
 */
const WorkDetails = ({ work }) => {
  // Ensure 'work' prop exists, provide fallback if not
  if (!work) {
    return (
      // Render content directly, parent provides container styling (bg-gray-800, p-6, etc.)
      <div>
        <h3 className={`text-xl font-semibold ${BRONZE_COLOR} mb-4`}>Details</h3>
        <p className="text-sm text-gray-400">Metadata not available.</p>
      </div>
    );
  }

  // Render content directly, parent provides container styling (bg-gray-800, p-6, etc.)
  return (
    <div>
      <h3 className={`text-xl font-semibold ${BRONZE_COLOR} mb-4`}>Details</h3>
      {/* Use definition list for key-value pairs */}
      <dl className="space-y-3 text-sm text-gray-300"> {/* Increased spacing slightly */}

        {/* Creator */}
        {/* Uses schema field: creatorName */}
        <div>
          <dt className="font-semibold text-gray-100">Creator:</dt> {/* Slightly emphasized key */}
          <dd className="ml-1">{displayValue(work.creatorName)}</dd>
        </div>

        {/* Published/Released Year */}
        {/* Uses schema field: publicationOrReleaseYear */}
        <div>
          <dt className="font-semibold text-gray-100">Published/Released:</dt>
          <dd className="ml-1">{displayValue(work.publicationOrReleaseYear)}</dd>
        </div>

        {/* Publisher/Network */}
        {/* Uses schema field: publisherOrNetwork */}
        <div>
          <dt className="font-semibold text-gray-100">Publisher/Network:</dt>
          <dd className="ml-1">{displayValue(work.publisherOrNetwork)}</dd>
        </div>

        {/* Focus/Theme */}
        {/* Uses schema field: focusOrTheme */}
        {work.focusOrTheme && ( // Only display if field has content
          <div>
            <dt className="font-semibold text-gray-100">Focus/Theme:</dt>
            <dd className="ml-1 whitespace-pre-wrap">{work.focusOrTheme}</dd> {/* Keep pre-wrap */}
          </div>
        )}

        {/* Availability Notes */}
        {/* Uses schema field: availabilityNotes */}
        {work.availabilityNotes && ( // Only display if field has content
          <div>
            <dt className="font-semibold text-gray-100">Availability:</dt>
            <dd className="ml-1 whitespace-pre-wrap">{work.availabilityNotes}</dd> {/* Keep pre-wrap */}
          </div>
        )}

        {/* Source URL */}
        {/* Uses schema field: sourceUrl */}
        {work.sourceUrl && ( // Only display if field has content
          <div>
            <dt className="font-semibold text-gray-100">Source Link:</dt>
            <dd className="ml-1">
              <a
                href={work.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center ${BRONZE_COLOR} hover:text-amber-300 hover:underline break-all`} // Use BRONZE_COLOR
              >
                <span>Visit Source</span>
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" /> {/* Slightly larger icon */}
              </a>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
};

export default WorkDetails;
