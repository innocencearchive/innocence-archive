// src/components/OipKeyInfo.jsx
import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react'; // Icons for loading/error states

// --- Import Theme Constants ---
import { BRONZE_COLOR } from './themeconstants'; // Assuming themeconstants.js is in the same directory

/**
 * OipKeyInfo Component
 * Displays key-value pairs of information for an Other Involved Person (OIP).
 * Designed to be used within a styled container (e.g., a sidebar with background/padding).
 * Handles loading and error states.
 *
 * Props:
 * - title: String for the section title (e.g., "Key Facts").
 * - icon: React component for the title icon (e.g., Info from lucide-react).
 * - data: Object where keys are labels and values are the data points to display.
 * - isLoading: Boolean indicating if the parent component is loading data.
 * - error: String containing an error message, or null/undefined.
 * - emptyMessage: String to display if data is empty (defaults if not provided).
 */
const OipKeyInfo = ({
    title = "Information", // Default title
    icon: IconComponent, // Expect the icon component itself as a prop
    data = {},
    isLoading = false,
    error = null,
    emptyMessage = "No key information available."
}) => {

    // Determine if the data object is effectively empty
    const isDataEmpty = !data || Object.keys(data).length === 0 || Object.values(data).every(val => !val || val === 'N/A');

    return (
        <div>
            {/* Title Section */}
            <h3 className={`text-xl font-semibold ${BRONZE_COLOR} mb-4 flex items-center`}>
                {IconComponent && <IconComponent className="mr-2 flex-shrink-0 h-5 w-5" />}
                {title}
            </h3>

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center text-gray-400 text-sm py-4">
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    <span>Loading info...</span>
                </div>
            )}

            {/* Error State */}
            {!isLoading && error && (
                <div className="flex items-center text-red-400 text-sm py-4">
                   <AlertTriangle className="mr-2 flex-shrink-0 h-4 w-4" />
                   <span>Error: {typeof error === 'string' ? error : 'Could not load information.'}</span>
                </div>
            )}

            {/* Empty State (After loading, no error, but no data) */}
            {!isLoading && !error && isDataEmpty && (
                 <p className="text-sm text-gray-400 italic pl-1 py-4">{emptyMessage}</p>
            )}

            {/* Data Display List */}
            {!isLoading && !error && !isDataEmpty && (
                <dl className="space-y-2 text-sm">
                    {Object.entries(data).map(([key, value]) => {
                        // Don't render if value is null, undefined, or explicitly 'N/A' (unless it's the only data)
                        if (!value || value === 'N/A') {
                            return null;
                        }
                        return (
                            <div key={key} className="flex flex-wrap">
                                <dt className="w-1/3 font-semibold text-gray-400 mr-1">{key}:</dt>
                                <dd className="flex-1 text-gray-200">{value}</dd>
                            </div>
                        );
                    })}
                </dl>
            )}
        </div>
    );
};

export default OipKeyInfo;
