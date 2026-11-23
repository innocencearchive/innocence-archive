// src/pages/AdminNewsPage.jsx
// Dedicated Admin News Management & Live RSS Feed Checker (/admin/news)
// Tabs:
//   1. Manage & Homepage News (pin/unpin, toggle homepage, edit, delete)
//   2. Add / Edit Story (manual composer with Call for Action CTA, Individual & MediaWork linking)
//   3. News Feeds (manage RSS sources like Innocence Project, click "Check Feed" to auto-pull & import)

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Newspaper,
  PlusCircle,
  Rss,
  RefreshCw,
  Pin,
  Home,
  Trash2,
  Edit3,
  ExternalLink,
  Megaphone,
  CheckCircle2,
  AlertCircle,
  Search,
  X,
  User,
  BookOpen,
  Loader2,
  Upload,
} from 'lucide-react';
import apiClient from '../apiClient';
import { BRONZE_COLOR, BRONZE_BORDER } from '../components/themeconstants';
import { NEWS_CATEGORIES, getNewsCategoryMeta, formatNewsDate } from '../components/newsConstants';

const EMPTY_FORM = {
  id: null,
  headline: '',
  url: '',
  summary: '',
  publishedAt: new Date().toISOString().slice(0, 10),
  category: 'CASE_UPDATE',
  status: 'PUBLISHED',
  showOnHomepage: true,
  isPinned: false,
  actionUrl: '',
  actionLabel: '',
  sourceId: '',
  sourceName: '',
  mediaWork: null,
  individuals: [],
};

function AdminNewsPage() {
  const [activeTab, setActiveTab] = useState('manage'); // manage | compose | feeds
  const [banner, setBanner] = useState(null); // { type: 'success'|'error', text }

  // --- Shared Sources ---
  const [sources, setSources] = useState([]);

  // --- Tab 1: Manage Articles ---
  const [articles, setArticles] = useState([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [articlesTotal, setArticlesTotal] = useState(0);
  const [articlesPage, setArticlesPage] = useState(1);
  const [articlesTotalPages, setArticlesTotalPages] = useState(1);
  const [filterQ, setFilterQ] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterHomepageOnly, setFilterHomepageOnly] = useState(false);

  // --- Tab 2: Composer / Editor ---
  const [form, setForm] = useState(EMPTY_FORM);
  const [savingForm, setSavingForm] = useState(false);
  const [indSearch, setIndSearch] = useState('');
  const [indResults, setIndResults] = useState([]);
  const [mediaSearch, setMediaSearch] = useState('');
  const [mediaResults, setMediaResults] = useState([]);

  // --- Tab 3: RSS Feeds & Bulk JSON Upload ---
  const [newSource, setNewSource] = useState({ name: '', feedUrl: '', websiteUrl: '', notes: '' });
  const [addingSource, setAddingSource] = useState(false);
  const [checkingSourceId, setCheckingSourceId] = useState(null);
  const [uploadingJson, setUploadingJson] = useState(false);
  const [feedPreview, setFeedPreview] = useState(null); // { source, items: [...] }
  const [importingFeed, setImportingFeed] = useState(false);

  const loadSources = async () => {
    try {
      const res = await apiClient.get('/news/admin/sources');
      setSources(res.data || []);
    } catch (err) {
      console.error('Failed to load news sources:', err);
    }
  };

  const loadArticles = async (pageOverride) => {
    setArticlesLoading(true);
    try {
      const p = pageOverride ?? articlesPage;
      const params = new URLSearchParams({ page: String(p), limit: '25' });
      if (filterQ.trim()) params.set('q', filterQ.trim());
      if (filterCat) params.set('category', filterCat);
      if (filterHomepageOnly) params.set('homepageOnly', 'true');
      const res = await apiClient.get(`/news/admin/articles?${params.toString()}`);
      setArticles(res.data?.items || []);
      setArticlesTotal(res.data?.total || 0);
      setArticlesPage(res.data?.page || 1);
      setArticlesTotalPages(res.data?.totalPages || 1);
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.message || 'Failed to load news articles.' });
    } finally {
      setArticlesLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  useEffect(() => {
    loadArticles(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCat, filterHomepageOnly]);

  // Typeahead: Individuals
  useEffect(() => {
    if (indSearch.trim().length < 2) {
      setIndResults([]);
      return;
    }
    const t = setTimeout(() => {
      apiClient
        .get(`/news/admin/search-individuals?q=${encodeURIComponent(indSearch.trim())}`)
        .then((res) => setIndResults(res.data || []))
        .catch(() => {});
    }, 220);
    return () => clearTimeout(t);
  }, [indSearch]);

  // Typeahead: MediaWork
  useEffect(() => {
    if (mediaSearch.trim().length < 2) {
      setMediaResults([]);
      return;
    }
    const t = setTimeout(() => {
      apiClient
        .get(`/news/admin/search-media?q=${encodeURIComponent(mediaSearch.trim())}`)
        .then((res) => setMediaResults(res.data || []))
        .catch(() => {});
    }, 220);
    return () => clearTimeout(t);
  }, [mediaSearch]);

  // --- Article Quick Actions ---
  const quickUpdate = async (article, patch) => {
    try {
      const res = await apiClient.put(`/news/admin/articles/${article.id}`, patch);
      setArticles((prev) => prev.map((a) => (a.id === article.id ? res.data : a)));
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.message || 'Update failed.' });
    }
  };

  const handleDeleteArticle = async (article) => {
    if (!window.confirm(`Permanently delete "${article.headline}"?`)) return;
    try {
      await apiClient.delete(`/news/admin/articles/${article.id}`);
      setArticles((prev) => prev.filter((a) => a.id !== article.id));
      setArticlesTotal((t) => Math.max(0, t - 1));
      setBanner({ type: 'success', text: 'News story deleted.' });
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.message || 'Delete failed.' });
    }
  };

  const startEditArticle = (article) => {
    setForm({
      id: article.id,
      headline: article.headline || '',
      url: article.url || '',
      summary: article.summary || '',
      publishedAt: article.publishedAt ? new Date(article.publishedAt).toISOString().slice(0, 10) : '',
      category: article.category || 'GENERAL',
      status: article.status || 'PUBLISHED',
      showOnHomepage: Boolean(article.showOnHomepage),
      isPinned: Boolean(article.isPinned),
      actionUrl: article.actionUrl || '',
      actionLabel: article.actionLabel || '',
      sourceId: article.sourceId ? String(article.sourceId) : '',
      sourceName: article.sourceName || article.source?.name || '',
      mediaWork: article.mediaWork || null,
      individuals: article.individuals || [],
    });
    setActiveTab('compose');
    setBanner(null);
  };

  // --- Save Manual Form ---
  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!form.headline.trim()) return;
    setSavingForm(true);
    setBanner(null);

    const payload = {
      headline: form.headline.trim(),
      url: form.url.trim() || null,
      summary: form.summary.trim() || null,
      publishedAt: form.publishedAt || null,
      category: form.category,
      status: form.status,
      showOnHomepage: form.showOnHomepage,
      isPinned: form.isPinned,
      actionUrl: form.actionUrl.trim() || null,
      actionLabel: form.actionLabel.trim() || null,
      sourceId: form.sourceId ? parseInt(form.sourceId, 10) : null,
      sourceName: form.sourceName.trim() || null,
      mediaWorkId: form.mediaWork?.id || null,
      individualIds: form.individuals.map((i) => i.id),
    };

    try {
      if (form.id) {
        await apiClient.put(`/news/admin/articles/${form.id}`, payload);
        setBanner({ type: 'success', text: 'News story updated!' });
      } else {
        await apiClient.post('/news/admin/articles', payload);
        setBanner({ type: 'success', text: 'News story published!' });
      }
      setForm(EMPTY_FORM);
      setActiveTab('manage');
      loadArticles(1);
      loadSources();
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.message || 'Failed to save story.' });
    } finally {
      setSavingForm(false);
    }
  };

  // --- Feed Sources Management ---
  const handleAddSource = async (e) => {
    e.preventDefault();
    if (!newSource.name.trim()) return;
    setAddingSource(true);
    setBanner(null);
    try {
      await apiClient.post('/news/admin/sources', newSource);
      setNewSource({ name: '', feedUrl: '', websiteUrl: '', notes: '' });
      setBanner({ type: 'success', text: `Added news source "${newSource.name}".` });
      loadSources();
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.message || 'Failed to add news source.' });
    } finally {
      setAddingSource(false);
    }
  };

  const handleCheckFeed = async (source) => {
    setCheckingSourceId(source.id);
    setFeedPreview(null);
    setBanner(null);
    try {
      const res = await apiClient.post(`/news/admin/sources/${source.id}/check`);
      const items = (res.data?.items || []).map((it) => ({
        ...it,
        selected: !it.alreadyImported,
        category: it.suggestedCategory || 'GENERAL',
        showOnHomepage: false,
        isPinned: false,
        selectedIndIds: (it.matchedIndividuals || []).map((m) => m.id),
      }));
      setFeedPreview({ ...res.data, items });
      loadSources();
    } catch (err) {
      setBanner({
        type: 'error',
        text: err.response?.data?.message || `Could not check feed for ${source.name}.`,
      });
    } finally {
      setCheckingSourceId(null);
    }
  };

  const updatePreviewItem = (tempIndex, patch) => {
    setFeedPreview((prev) =>
      prev
        ? { ...prev, items: prev.items.map((it) => (it.tempIndex === tempIndex ? { ...it, ...patch } : it)) }
        : prev
    );
  };

  const toggleMatchedIndividual = (tempIndex, indId) => {
    setFeedPreview((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((it) => {
              if (it.tempIndex !== tempIndex) return it;
              const current = it.selectedIndIds || [];
              const next = current.includes(indId)
                ? current.filter((id) => id !== indId)
                : [...current, indId];
              return { ...it, selectedIndIds: next };
            }),
          }
        : prev
    );
  };

  const handleBulkJsonFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingJson(true);
    setFeedPreview(null);
    setBanner(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const rawItems = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.items)
          ? parsed.items
          : Array.isArray(parsed?.articles)
            ? parsed.articles
            : null;
      if (!rawItems || rawItems.length === 0) {
        setBanner({
          type: 'error',
          text: 'JSON file must contain an array of news articles (e.g., delta_news_2025_2026_bulk.json).',
        });
        return;
      }

      const res = await apiClient.post('/news/admin/articles/bulk-preview', {
        fileName: file.name,
        items: rawItems,
      });
      const items = (res.data?.items || []).map((it) => ({
        ...it,
        selected: !it.alreadyImported,
        category: it.suggestedCategory || 'GENERAL',
        showOnHomepage: Boolean(it.showOnHomepage),
        isPinned: Boolean(it.isPinned),
        selectedIndIds: (it.matchedIndividuals || []).map((m) => m.id),
      }));
      setFeedPreview({ ...res.data, items });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to parse or preview bulk news JSON.',
      });
    } finally {
      setUploadingJson(false);
    }
  };

  const handleImportSelectedFeedItems = async () => {
    if (!feedPreview) return;
    const chosen = feedPreview.items.filter((it) => it.selected && !it.alreadyImported);
    if (chosen.length === 0) {
      setBanner({ type: 'error', text: 'Select at least one new story to import.' });
      return;
    }
    setImportingFeed(true);
    setBanner(null);
    try {
      const payloadItems = chosen.map((it) => ({
        headline: it.headline,
        url: it.url,
        summary: it.summary,
        publishedAt: it.publishedAt,
        category: it.category,
        status: it.status || 'PUBLISHED',
        showOnHomepage: it.showOnHomepage,
        isPinned: it.isPinned,
        actionUrl: it.actionUrl,
        actionLabel: it.actionLabel,
        sourceId: it.sourceId,
        sourceName: it.sourceName,
        individualIds: it.selectedIndIds,
      }));
      const res = await apiClient.post('/news/admin/articles/bulk-import', { items: payloadItems });
      const linkedMsg = res.data.linkedCount ? ` and linked ${res.data.linkedCount} individual mention(s)` : '';
      setBanner({
        type: 'success',
        text: `Imported ${res.data.created} new story/stories (${res.data.skipped} skipped)${linkedMsg}.`,
      });
      // Mark imported in current preview
      const importedUrls = new Set(chosen.map((c) => c.url));
      setFeedPreview((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((it) =>
                importedUrls.has(it.url) ? { ...it, alreadyImported: true, selected: false } : it
              ),
            }
          : prev
      );
      loadArticles(1);
      loadSources();
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.message || 'Feed import failed.' });
    } finally {
      setImportingFeed(false);
    }
  };

  const tabBtn = (id, label, icon) => {
    const Icon = icon;
    const active = activeTab === id;
    return (
      <button
        type="button"
        onClick={() => {
          setActiveTab(id);
          if (id === 'compose' && form.id) setForm(EMPTY_FORM);
        }}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
          active
            ? 'bg-amber-600 text-white'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
        }`}
      >
        <Icon className="w-4 h-4" />
        {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className={`text-2xl md:text-3xl font-serif font-bold ${BRONZE_COLOR} flex items-center gap-2.5`}>
              <Newspaper className="w-7 h-7" /> News &amp; Feed Manager
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Curate Homepage Recent News, post Calls for Action or New Media alerts, and pull live stories from RSS feeds.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/news"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md bg-gray-800 hover:bg-gray-700 border border-gray-700 text-amber-300"
            >
              View Public News Hub <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex flex-wrap gap-2.5">
          {tabBtn('manage', `Manage & Homepage (${articlesTotal})`, Newspaper)}
          {tabBtn('compose', form.id ? 'Edit News Story' : 'Add News Story', PlusCircle)}
          {tabBtn('feeds', `Feeds & Bulk Import (${sources.length})`, Rss)}
        </div>

        {/* Status Banner */}
        {banner && (
          <div
            className={`p-3.5 rounded-lg border text-sm flex items-center justify-between gap-3 ${
              banner.type === 'error'
                ? 'bg-red-950/70 border-red-700 text-red-200'
                : 'bg-emerald-950/70 border-emerald-700 text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {banner.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{banner.text}</span>
            </div>
            <button type="button" onClick={() => setBanner(null)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ===================== TAB 1: MANAGE & HOMEPAGE ===================== */}
        {activeTab === 'manage' && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadArticles(1);
                }}
                className="relative flex-1 min-w-[220px] max-w-md"
              >
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={filterQ}
                  onChange={(e) => setFilterQ(e.target.value)}
                  placeholder="Search headlines..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white"
                />
              </form>

              <select
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
              >
                <option value="">All Categories</option>
                {NEWS_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>

              <label className="inline-flex items-center gap-2 text-xs text-gray-300 cursor-pointer bg-gray-900 border border-gray-700 rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={filterHomepageOnly}
                  onChange={(e) => setFilterHomepageOnly(e.target.checked)}
                  className="accent-amber-500"
                />
                Homepage Only
              </label>

              <button
                type="button"
                onClick={() => loadArticles(1)}
                className="px-3 py-2 text-xs font-semibold bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-200"
              >
                Search
              </button>
            </div>

            {articlesLoading ? (
              <div className="py-12 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-amber-500" /> Loading stories...
              </div>
            ) : articles.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                No news stories match these filters. Try checking a feed or adding a story!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400">
                      <th className="py-2 pr-3">Homepage / Pin</th>
                      <th className="py-2 pr-3">Headline &amp; Details</th>
                      <th className="py-2 pr-3">Category</th>
                      <th className="py-2 pr-3">Linked</th>
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/60">
                    {articles.map((art) => {
                      const cat = getNewsCategoryMeta(art.category);
                      return (
                        <tr key={art.id} className="hover:bg-gray-700/30 align-top">
                          <td className="py-3 pr-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                title={art.showOnHomepage ? 'Remove from Homepage' : 'Show on Homepage'}
                                onClick={() => quickUpdate(art, { showOnHomepage: !art.showOnHomepage })}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium ${
                                  art.showOnHomepage
                                    ? 'bg-emerald-900/70 border-emerald-600 text-emerald-200'
                                    : 'bg-gray-900 border-gray-700 text-gray-500 hover:text-gray-200'
                                }`}
                              >
                                <Home className="w-3 h-3" />
                                {art.showOnHomepage ? 'Home' : 'Off'}
                              </button>
                              <button
                                type="button"
                                title={art.isPinned ? 'Unpin from Top' : 'Pin to Top'}
                                onClick={() =>
                                  quickUpdate(art, {
                                    isPinned: !art.isPinned,
                                    ...(!art.isPinned ? { showOnHomepage: true } : {}),
                                  })
                                }
                                className={`inline-flex items-center p-1.5 rounded border ${
                                  art.isPinned
                                    ? 'bg-amber-600 border-amber-400 text-white'
                                    : 'bg-gray-900 border-gray-700 text-gray-500 hover:text-amber-300'
                                }`}
                              >
                                <Pin className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 pr-3 max-w-md">
                            <div className="font-semibold text-gray-100 leading-snug">
                              {art.url ? (
                                <a
                                  href={art.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-amber-300"
                                >
                                  {art.headline}
                                  <ExternalLink className="inline w-3 h-3 ml-1 text-gray-500" />
                                </a>
                              ) : (
                                art.headline
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5">
                              {art.source?.name || art.sourceName || 'Manual'}
                              {art.status !== 'PUBLISHED' && (
                                <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-700 text-amber-300 text-[10px]">
                                  {art.status}
                                </span>
                              )}
                              {art.actionUrl && (
                                <span className="ml-2 text-orange-300">
                                  · CTA: {art.actionLabel || 'Take Action'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 pr-3 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${cat.badgeClass}`}>
                              {cat.label}
                            </span>
                          </td>
                          <td className="py-3 pr-3">
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {(art.individuals || []).map((ind) => (
                                <span
                                  key={ind.id}
                                  className="px-1.5 py-0.5 rounded bg-gray-900 border border-gray-700 text-amber-200 text-[10px]"
                                >
                                  {ind.firstName} {ind.lastName}
                                </span>
                              ))}
                              {art.mediaWork && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-700 text-amber-300 text-[10px]">
                                  {art.mediaWork.title}
                                </span>
                              )}
                              {!art.individuals?.length && !art.mediaWork && (
                                <span className="text-gray-600">—</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 pr-3 whitespace-nowrap text-gray-400">
                            {formatNewsDate(art.publishedAt) || 'Undated'}
                          </td>
                          <td className="py-3 text-right whitespace-nowrap space-x-1.5">
                            <button
                              type="button"
                              onClick={() => startEditArticle(art)}
                              className="inline-flex items-center px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200"
                            >
                              <Edit3 className="w-3 h-3 mr-1" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteArticle(art)}
                              className="inline-flex items-center px-2 py-1 rounded bg-red-900/60 hover:bg-red-800 text-red-200"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {articlesTotalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-gray-700 text-xs text-gray-400">
                <span>
                  Page {articlesPage} of {articlesTotalPages} ({articlesTotal.toLocaleString()} total)
                </span>
                <div className="space-x-2">
                  <button
                    type="button"
                    disabled={articlesPage <= 1}
                    onClick={() => loadArticles(articlesPage - 1)}
                    className="px-3 py-1 bg-gray-700 rounded disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={articlesPage >= articlesTotalPages}
                    onClick={() => loadArticles(articlesPage + 1)}
                    className="px-3 py-1 bg-gray-700 rounded disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 2: ADD / EDIT STORY ===================== */}
        {activeTab === 'compose' && (
          <form onSubmit={handleSaveForm} className={`bg-gray-800 border ${BRONZE_BORDER} rounded-xl p-6 space-y-5`}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-amber-300">
                {form.id ? `Editing News Story #${form.id}` : 'Add a News Story or Announcement'}
              </h2>
              {form.id && (
                <button
                  type="button"
                  onClick={() => setForm(EMPTY_FORM)}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Cancel Edit / Start Blank
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Headline *</label>
                <input
                  type="text"
                  required
                  value={form.headline}
                  onChange={(e) => setForm({ ...form, headline: e.target.value })}
                  placeholder="e.g., Sign the Petition: Urgent Clemency Call Ahead of Scheduled Hearing"
                  className="w-full p-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full p-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white"
                >
                  {NEWS_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Publish Date</label>
                <input
                  type="date"
                  value={form.publishedAt}
                  onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
                  className="w-full p-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Article URL (optional for internal announcements)</label>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://innocenceproject.org/news/..."
                  className="w-full p-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">News Source / Outlet</label>
                <select
                  value={form.sourceId}
                  onChange={(e) => {
                    const sid = e.target.value;
                    const found = sources.find((s) => String(s.id) === sid);
                    setForm({ ...form, sourceId: sid, sourceName: found ? found.name : form.sourceName });
                  }}
                  className="w-full p-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white"
                >
                  <option value="">— Custom / Other Outlet —</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {!form.sourceId && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Custom Outlet Name</label>
                  <input
                    type="text"
                    value={form.sourceName}
                    onChange={(e) => setForm({ ...form, sourceName: e.target.value })}
                    placeholder="e.g., Texas Tribune, AP News, Innocence Archive"
                    className="w-full p-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white"
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Short Summary (1–2 sentences shown on Homepage &amp; Hub)</label>
                <textarea
                  rows={3}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  placeholder="Concise summary of the case update, exoneration, media release, or call for action..."
                  className="w-full p-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white"
                />
              </div>
            </div>

            {/* Call for Action Box (always available, highlighted when CALL_FOR_ACTION selected) */}
            <div
              className={`rounded-lg p-4 border ${
                form.category === 'CALL_FOR_ACTION'
                  ? 'bg-orange-950/30 border-orange-500/70'
                  : 'bg-gray-900/60 border-gray-700'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-orange-300 mb-3">
                <Megaphone className="w-4 h-4" />
                Action Button (Optional — ideal for Petitions, Clemency Campaigns, or Phone Call Scripts)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Action URL (Petition / Phone Campaign Link)</label>
                  <input
                    type="url"
                    value={form.actionUrl}
                    onChange={(e) => setForm({ ...form, actionUrl: e.target.value })}
                    placeholder="https://innocenceproject.org/petitions/..."
                    className="w-full p-2 bg-gray-900 border border-gray-700 rounded text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Button Label</label>
                  <input
                    type="text"
                    value={form.actionLabel}
                    onChange={(e) => setForm({ ...form, actionLabel: e.target.value })}
                    placeholder='e.g., "Sign Petition" or "Call Governor"'
                    className="w-full p-2 bg-gray-900 border border-gray-700 rounded text-sm text-white"
                  />
                </div>
              </div>
            </div>

            {/* Link Individuals + Optional MediaWork */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Individuals Picker */}
              <div className="bg-gray-900/70 border border-gray-700 rounded-lg p-4 space-y-2.5">
                <label className="block text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Link to Individuals (appears in their profile&apos;s News section)
                </label>
                <input
                  type="text"
                  value={indSearch}
                  onChange={(e) => setIndSearch(e.target.value)}
                  placeholder="Type a name to search 4,151 individuals..."
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-xs text-white"
                />
                {indResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto bg-gray-800 border border-gray-700 rounded divide-y divide-gray-700 text-xs">
                    {indResults.map((ind) => (
                      <button
                        key={ind.id}
                        type="button"
                        onClick={() => {
                          if (!form.individuals.some((x) => x.id === ind.id)) {
                            setForm({ ...form, individuals: [...form.individuals, ind] });
                          }
                          setIndSearch('');
                          setIndResults([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-700 flex justify-between"
                      >
                        <span className="text-gray-100 font-medium">
                          {ind.firstName} {ind.lastName}
                          {ind.nickname ? ` "${ind.nickname}"` : ''}
                        </span>
                        <span className="text-gray-400">
                          {ind.caseLocationState || '?'} ({ind.convictionYear || '?'}→{ind.exonerationOrReleaseYear || '?'})
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {form.individuals.map((ind) => (
                    <span
                      key={ind.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-700 text-amber-200 text-xs"
                    >
                      {ind.firstName} {ind.lastName}
                      <button
                        type="button"
                        onClick={() =>
                          setForm({ ...form, individuals: form.individuals.filter((x) => x.id !== ind.id) })
                        }
                        className="hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {form.individuals.length === 0 && (
                    <span className="text-[11px] text-gray-500">No individuals linked yet.</span>
                  )}
                </div>
              </div>

              {/* Optional MediaWork Picker (great for NEW_MEDIA announcements) */}
              <div className="bg-gray-900/70 border border-gray-700 rounded-lg p-4 space-y-2.5">
                <label className="block text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" /> Link to a Book / Film / Podcast (optional, for New Media)
                </label>
                <input
                  type="text"
                  value={mediaSearch}
                  onChange={(e) => setMediaSearch(e.target.value)}
                  placeholder="Type a book, film, or podcast title..."
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-xs text-white"
                />
                {mediaResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto bg-gray-800 border border-gray-700 rounded divide-y divide-gray-700 text-xs">
                    {mediaResults.map((mw) => (
                      <button
                        key={mw.id}
                        type="button"
                        onClick={() => {
                          setForm({ ...form, mediaWork: mw });
                          setMediaSearch('');
                          setMediaResults([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-700 flex justify-between"
                      >
                        <span className="text-gray-100 font-medium">{mw.title}</span>
                        <span className="text-gray-400">{mw.workType}</span>
                      </button>
                    ))}
                  </div>
                )}
                {form.mediaWork ? (
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-700 text-amber-200 text-xs">
                    {form.mediaWork.title} ({form.mediaWork.workType})
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, mediaWork: null })}
                      className="hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-gray-500">No media work linked.</span>
                )}
              </div>
            </div>

            {/* Placement & Status Controls */}
            <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-gray-700">
              <label className="inline-flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.showOnHomepage}
                  onChange={(e) => setForm({ ...form, showOnHomepage: e.target.checked })}
                  className="accent-amber-500 w-4 h-4"
                />
                Show in Homepage Recent News
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPinned}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      isPinned: e.target.checked,
                      ...(e.target.checked ? { showOnHomepage: true } : {}),
                    })
                  }
                  className="accent-amber-500 w-4 h-4"
                />
                Pin to Top (Lead Story)
              </label>

              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-200"
              >
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="DRAFT">DRAFT</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>

              <button
                type="submit"
                disabled={savingForm}
                className="ml-auto px-6 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold"
              >
                {savingForm ? 'Saving...' : form.id ? 'Save Changes' : 'Publish Story'}
              </button>
            </div>
          </form>
        )}

        {/* ===================== TAB 3: RSS NEWS FEEDS & BULK JSON IMPORT ===================== */}
        {activeTab === 'feeds' && (
          <div className="space-y-6">
            {/* Bulk JSON Upload Card */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-amber-300 flex items-center gap-2">
                  <Upload className="w-5 h-5" /> Bulk Import News from JSON
                </h2>
                <p className="text-xs text-gray-400">
                  Upload a news array JSON file (such as <code className="text-amber-200/90">delta_news_2025_2026_bulk.json</code>) to preview duplicates, auto-match mentioned individuals in your archive, and commit in one click.
                </p>
              </div>
              <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer shrink-0 transition-colors">
                {uploadingJson ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Matching Stories...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" /> Choose JSON File
                  </>
                )}
                <input
                  type="file"
                  accept=".json,application/json"
                  disabled={uploadingJson}
                  onChange={handleBulkJsonFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Existing Sources Table */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
              <h2 className="text-lg font-semibold text-amber-300 flex items-center gap-2">
                <Rss className="w-5 h-5" /> Configured News Feeds
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sources.map((src) => (
                  <div
                    key={src.id}
                    className="bg-gray-900 border border-gray-700 rounded-lg p-4 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-white text-sm">{src.name}</h3>
                        <span className="text-[11px] text-gray-400">
                          {src._count?.articles || 0} stories
                        </span>
                      </div>
                      {src.feedUrl ? (
                        <p className="text-[11px] text-blue-400 truncate mt-1" title={src.feedUrl}>
                          {src.feedUrl}
                        </p>
                      ) : (
                        <p className="text-[11px] text-gray-500 italic mt-1">Manual / internal source (no RSS)</p>
                      )}
                      {src.notes && <p className="text-xs text-gray-400 mt-1.5">{src.notes}</p>}
                      <p className="text-[10.5px] text-gray-500 mt-2">
                        Last checked: {src.lastCheckedAt ? new Date(src.lastCheckedAt).toLocaleString() : 'Never'}
                      </p>
                    </div>

                    {src.feedUrl && (
                      <button
                        type="button"
                        disabled={checkingSourceId === src.id}
                        onClick={() => handleCheckFeed(src)}
                        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${checkingSourceId === src.id ? 'animate-spin' : ''}`} />
                        {checkingSourceId === src.id ? 'Checking Live Feed...' : 'Check Feed for New Stories'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Live Feed Preview Results */}
            {feedPreview && (
              <div className={`bg-gray-800 border ${BRONZE_BORDER} rounded-xl p-5 space-y-4`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      Preview Results: {feedPreview.source?.name}
                    </h3>
                    <p className="text-xs text-gray-400">
                      Loaded {feedPreview.totalFetched} stories ·{' '}
                      <strong className="text-emerald-300">{feedPreview.newCount} new</strong>
                      {typeof feedPreview.matchedArticleCount === 'number' && (
                        <>
                          {' '}· <strong className="text-amber-300">{feedPreview.matchedArticleCount} linked to individuals</strong>
                        </>
                      )}{' '}
                      (auto-matched against {feedPreview.totalIndividualsChecked ? feedPreview.totalIndividualsChecked.toLocaleString() : 'your archive’s'} individuals)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFeedPreview((prev) => ({
                          ...prev,
                          items: prev.items.map((it) => ({ ...it, selected: !it.alreadyImported })),
                        }))
                      }
                      className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-200"
                    >
                      Select All New
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFeedPreview((prev) => ({
                          ...prev,
                          items: prev.items.map((it) => ({ ...it, selected: false })),
                        }))
                      }
                      className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-200"
                    >
                      Deselect All
                    </button>
                    <button
                      type="button"
                      disabled={importingFeed}
                      onClick={handleImportSelectedFeedItems}
                      className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white"
                    >
                      {importingFeed
                        ? 'Adding Stories...'
                        : `Add Selected (${feedPreview.items.filter((i) => i.selected && !i.alreadyImported).length})`}
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
                  {feedPreview.items.map((it) => (
                    <div
                      key={it.tempIndex}
                      className={`p-3.5 rounded-lg border text-xs flex flex-col md:flex-row md:items-start gap-3 ${
                        it.alreadyImported
                          ? 'bg-gray-900/40 border-gray-800 opacity-55'
                          : it.selected
                            ? 'bg-gray-900 border-amber-600/60'
                            : 'bg-gray-900/70 border-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={it.alreadyImported}
                        checked={it.selected && !it.alreadyImported}
                        onChange={(e) => updatePreviewItem(it.tempIndex, { selected: e.target.checked })}
                        className="accent-amber-500 mt-1 w-4 h-4 shrink-0"
                      />

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <a
                            href={it.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-sm text-gray-100 hover:text-amber-300"
                          >
                            {it.headline}
                            <ExternalLink className="inline w-3 h-3 ml-1 text-gray-500" />
                          </a>
                          {it.alreadyImported && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[10px]">
                              Already in Archive
                            </span>
                          )}
                        </div>
                        {it.summary && <p className="text-gray-400 line-clamp-2">{it.summary}</p>}
                        <div className="flex items-center flex-wrap gap-1.5 text-[11px] text-gray-500">
                          <span>{formatNewsDate(it.publishedAt) || 'No date'}</span>
                          {it.sourceName && (
                            <span className="text-gray-400">· {it.sourceName}</span>
                          )}
                          {it.matchedIndividuals?.length > 0 && (
                            <div className="flex items-center flex-wrap gap-1.5 ml-1">
                              <span className="text-amber-300/90 font-medium">Matched:</span>
                              {it.matchedIndividuals.map((m) => {
                                const isLinked = (it.selectedIndIds || []).includes(m.id);
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    disabled={it.alreadyImported}
                                    onClick={() => toggleMatchedIndividual(it.tempIndex, m.id)}
                                    title={isLinked ? 'Click to unlink this individual' : 'Click to link this individual'}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10.5px] transition-colors ${
                                      isLinked
                                        ? 'bg-amber-950/70 border-amber-600/70 text-amber-200 hover:bg-amber-900/70'
                                        : 'bg-gray-800 border-gray-700 text-gray-500 line-through hover:text-gray-300'
                                    }`}
                                  >
                                    <User className="w-2.5 h-2.5" />
                                    {m.name}
                                    {m.state ? ` (${m.state})` : ''}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {!it.alreadyImported && (
                        <div className="flex flex-wrap md:flex-col items-end gap-2 shrink-0">
                          <select
                            value={it.category}
                            onChange={(e) => updatePreviewItem(it.tempIndex, { category: e.target.value })}
                            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                          >
                            {NEWS_CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                          <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={it.showOnHomepage}
                              onChange={(e) =>
                                updatePreviewItem(it.tempIndex, { showOnHomepage: e.target.checked })
                              }
                              className="accent-emerald-500"
                            />
                            Show on Home
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New News Source Form */}
            <form onSubmit={handleAddSource} className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-200">Add a New RSS / News Source</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={newSource.name}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  placeholder="Outlet Name (e.g., Death Penalty Info Center)"
                  className="p-2 bg-gray-900 border border-gray-700 rounded text-xs text-white"
                />
                <input
                  type="url"
                  value={newSource.feedUrl}
                  onChange={(e) => setNewSource({ ...newSource, feedUrl: e.target.value })}
                  placeholder="RSS / Atom Feed URL (https://.../feed/)"
                  className="p-2 bg-gray-900 border border-gray-700 rounded text-xs text-white"
                />
                <input
                  type="url"
                  value={newSource.websiteUrl}
                  onChange={(e) => setNewSource({ ...newSource, websiteUrl: e.target.value })}
                  placeholder="Website URL (optional)"
                  className="p-2 bg-gray-900 border border-gray-700 rounded text-xs text-white"
                />
              </div>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newSource.notes}
                  onChange={(e) => setNewSource({ ...newSource, notes: e.target.value })}
                  placeholder="Notes (optional)"
                  className="flex-1 p-2 bg-gray-900 border border-gray-700 rounded text-xs text-white"
                />
                <button
                  type="submit"
                  disabled={addingSource}
                  className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-xs font-semibold text-white"
                >
                  {addingSource ? 'Adding...' : 'Add News Source'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminNewsPage;
