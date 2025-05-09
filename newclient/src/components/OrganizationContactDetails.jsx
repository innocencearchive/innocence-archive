/* ========================================================================== */
/* --- File: src/components/OrganizationContactDetails.jsx (Refactored v1) */
/* --- Displays contact details for an Organization within the sidebar ---  */
/* ========================================================================== */
import React from 'react';
import { Globe, MapPin } from 'lucide-react'; // Keep relevant icons
import { BRONZE_COLOR } from './themeconstants'; // Adjust path if necessary

/**
 * Displays contact/location details for an Organization.
 * Designed to be placed inside a styled container (e.g., the gray sidebar).
 *
 * Props:
 * - org: An Organization object (fetched from the API).
 */
const OrganizationContactDetails = ({ org }) => {
    // Ensure 'org' prop exists, provide fallback if not
    if (!org) {
        return (
            <div>
                <h3 className={`text-lg font-semibold ${BRONZE_COLOR} mb-3 border-b border-gray-600 pb-2`}>Contact Details</h3>
                <p className="text-sm text-gray-400 italic mt-3">Details not available.</p>
            </div>
        );
    }

    // Construct location string from available fields
    const locationString = [org.locationCity, org.locationState, org.locationCountry]
                            .filter(Boolean) // Remove null/undefined/empty strings
                            .join(', ');

    return (
        // No outer container/aside element - parent provides it (bg-gray-800, padding etc.)
        <div>
            <h3 className={`text-lg font-semibold ${BRONZE_COLOR} mb-4 border-b border-gray-600 pb-2`}>Contact Details</h3>
            <dl className="space-y-3 text-sm text-gray-300"> {/* Use definition list */}

                {/* Website */}
                {org.website ? (
                    <div>
                         <dt className="font-semibold text-gray-400 inline-flex items-center">
                            <Globe size={14} className="mr-1.5" /> Website:
                         </dt>
                         <dd className="ml-1 mt-0.5"> {/* Margin top for alignment */}
                            <a
                                href={org.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center ${BRONZE_COLOR} hover:underline break-all`}
                            >
                                <span>{org.website}</span>
                                {/* Optional: Add ExternalLink icon if desired */}
                            </a>
                         </dd>
                    </div>
                ) : (
                     <div>
                         <dt className="font-semibold text-gray-400 inline-flex items-center">
                            <Globe size={14} className="mr-1.5" /> Website:
                         </dt>
                         <dd className="ml-1 mt-0.5 text-gray-400 italic">N/A</dd>
                     </div>
                )}

                {/* Location */}
                {locationString ? (
                    <div>
                        <dt className="font-semibold text-gray-400 inline-flex items-center">
                            <MapPin size={14} className="mr-1.5" /> Location:
                        </dt>
                        <dd className="ml-1 mt-0.5">{locationString}</dd>
                    </div>
                 ) : (
                     <div>
                         <dt className="font-semibold text-gray-400 inline-flex items-center">
                            <MapPin size={14} className="mr-1.5" /> Location:
                         </dt>
                         <dd className="ml-1 mt-0.5 text-gray-400 italic">N/A</dd>
                     </div>
                 )}

                {/* Add other relevant details from org object if needed, e.g., Type */}
                 {org.type && (
                    <div>
                        <dt className="font-semibold text-gray-400 inline-flex items-center">
                             Type: {/* Maybe add an icon? Building? */}
                        </dt>
                        <dd className="ml-1 mt-0.5">{formatOrgType(org.type)}</dd> {/* Assuming formatOrgType is available or passed */}
                    </div>
                 )}


            </dl>
        </div>
    );
};

// Helper function (can be moved to utils if used elsewhere)
const formatOrgType = (orgType) => {
    if (!orgType) return 'Unknown Type';
    return orgType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};


export default OrganizationContactDetails;
