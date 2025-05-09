/* ========================================================================== */
/* --- File: src/components/ContributingFactorsList.jsx ---                 */
/* --- Reused from IndividualProfilePage, adapted for MediaWorkPage ---     */
/* ========================================================================== */
import React from 'react';
import { Link } from 'react-router-dom'; // Added Link
import { ListTree, Loader2, AlertTriangle } from 'lucide-react'; // Added Loader2, AlertTriangle

// --- Import Theme Constants ---
import { BRONZE_COLOR } from './themeconstants';

/**
 * ContributingFactorsList Component
 * Renders a list of contributing factors.
 * Handles loading and error states.
 * Expects parent container to handle border, padding, and scrolling.
 *
 * Props:
 * - factors: An array of ContributingFactor objects (should have id, name).
 * - isLoading: Boolean indicating if data is loading.
 * - error: String containing error message, or null/undefined if no error.
 */
const ContributingFactorsList = ({ factors, isLoading, error }) => {
    const title = "Contributing Factors";
    const linkPrefix = "/factor"; // Link destination prefix (adjust if needed)

    return (
        <div>
            {/* List Heading */}
            <h3 className={`text-xl font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
                <ListTree className="mr-2 flex-shrink-0" size={20} />
                {title}
            </h3>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center text-gray-400 text-sm py-4">
                <Loader2 className="animate-spin mr-2" size={16} />
                <span>Loading...</span>
              </div>
            )}

            {/* Error State */}
            {!isLoading && error && (
              <div className="flex items-center text-red-400 text-sm py-4">
                 <AlertTriangle className="mr-2 flex-shrink-0" size={16} />
                 <span>Error: {error}</span>
              </div>
            )}

            {/* Empty State (after loading, no error) */}
            {!isLoading && !error && (!factors || factors.length === 0) && (
              <p className="text-sm text-gray-400 italic pl-1">
                No contributing factors listed.
              </p>
            )}

            {/* List Content */}
            {!isLoading && !error && factors && factors.length > 0 && (
                // Use Link for each factor if a detail page exists
                <ul className="space-y-1 text-sm">
                    {factors.map(factor => (
                        <li key={factor.id} className="py-1 border-b border-gray-700 last:border-b-0">
                            <Link
                                to={`${linkPrefix}/${factor.id}`}
                                className="text-gray-300 hover:text-amber-400 transition-colors"
                            >
                                {factor.name || 'Unnamed Factor'}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ContributingFactorsList;
