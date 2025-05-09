// src/components/ModuleCard.jsx
// Base Module Card Component (Helper for Explore Section)
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

// Assuming theme constants are available, otherwise replace with hex codes
// import { BRONZE_BORDER, BRONZE_COLOR } from './themeconstants'; // Adjust path if needed
const BRONZE_COLOR = 'text-[#af7a56]'; // Example

const ModuleCard = ({ title, icon: Icon, children, seeMoreLink, seeMoreText }) => (
  // Main container: Removed h-full to allow card height to shrink to content.
  <div className="bg-gray-800 p-4 rounded-lg flex flex-col"> {/* REMOVED h-full */}

    {/* Header: Icon + Title */}
    {/* Alignment should be top-left by default in flex-col */}
    <h3 className={`font-serif uppercase ${BRONZE_COLOR} text-lg mb-2 flex items-center`}>
      {/* Render icon if provided */}
      {Icon && <Icon className="mr-2 flex-shrink-0" size={20} />}
      {title}
    </h3>

    {/* Content Area: Passed as children */}
    {/* Alignment should be top-left by default */}
    <div className="text-gray-300 text-sm mb-2 overflow-y-auto"> {/* Removed flex-grow previously */}
      {children}
    </div>

    {/* Footer: "See More" link */}
    {/* mt-auto pushes this to the bottom relative to sibling content */}
    {seeMoreLink && (
      // Use Link for internal links, regular <a> for external
      seeMoreLink.startsWith('/') ? (
        <Link to={seeMoreLink} className="text-sm text-amber-500 hover:text-amber-400 self-start mt-auto flex items-center">
           {seeMoreText || "See More"}
           <ExternalLink size={14} className="ml-1" />
        </Link>
      ) : (
        <a href={seeMoreLink} className="text-sm text-amber-500 hover:text-amber-400 self-start mt-auto flex items-center" target="_blank" rel="noopener noreferrer">
           {seeMoreText || "See More"} <ExternalLink size={14} className="ml-1" />
        </a>
      )
    )}
  </div>
);

export default ModuleCard;
