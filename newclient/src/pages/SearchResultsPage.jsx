// src/pages/SearchResultsPage.jsx
import apiClient from '../apiClient';
import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
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
            // You could further differentiate item icons based on item.itemMediaType or item.parentWorkType
            switch (result.itemMediaType) {
                case 'PODCAST_EPISODE':
                    return <Mic className="w-5 h-5 mr-3 inline-block text-indigo-400 flex-shrink-0" />;
                case 'TV_EPISODE':
                     return <Tv className="w-5 h-5 mr-3 inline-block text-pink-400 flex-shrink-0" />;
                // For BOOK_CONTENT, FILM_CONTENT, DOCUMENTARY_CONTENT, they should ideally be filtered out
                // by the backend if the parent MediaWork is shown. If they still appear, use a generic icon or parent's icon.
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
    const navigate = useNavigate();
    const query = searchParams.get('q');
    const typeFilter = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = 20; // Or make this configurable

    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(page);
    const [totalPages, setTotalPages] = useState(0);
    const [totalResults, setTotalResults] = useState(0);

    useEffect(() => {
        // Update currentPage state if page param changes
        setCurrentPage(parseInt(searchParams.get('page') || '1', 10));
    }, [searchParams]);

    useEffect(() => {
        const shouldFetch = query || typeFilter;
        if (!shouldFetch) {
            setResults([]); setError(null); setIsLoading(false); setTotalPages(0); setTotalResults(0);
            return;
        }

        const fetchResults = async () => {
            setIsLoading(true); setError(null);

            let apiUrl = '/api/search?';
            const params = [];
            if (query) params.push(`q=${encodeURIComponent(query)}`);
            if (typeFilter) params.push(`type=${encodeURIComponent(typeFilter)}`);
            
            // Only add page and limit for type-filtered searches, as keyword search pagination is client-side for now
            if (typeFilter) {
                params.push(`page=${currentPage}`);
                params.push(`limit=${limit}`);
            }
            apiUrl += params.join('&');

            console.log(`Fetching search results from: ${apiUrl}`);

            try {
                const response = await apiClient.get(apiUrl);
                const data = response.data;

                setResults(data.results || []); // API now returns { results: [], ... }
                if (typeFilter) { // Only expect pagination data for type-filtered searches
                    setTotalResults(data.totalCount || 0);
                    setTotalPages(Math.ceil((data.totalCount || 0) / limit));
                } else { // For keyword searches, pagination is client-side based on fetched batch
                    setTotalResults(data.results?.length || 0); // total is just what we got
                    setTotalPages(1); // Only one "page" from backend for keyword search
                }
                console.log(`Received ${data.results?.length || 0} results. Total available (if type-filtered): ${data.totalCount}`);
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
    }, [query, typeFilter, currentPage, limit, searchParams]); // Added searchParams to deps for page changes

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            // Update the URL search parameter, which will trigger the useEffect
            const newSearchParams = new URLSearchParams(searchParams);
            newSearchParams.set('page', newPage.toString());
            setSearchParams(newSearchParams);
            // setCurrentPage(newPage); // This will be set by useEffect watching searchParams
        }
    };
    
    const pageTitle = typeFilter
        ? `Results for Type: ${formatTypeName(typeFilter)}`
        : query ? `Search Results for: "${query}"` : "Search Results";
    const noResultsMessage = typeFilter
        ? `No results found for type "${formatTypeName(typeFilter)}".`
        : query ? `No results found for "${query}".` : "No search criteria provided.";
    const promptMessage = "Please enter a search term or select a category from the homepage.";


    // Client-side pagination for keyword searches (if results exceed limit)
    // For type-filtered searches, pagination is driven by totalPages from API
    let paginatedResults = results;
    let currentClientPage = 1; // Only for client-side pagination
    let totalClientPages = 1;  // Only for client-side pagination

    if (!typeFilter && query && results.length > limit) {
        currentClientPage = currentPage; // Use currentPage for client-side as well
        totalClientPages = Math.ceil(results.length / limit);
        const startIndex = (currentClientPage - 1) * limit;
        const endIndex = startIndex + limit;
        paginatedResults = results.slice(startIndex, endIndex);
    } else if (typeFilter) {
        // Results are already paginated by the backend for type-filtered searches
        paginatedResults = results;
    }


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
                                    <div className="flex items-start mb-1"> {/* Changed to items-start for better icon alignment with multi-line text */}
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
                                    <p className="text-sm text-gray-300 ml-8">{result.detail}</p> {/* Adjusted indent if icons are larger */}
                                </Link>
                            </li>
                        ))}
                    </ul>

                    {/* Pagination Controls */}
                    {((typeFilter && totalPages > 1) || (!typeFilter && query && totalClientPages > 1)) && (
                        <div className="mt-8 flex justify-center items-center space-x-2">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="text-gray-400">
                                Page {currentPage} of {typeFilter ? totalPages : totalClientPages}
                            </span>
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === (typeFilter ? totalPages : totalClientPages)}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    )}
                     {typeFilter && totalResults > 0 && (
                        <p className="text-center text-sm text-gray-500 mt-4">
                            Showing {paginatedResults.length} of {totalResults} total results.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

export default SearchResultsPage;
