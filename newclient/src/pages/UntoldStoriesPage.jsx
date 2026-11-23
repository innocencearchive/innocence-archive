// src/pages/UntoldStoriesPage.jsx
// Public "Stories Yet to Be Told" directory:
// Lists individuals in the database who do not yet appear in any documented media or news coverage.
// Shows only minimal factual data (name, state, years, time served) and links to a full profile
// ONLY when isPublished is true (protecting NRE-exclusive records while shining a light on untold stories).

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, BookOpen, ArrowRight, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import apiClient from '../apiClient';
import { BRONZE_COLOR, BRONZE_BORDER } from '../components/themeconstants';

function UntoldStoriesPage() {
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [availableStates, setAvailableStates] = useState([]);

  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [sort, setSort] = useState('exonerated_desc');
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/individuals/untold-stories', {
        params: {
          q: q || undefined,
          state: stateFilter || undefined,
          sort,
          page,
          limit: 50,
        },
      });
      setItems(res.data.items || []);
      setTotalCount(res.data.totalCount || 0);
      setTotalPages(res.data.totalPages || 1);
      setAvailableStates(res.data.availableStates || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load Stories Yet to Be Told.');
    } finally {
      setLoading(false);
    }
  }, [q, stateFilter, sort, page]);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setQ(searchInput.trim());
  };

  return (
    <div className="min-h-screen bg-black text-gray-200 px-4 md:px-8 py-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header / Editorial Framing */}
        <header className={`border-b ${BRONZE_BORDER} pb-6 space-y-3`}>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-500 font-semibold">
            The Innocence Archive · Research Callout
          </p>
          <h1 className={`text-3xl md:text-5xl font-serif font-bold ${BRONZE_COLOR}`}>
            Stories Yet to Be Told
          </h1>
          <p className="text-gray-300 max-w-3xl text-sm md:text-base leading-relaxed">
            Every name below represents a wrongfully convicted American in our research index whose
            story has not yet been linked to documented books, films, podcasts, or news coverage in
            The Innocence Archive. As journalists, podcasters, filmmakers, and researchers bring
            these stories into public media, each person automatically graduates from this list into
            our full archive.
          </p>
          <div className="pt-1 text-xs text-gray-400">
            Currently documenting{' '}
            <strong className="text-amber-400">{totalCount.toLocaleString()}</strong> untold{' '}
            {totalCount === 1 ? 'story' : 'stories'}
            {stateFilter ? ` in ${stateFilter}` : ''}.
          </div>
        </header>

        {/* Search & Filter Controls */}
        <section className="bg-gray-900/80 border border-gray-800 rounded-lg p-4 flex flex-wrap gap-3 items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="flex flex-1 min-w-[240px] gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name or state..."
                className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm font-medium"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Filter size={14} className="text-gray-500" />
            <select
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200"
            >
              <option value="">All States</option>
              {availableStates.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200"
            >
              <option value="exonerated_desc">Most Recently Exonerated</option>
              <option value="convicted_desc">Most Recently Convicted</option>
              <option value="convicted_asc">Earliest Conviction Year</option>
              <option value="name_asc">Name (A → Z)</option>
            </select>
          </div>
        </section>

        {error && (
          <div className="p-4 bg-red-950/60 border border-red-800 rounded text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Directory Table */}
        <section className="bg-gray-900/60 border border-gray-800 rounded-lg overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm">Loading directory...</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              No matching untold stories found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-900 border-b border-gray-800 text-xs uppercase tracking-wider text-gray-400">
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">State</th>
                    <th className="py-3 px-4">Convicted</th>
                    <th className="py-3 px-4">Exonerated / Released</th>
                    <th className="py-3 px-4">Time Served</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/80">
                  {items.map((person) => (
                    <tr key={person.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="py-3 px-4 font-medium text-gray-100">
                        {person.isPublished ? (
                          <Link
                            to={`/profile/${person.id}`}
                            className="text-amber-400 hover:text-amber-300 hover:underline inline-flex items-center gap-1"
                          >
                            {person.fullName}
                            <ArrowRight size={13} />
                          </Link>
                        ) : (
                          <span>{person.fullName}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-300">{person.caseLocationState || '—'}</td>
                      <td className="py-3 px-4 text-gray-300">{person.convictionYear || '—'}</td>
                      <td className="py-3 px-4 text-gray-300">
                        {person.exonerationOrReleaseYear || '—'}
                      </td>
                      <td className="py-3 px-4 text-amber-300/90">{person.timeServed || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-t border-gray-800 text-xs text-gray-400">
              <span>
                Page <strong className="text-gray-200">{page}</strong> of{' '}
                <strong className="text-gray-200">{totalPages}</strong> ({totalCount.toLocaleString()} total)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="inline-flex items-center px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded text-gray-200"
                >
                  <ChevronLeft size={14} className="mr-1" /> Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded text-gray-200"
                >
                  Next <ChevronRight size={14} className="ml-1" />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Bottom Attribution Note */}
        <footer className="text-xs text-gray-500 flex items-start gap-2 pt-2">
          <BookOpen size={15} className="shrink-0 mt-0.5 text-amber-500/70" />
          <p>
            This index lists only basic public factual milestones (name, state, and years) for
            individuals without documented media coverage in our archive. Have a book, documentary,
            podcast, or news article featuring someone on this list? Once linked in our archive,
            they are automatically removed from this page.
          </p>
        </footer>
      </div>
    </div>
  );
}

export default UntoldStoriesPage;
