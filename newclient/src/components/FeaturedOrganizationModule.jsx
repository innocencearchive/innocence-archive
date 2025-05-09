// src/components/FeaturedOrganizationModule.jsx
import React from 'react';
import { Link } from 'react-router-dom'; // Import Link for internal navigation
import { Building, ExternalLink } from 'lucide-react'; // Keep icons
import ModuleCard from './ModuleCard'; // Assuming ModuleCard handles the seeMoreLink prop
import { BRONZE_COLOR } from './themeConstants'; // If ModuleCard doesn't handle this itself

/**
 * FeaturedOrganizationModule Component
 *
 * Displays information about a featured organization within a ModuleCard.
 * Expects an 'Organization' object as the 'org' prop.
 *
 * @param {object} props - Component props.
 * @param {object|null} props.org - The Organization object fetched from the backend, or null.
 */
const FeaturedOrganizationModule = ({ org }) => {
  // If no organization data is provided, render a placeholder or nothing
  if (!org) {
    // Return null or a placeholder card structure if needed for grid layout
    return (
       <ModuleCard title="Featured Organization" icon={Building}>
           <p className="text-gray-400 text-sm italic">No featured organization available.</p>
       </ModuleCard>
     );
    // return null;
  }

  // Use org.notes for description, provide fallback
  const displayDescription = org.notes ?? 'No description available.';
  // Use org.website for the external link
  const websiteLink = org.website;

  return (
    <ModuleCard
      title="Featured Organization"
      icon={Building}
      // Pass the actual website URL to the seeMoreLink prop
      // ModuleCard should ideally handle hiding this link if websiteLink is null/undefined
      seeMoreLink={websiteLink}
      seeMoreText="Visit Website"
    >
      {/* Content that goes INSIDE the ModuleCard */}
      {/* Display Organization Name */}
      <p className="font-medium text-gray-100 mb-1">{org.name ?? 'Unnamed Organization'}</p>
      {/* Display Organization Description (from notes) */}
      <p className="text-gray-300 text-sm mb-3">{displayDescription}</p>

      {/* Add the INTERNAL link to the org's profile page */}
      {org.id && ( // Only show if the org has an ID
        <Link
          to={`/organization/${org.id}`} // Link to the internal organization page
          className={`text-sm ${BRONZE_COLOR} hover:text-amber-400 hover:underline flex items-center`}
        >
          View Details
          {/* Using ExternalLink icon here might be confusing, consider changing or removing */}
          <ExternalLink size={14} className="ml-1" />
        </Link>
      )}
      {/* End of content inside ModuleCard */}
    </ModuleCard>
  );
};

export default FeaturedOrganizationModule;
