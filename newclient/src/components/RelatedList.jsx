// src/components/RelatedList.jsx
import React from 'react';
import { Link } from 'react-router-dom';
// Removed unused import: import getTypeIcon from './getTypeIcon';
// Removed unused import: import { BookOpen } from 'lucide-react';
import { BRONZE_COLOR } from './themeconstants'; // Assuming this is used and defined

/**
 * Reusable component to display related lists (e.g., Individuals, Factors, MediaItems).
 * Handles loading and error states passed from the parent.
 * Adapts display based on item properties using existing logic or a specified nameField.
 *
 * Props:
 * - title: Title for the list section (string).
 * - icon: Icon component to display next to the title.
 * - items: Array of data objects (e.g., Individual, ContributingFactor, MediaItem).
 * - linkPrefix: The base path for the link URL (e.g., "/profile", "/factor", "/item").
 * - nameField (optional): The specific property name on the item object to use for display text (string).
 * If not provided, defaults to using firstName/lastName or name.
 * - isLoading (optional): Boolean indicating if data is currently loading.
 * - error (optional): String containing an error message if fetching failed.
 */
const RelatedList = ({ title, icon: Icon, items, linkPrefix, nameField = null, isLoading, error }) => { // Added nameField prop

  // 1. Handle Loading State
  if (isLoading) {
    return (
      <section aria-label={title} className="mb-8 opacity-75">
        <h3 className={`text-lg font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
          {Icon && <Icon className="mr-2" size={20} />} {title}
        </h3>
        <p className="text-sm text-gray-400 ml-5">Loading...</p>
      </section>
    );
  }

  // 2. Handle Error State
  if (error) {
    return (
      <section aria-label={title} className="mb-8 opacity-75">
        <h3 className={`text-lg font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
           {Icon && <Icon className="mr-2" size={20} />} {title}
        </h3>
        <p className="text-sm text-red-400 ml-5">Error: {error}</p>
      </section>
    );
  }

  // 3. Handle Empty State (after loading and no error)
  if (!items || items.length === 0) {
     return (
      <section aria-label={title} className="mb-8">
        <h3 className={`text-lg font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
           {Icon && <Icon className="mr-2" size={20} />} {title}
        </h3>
        <p className="text-sm text-gray-400 ml-5">None specified.</p>
      </section>
    );
  }

  // 4. Render the List if items exist
  return (
    <section aria-label={title} className="mb-8">
       <h3 className={`text-lg font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
         {Icon && <Icon className="mr-2" size={20} />} {title}
       </h3>
       <ul className="list-disc list-inside text-sm text-gray-300 space-y-1 ml-5">
         {items.map(item => {
           // *** MODIFICATION START: Determine display name logic ***
           let displayName = 'Unnamed Item'; // Default fallback

           if (nameField && item.hasOwnProperty(nameField) && item[nameField]) {
               // Use the specified nameField if provided and exists on the item
               displayName = item[nameField];
           } else if (item.firstName && item.lastName) {
               // Fallback for Individuals
               displayName = `${item.firstName} ${item.lastName}`;
           } else if (item.name) {
               // Fallback for Factors (or other objects with 'name')
               displayName = item.name;
           }
           // If none of the above match, displayName remains 'Unnamed Item'
           // *** MODIFICATION END ***

           // Ensure item has an ID for key and link
           if (typeof item.id === 'undefined') {
               console.warn("RelatedList item missing ID:", item);
               return null; // Skip rendering item without ID
           }

           return (
             <li key={item.id}>
               {/* Link uses the provided linkPrefix */}
               <Link to={`${linkPrefix}/${item.id}`} className="hover:text-amber-500 hover:underline">
                 {displayName} {/* Use the determined display name */}
               </Link>
             </li>
           );
         })}
       </ul>
    </section>
  );
};

export default RelatedList;
