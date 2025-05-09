// src/components/RelatedPeopleList.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Loader2, AlertTriangle } from 'lucide-react'; // Using Users icon

// --- Import Theme Constants ---
import { BRONZE_COLOR } from './themeconstants'; // Assuming themeconstants.js is in the same directory

// --- Helper Functions (Consider moving to a shared utils file) ---
const formatStatus = (status) => {
    if (!status) return null;
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const formatRole = (role) => {
    if (!role) return null;
    return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

/**
 * RelatedPeopleList Component
 * Renders a list of related people, distinguishing between Wrongfully Convicted (WC)
 * individuals and Other Involved Persons (OIPs). Links to appropriate profile pages.
 * Handles loading and error states.
 * Expects parent container to handle border, padding, and scrolling.
 *
 * Props:
 * - people: An array of person objects. Each object MUST have an 'id', 'firstName',
 * 'lastName', and a 'type' property ('WC' or 'OIP').
 * WC objects should also have 'status'. OIP objects should have 'role'.
 * - isLoading: Boolean indicating if data is loading.
 * - error: String containing error message, or null/undefined if no error.
 * - emptyMessage: String to display if the people array is empty.
 */
const RelatedPeopleList = ({
    people = [],
    isLoading = false,
    error = null,
    emptyMessage = "No related people listed."
}) => {
    const title = "Related People";

    return (
        <div>
            {/* List Heading */}
            <h3 className={`text-lg font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
                <Users className="mr-2 flex-shrink-0 h-5 w-5" />
                {title}
            </h3>

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center text-gray-400 text-sm py-4">
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    <span>Loading people...</span>
                </div>
            )}

            {/* Error State */}
            {!isLoading && error && (
                <div className="flex items-center text-red-400 text-sm py-4">
                   <AlertTriangle className="mr-2 flex-shrink-0 h-4 w-4" />
                   <span>Error: {typeof error === 'string' ? error : 'Could not load people.'}</span>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && (!people || people.length === 0) && (
                 <p className="text-sm text-gray-400 italic pl-1 py-4">{emptyMessage}</p>
            )}

            {/* List Content */}
            {!isLoading && !error && people && people.length > 0 && (
                <ul className="space-y-2 text-sm">
                    {people.map(person => {
                        // Determine properties based on person type
                        const personType = person.type; // Should be 'WC' or 'OIP'
                        const linkPrefix = personType === 'WC' ? '/profile' : '/person';
                        const personName = person.firstName || person.lastName ? `${person.firstName || ''} ${person.lastName || ''}`.trim() : 'Unnamed Person';

                        let displayDetail = null;
                        if (personType === 'WC') {
                            displayDetail = formatStatus(person.status);
                        } else if (personType === 'OIP') {
                            displayDetail = formatRole(person.role);
                        }

                        // Basic validation
                        if (!person.id || !personType) {
                            console.warn("RelatedPeopleList item missing id or type:", person);
                            return null; // Skip rendering invalid items
                        }

                        return (
                            <li key={`${personType}-${person.id}`} className="py-1 border-b border-gray-700 last:border-b-0">
                                {/* Link to the correct profile page type */}
                                <Link
                                    to={`${linkPrefix}/${person.id}`}
                                    className="text-gray-300 hover:text-amber-400 transition-colors block"
                                >
                                    <div>{personName}</div>
                                    {/* Display status for WC or role for OIP */}
                                    {displayDetail && (
                                        <div className="text-xs text-gray-400 mt-0.5">({displayDetail})</div>
                                    )}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default RelatedPeopleList;
