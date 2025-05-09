// src/pages/SearchResultsPage.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Loader2, AlertCircle, User, FileText, Building, Link as LinkIcon, BookOpen } from 'lucide-react'; // Added BookOpen

// Import Theme Constants if needed for styling results
import { BRONZE_COLOR } from '../components/themeconstants';

// Helper function to get appropriate icon based on result type
const getResultIcon = (type) => {
    switch (type) {
        case 'individual':
            return <User className="w-5 h-5 mr-2 inline-block text-blue-400" />;
        case 'mediaWork':
            // Specific icon for books if possible (assuming type info is available)
            // This might require more data from backend if just 'mediaWork' is given
            return <FileText className="w-5 h-5 mr-2 inline-block text-green-400" />;
        case 'mediaItem':
            return <FileText className="w-5 h-5 mr-2 inline-block text-green-400" />;
        case 'organization':
            return <Building className="w-5 h-5 mr-2 inline-block text-purple-400" />;
        default:
            return <LinkIcon className="w-5 h-5 mr-2 inline-block text-gray-400" />;
    }
};

// Helper function to format type name for display
const formatTypeName = (type) => {
    if (!type) return '';
    // Simple formatting, adjust as needed
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

function SearchResultsPage() {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q'); // Get the search query 'q'
    const typeFilter = searchParams.get('type'); // *** Get the type filter ***

    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch search results when the query or type filter changes
    useEffect(() => {
        // Determine if we should fetch based on query or type filter
        const shouldFetch = query || typeFilter;

        if (!shouldFetch) {
            // If there's neither query nor type, don't fetch
            setResults([]);
            setError(null);
            setIsLoading(false);
            return;
        }

        const fetchResults = async () => {
            setIsLoading(true);
            setError(null);
            setResults([]); // Clear previous results

            // *** Construct the API URL conditionally ***
            let apiUrl = 'http://localhost:3001/api/search?';
            const params = [];
            if (query) {
                params.push(`q=${encodeURIComponent(query)}`);
            }
            if (typeFilter) {
                params.push(`type=${encodeURIComponent(typeFilter)}`);
            }
            apiUrl += params.join('&'); // Add parameters like q=...&type=...

            console.log(`Fetching search results from: ${apiUrl}`);

            try {
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({})); // Try to parse error message
                    throw new Error(`HTTP error! status: ${response.status} - ${errorData.message || 'Failed to fetch search results'}`);
                }
                const data = await response.json();
                setResults(data); // Set the results received from the backend
                console.log(`Received ${data.length} results.`);
            } catch (err) {
                console.error("Search fetch error:", err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchResults();

    }, [query, typeFilter]); // *** Re-run effect if query OR typeFilter changes ***

    // Determine the title based on whether it's a query or type filter
    const pageTitle = typeFilter
        ? `Results for Type: ${formatTypeName(typeFilter)}`
        : `Search Results for: "${query}"`;

    // Determine the message for no results
    const noResultsMessage = typeFilter
        ? `No results found for type "${formatTypeName(typeFilter)}".`
        : `No results found for "${query}".`;

    // Determine message when neither query nor type is present
    const promptMessage = "Please enter a search term or select a category.";


    return (
        <div className="p-4 md:p-8 bg-black text-gray-50 min-h-[calc(100vh-200px)]"> {/* Adjust min-height as needed */}
            {/* *** Updated Title Logic *** */}
            <h1 className={`text-3xl font-semibold mb-6 ${BRONZE_COLOR}`}>
                {pageTitle}
            </h1>

            {/* Loading State */}
            {isLoading && (
                <div className="flex justify-center items-center py-10">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    <p className="ml-3 text-gray-400">Loading results...</p>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="flex justify-center items-center py-10 text-red-500 bg-red-900/20 p-4 rounded-md">
                    <AlertCircle className="w-6 h-6 mr-3" />
                    <div>
                        <p className="font-semibold">Error loading search results:</p>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            )}

            {/* No Results State */}
            {/* Show if not loading, no error, but results are empty AND we had a query or type filter */}
            {!isLoading && !error && results.length === 0 && (query || typeFilter) && (
                <div className="text-center py-10 text-gray-400">
                    {/* *** Updated No Results Message *** */}
                    <p>{noResultsMessage}</p>
                </div>
            )}

             {/* No Query/Type State */}
             {/* Show if not loading, no error, AND neither query nor type filter is present */}
             {!isLoading && !error && !query && !typeFilter && (
                <div className="text-center py-10 text-gray-400">
                    {/* *** Updated Prompt Message *** */}
                    <p>{promptMessage}</p>
                </div>
            )}

            {/* Display Results */}
            {!isLoading && !error && results.length > 0 && (
                <ul className="space-y-4">
                    {results.map((result) => (
                        <li key={`${result.type}-${result.id}`} className="bg-gray-800 p-4 rounded-lg shadow hover:shadow-md transition-shadow duration-200">
                            <Link to={result.path} className="block hover:bg-gray-700/50 p-2 -m-2 rounded">
                                <div className="flex items-center mb-1">
                                    {getResultIcon(result.type)}
                                    <span className="font-semibold text-lg text-gray-100 mr-2">{result.name}</span>
                                    {/* Display parent work title for media items */}
                                    {result.type === 'mediaItem' && result.parentWork && (
                                        <span className="text-sm text-gray-400">(from {result.parentWork})</span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-300 ml-7">{result.detail}</p> {/* Indent detail */}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default SearchResultsPage;
