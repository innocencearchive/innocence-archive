import React from 'react';

// Assuming getTypeIcon function exists and maps workType enum values to icons
import getTypeIcon from './getTypeIcon';
// Assuming BRONZE_COLOR is defined elsewhere
import { BRONZE_COLOR } from './themeconstants.js';

/**
 * Displays the main header for a Media Work.
 * Expects props:
 * - title: The title of the work (string).
 * - creator: The creator/author/host of the work (string, mapped from schema's creatorName).
 * - type: The type of the work (string, mapped from schema's workType enum).
 */
const WorkHeader = ({ title, creator, type }) => (
  <div className="mb-6 text-center">
    {/* Display Icon and Type */}
    <div className={`inline-flex items-center justify-center ${BRONZE_COLOR} mb-2`}>
      {/* Assumes getTypeIcon handles the 'type' string (e.g., 'BOOK', 'FILM') */}
      {getTypeIcon(type)}
      {/* Display the type */}
      <span className="text-sm uppercase tracking-wider ml-2">{type}</span>
    </div>
    {/* Display Title */}
    <h1 className="text-3xl md:text-4xl font-bold text-gray-50 mb-2">{title}</h1>
    {/* Display Creator */}
    <p className="text-lg text-gray-400">By: {creator}</p>
  </div>
);

export default WorkHeader;
