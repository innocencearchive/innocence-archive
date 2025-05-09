// src/components/OrganizationsInvolved.jsx
import React from 'react';
// Removed unused ExternalLink import
import { Building } from 'lucide-react';
// Import Link from react-router-dom for internal navigation
import { Link } from 'react-router-dom';
// Assuming theme constants are correctly imported
import { BRONZE_COLOR } from './themeConstants';

/**
 * OrganizationsInvolved Component
 *
 * Displays a list of organizations related to a case, with links to their respective pages.
 *
 * @param {object} props - Component props.
 * @param {Array} [props.organizations=[]] - An array of Organization objects (from backend include).
 */
const OrganizationsInvolved = ({ organizations = [] }) => ( // Default to empty array
   <section aria-labelledby="orgs-title" className="mt-8 max-w-5xl mx-auto">
      <h3 id="orgs-title" className={`text-lg font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
         <Building className="mr-2" size={20} /> Organizations Involved
      </h3>
      {/* Check if organizations array exists and has items */}
      {organizations && organizations.length > 0 ? (
         <ul className="list-disc list-inside text-sm text-gray-300 space-y-1 ml-5"> {/* Added ml-5 for consistent indent */}
           {organizations.map(org => {
                // Ensure org has an ID before rendering
                if (typeof org.id === 'undefined') {
                    console.warn("OrganizationsInvolved item missing ID:", org);
                    return null; // Skip rendering item without ID
                }
                return (
                    <li key={org.id}>
                        {/* *** MODIFICATION START: Use React Router Link *** */}
                        {/* Create an internal link to the organization's page */}
                        <Link
                            to={`/organization/${org.id}`} // Assumes route is /organization/:id
                            className="hover:text-amber-500 hover:underline"
                        >
                            {org.name ?? 'Unnamed Organization'} {/* Display name, provide fallback */}
                        </Link>
                        {/* *** MODIFICATION END *** */}
                    </li>
                );
            })}
         </ul>
       ) : (
         // Display fallback message if no organizations
         <p className="text-gray-400 text-sm italic ml-5"> {/* Added ml-5 for consistent indent */}
            No specific organizations linked to this case yet.
         </p>
       )}
   </section>
 );

 export default OrganizationsInvolved;
