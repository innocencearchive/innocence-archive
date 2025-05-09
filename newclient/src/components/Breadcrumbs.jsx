// src/components/Breadcrumbs.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react'; // Assuming lucide-react

/**
 * Reusable Breadcrumbs Component
 * @param {Array} items - Array of breadcrumb item objects.
 * Each object should have:
 * - label: string (Text to display)
 * - link: string (Optional: URL path for the link. Last item usually omits this)
 */
const Breadcrumbs = ({ items = [] }) => {
  // Ensure items is always an array
  const validItems = Array.isArray(items) ? items : [];

  return (
    <nav aria-label="Breadcrumb" className="py-3 px-4 md:px-8 text-sm text-gray-400">
      <ol className="list-none p-0 inline-flex flex-wrap"> {/* Added flex-wrap for responsiveness */}
        {validItems.map((item, index) => (
          <li key={index} className="flex items-center">
            {/* Render Link if 'link' is provided AND it's not the last item */}
            {(item.link && index < validItems.length - 1) ? (
              <Link to={item.link} className="hover:text-amber-500 transition-colors">
                {item.label}
              </Link>
            ) : (
              // Render plain text for the last item or items without a link
              <span className={index === validItems.length - 1 ? "text-gray-50" : ""}>
                {item.label}
              </span>
            )}

            {/* Render separator if it's not the last item */}
            {index < validItems.length - 1 && (
              <ChevronRight size={16} className="mx-1 flex-shrink-0" />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;

// --- Example Usage (e.g., inside MediaItemPage.jsx) ---
/*
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs'; // Import the reusable component
// ... other imports and component logic ...

function MediaItemPage() {
  const { id } = useParams();
  const [itemData, setItemData] = useState(null);
  // ... loading, error states, useEffect to fetch itemData ...

  // --- Construct the breadcrumb items array ---
  // This would be built dynamically based on fetched itemData
  const breadcrumbItems = [
    { label: "Home", link: "/" },
    { label: "Media Archive", link: "/media" } // Example link to a media index page
  ];

  if (itemData && itemData.parentWork) {
    breadcrumbItems.push({
      label: itemData.parentWork.title,
      link: `/work/${itemData.parentWork.id}` // Link to the parent work page
    });
  }

  if (itemData) {
     breadcrumbItems.push({
       label: itemData.title // The current item - no link needed
     });
  } else if (loading) {
      breadcrumbItems.push({ label: "Loading..." });
  } else {
       breadcrumbItems.push({ label: "Item" }); // Fallback if no data yet
  }


  if (loading) return <div>Loading...</div>; // Basic loading state
  if (!itemData) return <div>Item not found.</div>; // Basic error/not found state

  return (
    <>
      <Breadcrumbs items={breadcrumbItems} /> // Use the component, pass the items array

      <div className="max-w-4xl mx-auto px-4 md:px-8 mt-6">
        { // Render the rest of the MediaItemPage content... }
        <h1>{itemData.title}</h1>
        { // ... }
      </div>
    </>
  );
}

export default MediaItemPage;
*/

