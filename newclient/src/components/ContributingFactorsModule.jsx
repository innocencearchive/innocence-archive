// src/components/ContributingFactorsModule.jsx
import React from 'react';
// Removed unused ExternalLink import
import { Link } from 'react-router-dom'; // Use Link for internal routing
import { Info } from 'lucide-react'; // Keep Info icon
import ModuleCard from './ModuleCard'; // Assuming it's in the same directory

/**
 * ContributingFactorsModule Component
 *
 * Displays a list of featured contributing factors within a ModuleCard.
 * Links each factor to its specific detail page.
 *
 * @param {object} props - Component props.
 * @param {Array} [props.factors=[]] - An array of ContributingFactor objects fetched from the backend.
 */
const ContributingFactorsModule = ({ factors = [] }) => ( // Default to empty array
  <ModuleCard
    title="Contributing Factors"
    icon={Info}
    // Link to a page listing all factors (create this route if needed)
    seeMoreLink="/factors"
    seeMoreText="Explore All Factors"
  >
    {/* Check if factors array has content */}
    {factors && factors.length > 0 ? (
      // Use a simple list for factors
      <ul className="space-y-1 text-sm">
        {factors.map(factor => {
           // Ensure factor has an ID for key and link
           if (typeof factor.id === 'undefined') {
               console.warn("ContributingFactorsModule item missing ID:", factor);
               return null; // Skip rendering item without ID
           }
           return (
                <li key={factor.id}>
                    {/* *** MODIFICATION START: Use React Router Link *** */}
                    {/* Link to the specific factor's page */}
                    <Link
                        to={`/factor/${factor.id}`} // Assumes route is /factor/:id
                        className="text-gray-300 hover:text-amber-500 hover:underline"
                    >
                        {factor.name ?? 'Unnamed Factor'} {/* Display factor name */}
                    </Link>
                    {/* *** MODIFICATION END *** */}
                </li>
           );
        })}
      </ul>
    ) : (
      // Fallback message if no factors are provided
      <p className="text-gray-400 text-sm italic">No featured factors available.</p>
    )}
  </ModuleCard>
);

export default ContributingFactorsModule;
