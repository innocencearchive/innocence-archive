/* ========================================================================== */
/* --- File: src/components/StoryNarrative.jsx (Updated) ---                */
/* --- Displays group info separately from narrative sections ---           */
/* ========================================================================== */

import React from 'react';
// Removed unused imports: ExternalLink, Link
import { BRONZE_COLOR } from './themeconstants'; // Ensure this path is correct

/**
 * StoryNarrative Component
 * Renders the narrative sections for an individual's profile.
 * Now separates and distinctly displays associated group information if provided.
 *
 * Props:
 * - storySections: An array of section objects.
 * Each object should have: id, subheading, text.
 * Sections representing group info should also have `isGroupInfo: true`.
 */
const StoryNarrative = ({ storySections }) => {
  // Separate group info sections from regular narrative sections
  const groupInfoSections = storySections.filter(section => section.isGroupInfo);
  const narrativeSections = storySections.filter(section => !section.isGroupInfo);

  return (
    <article aria-label="Case Narrative" className="text-gray-300 leading-relaxed">
      {/* Main Heading */}
      <h2 className="text-xl font-semibold text-gray-100 mb-4 border-b border-gray-700 pb-2">
        The Story
      </h2>

      {/* Group Information Section (Rendered if groups exist) */}
      {groupInfoSections.length > 0 && (
        <div className="mb-6 p-3 bg-gray-800 rounded-md shadow-sm"> {/* Added subtle background */}
          {groupInfoSections.map(section => (
            <div key={section.id}>
              {/* Using a slightly different style for group subheading */}
              <h3 className={`text-md font-semibold ${BRONZE_COLOR} mb-1`}>
                {section.subheading}
              </h3>
              {/* Displaying group names */}
              <p className="text-sm text-gray-400">
                {section.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Narrative Sections (Using prose for rich text styling) */}
      {/* Only apply prose classes if there are narrative sections */}
      {narrativeSections.length > 0 ? (
         <div className="prose prose-invert prose-sm md:prose-base max-w-none">
            {narrativeSections.map(section => (
            <div key={section.id} className="mb-6">
                {/* Standard narrative subheading */}
                <h3 className={`text-lg font-semibold ${BRONZE_COLOR} mb-2`}>
                {section.subheading}
                </h3>
                {/* Standard narrative text */}
                <p>{section.text}</p>
            </div>
            ))}
        </div>
        ) : (
        // Optional: Display a message if only group info exists and no narrative
        groupInfoSections.length > 0 && <p className="text-sm text-gray-500 italic mt-4">No narrative summary available.</p>
        )
      }

       {/* Display message if NO sections exist at all */}
       {storySections.length === 0 && (
         <p className="text-sm text-gray-500 italic">No story information available.</p>
       )}

    </article>
  );
};

export default StoryNarrative;
