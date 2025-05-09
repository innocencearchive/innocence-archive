/* ========================================================================== */
/* --- File: src/components/RelatedMediaList.jsx (Refactored v4) ---        */
/* --- Displays list of related media items (M2M relation) ---            */
/* --- Implements dynamic linking based on media type ---                 */
/* ========================================================================== */
import React from 'react';
import { Link } from 'react-router-dom';
import { ListTree, Tv, BookOpen, Mic, Clapperboard, FileText, Loader2, AlertTriangle } from 'lucide-react'; // Use ListTree for title, added specific icons + state icons
import { BRONZE_COLOR } from './themeconstants';

// Helper to get appropriate icon based on MediaItemType or MediaWorkType
const getMediaIcon = (item) => {
    // Determine type based on item's own type or its parent work's type
    const itemType = item?.itemMediaType;
    const workType = item?.work?.workType;
    const type = itemType || workType || 'UNKNOWN';

    // Prioritize specific item types first
    if (itemType === 'PODCAST_EPISODE') return <Mic size={14} className="mr-1.5 text-gray-400 flex-shrink-0" />;
    if (itemType === 'TV_EPISODE') return <Tv size={14} className="mr-1.5 text-gray-400 flex-shrink-0" />;
    if (itemType === 'BOOK_CONTENT' || itemType === 'BOOK_CHAPTER') return <BookOpen size={14} className="mr-1.5 text-gray-400 flex-shrink-0" />;
    if (itemType === 'FILM_CONTENT' || itemType === 'DOCUMENTARY_CONTENT') return <Clapperboard size={14} className="mr-1.5 text-gray-400 flex-shrink-0" />;

    // Fallback to work types if item type is generic or missing
    if (workType === 'PODCAST_SERIES') return <Mic size={14} className="mr-1.5 text-gray-400 flex-shrink-0" />;
    if (workType === 'TV_SERIES') return <Tv size={14} className="mr-1.5 text-gray-400 flex-shrink-0" />;
    if (workType === 'BOOK') return <BookOpen size={14} className="mr-1.5 text-gray-400 flex-shrink-0" />;
    if (workType === 'FILM' || workType === 'DOCUMENTARY' || workType === 'DOCUSERIES') return <Clapperboard size={14} className="mr-1.5 text-gray-400 flex-shrink-0" />;

    // Default icon
    return <FileText size={14} className="mr-1.5 text-gray-400 flex-shrink-0" />;
};


// **UPDATED Helper to determine link path based on media type**
const getMediaLink = (item) => {
    const itemId = item?.id;
    const itemType = item?.itemMediaType;
    const workId = item?.work?.id;
    const workType = item?.work?.workType;

    // --- Priority 1: Link to Combined Page for Books/Films/Docs ---
    // Check if the item itself is content OR if the parent work is the primary type
    if (itemType === 'BOOK_CONTENT' || itemType === 'FILM_CONTENT' || itemType === 'DOCUMENTARY_CONTENT' || workType === 'BOOK' || workType === 'FILM' || workType === 'DOCUMENTARY') {
        if (workId) {
            return `/combined/${workId}`; // Use WORK ID for combined page
        } else {
            console.error(`RelatedMediaList: Missing workId for combined type (${itemType || workType}) item ID ${itemId}. Cannot generate correct link.`);
            // Fallback to item page might be better than '#' if workId is missing
            return itemId ? `/item/${itemId}` : '#';
        }
    }

    // --- Priority 2: Link to specific MediaItem page (Episodes, Chapters etc.) ---
    // Check if it has an item ID and is NOT a primary content type handled above
    if (itemId && itemType && itemType !== 'BOOK_CONTENT' && itemType !== 'FILM_CONTENT' && itemType !== 'DOCUMENTARY_CONTENT') {
        return `/item/${itemId}`;
    }

    // --- Priority 3: Link to MediaWork page (Series, Podcast Series etc.) ---
    // Check if it has a work ID and is NOT a primary work type handled above
    if (workId && workType && workType !== 'BOOK' && workType !== 'FILM' && workType !== 'DOCUMENTARY') {
         return `/media/${workId}`; // Use WORK ID for work page
    }

    // --- Fallback: If it's somehow just a work object passed directly (less likely) ---
    // Check if 'item' itself has an ID and a workType (and wasn't caught above)
    if (item?.id && item?.workType && item.workType !== 'BOOK' && item.workType !== 'FILM' && item.workType !== 'DOCUMENTARY') {
         return `/media/${item.id}`; // Use ITEM ID as WORK ID here
    }

    // If no suitable link can be determined
    console.warn("Could not determine link for related media item:", item);
    return "#"; // Default fallback
};

// Helper to format type string (more descriptive)
const formatMediaTypeString = (item) => {
     const itemType = item?.itemMediaType;
     const workType = item?.work?.workType;

     // Prioritize specific item type if available
     if (itemType && itemType !== 'UNKNOWN' && itemType !== 'OTHER') {
         return itemType.replace(/_/g, ' ').toLowerCase();
     }
     // Fallback to work type if item type is generic or missing
     if (workType && workType !== 'UNKNOWN' && workType !== 'OTHER') {
         return workType.replace(/_/g, ' ').toLowerCase();
     }
     return 'media'; // Generic fallback
}

/**
 * RelatedMediaList Component
 * Renders a list of related media items (e.g., part 2, related case).
 * Handles loading and error states.
 * Expects parent container to handle border, padding, and scrolling.
 *
 * Props:
 * - mediaItems: An array of MediaItem objects (MUST include parent 'work' object with id and workType).
 * - isLoading: Boolean indicating if data is loading.
 * - error: String containing error message, or null/undefined if no error.
 */
const RelatedMediaList = ({ mediaItems, isLoading, error }) => {
    const title = "Related Media Items";

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center text-gray-400 text-sm py-4">
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    <span>Loading related media...</span>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex items-center text-red-400 text-sm py-4">
                   <AlertTriangle className="mr-2 flex-shrink-0 h-4 w-4" />
                   <span>Error: {typeof error === 'string' ? error : 'Could not load related media.'}</span>
                </div>
            );
        }

        if (!mediaItems || mediaItems.length === 0) {
            return <p className="text-sm text-gray-400 italic pl-1 py-4">No related media items listed.</p>;
        }

        return (
            <ul className="space-y-2 text-sm">
                {mediaItems.map(item => {
                    // Determine the best title to display (item title or work title)
                    // **Crucial**: Assumes the 'item' objects in mediaItems have 'id' and potentially 'itemTitle',
                    // and nested 'work' object with 'id', 'title', and 'workType'.
                    const displayTitle = item.itemTitle || item?.work?.title || 'Untitled Media';
                    const linkPath = getMediaLink(item); // Use the updated helper
                    const typeString = formatMediaTypeString(item); // Use the updated helper

                    // Ensure item has a unique key (using item.id)
                    if (!item.id) {
                         console.warn("RelatedMediaList item missing ID:", item);
                         return null; // Skip rendering if no ID
                    }

                    return (
                        <li key={item.id} className="flex items-start"> {/* Use unique item ID as key */}
                            {getMediaIcon(item)} {/* Icon based on type */}
                            {linkPath !== "#" ? (
                                <Link to={linkPath} className="text-gray-300 hover:text-amber-400 transition-colors">
                                    {displayTitle}
                                    {/* Display formatted type string */}
                                    <span className="text-xs text-gray-500 ml-1 capitalize">({typeString})</span>
                                </Link>
                            ) : (
                                // Render without link if path couldn't be determined
                                <span className="text-gray-300">
                                    {displayTitle}
                                    <span className="text-xs text-gray-500 ml-1 capitalize">({typeString})</span>
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        );
    };

    return (
        <div>
            <h4 className={`text-md font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
                <ListTree className="mr-2 h-4 w-4" />
                {title}
            </h4>
            {renderContent()}
        </div>
    );
};

export default RelatedMediaList;
