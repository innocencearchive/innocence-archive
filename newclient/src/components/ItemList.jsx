/* ========================================================================== */
/* --- File: src/components/ItemList.jsx (Refactored) ---                   */
/* --- Displays list of items (episodes, etc.) for block layout ---         */
/* ========================================================================== */

import React from 'react';
import ItemListItem from './ItemListItem'; // Renders each item row
import { List } from 'lucide-react';      // Icon for the list heading

// --- Import Theme Constants ---
// Ensure this path is correct relative to src/components/
import { BRONZE_COLOR } from './themeconstants';

/**
 * ItemList Component (Refactored for Block Layout)
 * Renders a list of MediaItems (episodes, articles, book content, etc.)
 * within a container provided by the parent component (e.g., in MediaWorkPage).
 * Expects the parent container to handle border, padding, and scrolling.
 *
 * Props:
 * - items: An array of MediaItem objects.
 * - itemTypeLabel: A string label for the list title (e.g., "Episodes", "Items"). Defaults to "Items".
 */
const ItemList = ({ items, itemTypeLabel = "Items" }) => {

  // Render content directly, parent provides container styling (border, p-4, scroll, etc.)
  return (
    <div>
      {/* List Heading */}
      <h3 className={`text-xl font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
        <List className="mr-2 flex-shrink-0" size={20} />
        {itemTypeLabel} {/* e.g., "Episodes" */}
      </h3>

      {/* List or Empty State Message */}
      {(!items || items.length === 0) ? (
        // Display message if no items are available
        <p className="text-sm text-gray-400 italic pl-1"> {/* Indent slightly */}
            No {itemTypeLabel.toLowerCase()} listed for this work.
        </p>
      ) : (
        // Render the list if items exist
        // Remove ul styling (bg, padding, border); parent container handles it
        <ul className="space-y-1"> {/* Add some space between items */}
          {items.map(item => (
            // Render ItemListItem for each item
            // ItemListItem handles its own styling (like bottom border)
            <ItemListItem key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
};

export default ItemList;
