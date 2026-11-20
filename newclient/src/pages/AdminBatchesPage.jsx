// src/pages/AdminBatchesPage.jsx
// Import Batch History: inspect committed batches, bulk-verify trusted batches, or safely roll back a batch

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, CheckCircle2, Trash2, RefreshCw, Package } from 'lucide-react';
import apiClient from '../apiClient';
import { BRONZE_COLOR } from '../components/themeconstants';

function AdminBatchesPage() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [busyBatch, setBusyBatch] = useState(null);

  const loadBatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/admin/tools/batches');
      setBatches(res.data?.batches || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load import batches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handleBulkVerify = async (batchId) => {
    if (!window.confirm(`Mark ALL records in batch "${batchId}" as VERIFIED?`)) return;
    setBusyBatch(batchId);
    setMessage(null);
    setError(null);
    try {
      const res = await apiClient.post(`/admin/tools/batches/${encodeURIComponent(batchId)}/verify`);
      setMessage(res.data.message);
      await loadBatches();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to verify batch.');
    } finally {
      setBusyBatch(null);
    }
  };

  const handleRollback = async (batchId, total) => {
    if (
      !window.confirm(
        `ROLL BACK batch "${batchId}"? This will PERMANENTLY DELETE all ${total} record(s) tagged with this batch ID.`
      )
    ) {
      return;
    }
    const typed = window.prompt(`Type "${batchId}" to confirm permanent rollback:`);
    if (typed !== batchId) return;

    setBusyBatch(batchId);
    setMessage(null);
    setError(null);
    try {
      const res = await apiClient.delete(`/admin/tools/batches/${encodeURIComponent(batchId)}`);
      setMessage(res.data.message);
      await loadBatches();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to roll back batch.');
    } finally {
      setBusyBatch(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8 text-gray-200">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-700 pb-4">
          <div>
            <h1 className={`text-2xl md:text-3xl font-semibold ${BRONZE_COLOR} flex items-center`}>
              <History size={28} className="mr-3" /> Import Batch History &amp; Rollback
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Track every committed import batch, bulk-verify trusted sources, or cleanly roll back a bad import.
            </p>
          </div>
          <button
            type="button"
            onClick={loadBatches}
            className="inline-flex items-center px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md text-xs"
          >
            <RefreshCw size={14} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
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

        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading batches...</div>
        ) : batches.length === 0 ? (
          <div className="py-12 text-center bg-gray-800/60 border border-gray-700 rounded-lg">
            <Package size={36} className="mx-auto text-gray-500 mb-2" />
            <p className="text-gray-300 font-medium">No tagged import batches yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              Commit a batch from the <Link to="/admin/import" className="text-amber-400 hover:underline">Import Queue</Link> to see it tracked here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {batches.map((b) => {
              const pct = b.total > 0 ? Math.round((b.verified / b.total) * 100) : 0;
              const isBusy = busyBatch === b.batchId;
              return (
                <div
                  key={b.batchId}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-amber-300">{b.batchId}</span>
                      <span className="px-2 py-0.5 text-[11px] rounded bg-gray-700 text-gray-300">
                        {b.ingestionSource}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(b.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-gray-300">
                      <span>Total: <strong>{b.total}</strong></span>
                      {b.breakdown.individuals > 0 && <span>Individuals: {b.breakdown.individuals}</span>}
                      {b.breakdown.mediaWorks > 0 && <span>Media Works: {b.breakdown.mediaWorks}</span>}
                      {b.breakdown.mediaItems > 0 && <span>Media Items: {b.breakdown.mediaItems}</span>}
                      {b.breakdown.organizations > 0 && <span>Organizations: {b.breakdown.organizations}</span>}
                      {b.breakdown.involvedPersons > 0 && <span>Involved Persons: {b.breakdown.involvedPersons}</span>}
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <div className="w-40 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-gray-400">
                        {b.verified}/{b.total} verified ({pct}%)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {b.unverified > 0 && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleBulkVerify(b.batchId)}
                        className="inline-flex items-center px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-xs font-medium"
                      >
                        <CheckCircle2 size={14} className="mr-1" /> Bulk Verify ({b.unverified})
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleRollback(b.batchId, b.total)}
                      className="inline-flex items-center px-3 py-1.5 rounded bg-red-800 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-medium"
                    >
                      <Trash2 size={14} className="mr-1" /> Roll Back
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminBatchesPage;
