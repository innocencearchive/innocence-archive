/* ========================================================================== */
/* --- File: src/components/MentionedInMediaList.jsx (Refactored v1) ---    */
/* --- Displays list of media items mentioning the organization ---         */
/* ========================================================================== */
import React from 'react';
import { Link } from 'react-router-dom';
import { Tv, BookOpen, Mic, Clapperboard, FileText, Loader2, AlertTriangle } from 'lucide-react'; // Added Loader2, AlertTriangle and specific media icons
import { BRONZE_COLOR } from './themeconstants';

// Helper to get appropriate icon based on MediaItemType or MediaWorkType
// This might need adjustment based on the actual data structure of mediaItems
const getMediaIcon = (type) => {
    // Prioritize MediaItemType if available
    if (type?.includes('EPISODE')) return <Tv size={14} className="mr-1.5 text-gray-400 flex-shrink-0" />;
    if (type?.includes('PODCAST')) return <Mic size={14} className="mr-1.5 text-gray-400 flex-shrink-0" />;
    // Check MediaWorkType
    if (type === 'BOOK' || type === 'BOOK_CONTENT') return <BookOpen size={14} className="mr-1.5 text-gray-400 flex-shrink-0" />;
    if (type?.includes('FILM') || type?.includes('DOCUMENTARY')) return <Clapperboard size={14} className="mr-1.5 text-gray-400 flex-shrink-0" />;
    // Default
    return <FileText size={14} className="mr-1.5 text-gray-400 flex-shrink-0" />;
};

// Helper to determine link path (assumes item has 'id' and potentially 'workId' or a type indicator)
// This logic might need refinement based on your API data structure for media mentions
const getMediaLink = (item) => {
    // Example logic: If it has a workId and itemTitle, link to item, else link to work
    if (item.workId && item.itemTitle) {
        return `/item/${item.id}`; // Link to MediaItemPage
    }
    // If it only has a title (likely a MediaWork) or workId is missing
    return `/work/${item.workId || item.id}`; // Link to MediaWorkPage (fallback to item.id if workId missing)
    // Adjust based on how your API returns media mentions (is it Items or Works?)
};


/**
 * MentionedInMediaList Component
 * Renders a list of media items/works where the organization is mentioned.
 * Handles loading and error states.
 * Expects parent container to handle border, padding, and scrolling.
 *
 * Props:
 * - mediaItems: An array of media item/work objects (e.g., { id, title, itemTitle, workId, itemMediaType, work?.workType }). Structure needs verification.
 * - isLoading: Boolean indicating if data is loading.
 * - error: String containing error message, or null/undefined if no error.
 */
const MentionedInMediaList = ({ mediaItems, isLoading, error }) => {
    const title = "Mentioned In Media";

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center text-gray-400 text-sm py-4">
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    <span>Loading media mentions...</span>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex items-center text-red-400 text-sm py-4">
                   <AlertTriangle className="mr-2 flex-shrink-0 h-4 w-4" />
                   <span>Error: {error}</span>
                </div>
            );
        }

        if (!mediaItems || mediaItems.length === 0) {
            return <p className="text-sm text-gray-400 italic pl-1 py-4">Not mentioned in any indexed media.</p>;
        }

        return (
            <ul className="space-y-2 text-sm">
                {mediaItems.map(item => {
                    // Determine the best title to display (item title or work title)
                    const displayTitle = item.itemTitle || item.title || 'Untitled Media';
                    // Determine the type (item type or work type)
                    const displayType = item.itemMediaType || item.work?.workType || 'UNKNOWN'; // Access nested workType if needed
                    const linkPath = getMediaLink(item);

                    return (
                        <li key={item.id || item.workId} className="flex items-start"> {/* Use unique key */}
                            {getMediaIcon(displayType)}
                            <Link to={linkPath} className="text-gray-300 hover:text-amber-400 transition-colors">
                                {displayTitle}
                                <span className="text-xs text-gray-500 ml-1">({displayType.replace(/_/g, ' ')})</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        );
    };

    return (
        // No outer container/section - parent provides it
        <div>
            <h4 className={`text-md font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
                <Tv className="mr-2 h-4 w-4" /> {/* Using Tv as general media icon for title */}
                {title}
            </h4>
            {renderContent()}
        </div>
    );
};

export default MentionedInMediaList;
