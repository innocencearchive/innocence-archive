// src/pages/AdminVerifyPage.jsx
// Unified Validation Queue across Individuals, Media Items, Media Works, Organizations, Involved Persons

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertOctagon,
  ExternalLink,
  RefreshCw,
  Edit3,
  Trash2,
  Eye,
  Search,
  X,
} from 'lucide-react';
import apiClient from '../apiClient';
import { BRONZE_COLOR } from '../components/themeconstants';
import AdminRecordInspectorModal from '../components/AdminRecordInspectorModal';

const STATUS_BADGE = {
  UNVERIFIED: 'bg-amber-900/70 text-amber-300 border-amber-700',
  IN_REVIEW: 'bg-blue-900/70 text-blue-300 border-blue-700',
  DISPUTED: 'bg-red-900/70 text-red-300 border-red-700',
  VERIFIED: 'bg-green-900/70 text-green-300 border-green-700',
};

function AdminVerifyPage() {
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [data, setData] = useState({ counts: {}, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notesByKey, setNotesByKey] = useState({});
  const [busyKey, setBusyKey] = useState(null);
  const [inspector, setInspector] = useState(null); // { item, mode: 'preview' | 'edit' }

  const openInspector = (item, mode = 'preview') => {
    setInspector({ item, mode });
  };

  const inspectedIdx = inspector
    ? data.items.findIndex((x) => x.resource === inspector.item.resource && x.id === inspector.item.id)
    : -1;

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { status: statusFilter, type: typeFilter };
      if (appliedSearch.trim()) params.q = appliedSearch.trim();
      const res = await apiClient.get('/admin/tools/validation-queue', { params });
      setData(res.data || { counts: {}, items: [] });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load validation queue.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, appliedSearch]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleSetStatus = async (item, nextStatus) => {
    const key = `${item.resource}-${item.id}`;
    setBusyKey(key);
    try {
      const notes = notesByKey[key] !== undefined ? notesByKey[key] : item.verificationNotes;
      await apiClient.patch(`/admin/verify/${item.resource}/${item.id}`, {
        verificationStatus: nextStatus,
        verified: nextStatus === 'VERIFIED',
        verificationNotes: notes,
      });
      await loadQueue();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm(
      `Permanently delete ${item.entityLabel} #${item.id} ("${item.title}")?\n\nThis removes the record from the database and cannot be undone.`
    );
    if (!confirmed) return;

    const key = `${item.resource}-${item.id}`;
    setBusyKey(key);
    try {
      await apiClient.delete(`/admin/${item.resource}/${item.id}`);
      await loadQueue();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete record.');
    } finally {
      setBusyKey(null);
    }
  };

  const typeTabs = [
    { key: 'ALL', label: `All (${(data.counts?.all ?? 0).toLocaleString()})` },
    { key: 'individuals', label: `Individuals (${(data.counts?.individuals ?? 0).toLocaleString()})` },
    { key: 'mediaitems', label: `Media Items (${(data.counts?.mediaitems ?? 0).toLocaleString()})` },
    { key: 'mediaworks', label: `Media Works (${(data.counts?.mediaworks ?? 0).toLocaleString()})` },
    { key: 'organizations', label: `Organizations (${(data.counts?.organizations ?? 0).toLocaleString()})` },
    { key: 'involvedpersons', label: `Involved Persons (${(data.counts?.involvedpersons ?? 0).toLocaleString()})` },
  ];

  const activeTotalCount =
    typeFilter === 'ALL' ? (data.counts?.all ?? 0) : (data.counts?.[typeFilter] ?? 0);

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8 text-gray-200">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-700 pb-4">
          <div>
            <h1 className={`text-2xl md:text-3xl font-semibold ${BRONZE_COLOR} flex items-center`}>
              <ShieldCheck size={28} className="mr-3" /> Unified Validation Queue
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Review, verify, flag, or dispute pending records across every entity in one place.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-xs text-gray-100"
            >
              <option value="PENDING">Pending (Unverified + In Review)</option>
              <option value="UNVERIFIED">Unverified Only</option>
              <option value="IN_REVIEW">In Review Only</option>
              <option value="DISPUTED">Disputed Only</option>
              <option value="ALL">All Non-Verified</option>
            </select>
            <button
              type="button"
              onClick={loadQueue}
              className="inline-flex items-center px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md text-xs"
            >
              <RefreshCw size={14} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {/* Entity Filter Tabs + Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-xs">
            {typeTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTypeFilter(tab.key)}
                className={`px-3 py-1.5 rounded-full border font-medium ${
                  typeFilter === tab.key
                    ? 'bg-amber-600 text-white border-amber-500'
                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAppliedSearch(searchInput.trim());
            }}
            className="flex items-center gap-2 w-full lg:w-auto"
          >
            <div className="relative flex-1 lg:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, title, #ID, state, batch..."
                className="w-full pl-8 pr-7 py-1.5 bg-gray-800 border border-gray-700 rounded-md text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500"
              />
              {(searchInput || appliedSearch) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setAppliedSearch('');
                  }}
                  title="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium shrink-0"
            >
              Search
            </button>
          </form>
        </div>

        {!loading && activeTotalCount > data.items.length && (
          <p className="text-xs text-gray-400">
            Showing the <strong className="text-gray-200">{data.items.length.toLocaleString()}</strong> most recently updated of{' '}
            <strong className="text-amber-300">{activeTotalCount.toLocaleString()}</strong> matching records — use the search bar above to jump directly to any entry.
          </p>
        )}

        {error && (
          <div className="p-3 bg-red-950/70 border border-red-700 rounded text-sm text-red-300">{error}</div>
        )}

        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading validation queue...</div>
        ) : data.items.length === 0 ? (
          <div className="py-12 text-center bg-gray-800/60 border border-gray-700 rounded-lg">
            <CheckCircle2 size={36} className="mx-auto text-green-400 mb-2" />
            <p className="text-gray-200 font-medium">Queue is clear for this filter!</p>
            <p className="text-xs text-gray-400 mt-1">
              Import new records in the <Link to="/admin/import" className="text-amber-400 hover:underline">Import Queue</Link> or check another status filter.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.items.map((item) => {
              const key = `${item.resource}-${item.id}`;
              const isBusy = busyKey === key;
              const notesVal = notesByKey[key] !== undefined ? notesByKey[key] : item.verificationNotes;

              return (
                <div
                  key={key}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 text-[11px] font-semibold uppercase rounded bg-gray-700 text-amber-300">
                          {item.entityLabel} #{item.id}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[11px] font-medium rounded border ${
                            STATUS_BADGE[item.verificationStatus] || ''
                          }`}
                        >
                          {item.verificationStatus}
                        </span>
                        {item.aiGenerated && (
                          <span className="px-2 py-0.5 text-[11px] rounded bg-purple-900/60 text-purple-300">
                            AI-Assisted
                          </span>
                        )}
                        {item.ingestionSource && (
                          <span className="text-[11px] text-gray-400">
                            Source tag: <strong className="text-gray-300">{item.ingestionSource}</strong>
                          </span>
                        )}
                        {item.importBatchId && (
                          <span className="text-[11px] text-gray-500">Batch: {item.importBatchId}</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => openInspector(item, 'preview')}
                        className="text-left text-base font-semibold text-gray-100 hover:text-amber-300 transition-colors"
                      >
                        {item.title}
                      </button>
                      {item.subtitle && <p className="text-xs text-gray-400">{item.subtitle}</p>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openInspector(item, 'preview')}
                        className="inline-flex items-center px-2.5 py-1.5 rounded bg-amber-600/90 hover:bg-amber-600 text-white text-xs font-medium"
                      >
                        <Eye size={14} className="mr-1" /> Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => openInspector(item, 'edit')}
                        className="inline-flex items-center px-2.5 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium"
                      >
                        <Edit3 size={14} className="mr-1" /> Edit
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleSetStatus(item, 'VERIFIED')}
                        className="inline-flex items-center px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-xs font-medium"
                      >
                        <CheckCircle2 size={14} className="mr-1" /> Verify
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleSetStatus(item, 'IN_REVIEW')}
                        className="inline-flex items-center px-2.5 py-1.5 rounded bg-blue-800 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium"
                      >
                        <Clock size={14} className="mr-1" /> In Review
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleSetStatus(item, 'DISPUTED')}
                        className="inline-flex items-center px-2.5 py-1.5 rounded bg-red-800 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-medium"
                      >
                        <AlertOctagon size={14} className="mr-1" /> Dispute
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDelete(item)}
                        title="Permanently delete this record"
                        className="inline-flex items-center px-2.5 py-1.5 rounded bg-red-950/90 hover:bg-red-900 border border-red-700/70 disabled:opacity-40 text-red-200 text-xs font-medium"
                      >
                        <Trash2 size={14} className="mr-1" /> Delete
                      </button>
                    </div>
                  </div>

                  {item.summary && (
                    <p className="text-xs text-gray-300 bg-gray-900/60 p-2.5 rounded line-clamp-3">
                      {item.summary}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    {item.sources.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-gray-400">Sources:</span>
                        {item.sources.map((s, idx) => (
                          <a
                            key={idx}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-blue-400 hover:underline"
                          >
                            {s.label}
                            <ExternalLink size={11} className="ml-1" />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span className="text-amber-400/80 italic">No primary source link attached</span>
                    )}

                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.tags.slice(0, 6).map((t, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-gray-700 text-gray-200 rounded text-[11px]">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <input
                      type="text"
                      value={notesVal}
                      onChange={(e) => setNotesByKey((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder="Optional verification / review notes (saved when you click Verify, In Review, or Dispute)..."
                      className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-gray-200"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {inspector && (
        <AdminRecordInspectorModal
          item={inspector.item}
          initialMode={inspector.mode}
          onClose={() => setInspector(null)}
          onUpdated={loadQueue}
          hasPrev={inspectedIdx > 0}
          hasNext={inspectedIdx >= 0 && inspectedIdx < data.items.length - 1}
          onPrev={() => {
            if (inspectedIdx > 0) {
              setInspector({ item: data.items[inspectedIdx - 1], mode: 'preview' });
            }
          }}
          onNext={() => {
            if (inspectedIdx >= 0 && inspectedIdx < data.items.length - 1) {
              setInspector({ item: data.items[inspectedIdx + 1], mode: 'preview' });
            }
          }}
        />
      )}
    </div>
  );
}

export default AdminVerifyPage;
