// src/pages/SearchResultsPage.jsx
import apiClient from '../apiClient';
import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Loader2,
  AlertCircle,
  User,
  FileText,
  Building,
  Link as LinkIcon,
  BookOpen,
  Clapperboard,
  Film,
  Mic,
  Tv,
  Search,
  X,
} from 'lucide-react';
import { BRONZE_COLOR } from '../components/themeconstants';
import MediaEditorialCard from '../components/MediaEditorialCard';

const MEDIA_COLLECTION_META = {
  BOOK: {
    title: 'Books Library',
    subtitle: 'Investigations, memoirs, and scholarship documenting wrongful convictions.',
    searchPlaceholder: 'Search books by title, author, topic, or case...',
    creatorSortLabel: 'Sort: Author (A–Z)',
  },
  FILM: {
    title: 'Films & Documentaries',
    subtitle: 'Feature films, documentaries, and docuseries exploring wrongful convictions.',
    searchPlaceholder: 'Search films by title, director, topic, or case...',
    creatorSortLabel: 'Sort: Director (A–Z)',
  },
  DOCUMENTARY: {
    title: 'Documentaries',
    subtitle: 'Documentary films and series examining wrongful convictions.',
    searchPlaceholder: 'Search documentaries by title, director, or case...',
    creatorSortLabel: 'Sort: Director (A–Z)',
  },
  PODCAST_SERIES: {
    title: 'Podcasts',
    subtitle: 'Investigative podcast series chronicling wrongful conviction cases.',
    searchPlaceholder: 'Search podcasts by title, host, topic, or case...',
    creatorSortLabel: 'Sort: Host (A–Z)',
  },
  TV_SERIES: {
    title: 'TV Series',
    subtitle: 'Television series and investigative broadcasts covering wrongful convictions.',
    searchPlaceholder: 'Search series by title, creator, or case...',
    creatorSortLabel: 'Sort: Creator (A–Z)',
  },
};

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
        case 'DOCUSERIES':
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
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
};

function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('q') || '';
  const typeFilter = (searchParams.get('type') || '').toUpperCase();
  const factorFilter = searchParams.get('factor') || '';
  const sortParam = searchParams.get('sort') || 'title';
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

  const isMediaCollection = Boolean(typeFilter && MEDIA_COLLECTION_META[typeFilter]);
  const collectionMeta = MEDIA_COLLECTION_META[typeFilter] || null;
  const limit = isMediaCollection ? 8 : 20;

  const [localSearch, setLocalSearch] = useState(query);
  const [results, setResults] = useState([]);
  const [availableFactors, setAvailableFactors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);

  // Sync local search input when URL ?q= changes externally (e.g. switching collections)
  useEffect(() => {
    setLocalSearch(query);
  }, [query]);

  // Debounce collection search input -> URL searchParams
  useEffect(() => {
    if (!isMediaCollection) return;
    if (localSearch.trim() === query.trim()) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (localSearch.trim()) {
        next.set('q', localSearch.trim());
      } else {
        next.delete('q');
      }
      next.set('page', '1');
      setSearchParams(next, { replace: true });
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearch, isMediaCollection, query, searchParams, setSearchParams]);

  // Fetch search results from API
  useEffect(() => {
    const currentQuery = searchParams.get('q') || '';
    const currentTypeFilter = (searchParams.get('type') || '').toUpperCase();
    const currentFactor = searchParams.get('factor') || '';
    const currentSort = searchParams.get('sort') || 'title';
    const pageForFetch = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const effectiveLimit = MEDIA_COLLECTION_META[currentTypeFilter] ? 8 : 20;

    if (!currentQuery && !currentTypeFilter) {
      setResults([]);
      setAvailableFactors([]);
      setError(null);
      setIsLoading(false);
      setTotalPages(0);
      setTotalResults(0);
      return;
    }

    const fetchResults = async () => {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (currentQuery) params.set('q', currentQuery);
      if (currentTypeFilter) {
        params.set('type', currentTypeFilter);
        params.set('page', String(pageForFetch));
        params.set('limit', String(effectiveLimit));
        if (currentFactor) params.set('factor', currentFactor);
        if (currentSort) params.set('sort', currentSort);
      }

      try {
        const response = await apiClient.get(`/search?${params.toString()}`);
        const data = response.data;
        const fetchedResults = data.results || [];

        setResults(fetchedResults);
        setAvailableFactors(data.availableFactors || []);

        if (currentTypeFilter) {
          const total = data.totalCount || 0;
          setTotalResults(total);
          setTotalPages(Math.ceil(total / effectiveLimit));
        } else {
          setTotalResults(fetchedResults.length);
          setTotalPages(Math.ceil(fetchedResults.length / effectiveLimit));
        }
      } catch (err) {
        console.error('Fetch error:', err);
        const errorMessage = err.response?.data?.message || err.message || 'An error occurred.';
        setError(errorMessage);
        setResults([]);
        setTotalPages(0);
        setTotalResults(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [searchParams]);

  const updateFilterParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set('page', '1');
    setSearchParams(next);
  };

  const clearCollectionFilters = () => {
    setLocalSearch('');
    const next = new URLSearchParams();
    next.set('type', typeFilter);
    next.set('page', '1');
    setSearchParams(next);
  };

  const handlePageChange = (newPage) => {
    const maxPages = typeFilter ? totalPages : Math.ceil(results.length / limit);
    if (newPage >= 1 && newPage <= maxPages) {
      const next = new URLSearchParams(searchParams);
      next.set('page', String(newPage));
      setSearchParams(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Client-side pagination slice for non-type global keyword searches
  let paginatedResults = results;
  let displayTotalPages = totalPages;
  if (!typeFilter && query && results.length > 0) {
    displayTotalPages = Math.ceil(results.length / limit);
    if (results.length > limit) {
      const startIndex = (currentPage - 1) * limit;
      paginatedResults = results.slice(startIndex, startIndex + limit);
    }
  }

  const pageTitle = collectionMeta
    ? collectionMeta.title
    : typeFilter
      ? `Results for ${formatTypeName(typeFilter)}`
      : query
        ? `Search Results for: "${query}"`
        : 'Search Results';

  const hasActiveFilters = Boolean(query || factorFilter || sortParam !== 'title');

  // Split global keyword results so mediaWork entries still get editorial cards
  const globalMediaWorks = !isMediaCollection
    ? paginatedResults.filter((r) => r.type === 'mediaWork')
    : [];
  const globalOtherResults = !isMediaCollection
    ? paginatedResults.filter((r) => r.type !== 'mediaWork')
    : [];

  return (
    <div className="p-4 md:p-8 bg-black text-gray-50 min-h-[calc(100vh-200px)]">
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <header className="mb-6 pb-4 border-b border-gray-800">
          <h1
            className={`text-3xl md:text-4xl font-serif font-bold tracking-wide uppercase ${BRONZE_COLOR}`}
          >
            {pageTitle}
          </h1>
          {collectionMeta && (
            <p className="text-sm text-gray-400 mt-1.5">{collectionMeta.subtitle}</p>
          )}
        </header>

        {/* Media Collection Filter & Search Toolbar */}
        {isMediaCollection && (
          <section className="mb-6 bg-gray-900/80 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Live Search within Collection */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  placeholder={collectionMeta.searchPlaceholder}
                  className="w-full pl-10 pr-9 py-2 text-sm rounded-lg bg-black border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-[#af7a56]"
                />
                {localSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocalSearch('');
                      updateFilterParam('q', '');
                    }}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortParam}
                onChange={(e) => updateFilterParam('sort', e.target.value === 'title' ? '' : e.target.value)}
                className="px-3.5 py-2 text-xs font-medium rounded-lg bg-black border border-gray-700 text-gray-200 focus:outline-none focus:border-[#af7a56]"
              >
                <option value="title">Sort: Title (A–Z)</option>
                <option value="creator">{collectionMeta.creatorSortLabel}</option>
                <option value="cases">Sort: Most Linked Cases</option>
              </select>
            </div>

            {/* Contributing Factor Filter Pills */}
            {availableFactors.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => updateFilterParam('factor', '')}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                    !factorFilter
                      ? 'bg-[#af7a56] text-white border-transparent'
                      : 'bg-black border-gray-700 text-gray-300 hover:border-[#af7a56]'
                  }`}
                >
                  All Factors
                </button>
                {availableFactors.slice(0, 8).map((f) => {
                  const key = f.code || f.name;
                  const active =
                    factorFilter &&
                    (factorFilter.toLowerCase() === (f.code || '').toLowerCase() ||
                      factorFilter.toLowerCase() === (f.name || '').toLowerCase());
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => updateFilterParam('factor', active ? '' : key)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                        active
                          ? 'bg-[#af7a56] text-white border-transparent'
                          : 'bg-black border-gray-700 text-gray-300 hover:border-[#af7a56]'
                      }`}
                    >
                      {f.name}
                      <span className="ml-1.5 opacity-70">({f.count})</span>
                    </button>
                  );
                })}

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearCollectionFilters}
                    className="ml-auto px-2.5 py-1 text-xs text-gray-400 hover:text-[#edc4a3] underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* Result Count Bar */}
        {!isLoading && !error && totalResults > 0 && (
          <div className="mb-4 flex items-center justify-between text-xs text-gray-400">
            <span>
              Showing <strong className="text-gray-200">{paginatedResults.length}</strong> of{' '}
              <strong className="text-gray-200">{totalResults}</strong>{' '}
              {totalResults === 1 ? 'result' : 'results'}
              {displayTotalPages > 1 ? ` · Page ${currentPage} of ${displayTotalPages}` : ''}
            </span>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-14">
            <Loader2 className="w-8 h-8 animate-spin text-[#af7a56]" />
            <p className="ml-3 text-gray-400">Loading results...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex justify-center items-center py-10 text-red-400 bg-red-900/20 border border-red-800/50 p-4 rounded-lg">
            <AlertCircle className="w-6 h-6 mr-3 flex-shrink-0" />
            <div>
              <p className="font-semibold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Empty States */}
        {!isLoading && !error && paginatedResults.length === 0 && (query || typeFilter) && (
          <div className="text-center py-14 bg-gray-900/60 border border-gray-800 rounded-xl text-gray-400 space-y-3">
            <p>
              {isMediaCollection
                ? `No ${collectionMeta.title.toLowerCase()} matched your current search or filters.`
                : query
                  ? `No results found for "${query}".`
                  : `No results found for type "${formatTypeName(typeFilter)}".`}
            </p>
            {isMediaCollection && hasActiveFilters && (
              <button
                type="button"
                onClick={clearCollectionFilters}
                className="px-4 py-1.5 text-xs font-semibold rounded-md bg-[#af7a56] hover:bg-[#a36c47] text-white"
              >
                Reset Filters
              </button>
            )}
          </div>
        )}

        {!isLoading && !error && !query && !typeFilter && (
          <div className="text-center py-14 text-gray-400">
            <p>Please enter a search term or select a collection from the homepage.</p>
          </div>
        )}

        {/* Results Display */}
        {!isLoading && !error && paginatedResults.length > 0 && (
          <>
            {isMediaCollection ? (
              /* Editorial 2-Column Media Cards (8 per page) */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {paginatedResults.map((result) => (
                  <MediaEditorialCard key={`${result.type}-${result.id}`} result={result} />
                ))}
              </div>
            ) : (
              /* Global Keyword Search: Editorial Cards for MediaWorks + Clean List for Other Entities */
              <div className="space-y-8">
                {globalMediaWorks.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-sm uppercase tracking-wider text-gray-400 font-semibold">
                      Books, Films &amp; Podcasts ({globalMediaWorks.length})
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {globalMediaWorks.map((result) => (
                        <MediaEditorialCard key={`${result.type}-${result.id}`} result={result} />
                      ))}
                    </div>
                  </section>
                )}

                {globalOtherResults.length > 0 && (
                  <section className="space-y-3">
                    {globalMediaWorks.length > 0 && (
                      <h2 className="text-sm uppercase tracking-wider text-gray-400 font-semibold">
                        Individuals, Episodes &amp; Organizations ({globalOtherResults.length})
                      </h2>
                    )}
                    <ul className="space-y-3">
                      {globalOtherResults.map((result) => (
                        <li
                          key={`${result.type}-${result.id}`}
                          className="bg-gray-900/90 border border-gray-800 hover:border-[#af7a56] p-4 rounded-xl transition-colors"
                        >
                          <Link to={result.path} className="block">
                            <div className="flex items-start mb-1">
                              {getResultIcon(result)}
                              <div>
                                <span className="font-semibold text-base text-gray-100 mr-2">
                                  {result.name}
                                </span>
                                {result.type === 'mediaItem' && result.parentWorkTitle && (
                                  <span className="text-xs text-gray-400">
                                    (from {result.parentWorkTitle})
                                  </span>
                                )}
                                {result.type === 'mediaItem' && (
                                  <span className="text-xs text-gray-500 ml-1.5">
                                    ({formatTypeName(result.itemMediaType)})
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-gray-300 ml-8 line-clamp-2">{result.detail}</p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}

            {/* Pagination Controls */}
            {displayTotalPages > 1 && (
              <nav
                aria-label="Pagination"
                className="mt-8 pt-6 border-t border-gray-800 flex justify-center items-center gap-3"
              >
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium bg-gray-900 border border-gray-700 hover:border-[#af7a56] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-300 px-2">
                  Page <strong className="text-[#edc4a3]">{currentPage}</strong> of{' '}
                  <strong>{displayTotalPages}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === displayTotalPages}
                  className="px-4 py-2 text-sm font-medium bg-gray-900 border border-gray-700 hover:border-[#af7a56] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SearchResultsPage;
