// src/pages/AdminAuditPage.jsx
// Data Health & Audit Dashboard + Live Duplicate Individual Resolver / Merger

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  GitMerge,
  RefreshCw,
  CheckCircle2,
  Link2,
} from 'lucide-react';
import apiClient from '../apiClient';
import { BRONZE_COLOR } from '../components/themeconstants';

function AdminAuditPage() {
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('duplicatePairs');
  const [mergingKey, setMergingKey] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const loadAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/admin/tools/audit');
      setAudit(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to run data audit.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, []);

  const handleMerge = async (keepId, mergeId, keepName, mergeName) => {
    if (
      !window.confirm(
        `Merge #${mergeId} (${mergeName}) INTO #${keepId} (${keepName})?\n\nAll source links, contributing factors, organizations, groups, and media appearances will be preserved on #${keepId}, and #${mergeId} will be deleted.`
      )
    ) {
      return;
    }

    const key = `${keepId}-${mergeId}`;
    setMergingKey(key);
    setMessage(null);
    setError(null);
    try {
      const res = await apiClient.post('/admin/tools/merge-individuals', { keepId, mergeId });
      setMessage(res.data.message);
      await loadAudit();
    } catch (err) {
      setError(err.response?.data?.message || 'Merge failed.');
    } finally {
      setMergingKey(null);
    }
  };

  const t = audit?.totals || {};
  const s = audit?.samples || {};

  const cards = [
    { key: 'duplicatePairs', label: 'Potential Duplicates', count: t.potentialDuplicates ?? 0, warn: (t.potentialDuplicates ?? 0) > 0 },
    { key: 'missingSources', label: 'Missing Primary Source', count: t.missingSources ?? 0, warn: (t.missingSources ?? 0) > 0 },
    { key: 'missingCrime', label: 'Missing Crime Category', count: t.missingCrime ?? 0, warn: (t.missingCrime ?? 0) > 0 },
    { key: 'missingState', label: 'Missing State', count: t.missingState ?? 0, warn: (t.missingState ?? 0) > 0 },
    { key: 'missingFactors', label: 'Missing Factors', count: t.missingFactors ?? 0, warn: (t.missingFactors ?? 0) > 0 },
    { key: 'unlinkedMediaItems', label: 'Unlinked Media Items', count: t.unlinkedMediaItems ?? 0, warn: (t.unlinkedMediaItems ?? 0) > 0 },
  ];

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8 text-gray-200">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-700 pb-4">
          <div>
            <h1 className={`text-2xl md:text-3xl font-semibold ${BRONZE_COLOR} flex items-center`}>
              <Activity size={28} className="mr-3" /> Data Health &amp; Audit Dashboard
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Spot missing citations, incomplete fields, unlinked media, and safely merge duplicate individuals.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAudit}
            className="inline-flex items-center px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md text-xs"
          >
            <RefreshCw size={14} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Re-run Audit
          </button>
        </div>

        {message && (
          <div className="p-3 bg-green-950/70 border border-green-700 rounded text-sm text-green-300">
            {message}
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-950/70 border border-red-700 rounded text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Scorecard Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {cards.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setActiveTab(c.key)}
              className={`p-4 rounded-lg border text-left transition-colors ${
                activeTab === c.key
                  ? 'bg-gray-800 border-amber-500'
                  : 'bg-gray-800/70 border-gray-700 hover:bg-gray-800'
              }`}
            >
              <div className={`text-2xl font-bold ${c.warn ? 'text-amber-400' : 'text-green-400'}`}>
                {loading ? '…' : c.count}
              </div>
              <div className="text-xs text-gray-300 mt-1">{c.label}</div>
            </button>
          ))}
        </div>

        {/* Active Drill-Down Panel */}
        {!loading && audit && (
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-5 space-y-4">
            {activeTab === 'duplicatePairs' ? (
              <>
                <h2 className="text-lg font-semibold text-amber-400 flex items-center">
                  <GitMerge size={18} className="mr-2" /> Potential Duplicate Individuals
                </h2>
                {(s.duplicatePairs || []).length === 0 ? (
                  <p className="text-sm text-green-400 flex items-center">
                    <CheckCircle2 size={16} className="mr-2" /> No potential duplicate individuals detected!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {s.duplicatePairs.map(({ a, b }) => {
                      const nameA = [a.firstName, a.middleName, a.lastName, a.suffix].filter(Boolean).join(' ');
                      const nameB = [b.firstName, b.middleName, b.lastName, b.suffix].filter(Boolean).join(' ');
                      return (
                        <div
                          key={`${a.id}-${b.id}`}
                          className="p-4 bg-gray-900 border border-gray-700 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4 items-center text-xs"
                        >
                          <div>
                            <div className="font-semibold text-gray-100">
                              #{a.id} {nameA}
                            </div>
                            <div className="text-gray-400">
                              {a.caseLocationState || 'No state'} · {a.convictionYear || '?'} → {a.exonerationOrReleaseYear || '?'}
                            </div>
                            <div className="text-gray-500">
                              {a.verificationStatus} · {a._count?.sourceLinks || 0} source(s) · {a._count?.mediaItemAppearances || 0} media
                            </div>
                          </div>

                          <div>
                            <div className="font-semibold text-gray-100">
                              #{b.id} {nameB}
                            </div>
                            <div className="text-gray-400">
                              {b.caseLocationState || 'No state'} · {b.convictionYear || '?'} → {b.exonerationOrReleaseYear || '?'}
                            </div>
                            <div className="text-gray-500">
                              {b.verificationStatus} · {b._count?.sourceLinks || 0} source(s) · {b._count?.mediaItemAppearances || 0} media
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 justify-end">
                            <button
                              type="button"
                              disabled={mergingKey !== null}
                              onClick={() => handleMerge(a.id, b.id, nameA, nameB)}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded font-medium"
                            >
                              Keep #{a.id} (Merge #{b.id})
                            </button>
                            <button
                              type="button"
                              disabled={mergingKey !== null}
                              onClick={() => handleMerge(b.id, a.id, nameB, nameA)}
                              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-200 rounded font-medium"
                            >
                              Keep #{b.id} (Merge #{a.id})
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : activeTab === 'unlinkedMediaItems' ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-amber-400 flex items-center">
                    <AlertTriangle size={18} className="mr-2" /> Unlinked Media Items (No Featured Individual)
                  </h2>
                  <Link to="/admin/manage/mediaitems" className="text-xs text-amber-400 hover:underline">
                    Open Media Items Manager →
                  </Link>
                </div>
                {(s.unlinkedMediaItems || []).length === 0 ? (
                  <p className="text-sm text-green-400">All media items are linked to at least one individual.</p>
                ) : (
                  <ul className="divide-y divide-gray-700 text-xs">
                    {s.unlinkedMediaItems.map((m) => (
                      <li key={m.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-100">#{m.id} {m.itemTitle || '(Untitled)'}</span>
                          <span className="text-gray-400 ml-2">
                            {m.work?.title} · {m.itemMediaType}
                          </span>
                        </div>
                        <span className="text-gray-500">{m.verificationStatus}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-amber-400 flex items-center">
                    <Link2 size={18} className="mr-2" /> {cards.find((c) => c.key === activeTab)?.label} (up to 50)
                  </h2>
                  <Link to="/admin/manage/individuals" className="text-xs text-amber-400 hover:underline">
                    Open Individuals Manager →
                  </Link>
                </div>
                {(s[activeTab] || []).length === 0 ? (
                  <p className="text-sm text-green-400 flex items-center">
                    <CheckCircle2 size={16} className="mr-2" /> No issues found in this category!
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-700 text-xs">
                    {(s[activeTab] || []).map((ind) => (
                      <li key={ind.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-100">
                            #{ind.id} {ind.firstName} {ind.lastName}
                          </span>
                          <span className="text-gray-400 ml-2">
                            {ind.caseLocationState || 'No state'}
                          </span>
                        </div>
                        <span className="text-gray-500">{ind.verificationStatus}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default AdminAuditPage;
