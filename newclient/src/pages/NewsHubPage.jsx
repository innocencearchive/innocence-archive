// src/pages/NewsHubPage.jsx
// Dedicated News Hub archive page (/news) with search, category pills (including Call for Action),
// source filtering, linked Individual / MediaWork chips, and pagination.

import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Newspaper,
  Search,
  ExternalLink,
  Megaphone,
  User,
  Pin,
  Loader2,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import apiClient from '../apiClient';
import Breadcrumbs from '../components/Breadcrumbs';
import { BRONZE_COLOR, BRONZE_BORDER, LIGHT_BRONZE_COLOR } from '../components/themeconstants';
import {
  NEWS_CATEGORIES,
  getNewsCategoryMeta,
  formatNewsDate,
  getMediaWorkPath,
} from '../components/newsConstants';

function NewsHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get('category') || '';
  const activeSourceId = searchParams.get('sourceId') || '';
  const activeQuery = searchParams.get('q') || '';
  const activePage = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);

  const [queryInput, setQueryInput] = useState(activeQuery);
  const [data, setData] = useState({
    items: [],
    total: 0,
    totalPublished: 0,
    page: 1,
    totalPages: 1,
    categoryCounts: {},
    sources: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setQueryInput(activeQuery);
  }, [activeQuery]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (activeCategory) params.set('category', activeCategory);
    if (activeSourceId) params.set('sourceId', activeSourceId);
    if (activeQuery) params.set('q', activeQuery);
    params.set('page', String(activePage));
    params.set('limit', '20');

    apiClient
      .get(`/news?${params.toString()}`)
      .then((res) => {
        if (mounted) setData(res.data || {});
      })
      .catch((err) => {
        if (mounted) setError(err.response?.data?.message || err.message || 'Failed to load news.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeCategory, activeSourceId, activeQuery, activePage]);

  const updateParams = (updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === '' || v === null || v === undefined) next.delete(k);
      else next.set(k, String(v));
    });
    if (!('page' in updates)) next.delete('page');
    setSearchParams(next);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    updateParams({ q: queryInput.trim() });
  };

  return (
    <div className="min-h-screen bg-black text-gray-100 pb-16">
      <div className="px-4 md:px-8 py-4">
        <Breadcrumbs items={[{ label: 'Home', link: '/' }, { label: 'News Hub' }]} />
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-4 space-y-6">
        {/* Page Header */}
        <div className="border-b border-[#af7a56]/30 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <Newspaper className={`w-7 h-7 ${BRONZE_COLOR}`} />
            <h1 className={`text-3xl md:text-4xl font-serif uppercase tracking-wide ${LIGHT_BRONZE_COLOR}`}>
              Innocence Archive News Hub
            </h1>
          </div>
          <p className="text-sm text-gray-400 max-w-3xl">
            Exonerations, court updates, case setbacks, urgent calls for action, policy reform, and newly indexed books, documentaries, and podcasts.
          </p>

          {/* Search + Source Filter Bar */}
          <div className="mt-5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
              <Search className={`w-4 h-4 ${BRONZE_COLOR} absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none`} />
              <input
                type="search"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Search headlines, individuals, or outlets..."
                className="w-full bg-gray-900 border border-[#af7a56]/40 rounded-full py-2 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#edc4a3]"
              />
            </form>

            {data.sources?.length > 0 && (
              <select
                value={activeSourceId}
                onChange={(e) => updateParams({ sourceId: e.target.value })}
                aria-label="Filter by news source"
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#af7a56]"
              >
                <option value="">All News Sources</option>
                {data.sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s._count?.articles || 0})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              onClick={() => updateParams({ category: '' })}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                !activeCategory
                  ? 'bg-[#af7a56] text-black border-[#edc4a3]'
                  : 'bg-gray-900 text-gray-300 border-gray-700 hover:border-[#af7a56]'
              }`}
            >
              All Stories ({data.totalPublished || 0})
            </button>
            {NEWS_CATEGORIES.map((cat) => {
              const count = data.categoryCounts?.[cat.value] || 0;
              const isSelected = activeCategory === cat.value;
              const isCta = cat.value === 'CALL_FOR_ACTION';
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => updateParams({ category: isSelected ? '' : cat.value })}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    isSelected
                      ? isCta
                        ? 'bg-orange-600 text-white border-orange-400'
                        : 'bg-[#af7a56] text-black border-[#edc4a3]'
                      : isCta && count > 0
                        ? 'bg-orange-950/60 text-orange-300 border-orange-500/60 hover:bg-orange-900/70'
                        : 'bg-gray-900 text-gray-300 border-gray-700 hover:border-[#af7a56]'
                  }`}
                >
                  {isCta && <Megaphone className="w-3.5 h-3.5" />}
                  {cat.plural} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="py-20 flex flex-col items-center text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
            Loading news archive...
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-red-950/50 border border-red-800 text-red-300 flex items-center gap-2 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        ) : data.items?.length === 0 ? (
          <div className="py-16 text-center text-gray-400 border border-gray-800 rounded-xl bg-gray-900/40">
            <p className="text-base">No news articles match the current filters.</p>
            {(activeCategory || activeQuery || activeSourceId) && (
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="mt-3 text-sm text-[#edc4a3] hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="text-xs text-gray-400">
              Showing page {data.page} of {data.totalPages} ({data.total.toLocaleString()} matching{' '}
              {data.total === 1 ? 'story' : 'stories'})
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.items.map((story) => {
                const cat = getNewsCategoryMeta(story.category);
                const dateLabel = formatNewsDate(story.publishedAt);
                const mediaPath = getMediaWorkPath(story.mediaWork);
                const isCta = story.category === 'CALL_FOR_ACTION';

                return (
                  <article
                    key={story.id}
                    className={`rounded-xl p-5 flex flex-col justify-between gap-3 transition-colors border ${
                      isCta
                        ? 'bg-orange-950/15 border-orange-500/50 hover:border-orange-400'
                        : 'bg-gray-900/80 border-gray-800 hover:border-[#af7a56]/70'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-gray-400 mb-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${cat.badgeClass}`}>
                          {isCta && <Megaphone className="w-3 h-3" />}
                          {cat.label}
                        </span>
                        {(story.source?.name || story.sourceName) && (
                          <span className="text-gray-300 font-medium">
                            {story.source?.name || story.sourceName}
                          </span>
                        )}
                        {dateLabel && <span>· {dateLabel}</span>}
                        {story.isPinned && (
                          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-[#edc4a3]">
                            <Pin className="w-3 h-3" /> Pinned
                          </span>
                        )}
                      </div>

                      {story.url ? (
                        <a
                          href={story.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block text-base font-semibold text-gray-100 hover:text-[#edc4a3] leading-snug transition-colors"
                        >
                          {story.headline}
                          <ExternalLink className="inline w-3.5 h-3.5 ml-1.5 text-gray-500 group-hover:text-[#edc4a3]" />
                        </a>
                      ) : mediaPath ? (
                        <Link
                          to={mediaPath}
                          className="block text-base font-semibold text-gray-100 hover:text-[#edc4a3] leading-snug transition-colors"
                        >
                          {story.headline}
                        </Link>
                      ) : (
                        <h2 className="text-base font-semibold text-gray-100 leading-snug">
                          {story.headline}
                        </h2>
                      )}

                      {story.summary && (
                        <p className="text-xs text-gray-400 mt-2 line-clamp-3 leading-relaxed">
                          {story.summary}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-gray-800/80">
                      {(story.individuals || []).map((ind) => (
                        <Link
                          key={ind.id}
                          to={`/profile/${ind.id}`}
                          className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-[#af7a56]/15 border border-[#af7a56]/40 text-[#edc4a3] hover:bg-[#af7a56]/30 transition-colors"
                        >
                          <User className="w-3 h-3" />
                          {ind.firstName} {ind.lastName}
                        </Link>
                      ))}

                      {mediaPath && (
                        <Link
                          to={mediaPath}
                          className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-amber-950/60 border border-amber-700/50 text-amber-300 hover:bg-amber-900/60 transition-colors"
                        >
                          <BookOpen className="w-3 h-3" />
                          {story.mediaWork.title}
                        </Link>
                      )}

                      {story.actionUrl && (
                        <a
                          href={story.actionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-md bg-orange-600 hover:bg-orange-500 text-white transition-colors"
                        >
                          <Megaphone className="w-3.5 h-3.5" />
                          {story.actionLabel || 'Take Action'}
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-4">
                <button
                  type="button"
                  disabled={activePage <= 1}
                  onClick={() => updateParams({ page: activePage - 1 })}
                  className={`px-4 py-2 rounded-lg text-sm border ${BRONZE_BORDER} text-gray-200 hover:bg-gray-900 disabled:opacity-40`}
                >
                  ← Previous
                </button>
                <span className="text-xs text-gray-400">
                  Page {data.page} of {data.totalPages}
                </span>
                <button
                  type="button"
                  disabled={activePage >= data.totalPages}
                  onClick={() => updateParams({ page: activePage + 1 })}
                  className={`px-4 py-2 rounded-lg text-sm border ${BRONZE_BORDER} text-gray-200 hover:bg-gray-900 disabled:opacity-40`}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default NewsHubPage;
