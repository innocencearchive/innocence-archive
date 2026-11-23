// src/pages/AdminImportPage.jsx
// On-site Import Staging & Validation Queue for safely rebuilding & expanding the archive

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  Database,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  GitMerge,
  RefreshCw,
  FileSpreadsheet,
  Play,
  ShieldCheck,
} from 'lucide-react';
import apiClient from '../apiClient';
import { BRONZE_COLOR, BRONZE_BORDER } from '../components/themeconstants';

const PAGE_SIZE = 100;
const COMMIT_CHUNK_SIZE = 100;

const MATCH_BADGE_STYLES = {
  NEW: 'bg-green-900/70 text-green-300 border-green-700',
  EXACT_MATCH: 'bg-blue-900/70 text-blue-300 border-blue-700',
  FUZZY_DUPLICATE: 'bg-amber-900/70 text-amber-300 border-amber-700',
  INVALID: 'bg-red-900/70 text-red-300 border-red-700',
};

function AdminImportPage() {
  // Core lookup status
  const [coreStatus, setCoreStatus] = useState(null);
  const [seedingCore, setSeedingCore] = useState(false);
  const [coreMessage, setCoreMessage] = useState(null);

  // Step 1: Upload / Paste config
  const [targetType, setTargetType] = useState('INDIVIDUAL');
  const [inputType, setInputType] = useState('CSV');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [defaultSourceName, setDefaultSourceName] = useState('National Registry of Exonerations');
  const [defaultSourceUrl, setDefaultSourceUrl] = useState('');
  const [defaultStatus, setDefaultStatus] = useState('');
  const [defaultClaimStrength, setDefaultClaimStrength] = useState('UNASSESSED');
  const [verificationStatus, setVerificationStatus] = useState('UNVERIFIED');
  const [ingestionSource, setIngestionSource] = useState('admin_import_queue');

  // Step 2: Preview state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [batchId, setBatchId] = useState(null);
  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  // Step 3: Commit state
  const [committing, setCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState('');
  const [commitResult, setCommitResult] = useState(null);

  const loadCoreStatus = async () => {
    try {
      const res = await apiClient.get('/admin/import/core-status');
      setCoreStatus(res.data);
    } catch (err) {
      console.error('Failed to load core lookup status:', err);
    }
  };

  useEffect(() => {
    loadCoreStatus();
  }, []);

  const handleSeedCore = async () => {
    setSeedingCore(true);
    setCoreMessage(null);
    try {
      const res = await apiClient.post('/admin/import/seed-core');
      setCoreMessage(
        `Initialized ${res.data.factorsUpserted} Contributing Factors, ${res.data.crimesUpserted} Crime Categories, and ${res.data.sourcesUpserted} Information Sources.`
      );
      await loadCoreStatus();
    } catch (err) {
      setCoreMessage(`Error: ${err.response?.data?.message || err.message}`);
    } finally {
      setSeedingCore(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (file.name.toLowerCase().endsWith('.json')) {
      setInputType('JSON');
    } else {
      setInputType('CSV');
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawText(String(ev.target?.result || ''));
    };
    reader.readAsText(file);
  };

  const handlePreview = async (e) => {
    e.preventDefault();
    setPreviewLoading(true);
    setPreviewError(null);
    setCommitResult(null);
    setPage(1);
    setStatusFilter('ALL');

    try {
      const res = await apiClient.post('/admin/import/preview', {
        targetType,
        inputType,
        rawText,
        defaultSourceName,
        defaultSourceUrl,
        defaultStatus,
        defaultClaimStrength,
      });
      setBatchId(res.data.batchId);
      setRows(res.data.rows || []);
    } catch (err) {
      setPreviewError(err.response?.data?.message || err.message || 'Preview failed.');
      setRows([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const updateRowAction = (rowIndex, newAction) => {
    setRows((prev) =>
      prev.map((r) => (r.rowIndex === rowIndex ? { ...r, action: newAction } : r))
    );
  };

  const applyBulkAction = (predicate, action) => {
    setRows((prev) =>
      prev.map((r) => (predicate(r) ? { ...r, action } : r))
    );
  };

  const counts = useMemo(() => {
    return {
      total: rows.length,
      NEW: rows.filter((r) => r.matchStatus === 'NEW').length,
      EXACT_MATCH: rows.filter((r) => r.matchStatus === 'EXACT_MATCH').length,
      FUZZY_DUPLICATE: rows.filter((r) => r.matchStatus === 'FUZZY_DUPLICATE').length,
      INVALID: rows.filter((r) => r.matchStatus === 'INVALID').length,
      toCreate: rows.filter((r) => r.action === 'CREATE').length,
      toMerge: rows.filter((r) => r.action === 'MERGE').length,
      toSkip: rows.filter((r) => r.action === 'SKIP').length,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (statusFilter === 'ALL') return rows;
    return rows.filter((r) => r.matchStatus === statusFilter);
  }, [rows, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const handleCommit = async () => {
    const activeRows = rows.filter((r) => r.action === 'CREATE' || r.action === 'MERGE');
    if (activeRows.length === 0) {
      setPreviewError('No rows are marked as CREATE or MERGE.');
      return;
    }

    if (
      !window.confirm(
        `Commit ${counts.toCreate} new record(s) and ${counts.toMerge} merge(s) as ${verificationStatus}? (${counts.toSkip} skipped)`
      )
    ) {
      return;
    }

    setCommitting(true);
    setPreviewError(null);
    setCommitResult(null);

    const totals = {
      batchId,
      targetType,
      created: 0,
      merged: 0,
      skipped: counts.toSkip,
      linksAdded: 0,
      errors: [],
    };

    try {
      for (let i = 0; i < activeRows.length; i += COMMIT_CHUNK_SIZE) {
        const chunk = activeRows.slice(i, i + COMMIT_CHUNK_SIZE);
        setCommitProgress(
          `Committing rows ${i + 1}–${Math.min(i + chunk.length, activeRows.length)} of ${activeRows.length}...`
        );
        const res = await apiClient.post('/admin/import/commit', {
          targetType,
          batchId,
          ingestionSource,
          defaultSourceName,
          verificationStatus,
          aiGenerated: false,
          rows: chunk,
        });
        totals.created += res.data.created || 0;
        totals.merged += res.data.merged || 0;
        totals.linksAdded += res.data.linksAdded || 0;
        if (Array.isArray(res.data.errors)) {
          totals.errors.push(...res.data.errors);
        }
      }
      setCommitResult(totals);
      setRows([]);
      await loadCoreStatus();
    } catch (err) {
      setPreviewError(err.response?.data?.message || err.message || 'Commit failed.');
    } finally {
      setCommitting(false);
      setCommitProgress('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8 text-gray-200">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-4 border-b border-gray-700 pb-4">
          <div>
            <Link
              to="/admin"
              className="inline-flex items-center text-sm text-amber-400 hover:text-amber-300 mb-2"
            >
              <ArrowLeft size={16} className="mr-1" /> Back to Admin Dashboard
            </Link>
            <h1 className={`text-2xl md:text-3xl font-semibold ${BRONZE_COLOR} flex items-center`}>
              <FileSpreadsheet size={28} className="mr-3" /> Import Staging &amp; Validation Queue
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Preview, deduplicate, normalize controlled fields, and attach source provenance before writing to the live database.
            </p>
          </div>
        </div>

        {/* Core Reference Tables Card (Step 0 On-Site) */}
        <section className={`bg-gray-800 border ${BRONZE_BORDER} rounded-lg p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-amber-400 flex items-center">
                <Database size={18} className="mr-2" /> Core Reference Tables (Step 0)
              </h2>
              {coreStatus ? (
                <div className="flex flex-wrap gap-4 mt-2 text-sm">
                  <span className={coreStatus.contributingFactors.ready ? 'text-green-400' : 'text-amber-400'}>
                    Contributing Factors: <strong>{coreStatus.contributingFactors.count}/{coreStatus.contributingFactors.expected}</strong>
                  </span>
                  <span className={coreStatus.crimeCategories.ready ? 'text-green-400' : 'text-amber-400'}>
                    Crime Categories: <strong>{coreStatus.crimeCategories.count}/{coreStatus.crimeCategories.expected}</strong>
                  </span>
                  <span className={coreStatus.informationSources.ready ? 'text-green-400' : 'text-amber-400'}>
                    Information Sources: <strong>{coreStatus.informationSources.count}</strong>
                  </span>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-1">Checking lookup table status...</p>
              )}
              {coreMessage && (
                <p className="text-xs text-green-300 mt-2">{coreMessage}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleSeedCore}
              disabled={seedingCore}
              className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-md bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white"
            >
              <RefreshCw size={15} className={`mr-2 ${seedingCore ? 'animate-spin' : ''}`} />
              {seedingCore ? 'Initializing...' : 'Initialize Core Lookup Tables'}
            </button>
          </div>
        </section>

        {/* Commit Result Banner */}
        {commitResult && (
          <section className="bg-green-950/60 border border-green-700 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-semibold text-green-300 flex items-center">
                <ShieldCheck size={20} className="mr-2" /> Batch Committed ({commitResult.batchId})
              </h2>
              <Link
                to={
                  commitResult.targetType === 'BOOK_BUNDLE' ||
                  commitResult.targetType === 'FILM_BUNDLE' ||
                  commitResult.targetType === 'PODCAST_SERIES_BUNDLE'
                    ? '/admin/verify'
                    : `/admin/manage/${commitResult.targetType === 'ORGANIZATION' ? 'organizations' : 'individuals'}?unverified=true`
                }
                className="px-3 py-1.5 text-sm bg-green-700 hover:bg-green-600 text-white rounded-md font-medium"
              >
                Open Validation Queue →
              </Link>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-gray-200">
              <span>Created: <strong className="text-green-300">{commitResult.created}</strong></span>
              <span>Merged: <strong className="text-blue-300">{commitResult.merged}</strong></span>
              <span>Skipped: <strong className="text-gray-400">{commitResult.skipped}</strong></span>
              <span>Source Links Added: <strong className="text-amber-300">{commitResult.linksAdded}</strong></span>
              <span>Errors: <strong className={commitResult.errors.length ? 'text-red-400' : 'text-gray-400'}>{commitResult.errors.length}</strong></span>
            </div>
            {commitResult.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto bg-gray-900/80 rounded p-3 text-xs text-red-300 space-y-1">
                {commitResult.errors.map((e, idx) => (
                  <div key={idx}>Row #{e.rowIndex} ({e.name || 'N/A'}): {e.error}</div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Step 1: Load & Configure */}
        <form onSubmit={handlePreview} className="bg-gray-800 border border-gray-700 rounded-lg p-5 space-y-4">
          <h2 className="text-lg font-semibold text-gray-100">1. Upload or Paste Source Data</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Target Entity</label>
              <select
                value={targetType}
                onChange={(e) => {
                  const val = e.target.value;
                  setTargetType(val);
                  if (val === 'BOOK_BUNDLE') {
                    setInputType('JSON');
                    setDefaultSourceName('Google Books');
                    setIngestionSource('books_v2_bundle');
                  } else if (val === 'FILM_BUNDLE') {
                    setInputType('JSON');
                    setDefaultSourceName('TMDB');
                    setIngestionSource('films_v2_bundle');
                  } else if (val === 'PODCAST_SERIES_BUNDLE') {
                    setInputType('JSON');
                    setDefaultSourceName('Apple Podcasts');
                    setIngestionSource('podcasts_v2_series_bundle');
                  } else if (val === 'GROUPS_AND_LINKS') {
                    setInputType('JSON');
                    setDefaultSourceName('Curated Groups');
                    setIngestionSource('groups_v2_bundle');
                  }
                }}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
              >
                <option value="INDIVIDUAL">Individuals (NRE, Wikipedia, Generic CSV/JSON)</option>
                <option value="ORGANIZATION">Organizations (CSV/JSON)</option>
                <option value="BOOK_BUNDLE">Books Bundle (Merged v2 JSON + Google Books)</option>
                <option value="FILM_BUNDLE">Films &amp; Series Bundle (Merged v2 JSON + TMDB + Streaming)</option>
                <option value="PODCAST_SERIES_BUNDLE">Podcast Series Bundle (Series Metadata Only — No Episodes)</option>
                <option value="GROUPS_AND_LINKS">Groups &amp; Co-Defendant Links (groups_v2 JSON)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Input Format</label>
              <select
                value={inputType}
                onChange={(e) => setInputType(e.target.value)}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
              >
                <option value="CSV">CSV</option>
                <option value="JSON">JSON</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Upload File (.csv / .json)</label>
              <label className="flex items-center justify-center px-3 py-2 bg-gray-700 hover:bg-gray-600 border border-dashed border-gray-500 rounded cursor-pointer text-sm text-amber-300">
                <Upload size={16} className="mr-2" />
                {fileName || 'Choose CSV or JSON file...'}
                <input
                  type="file"
                  accept=".csv,.json,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Default Source Name (Provenance)</label>
              <input
                type="text"
                list="known-sources"
                value={defaultSourceName}
                onChange={(e) => setDefaultSourceName(e.target.value)}
                placeholder="e.g. National Registry of Exonerations"
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
              />
              <datalist id="known-sources">
                {(coreStatus?.informationSources?.items || []).map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Default Source URL (optional fallback)</label>
              <input
                type="text"
                value={defaultSourceUrl}
                onChange={(e) => setDefaultSourceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
              />
            </div>

            {targetType === 'INDIVIDUAL' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Default Status (if blank in file)</label>
                <select
                  value={defaultStatus}
                  onChange={(e) => setDefaultStatus(e.target.value)}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                >
                  <option value="">— Leave Blank / Detect —</option>
                  <option value="EXONERATED">EXONERATED</option>
                  <option value="RELEASED_ALFORD_PLEA">RELEASED_ALFORD_PLEA</option>
                  <option value="RELEASED_CLEMENCY">RELEASED_CLEMENCY</option>
                  <option value="RELEASED_TIME_SERVED">RELEASED_TIME_SERVED</option>
                  <option value="CONVICTION_OVERTURNED">CONVICTION_OVERTURNED</option>
                  <option value="CONVICTED">CONVICTED</option>
                  <option value="EXECUTED">EXECUTED</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-400 mb-1">Target Verification Status</label>
              <select
                value={verificationStatus}
                onChange={(e) => setVerificationStatus(e.target.value)}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
              >
                <option value="UNVERIFIED">UNVERIFIED (Recommended)</option>
                <option value="IN_REVIEW">IN_REVIEW</option>
                <option value="VERIFIED">VERIFIED</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Ingestion Source Tag (audit trail)</label>
              <input
                type="text"
                value={ingestionSource}
                onChange={(e) => setIngestionSource(e.target.value)}
                placeholder="e.g. nre_csv_2026, wikipedia_csv, manual_csv"
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
              />
            </div>

            {targetType === 'INDIVIDUAL' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Default Claim Strength</label>
                <select
                  value={defaultClaimStrength}
                  onChange={(e) => setDefaultClaimStrength(e.target.value)}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                >
                  <option value="UNASSESSED">UNASSESSED (auto-upgrades EXONERATED)</option>
                  <option value="FORMALLY_EXONERATED">FORMALLY_EXONERATED</option>
                  <option value="OFFICIAL_RELIEF_NO_EXONERATION">OFFICIAL_RELIEF_NO_EXONERATION</option>
                  <option value="STRONG_NEW_EVIDENCE">STRONG_NEW_EVIDENCE</option>
                  <option value="CREDIBLE_CLAIM">CREDIBLE_CLAIM</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Raw {inputType} Content {rawText ? `(${rawText.length.toLocaleString()} chars loaded)` : ''}
            </label>
            <textarea
              rows={5}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={
                inputType === 'CSV'
                  ? 'Paste CSV with headers (e.g. Name,State,ConvictedYear,ExoneratedYear,Crime,Link)...'
                  : 'Paste JSON array of records...'
              }
              className="w-full p-2 bg-gray-900 border border-gray-700 rounded text-xs font-mono text-gray-200"
            />
          </div>

          {previewError && (
            <div className="p-3 bg-red-950/70 border border-red-700 rounded text-sm text-red-300">
              {previewError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={previewLoading || !rawText.trim()}
              className="inline-flex items-center px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold rounded-md text-sm"
            >
              <Play size={16} className="mr-2" />
              {previewLoading ? 'Analyzing & Checking Duplicates...' : 'Preview & Validate (No DB Writes)'}
            </button>
          </div>
        </form>

        {/* Step 2: Staging Preview Table */}
        {rows.length > 0 && (
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">
                  2. Review Staging Queue <span className="text-xs font-normal text-gray-400">({batchId})</span>
                </h2>
                <p className="text-xs text-gray-400">
                  Planned commit: <strong className="text-green-400">{counts.toCreate} Create</strong> ·{' '}
                  <strong className="text-blue-400">{counts.toMerge} Merge</strong> ·{' '}
                  <strong className="text-gray-400">{counts.toSkip} Skip</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={handleCommit}
                disabled={committing || counts.toCreate + counts.toMerge === 0}
                className="inline-flex items-center px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-md text-sm"
              >
                <CheckCircle2 size={16} className="mr-2" />
                {committing
                  ? commitProgress || 'Committing...'
                  : `Commit Approved (${counts.toCreate + counts.toMerge})`}
              </button>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { key: 'ALL', label: `All (${counts.total})` },
                { key: 'NEW', label: `New (${counts.NEW})` },
                { key: 'EXACT_MATCH', label: `Exact Match (${counts.EXACT_MATCH})` },
                { key: 'FUZZY_DUPLICATE', label: `Fuzzy Duplicate (${counts.FUZZY_DUPLICATE})` },
                { key: 'INVALID', label: `Invalid (${counts.INVALID})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.key);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-full border font-medium ${
                    statusFilter === tab.key
                      ? 'bg-amber-600 text-white border-amber-500'
                      : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Bulk Action Bar */}
            <div className="flex flex-wrap gap-2 text-xs border-t border-b border-gray-700 py-2">
              <span className="text-gray-400 self-center mr-1">Bulk actions:</span>
              <button
                type="button"
                onClick={() => applyBulkAction((r) => r.matchStatus === 'NEW', 'CREATE')}
                className="px-2.5 py-1 bg-green-900/60 hover:bg-green-800 text-green-200 rounded"
              >
                Approve All NEW
              </button>
              <button
                type="button"
                onClick={() => applyBulkAction((r) => r.matchStatus === 'EXACT_MATCH', 'MERGE')}
                className="px-2.5 py-1 bg-blue-900/60 hover:bg-blue-800 text-blue-200 rounded"
              >
                Merge All EXACT_MATCH
              </button>
              <button
                type="button"
                onClick={() =>
                  applyBulkAction(
                    (r) => r.matchStatus === 'FUZZY_DUPLICATE' || r.matchStatus === 'INVALID',
                    'SKIP'
                  )
                }
                className="px-2.5 py-1 bg-amber-900/60 hover:bg-amber-800 text-amber-200 rounded"
              >
                Skip Fuzzy &amp; Invalid
              </button>
              <button
                type="button"
                onClick={() => applyBulkAction(() => true, 'SKIP')}
                className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
              >
                Skip All
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Action</th>
                    <th className="py-2 pr-3">Record Preview</th>
                    <th className="py-2 pr-3">Normalized Fields &amp; Source</th>
                    <th className="py-2">DB Match / Warnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/60">
                  {pagedRows.map((row) => (
                    <tr key={row.rowIndex} className="hover:bg-gray-700/30 align-top">
                      <td className="py-2.5 pr-3 text-gray-500">{row.rowIndex}</td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-[11px] font-medium ${
                            MATCH_BADGE_STYLES[row.matchStatus] || ''
                          }`}
                        >
                          {row.matchStatus}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <select
                          value={row.action}
                          disabled={row.matchStatus === 'INVALID'}
                          onChange={(e) => updateRowAction(row.rowIndex, e.target.value)}
                          className="p-1 bg-gray-700 border border-gray-600 rounded text-xs text-white disabled:opacity-40"
                        >
                          <option value="CREATE">CREATE</option>
                          {row.existingMatch && <option value="MERGE">MERGE (#{row.existingMatch.id})</option>}
                          <option value="SKIP">SKIP</option>
                        </select>
                      </td>
                      <td className="py-2.5 pr-3">
                        {targetType === 'PODCAST_SERIES_BUNDLE' ? (
                          <div className="flex items-start gap-2.5">
                            {row.data.mediaWork?.imagePath && (
                              <img
                                src={row.data.mediaWork.imagePath}
                                alt=""
                                className="w-10 h-10 rounded object-cover shrink-0 border border-gray-700"
                              />
                            )}
                            <div>
                              <div className="font-semibold text-gray-100 flex items-center gap-2 flex-wrap">
                                <span>{row.data.mediaWork?.title || '—'}</span>
                                {row.data.category && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                                      row.data.category === 'CORE'
                                        ? 'bg-emerald-900/70 text-emerald-300'
                                        : row.data.category === 'HALLUCINATION_OR_ERROR'
                                          ? 'bg-red-900/70 text-red-300'
                                          : 'bg-amber-900/70 text-amber-300'
                                    }`}
                                  >
                                    {row.data.category}
                                  </span>
                                )}
                              </div>
                              <div className="text-gray-400">
                                {row.data.mediaWork?.creatorName || 'Unknown host'} ·{' '}
                                {row.data.mediaWork?.publicationOrReleaseYear || '?'}
                              </div>
                              <div className="text-gray-500">
                                {row.data.podcastMeta?.appleCollectionId
                                  ? `Apple #${row.data.podcastMeta.appleCollectionId}`
                                  : 'No Apple ID'}
                                {row.data.mediaWork?.imagePath ? ' · Artwork ✓' : ' · No artwork'}
                                {row.data.podcastMeta?.rssFeedUrl ? ' · RSS ✓' : ''}
                              </div>
                            </div>
                          </div>
                        ) : targetType === 'FILM_BUNDLE' ? (
                          <div>
                            <div className="font-semibold text-gray-100 flex items-center gap-2 flex-wrap">
                              <span>{row.data.mediaWork?.title || '—'}</span>
                              <span className="px-1.5 py-0.5 bg-gray-700 text-amber-300 rounded text-[10px]">
                                {row.data.mediaWork?.workType}
                              </span>
                            </div>
                            <div className="text-gray-400">
                              {row.data.mediaWork?.creatorName || 'Unknown creator'} ·{' '}
                              {row.data.mediaWork?.publicationOrReleaseYear || '?'}
                            </div>
                            <div className="text-gray-500">
                              {row.data.mediaWork?.externalId ? `TMDB #${row.data.mediaWork.externalId}` : 'No TMDB ID'}
                              {row.data.mediaWork?.imagePath ? ' · Poster ✓' : ' · No poster'}
                              {row.data._previewStats?.streamingCount > 0
                                ? ` · ${row.data._previewStats.streamingCount} streaming`
                                : ''}
                            </div>
                          </div>
                        ) : targetType === 'BOOK_BUNDLE' ? (
                          <div>
                            <div className="font-semibold text-gray-100">{row.data.mediaWork?.title || '—'}</div>
                            <div className="text-gray-400">
                              {row.data.mediaWork?.creatorName || 'Unknown author'} ·{' '}
                              {row.data.mediaWork?.publicationOrReleaseYear || '?'}
                            </div>
                            <div className="text-gray-500">
                              {row.data.mediaWork?.externalId ? `ISBN-13: ${row.data.mediaWork.externalId}` : 'No ISBN-13'}
                              {row.data.bookPurchaseDetails ? ' · Google Books ✓' : ''}
                            </div>
                          </div>
                        ) : targetType === 'GROUPS_AND_LINKS' ? (
                          <div>
                            <div className="font-semibold text-gray-100 flex items-center gap-2">
                              <span>{row.data.name || row.data.label || '—'}</span>
                              <span className="px-1.5 py-0.5 bg-gray-700 text-amber-300 rounded text-[10px]">
                                {row.data.kind}
                              </span>
                            </div>
                            <div className="text-gray-400">
                              Matched in DB: {(row.data.matchedMembers || []).length} · Missing: {(row.data.missingMembers || []).length}
                            </div>
                            {(row.data.matchedMembers || []).length > 0 && (
                              <div className="text-gray-500 truncate max-w-sm">
                                {row.data.matchedMembers.map((m) => m.name).join(', ')}
                              </div>
                            )}
                          </div>
                        ) : targetType === 'ORGANIZATION' ? (
                          <div>
                            <div className="font-semibold text-gray-100">{row.data.name || '—'}</div>
                            <div className="text-gray-400">
                              {row.data.type} · {[row.data.locationCity, row.data.locationState].filter(Boolean).join(', ') || 'No location'}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-gray-100 flex items-center gap-1.5 flex-wrap">
                              <span>
                                {[row.data.firstName, row.data.middleName, row.data.lastName, row.data.suffix]
                                  .filter(Boolean)
                                  .join(' ') || '—'}
                              </span>
                              {row.data.disambiguationTag && (
                                <span className="px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded text-[10px]">
                                  {row.data.disambiguationTag}
                                </span>
                              )}
                              {row.data.sourceLinks?.length > 1 && (
                                <span className="px-1.5 py-0.5 bg-amber-900/70 text-amber-300 rounded text-[10px]">
                                  {row.data.sourceLinks.length} NRE cases
                                </span>
                              )}
                            </div>
                            <div className="text-gray-400">
                              {[row.data.caseLocationCity, row.data.caseLocationState].filter(Boolean).join(', ') || 'No state'} ·{' '}
                              {row.data.convictionYear || '?'} → {row.data.exonerationOrReleaseYear || '?'}
                            </div>
                            {row.data.status && (
                              <div className="text-gray-500">{row.data.status} / {row.data.claimStrength}</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 space-y-1">
                        {targetType === 'PODCAST_SERIES_BUNDLE' && (
                          <>
                            <div className="text-amber-300">
                              {row.data.mediaWork?.publisherOrNetwork || 'Independent / Unknown network'}
                              {row.data.podcastMeta?.appleTrackCount
                                ? ` · ~${row.data.podcastMeta.appleTrackCount} eps (series only)`
                                : ' · Series metadata only'}
                            </div>
                            {row.data.mediaWork?.focusOrTheme && (
                              <div className="text-gray-400 line-clamp-2 max-w-xs">
                                {row.data.mediaWork.focusOrTheme}
                              </div>
                            )}
                          </>
                        )}
                        {targetType === 'FILM_BUNDLE' && (
                          <>
                            <div className="text-amber-300">
                              {row.data._previewStats?.episodeCount || 0} item(s) ·{' '}
                              {row.data._previewStats?.individualCount || 0} individual(s) ·{' '}
                              {row.data._previewStats?.involvedPersonCount || 0} involved
                            </div>
                            {(row.data._previewStats?.contributingFactorCodes || []).length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {row.data._previewStats.contributingFactorCodes.map((c) => (
                                  <span key={c} className="px-1.5 py-0.5 bg-gray-700 text-gray-200 rounded text-[10px]">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                        {targetType === 'BOOK_BUNDLE' && (
                          <>
                            <div className="text-amber-300">
                              {(row.data.featuredIndividuals || []).length} individual(s) ·{' '}
                              {(row.data.involvedPersons || []).length} involved person(s)
                            </div>
                            {(row.data.mediaItem?.contributingFactorCodes || []).length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {row.data.mediaItem.contributingFactorCodes.map((c) => (
                                  <span key={c} className="px-1.5 py-0.5 bg-gray-700 text-gray-200 rounded text-[10px]">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                        {targetType === 'INDIVIDUAL' && row.data.crimeCategoryName && (
                          <div className="text-amber-300">Crime: {row.data.crimeCategoryName}</div>
                        )}
                        {targetType === 'INDIVIDUAL' && row.data.contributingFactorCodes?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {row.data.contributingFactorCodes.map((c) => (
                              <span key={c} className="px-1.5 py-0.5 bg-gray-700 text-gray-200 rounded text-[10px]">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                        {row.data.sourceUrl || row.data.mediaWork?.sourceUrl ? (
                          <a
                            href={row.data.sourceUrl || row.data.mediaWork?.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-blue-400 hover:underline truncate max-w-xs"
                          >
                            {row.data.sourceName ? `[${row.data.sourceName}] ` : ''}
                            {row.data.sourceUrl || row.data.mediaWork?.sourceUrl}
                          </a>
                        ) : row.data.website ? (
                          <a
                            href={row.data.website}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-blue-400 hover:underline truncate max-w-xs"
                          >
                            {row.data.website}
                          </a>
                        ) : (
                          <span className="text-gray-500 italic">No source URL</span>
                        )}
                      </td>
                      <td className="py-2.5 space-y-1">
                        {row.existingMatch && (
                          <div className="text-blue-300 flex items-center">
                            <GitMerge size={12} className="mr-1 shrink-0" />
                            Existing #{row.existingMatch.id}:{' '}
                            {row.existingMatch.title ||
                              row.existingMatch.name ||
                              `${row.existingMatch.firstName} ${row.existingMatch.lastName}`}{' '}
                            ({row.existingMatch.verificationStatus})
                          </div>
                        )}
                        {row.warnings.map((w, idx) => (
                          <div key={idx} className="text-amber-300 flex items-start">
                            {row.matchStatus === 'INVALID' ? (
                              <XCircle size={12} className="mr-1 mt-0.5 shrink-0 text-red-400" />
                            ) : (
                              <AlertTriangle size={12} className="mr-1 mt-0.5 shrink-0" />
                            )}
                            <span>{w}</span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-gray-700 text-xs text-gray-400">
                <span>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredRows.length)} of{' '}
                  {filteredRows.length} rows
                </span>
                <div className="space-x-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1 bg-gray-700 rounded disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span>
                    Page {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1 bg-gray-700 rounded disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default AdminImportPage;
