// src/components/KeyInfo.jsx
import React from 'react';
// Removed unused ExternalLink import
// Removed unused Link import (unless needed for factor links later)
import { BRONZE_COLOR } from './themeconstants'; // Ensure path is correct

const KeyInfo = ({ info }) => {
  // Helper function to display N/A for null or undefined values
  const displayValue = (value, suffix = '') => (value !== null && typeof value !== 'undefined' ? `${value}${suffix}` : 'N/A');

  // Safely get the crime name using optional chaining
  const crimeName = info?.crimeCategory?.crime_name; // Added optional chaining for info

  // Check if contributingFactors exists and is a non-empty array
  const hasContributingFactors = info?.contributingFactors && Array.isArray(info.contributingFactors) && info.contributingFactors.length > 0; // Added optional chaining for info

  // REFACTOR: Removed background, border, and rounded-lg from the aside element.
  // These styles should be applied by the container div in the page layout.
  // Kept internal padding (p-4).
  return (
    <aside aria-label="Key Case Information" className="p-4">
      <h3 className={`text-lg font-semibold ${BRONZE_COLOR} mb-3`}>Key Information</h3>
      {/* Use a definition list for better semantics */}
      <dl className="space-y-1 text-sm text-gray-300">
        <div>
          <dt className="inline font-semibold">State:</dt>
          {/* Use schema field: caseLocationState */}
          <dd className="inline ml-1">{displayValue(info?.caseLocationState)}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">County:</dt>
          {/* Use schema field: caseLocationCounty */}
          <dd className="inline ml-1">{displayValue(info?.caseLocationCounty)}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Conviction Year:</dt>
          {/* Use schema field: convictionYear */}
          <dd className="inline ml-1">{displayValue(info?.convictionYear)}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Status:</dt>
          {/* Use schema field: status. Display exonerationOrReleaseYear conditionally */}
          <dd className="inline ml-1">
            {displayValue(info?.status)}
            {info?.exonerationOrReleaseYear ? ` (${info.exonerationOrReleaseYear})` : ''}
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold">Time Served:</dt>
          {/* Use schema field: timeServedYears */}
          <dd className="inline ml-1">{displayValue(info?.timeServedYears, ' years')}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Crime Category:</dt>
          {/* Display crime name from the included crimeCategory relation */}
          <dd className="inline ml-1">{displayValue(crimeName)}</dd>
        </div>
        <div>
          <dt className="font-semibold">Contributing Factors:</dt>
          <dd className="ml-1">
            {hasContributingFactors ? (
              <ul className="list-disc list-inside mt-1">
                {/* Map over the included contributingFactors array */}
                {info.contributingFactors.map(factor => (
                  // Use factor.id and factor.name from the schema model
                  // TODO: Add link to factor page if available in future
                  <li key={factor.id}>
                    {factor.name || 'Unnamed Factor'}
                  </li>
                ))}
              </ul>
            ) : (
              // Display N/A if no factors are present or included
              'N/A'
            )}
          </dd>
        </div>
      </dl>
    </aside>
  );
};

export default KeyInfo;
