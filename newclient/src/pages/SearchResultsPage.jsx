// src/pages/SearchResultsPage.jsx
import apiClient from '../apiClient';
import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom'; // Removed useNavigate as it's not used
import { Loader2, AlertCircle, User, FileText, Building, Link as LinkIcon, BookOpen, Clapperboard, Film, Mic, Tv } from 'lucide-react';
import { BRONZE_COLOR } from '../components/themeconstants';

// Helper function to get appropriate icon based on result type and specific media type
const getResultIcon = (result) => {
    switch (result.type) {
        case 'individual':
            return <User className="w-5 h-5 mr-3 inline-block text-blue-400 flex-shrink-0" />;
        case 'mediaWork':
            switch (result.workType) {
                case 'BOOK':
                    return <BookOpen className="w-5 h-5 mr-3 inline-block text-orange-400 flex-shrink-0" />;
                case 'FILM':
                    return <Film className="w-5 h-5 mr-3 inline-block text-red-400 flex-shrink-0" />;
                case 'DOCUMENTARY':
                    return <Clapperboard className="w-5 h-5 mr-3 inline-block text-teal-400 flex-shrink-0" />;
                case 'PODCAST_SERIES':
                    return <Mic className="w-5 h-5 mr-3 inline-block text-indigo-400 flex-shrink-0" />;
                case 'TV_SERIES':
                    return <Tv className="w-5 h-5 mr-3 inline-block text-pink-400 flex-shrink-0" />;
                default:
                    return <FileText className="w-5 h-5 mr-3 inline-block text-green-400 flex-shrink-0" />;
            }
        case 'mediaItem':
            switch (result.itemMediaType) {
                case 'PODCAST_EPISODE':
                    return <Mic className="w-5 h-5 mr-3 inline-block text-indigo-400 flex-shrink-0" />;
                case 'TV_EPISODE':
                     return <Tv className="w-5 h-5 mr-3 inline-block text-pink-400 flex-shrink-0" />;
                case 'BOOK_CONTENT':
                    return <BookOpen className="w-5 h-5 mr-3 inline-block text-orange-400 flex-shrink-0" />;
                case 'FILM_CONTENT':
                    return <Film className="w-5 h-5 mr-3 inline-block text-red-400 flex-shrink-0" />;
                case 'DOCUMENTARY_CONTENT':
                    return <Clapperboard className="w-5 h-5 mr-3 inline-block text-teal-400 flex-shrink-0" />;
                default:
                    return <FileText className="w-5 h-5 mr-3 inline-block text-lime-400 flex-shrink-0" />;
            }
        case 'organization':
            return <Building className="w-5 h-5 mr-3 inline-block text-purple-400 flex-shrink-0" />;
        default:
            return <LinkIcon className="w-5 h-5 mr-3 inline-block text-gray-400 flex-shrink-0" />;
    }
};

const formatTypeName = (type) => {
    if (!type) return '';
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

function SearchResultsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    
    // query and typeFilter are derived directly from searchParams on each render
    const query = searchParams.get('q');
    const typeFilter = searchParams.get('type');
    
    // currentPage state is primarily for UI display and client-side pagination logic
    const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1', 10));
    
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [totalPages, setTotalPages] = useState(0);
    const [totalResults, setTotalResults] = useState(0);
    const limit = 20; // Or make this configurable

    // Effect to update currentPage state when the URL's page parameter changes
    useEffect(() => {
        setCurrentPage(parseInt(searchParams.get('page') || '1', 10));
    }, [searchParams]);

    // Effect to fetch search results
    useEffect(() => {
        // Derive query and typeFilter directly from searchParams for this effect's logic
        const currentQuery = searchParams.get('q');
        const currentTypeFilter = searchParams.get('type');

        const shouldFetch = currentQuery || currentTypeFilter;
        if (!shouldFetch) {
            setResults([]); setError(null); setIsLoading(false); setTotalPages(0); setTotalResults(0);
            return;
        }

        const fetchResults = async () => {
            setIsLoading(true); setError(null);

            // *** CRITICAL CHANGE: Get page number directly from searchParams for the API call ***
            const pageForFetch = parseInt(searchParams.get('page') || '1', 10);

            let apiUrl = '/api/search?';
            const params = [];
            if (currentQuery) params.push(`q=${encodeURIComponent(currentQuery)}`);
            if (currentTypeFilter) params.push(`type=${encodeURIComponent(currentTypeFilter)}`);
            
            // Only add page and limit for type-filtered (backend paginated) searches
            if (currentTypeFilter) {
                params.push(`page=${pageForFetch}`);
                params.push(`limit=${limit}`);
            }
            // For keyword searches, the backend sends all relevant results,
            // and pagination is handled client-side. So, no page/limit sent for keyword search here.
            
            apiUrl += params.join('&');

            console.log(`Fetching search results from: ${apiUrl} (Page in URL for fetch: ${pageForFetch})`);

            try {
                const response = await apiClient.get(apiUrl);
                const data = response.data;

                setResults(data.results || []);
                if (currentTypeFilter) { // Pagination data from backend for type-filtered searches
                    setTotalResults(data.totalCount || 0);
                    setTotalPages(Math.ceil((data.totalCount || 0) / limit));
                } else { // For keyword searches, derive pagination from the fetched batch
                    setTotalResults(data.results?.length || 0);
                    setTotalPages(1); // All keyword results are fetched in one go from backend
                }
            } catch (err) {
                console.error("Fetch error:", err);
                const errorMessage = err.response?.data?.message || err.message || "An error occurred.";
                setError(errorMessage);
                setResults([]); setTotalPages(0); setTotalResults(0);
            } finally {
                setIsLoading(false);
            }
        };

        fetchResults();
    // Dependencies: `searchParams` (covers changes in q, type, page) and `limit`.
    // `query` and `typeFilter` (component-scope consts) are not needed here as we derive
    // `currentQuery` and `currentTypeFilter` from `searchParams` inside the effect.
    }, [searchParams, limit]);

    const handlePageChange = (newPage) => {
        const maxPages = typeFilter ? totalPages : Math.ceil(results.length / limit); // Use client-side total for keyword search
        if (newPage >= 1 && newPage <= maxPages) {
            const newSearchParams = new URLSearchParams(searchParams);
            newSearchParams.set('page', newPage.toString());
            setSearchParams(newSearchParams); // This updates the URL and triggers effects
        }
    };
    
    const pageTitle = typeFilter
        ? `Results for Type: ${formatTypeName(typeFilter)}`
        : query ? `Search Results for: "${query}"` : "Search Results";
    const noResultsMessage = typeFilter
        ? `No results found for type "${formatTypeName(typeFilter)}".`
        : query ? `No results found for "${query}".` : "No search criteria provided.";
    const promptMessage = "Please enter a search term or select a category from the homepage.";

    // Client-side pagination logic for keyword searches
    let paginatedResults = results;
    let displayTotalPages = totalPages; // This will be totalPages from backend for typeFilter

    if (!typeFilter && query && results.length > 0) { // Keyword search with results
        displayTotalPages = Math.ceil(results.length / limit);
        if (results.length > limit) {
            const startIndex = (currentPage - 1) * limit; // currentPage state is fine here for slicing
            const endIndex = startIndex + limit;
            paginatedResults = results.slice(startIndex, endIndex);
        }
    }
    // For typeFilter, paginatedResults is already the correct page from the backend.

    return (
        <div className="p-4 md:p-8 bg-black text-gray-50 min-h-[calc(100vh-200px)]">
            <h1 className={`text-3xl font-semibold mb-6 ${BRONZE_COLOR}`}>
                {pageTitle}
            </h1>

            {isLoading && (
                <div className="flex justify-center items-center py-10">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    <p className="ml-3 text-gray-400">Loading results...</p>
                </div>
            )}
            {error && (
                <div className="flex justify-center items-center py-10 text-red-500 bg-red-900/20 p-4 rounded-md">
                    <AlertCircle className="w-6 h-6 mr-3" />
                    <div><p className="font-semibold">Error:</p><p className="text-sm">{error}</p></div>
                </div>
            )}
            {!isLoading && !error && paginatedResults.length === 0 && (query || typeFilter) && (
                <div className="text-center py-10 text-gray-400"><p>{noResultsMessage}</p></div>
            )}
            {!isLoading && !error && !query && !typeFilter && (
                <div className="text-center py-10 text-gray-400"><p>{promptMessage}</p></div>
            )}

            {!isLoading && !error && paginatedResults.length > 0 && (
                <>
                    <ul className="space-y-4">
                        {paginatedResults.map((result) => (
                            <li key={`${result.type}-${result.id}`} className="bg-gray-800 p-4 rounded-lg shadow hover:shadow-md transition-shadow duration-200">
                                <Link to={result.path} className="block hover:bg-gray-700/50 p-2 -m-2 rounded">
                                    <div className="flex items-start mb-1">
                                        {getResultIcon(result)}
                                        <div>
                                            <span className="font-semibold text-lg text-gray-100 mr-2">{result.name}</span>
                                            {result.type === 'mediaItem' && result.parentWorkTitle && (
                                                <span className="text-sm text-gray-400">(from {result.parentWorkTitle})</span>
                                            )}
                                             {result.type === 'mediaWork' && (
                                                <span className="text-xs text-gray-500 ml-1">({formatTypeName(result.workType)})</span>
                                            )}
                                            {result.type === 'mediaItem' && (
                                                <span className="text-xs text-gray-500 ml-1">({formatTypeName(result.itemMediaType)})</span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-300 ml-8">{result.detail}</p>
                                </Link>
                            </li>
                        ))}
                    </ul>

                    {/* Pagination Controls */}
                    {(displayTotalPages > 1) && (
                        <div className="mt-8 flex justify-center items-center space-x-2">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="text-gray-400">
                                Page {currentPage} of {displayTotalPages}
                            </span>
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === displayTotalPages}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    )}
                     {totalResults > 0 && ( // Show total results count consistently
                        <p className="text-center text-sm text-gray-500 mt-4">
                            {typeFilter ? `Showing ${paginatedResults.length} of ${totalResults} total results.` : `Displaying ${paginatedResults.length} of ${totalResults} results found.`}
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

export default SearchResultsPage;
