import React from 'react';
import { Link } from 'react-router-dom'; // Import Link for navigation

// Assuming getTypeIcon function exists and maps itemMediaType enum values to icons
import getTypeIcon from './getTypeIcon';
// Assuming BRONZE_COLOR is defined elsewhere
import { BRONZE_COLOR } from './themeconstants.js';

/**
 * Displays the header for a Media Item page.
 * Includes the item title, type, and optionally a link back to the parent Media Work.
 *
 * Expects props:
 * - title: The title of the item (string, mapped from schema's itemTitle).
 * - type: The type of the item (string, mapped from schema's itemMediaType enum).
 * - parentWork: The parent MediaWork object (object, included via backend query).
 */
const ItemHeader = ({ title, type, parentWork }) => (
  <div className="mb-6">
    {/* Optional: Link back to parent work */}
    {/* Check if parentWork object exists and has an id */}
    {parentWork?.id && (
       // Link assumes the route for MediaWorkPage is /work/:id
       <Link
          to={`/media/${parentWork.id}`}
          className={`inline-flex items-center text-sm ${BRONZE_COLOR} hover:text-amber-400 mb-1 hover:underline`}
        >
          {/* Display parent work title and type (use workType from schema) */}
          {parentWork.title ?? 'Parent Work'} ({parentWork.workType ?? 'Unknown Type'})
       </Link>
    )}

    {/* Display Item Title */}
    <h1 className="text-3xl md:text-4xl font-bold text-gray-50 mb-2">{title}</h1>

    {/* Display Item Type and Icon */}
    <div className={`inline-flex items-center justify-start text-sm uppercase tracking-wider ${BRONZE_COLOR}`}>
      {/* Assumes getTypeIcon handles the 'type' string (e.g., 'PODCAST_EPISODE') */}
      {getTypeIcon(type)}
      {/* Display the type string */}
      <span className="ml-2">{type}</span>
    </div>
  </div>
);

export default ItemHeader;
