import React from 'react';
import { ExternalLink } from 'lucide-react'; // Import icon for external links

// Assuming BRONZE_COLOR is defined elsewhere
import { BRONZE_COLOR } from './themeconstants.js';

// Helper function to display N/A for null/undefined/empty strings
const displayValue = (value, suffix = '') => {
  // Check for null, undefined, or empty string
  if (value === null || typeof value === 'undefined' || value === '') {
    return 'N/A';
  }
  return `${value}${suffix}`;
};

// Displays metadata based on the MediaWork schema model
const WorkMetadata = ({ work }) => {
  // Ensure 'work' prop exists, provide fallback if not
  if (!work) {
    return (
      <aside aria-label="Work Metadata" className="p-4 border border-gray-700 rounded-lg bg-gray-800 mb-8">
        <h3 className={`text-lg font-semibold ${BRONZE_COLOR} mb-3`}>Details</h3>
        <p className="text-sm text-gray-400">Metadata not available.</p>
      </aside>
    );
  }

  return (
    <aside aria-label="Work Metadata" className="p-4 border border-gray-700 rounded-lg bg-gray-800 mb-8">
      <h3 className={`text-lg font-semibold ${BRONZE_COLOR} mb-3`}>Details</h3>
      {/* Use definition list for key-value pairs */}
      <dl className="space-y-2 text-sm text-gray-300">

        {/* Published/Released Year */}
        {/* Uses schema field: publicationOrReleaseYear */}
        <div>
          <dt className="font-semibold">Published/Released:</dt>
          <dd className="ml-1">{displayValue(work.publicationOrReleaseYear)}</dd>
        </div>

        {/* Publisher/Network */}
        {/* Uses schema field: publisherOrNetwork */}
        {/* Displayed generally, not tied to specific workType */}
        <div>
          <dt className="font-semibold">Publisher/Network:</dt>
          <dd className="ml-1">{displayValue(work.publisherOrNetwork)}</dd>
        </div>

        {/* Focus/Theme */}
        {/* Uses schema field: focusOrTheme */}
        {work.focusOrTheme && ( // Only display if field has content
          <div>
            <dt className="font-semibold">Focus/Theme:</dt>
            <dd className="ml-1 whitespace-pre-wrap">{work.focusOrTheme}</dd>
          </div>
        )}

        {/* Availability Notes */}
        {/* Uses schema field: availabilityNotes */}
        {work.availabilityNotes && ( // Only display if field has content
          <div>
            <dt className="font-semibold">Availability:</dt>
            <dd className="ml-1 whitespace-pre-wrap">{work.availabilityNotes}</dd>
          </div>
        )}

        {/* Source URL */}
        {/* Uses schema field: sourceUrl */}
        {work.sourceUrl && ( // Only display if field has content
          <div>
            <dt className="font-semibold">Source Link:</dt>
            <dd className="ml-1">
              <a
                href={work.sourceUrl}
                target="_blank" // Open in new tab
                rel="noopener noreferrer" // Security best practice for target="_blank"
                className="inline-flex items-center text-amber-500 hover:text-amber-400 hover:underline break-all" // Added break-all for long URLs
              >
                <span>Visit Source</span>
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </dd>
          </div>
        )}

        {/* Removed 'Studio' and 'Runtime' as they are not in the MediaWork schema */}

      </dl>
    </aside>
  );
};

export default WorkMetadata;
