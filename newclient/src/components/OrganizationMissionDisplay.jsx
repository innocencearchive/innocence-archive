/* ========================================================================== */
/* --- File: src/components/OrganizationMissionDisplay.jsx (Refactored v1) */
/* --- Displays the mission/notes for an Organization ---                   */
/* ========================================================================== */
import React from 'react';
import { BRONZE_COLOR } from './themeconstants'; // Import bronze color constant

/**
 * Displays the mission/description (notes field) for an Organization.
 * Designed to be placed inside a styled container (e.g., the bronze-bordered area).
 *
 * Props:
 * - missionText: The mission/notes text (string). Parent provides this from 'orgData.notes'.
 */
const OrganizationMissionDisplay = ({ missionText }) => {
    // Determine fallback text if missionText is empty or null
    const displayMission = missionText || <span className="text-gray-400 italic">No mission statement or description provided.</span>;

    return (
        // No outer container/section element - parent provides it (border, padding etc.)
        <div>
            {/* Apply bronze color to the heading */}
            <h2 className={`text-2xl font-semibold ${BRONZE_COLOR} mb-4`}>Mission / Description</h2>
            {/* Use text-gray-300 for better contrast on black background */}
            <div className="text-gray-300 leading-relaxed space-y-4">
                {/* Display the mission text passed via props, handle line breaks */}
                <p className="whitespace-pre-wrap">{displayMission}</p>
            </div>
        </div>
    );
};

export default OrganizationMissionDisplay;
