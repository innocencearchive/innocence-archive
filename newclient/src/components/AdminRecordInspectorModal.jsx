// src/components/AdminRecordInspectorModal.jsx
// Slide-over Full Record Inspector & Inline Editor for the Validation Queue (/admin/verify).
// Supports:
//   - Preview mode: full untruncated record details, provenance links, and related entities
//   - Edit mode: full database editor for every field in ADMIN_RESOURCES[resource] + source links
//   - Verification actions: Verify, Verify & Next, In Review, Dispute, Save & Verify

import React, { useEffect, useState, useCallback } from 'react';
import {
  X,
  Eye,
  Edit3,
  CheckCircle2,
  Clock,
  AlertOctagon,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Save,
  Loader2,
  Plus,
  Trash2,
  Link as LinkIcon,
  Globe,
  EyeOff,
} from 'lucide-react';
import apiClient from '../apiClient';
import { ADMIN_RESOURCES } from '../pages/adminResourceConfig';
import { BRONZE_COLOR } from './themeconstants';

const STATUS_BADGE = {
  UNVERIFIED: 'bg-amber-900/70 text-amber-300 border-amber-700',
  IN_REVIEW: 'bg-blue-900/70 text-blue-300 border-blue-700',
  DISPUTED: 'bg-red-900/70 text-red-300 border-red-700',
  VERIFIED: 'bg-green-900/70 text-green-300 border-green-700',
};

function buildInitialForm(fields, row = null) {
  const form = {};
  for (const field of fields) {
    if (row && row[field.name] !== undefined && row[field.name] !== null) {
      if (field.type === 'date') {
        form[field.name] = String(row[field.name]).slice(0, 10);
      } else if (field.type === 'multiselect') {
        form[field.name] = Array.isArray(row[field.name]) ? row[field.name].map(Number) : [];
      } else {
        form[field.name] = row[field.name];
      }
    } else if (field.defaultValue !== undefined) {
      form[field.name] = field.defaultValue;
    } else if (field.type === 'checkbox') {
      form[field.name] = false;
    } else if (field.type === 'multiselect') {
      form[field.name] = [];
    } else {
      form[field.name] = '';
    }
  }
  return form;
}

function getPublicUrl(resource, record) {
  if (!record?.id) return null;
  if (resource === 'individuals') return `/profile/${record.id}`;
  if (resource === 'organizations') return `/organization/${record.id}`;
  if (resource === 'mediaworks') {
    if (record.workType === 'BOOK') return `/book/${record.id}`;
    if (record.workType === 'PODCAST_SERIES') return `/podcast/${record.id}`;
    return `/film/${record.id}`;
  }
  return null;
}

function formatDateDisplay(val) {
  if (!val) return null;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function DetailField({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded p-2.5">
      <div className="text-[10.5px] uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
      <div className="text-xs text-gray-100 mt-0.5 break-words">{String(value)}</div>
    </div>
  );
}

function AdminRecordInspectorModal({
  item,
  initialMode = 'preview',
  onClose,
  onUpdated,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}) {
  const resource = item?.resource;
  const id = item?.id;
  const config = ADMIN_RESOURCES[resource];

  const [mode, setMode] = useState(initialMode); // 'preview' | 'edit'
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveMessage, setSaveMessage] = useState(null);

  // Edit form state
  const [formData, setFormData] = useState({});
  const [lookups, setLookups] = useState({});
  const [multiSearch, setMultiSearch] = useState({});
  const [saving, setSaving] = useState(false);

  // Quick verification notes (in Preview mode)
  const [quickNotes, setQuickNotes] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  // Individual Source Links manager
  const [sourceLinks, setSourceLinks] = useState([]);
  const [infoSources, setInfoSources] = useState([]);
  const [newLinkSourceId, setNewLinkSourceId] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkHeadline, setNewLinkHeadline] = useState('');
  const [addingLink, setAddingLink] = useState(false);

  // Sync mode when switching items or opening
  useEffect(() => {
    setMode(initialMode);
    setSaveMessage(null);
    setError(null);
  }, [resource, id, initialMode]);

  // Close on Escape
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const loadRecord = useCallback(async () => {
    if (!resource || !id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/admin/tools/record/${resource}/${id}`);
      const full = res.data;
      setRecord(full);
      setQuickNotes(full.verificationNotes || '');
      if (config) {
        setFormData(buildInitialForm(config.fields, full));
      }
      if (resource === 'individuals') {
        setSourceLinks(full.sourceLinks || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load full record.');
    } finally {
      setLoading(false);
    }
  }, [resource, id, config]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  // Load lookups lazily when entering edit mode
  useEffect(() => {
    if (mode !== 'edit' || !config) return;
    let active = true;
    const lookupFields = config.fields.filter((f) => f.type === 'lookup' || f.type === 'multiselect');
    const uniqueKeys = Array.from(new Set(lookupFields.map((f) => f.lookupKey)));

    const missingKeys = uniqueKeys.filter((k) => !lookups[k]);
    if (missingKeys.length > 0) {
      Promise.all(
        missingKeys.map(async (key) => {
          try {
            const res = await apiClient.get(`/admin/${key}`);
            return [key, res.data || []];
          } catch {
            return [key, []];
          }
        })
      ).then((entries) => {
        if (active) {
          setLookups((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
        }
      });
    }

    if (resource === 'individuals' && infoSources.length === 0) {
      apiClient
        .get('/admin/informationsources')
        .then((res) => {
          if (active) setInfoSources(res.data || []);
        })
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [mode, config, resource, lookups, infoSources.length]);

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field.name]: value }));
  };

  const toggleMultiselect = (fieldName, optionId) => {
    setFormData((prev) => {
      const cur = Array.isArray(prev[fieldName]) ? prev[fieldName] : [];
      const next = cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId];
      return { ...prev, [fieldName]: next };
    });
  };

  const handleSaveEdit = async ({ alsoVerify = false, advanceAfter = false } = {}) => {
    if (!config || !record) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const payload = { ...formData };
      if (alsoVerify) {
        payload.verificationStatus = 'VERIFIED';
        payload.verified = true;
      }
      await apiClient.put(`${config.endpoint}/${record.id}`, payload);
      await loadRecord();
      if (onUpdated) await onUpdated();
      if (advanceAfter && hasNext) {
        onNext();
      } else {
        setSaveMessage(alsoVerify ? 'Saved changes and marked VERIFIED.' : 'Changes saved.');
        setMode('preview');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatus = async (nextStatus, advanceAfter = false) => {
    if (!record) return;
    setActionBusy(true);
    setError(null);
    setSaveMessage(null);
    try {
      await apiClient.patch(`/admin/verify/${resource}/${record.id}`, {
        verificationStatus: nextStatus,
        verified: nextStatus === 'VERIFIED',
        verificationNotes: quickNotes,
      });
      if (onUpdated) await onUpdated();
      if (advanceAfter && hasNext) {
        onNext();
      } else if (nextStatus === 'VERIFIED') {
        onClose();
      } else {
        await loadRecord();
        setSaveMessage(`Marked as ${nextStatus}.`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleAddSourceLink = async () => {
    if (!newLinkSourceId || !newLinkUrl.trim()) return;
    setAddingLink(true);
    setError(null);
    try {
      await apiClient.post(`/admin/individuals/${record.id}/sourcelinks`, {
        informationSourceId: parseInt(newLinkSourceId, 10),
        specificUrl: newLinkUrl.trim(),
        headline: newLinkHeadline.trim() || null,
      });
      setNewLinkUrl('');
      setNewLinkHeadline('');
      await loadRecord();
      if (onUpdated) await onUpdated();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add source link.');
    } finally {
      setAddingLink(false);
    }
  };

  const handleDeleteSourceLink = async (linkId) => {
    try {
      await apiClient.delete(`/admin/sourcelinks/${linkId}`);
      await loadRecord();
      if (onUpdated) await onUpdated();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove source link.');
    }
  };

  const publicUrl = getPublicUrl(resource, record);

  const displayTitle = record
    ? resource === 'individuals' || resource === 'involvedpersons'
      ? [record.firstName, record.middleName, record.lastName, record.suffix].filter(Boolean).join(' ')
      : resource === 'mediaitems'
        ? record.itemTitle || `Item #${record.itemNumber || record.id}`
        : record.title || record.name || `#${record.id}`
    : item?.title || 'Loading...';

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-gray-900 border-l border-gray-700 h-full flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="px-5 py-4 border-b border-gray-700 bg-gray-950/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[11px] font-semibold uppercase rounded bg-gray-800 text-amber-300 border border-gray-700">
                {item.entityLabel} #{item.id}
              </span>
              {record?.verificationStatus && (
                <span
                  className={`px-2 py-0.5 text-[11px] font-medium rounded border ${
                    STATUS_BADGE[record.verificationStatus] || ''
                  }`}
                >
                  {record.verificationStatus}
                </span>
              )}
              {resource === 'individuals' && record && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border ${
                    record.isPublished === false
                      ? 'bg-gray-800 text-gray-300 border-gray-600'
                      : 'bg-emerald-950/60 text-emerald-300 border-emerald-700/70'
                  }`}
                >
                  {record.isPublished === false ? (
                    <>
                      <EyeOff size={11} /> {record.nreOnly ? 'Unpublished (NRE-only)' : 'Unpublished'}
                    </>
                  ) : (
                    <>
                      <Globe size={11} /> Published
                    </>
                  )}
                </span>
              )}
            </div>
            <h2 className={`text-lg font-semibold ${BRONZE_COLOR} truncate`}>{displayTitle}</h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Preview / Edit toggle */}
            <div className="inline-flex rounded-md border border-gray-700 overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setMode('preview')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 font-medium ${
                  mode === 'preview' ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Eye size={13} /> Preview
              </button>
              <button
                type="button"
                onClick={() => setMode('edit')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 font-medium ${
                  mode === 'edit' ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Edit3 size={13} /> Edit
              </button>
            </div>

            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                title="Open public page in new tab"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs text-gray-200"
              >
                Public <ExternalLink size={12} />
              </a>
            )}

            <button
              type="button"
              disabled={!hasPrev}
              onClick={onPrev}
              title="Previous queue item"
              className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 border border-gray-700 text-gray-200"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={!hasNext}
              onClick={onNext}
              title="Next queue item"
              className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 border border-gray-700 text-gray-200"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-950/70 border border-red-700 rounded text-xs text-red-200">{error}</div>
          )}
          {saveMessage && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-700 rounded text-xs text-emerald-200">
              {saveMessage}
            </div>
          )}

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              Loading full record...
            </div>
          ) : !record ? (
            <div className="py-12 text-center text-gray-400 text-sm">Record could not be loaded.</div>
          ) : mode === 'preview' ? (
            /* ================= PREVIEW MODE ================= */
            <div className="space-y-5">
              {/* Individual Preview */}
              {resource === 'individuals' && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <DetailField label="Status" value={record.status} />
                    <DetailField label="Claim Strength" value={record.claimStrength} />
                    <DetailField label="Crime Category" value={record.crimeCategory?.crime_name} />
                    <DetailField label="Crime Date" value={formatDateDisplay(record.crimeDate)} />
                    <DetailField label="Conviction Year" value={record.convictionYear} />
                    <DetailField label="Exoneration / Release" value={record.exonerationOrReleaseYear} />
                    <DetailField label="Time Served" value={record.timeServed} />
                    <DetailField label="Sentence" value={record.sentence} />
                    <DetailField
                      label="Location"
                      value={[record.caseLocationCity, record.caseLocationCounty, record.caseLocationState, record.caseLocationCountry]
                        .filter(Boolean)
                        .join(', ')}
                    />
                    <DetailField label="Nickname" value={record.nickname} />
                    <DetailField label="Disambiguation Tag" value={record.disambiguationTag} />
                    <DetailField label="Ingestion Source" value={record.ingestionSource} />
                    <DetailField label="Import Batch" value={record.importBatchId} />
                  </div>

                  {/* Full Narrative Summary */}
                  <div className="bg-gray-800/70 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                        Full Narrative Summary
                      </h3>
                      <button
                        type="button"
                        onClick={() => setMode('edit')}
                        className="text-[11px] text-amber-300 hover:underline inline-flex items-center gap-1"
                      >
                        <Edit3 size={11} /> Edit
                      </button>
                    </div>
                    {record.narrativeSummary ? (
                      <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                        {record.narrativeSummary}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 italic">No narrative summary recorded.</p>
                    )}
                  </div>

                  {/* Contributing Factors */}
                  {record.contributingFactors?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                        Contributing Factors ({record.contributingFactors.length})
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {record.contributingFactors.map((f) => (
                          <span key={f.id} className="px-2.5 py-1 rounded bg-gray-800 border border-gray-700 text-xs text-amber-200">
                            {f.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Source Provenance Links */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                      Source Provenance Links ({record.sourceLinks?.length || 0})
                    </h3>
                    {record.sourceLinks?.length > 0 ? (
                      <div className="space-y-1.5">
                        {record.sourceLinks.map((sl) => (
                          <div
                            key={sl.id}
                            className="flex items-center justify-between gap-2 bg-gray-800/60 border border-gray-700/80 rounded px-3 py-2 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-amber-300 mr-2">
                                {sl.informationSource?.name || 'Source'}
                              </span>
                              <a
                                href={sl.specificUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-400 hover:underline break-all inline-flex items-center gap-1"
                              >
                                {sl.headline || sl.specificUrl}
                                <ExternalLink size={11} className="shrink-0" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-400/80 italic">No primary source links attached yet.</p>
                    )}
                  </div>

                  {/* Organizations & Groups */}
                  {(record.organizationsInvolved?.length > 0 || record.groups?.length > 0) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {record.organizationsInvolved?.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                            Organizations Involved
                          </h3>
                          <div className="flex flex-wrap gap-1.5">
                            {record.organizationsInvolved.map((o) => (
                              <span key={o.id} className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-xs text-gray-200">
                                {o.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {record.groups?.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                            Groups / Cases
                          </h3>
                          <div className="flex flex-wrap gap-1.5">
                            {record.groups.map((g) => (
                              <span key={g.id} className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-xs text-gray-200">
                                {g.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Linked Media & News */}
                  {(record.mediaItemAppearances?.length > 0 || record.newsArticles?.length > 0) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {record.mediaItemAppearances?.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                            Media Appearances ({record.mediaItemAppearances.length})
                          </h3>
                          <ul className="space-y-1 text-xs text-gray-300">
                            {record.mediaItemAppearances.map((m) => (
                              <li key={m.id} className="bg-gray-800/50 rounded px-2.5 py-1.5">
                                <span className="text-amber-300">{m.work?.title || m.itemMediaType}</span>
                                {m.itemTitle && m.itemTitle !== m.work?.title ? ` — ${m.itemTitle}` : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {record.newsArticles?.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                            Linked News ({record.newsArticles.length})
                          </h3>
                          <ul className="space-y-1 text-xs">
                            {record.newsArticles.map((n) => (
                              <li key={n.id} className="bg-gray-800/50 rounded px-2.5 py-1.5">
                                {n.url ? (
                                  <a href={n.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                                    {n.headline}
                                  </a>
                                ) : (
                                  <span className="text-gray-200">{n.headline}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Generic Preview for MediaWorks, MediaItems, Organizations, InvolvedPersons */}
              {resource !== 'individuals' && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {(config?.fields || [])
                      .filter((f) => f.type !== 'textarea' && f.type !== 'multiselect')
                      .map((f) => {
                        let val = record[f.name];
                        if (f.type === 'date' && val) val = formatDateDisplay(val);
                        if (f.type === 'checkbox') val = val ? 'Yes' : 'No';
                        if (f.name === 'workId' && record.work) val = `${record.work.title} (${record.work.workType})`;
                        return <DetailField key={f.name} label={f.label} value={val} />;
                      })}
                  </div>

                  {(config?.fields || [])
                    .filter((f) => f.type === 'textarea' && record[f.name])
                    .map((f) => (
                      <div key={f.name} className="bg-gray-800/70 border border-gray-700 rounded-lg p-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1.5">
                          {f.label}
                        </h3>
                        <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
                          {record[f.name]}
                        </p>
                      </div>
                    ))}

                  {record.individualsFeatured?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                        Featured Individuals ({record.individualsFeatured.length})
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {record.individualsFeatured.map((i) => (
                          <span key={i.id} className="px-2.5 py-1 rounded bg-gray-800 border border-gray-700 text-xs text-amber-200">
                            {i.firstName} {i.lastName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {record.items?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                        Child Items / Episodes ({record.items.length})
                      </h3>
                      <ul className="space-y-1 text-xs text-gray-300 max-h-48 overflow-y-auto">
                        {record.items.map((it) => (
                          <li key={it.id} className="bg-gray-800/50 rounded px-2.5 py-1.5">
                            {it.itemNumber ? `#${it.itemNumber} · ` : ''}
                            {it.itemTitle || `Item #${it.id}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            /* ================= FULL EDIT MODE ================= */
            <form
              id="inspector-edit-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEdit({ alsoVerify: false });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {(config?.fields || []).map((field) => {
                  const isWide = field.type === 'textarea' || field.type === 'multiselect';
                  const val = formData[field.name];

                  if (field.type === 'checkbox') {
                    return (
                      <label
                        key={field.name}
                        className="flex items-center gap-2 bg-gray-800/60 border border-gray-700 rounded p-2.5 text-xs text-gray-200 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(val)}
                          onChange={(e) => handleFieldChange(field, e.target.checked)}
                          className="accent-amber-500 w-4 h-4"
                        />
                        {field.label}
                      </label>
                    );
                  }

                  if (field.type === 'multiselect') {
                    const opts = lookups[field.lookupKey] || [];
                    const selectedIds = Array.isArray(val) ? val : [];
                    const q = (multiSearch[field.name] || '').trim().toLowerCase();
                    const filteredOpts = q
                      ? opts.filter((o) => (field.optionLabel ? field.optionLabel(o) : o.name || o.title || '').toLowerCase().includes(q))
                      : opts;

                    return (
                      <div key={field.name} className="md:col-span-2 bg-gray-800/50 border border-gray-700 rounded p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-medium text-gray-300">
                            {field.label} ({selectedIds.length} selected)
                          </label>
                          <input
                            type="text"
                            value={multiSearch[field.name] || ''}
                            onChange={(e) => setMultiSearch((prev) => ({ ...prev, [field.name]: e.target.value }))}
                            placeholder="Filter..."
                            className="px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-white w-44"
                          />
                        </div>
                        <div className="max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1 pr-1">
                          {filteredOpts.slice(0, 120).map((o) => {
                            const label = field.optionLabel ? field.optionLabel(o) : o.name || o.title || `#${o.id}`;
                            const checked = selectedIds.includes(o.id);
                            return (
                              <label
                                key={o.id}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer ${
                                  checked ? 'bg-amber-950/60 text-amber-200' : 'text-gray-300 hover:bg-gray-800'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleMultiselect(field.name, o.id)}
                                  className="accent-amber-500"
                                />
                                <span className="truncate">{label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={field.name} className={isWide ? 'md:col-span-2' : ''}>
                      <label className="block text-xs text-gray-400 mb-1">
                        {field.label}
                        {field.required && <span className="text-red-400 ml-0.5">*</span>}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          rows={field.name === 'narrativeSummary' ? 6 : 3}
                          value={val ?? ''}
                          onChange={(e) => handleFieldChange(field, e.target.value)}
                          className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-xs text-white leading-relaxed"
                        />
                      ) : field.type === 'select' ? (
                        <select
                          required={field.required}
                          value={val ?? ''}
                          onChange={(e) => handleFieldChange(field, e.target.value)}
                          className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-xs text-white"
                        >
                          <option value="">— Select —</option>
                          {(field.options || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'lookup' ? (
                        <select
                          required={field.required}
                          value={val ?? ''}
                          onChange={(e) => handleFieldChange(field, e.target.value ? Number(e.target.value) : '')}
                          className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-xs text-white"
                        >
                          <option value="">— None —</option>
                          {(lookups[field.lookupKey] || []).map((o) => (
                            <option key={o.id} value={o.id}>
                              {field.optionLabel ? field.optionLabel(o) : o.name || o.title || `#${o.id}`}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type || 'text'}
                          required={field.required}
                          value={val ?? ''}
                          onChange={(e) => handleFieldChange(field, e.target.value)}
                          className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-xs text-white"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Source Provenance Links Editor (Individuals) */}
              {resource === 'individuals' && (
                <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <LinkIcon size={13} /> Source Provenance Links ({sourceLinks.length})
                  </h3>

                  {sourceLinks.length > 0 && (
                    <div className="space-y-1.5">
                      {sourceLinks.map((sl) => (
                        <div
                          key={sl.id}
                          className="flex items-center justify-between gap-2 bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-xs"
                        >
                          <div className="min-w-0 truncate">
                            <span className="text-amber-300 font-medium mr-1.5">
                              {sl.informationSource?.name || 'Source'}:
                            </span>
                            <a href={sl.specificUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                              {sl.headline || sl.specificUrl}
                            </a>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteSourceLink(sl.id)}
                            className="text-red-400 hover:text-red-300 shrink-0"
                            title="Remove link"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={newLinkSourceId}
                      onChange={(e) => setNewLinkSourceId(e.target.value)}
                      className="p-2 bg-gray-900 border border-gray-700 rounded text-xs text-white"
                    >
                      <option value="">Select Source...</option>
                      {infoSources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="url"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      placeholder="https://..."
                      className="p-2 bg-gray-900 border border-gray-700 rounded text-xs text-white"
                    />
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newLinkHeadline}
                        onChange={(e) => setNewLinkHeadline(e.target.value)}
                        placeholder="Headline (optional)"
                        className="flex-1 min-w-0 p-2 bg-gray-900 border border-gray-700 rounded text-xs text-white"
                      />
                      <button
                        type="button"
                        disabled={addingLink || !newLinkSourceId || !newLinkUrl.trim()}
                        onClick={handleAddSourceLink}
                        className="px-2.5 py-1.5 rounded bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-medium shrink-0 inline-flex items-center"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Sticky Footer Actions */}
        <div className="px-5 py-3.5 border-t border-gray-700 bg-gray-950/90 shrink-0 space-y-2.5">
          {mode === 'preview' ? (
            <>
              <input
                type="text"
                value={quickNotes}
                onChange={(e) => setQuickNotes(e.target.value)}
                placeholder="Optional verification notes (saved when clicking Verify / In Review / Dispute)..."
                className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-gray-200"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={actionBusy || loading}
                    onClick={() => handleQuickStatus('VERIFIED', false)}
                    className="inline-flex items-center px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-xs font-semibold"
                  >
                    <CheckCircle2 size={14} className="mr-1" /> Verify
                  </button>
                  {hasNext && (
                    <button
                      type="button"
                      disabled={actionBusy || loading}
                      onClick={() => handleQuickStatus('VERIFIED', true)}
                      className="inline-flex items-center px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold"
                    >
                      <CheckCircle2 size={14} className="mr-1" /> Verify &amp; Next →
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={actionBusy || loading}
                    onClick={() => handleQuickStatus('IN_REVIEW', false)}
                    className="inline-flex items-center px-2.5 py-1.5 rounded bg-blue-800 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium"
                  >
                    <Clock size={14} className="mr-1" /> In Review
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy || loading}
                    onClick={() => handleQuickStatus('DISPUTED', false)}
                    className="inline-flex items-center px-2.5 py-1.5 rounded bg-red-800 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-medium"
                  >
                    <AlertOctagon size={14} className="mr-1" /> Dispute
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setMode('edit')}
                  className="inline-flex items-center px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                >
                  <Edit3 size={14} className="mr-1" /> Edit Full Record
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setMode('preview')}
                className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs text-gray-200"
              >
                Cancel Edit
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  form="inspector-edit-form"
                  disabled={saving}
                  className="inline-flex items-center px-3.5 py-1.5 rounded bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-semibold"
                >
                  <Save size={14} className="mr-1.5" /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveEdit({ alsoVerify: true, advanceAfter: hasNext })}
                  className="inline-flex items-center px-3.5 py-1.5 rounded bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-xs font-semibold"
                >
                  <CheckCircle2 size={14} className="mr-1.5" />
                  {hasNext ? 'Save, Verify & Next →' : 'Save & Verify'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminRecordInspectorModal;
