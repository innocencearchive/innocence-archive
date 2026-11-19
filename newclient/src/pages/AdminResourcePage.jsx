// src/pages/AdminResourcePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Trash2,
  X,
  RefreshCw,
} from 'lucide-react';
import apiClient from '../apiClient';
import { ADMIN_RESOURCES } from './adminResourceConfig';
import { BRONZE_COLOR, BRONZE_BORDER } from '../components/themeconstants';

function buildInitialForm(fields, row = null, presetDefaults = {}) {
  const form = {};
  for (const field of fields) {
    if (row && row[field.name] !== undefined && row[field.name] !== null) {
      if (field.type === 'date') {
        form[field.name] = String(row[field.name]).slice(0, 10);
      } else {
        form[field.name] = row[field.name];
      }
    } else if (presetDefaults[field.name] !== undefined) {
      form[field.name] = presetDefaults[field.name];
    } else if (field.defaultValue !== undefined) {
      form[field.name] = field.defaultValue;
    } else if (field.type === 'checkbox') {
      form[field.name] = false;
    } else {
      form[field.name] = '';
    }
  }
  return form;
}

function AdminResourcePage() {
  const { resource } = useParams();
  const [searchParams] = useSearchParams();
  const config = ADMIN_RESOURCES[resource];

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [unverifiedOnly, setUnverifiedOnly] = useState(searchParams.get('unverified') === 'true');
  const workTypeFilter = searchParams.get('workType') || '';

  const [lookups, setLookups] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchLookups = useCallback(async () => {
    if (!config) return;
    const lookupFields = config.fields.filter((f) => f.type === 'lookup');
    if (lookupFields.length === 0) return;

    const entries = await Promise.all(
      lookupFields.map(async (f) => {
        try {
          const res = await apiClient.get(`/admin/${f.lookupKey}`);
          return [f.lookupKey, res.data];
        } catch {
          return [f.lookupKey, []];
        }
      })
    );
    setLookups(Object.fromEntries(entries));
  }, [config]);

  const fetchRows = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (unverifiedOnly) params.unverifiedOnly = 'true';
      if (workTypeFilter && resource === 'mediaworks') params.workType = workTypeFilter;
      const res = await apiClient.get(config.endpoint, { params });
      setRows(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load records.');
    } finally {
      setLoading(false);
    }
  }, [config, search, unverifiedOnly, workTypeFilter, resource]);

  useEffect(() => {
    fetchRows();
    fetchLookups();
  }, [fetchRows, fetchLookups]);

  useEffect(() => {
    if (config && searchParams.get('action') === 'add') {
      const presets = workTypeFilter ? { workType: workTypeFilter } : {};
      setEditingRow(null);
      setFormData(buildInitialForm(config.fields, null, presets));
      setFormError(null);
      setModalOpen(true);
    }
  }, [config, searchParams, workTypeFilter]);

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-900 p-8 text-gray-200">
        <p className="text-red-400 mb-4">Unknown admin resource: {resource}</p>
        <Link to="/admin" className="text-amber-400 hover:underline">
          ← Back to Admin Dashboard
        </Link>
      </div>
    );
  }

  const openAdd = () => {
    const presets = workTypeFilter ? { workType: workTypeFilter } : {};
    setEditingRow(null);
    setFormData(buildInitialForm(config.fields, null, presets));
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingRow(row);
    setFormData(buildInitialForm(config.fields, row));
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (editingRow) {
        await apiClient.put(`${config.endpoint}/${editingRow.id}`, formData);
      } else {
        await apiClient.post(config.endpoint, formData);
      }
      setModalOpen(false);
      await fetchRows();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to save record.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete ${config.singular} #${row.id}? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`${config.endpoint}/${row.id}`);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete record.');
    }
  };

  const handleToggleVerify = async (row) => {
    const nextVerified = row.verificationStatus !== 'VERIFIED';
    try {
      const res = await apiClient.patch(`/admin/verify/${resource}/${row.id}`, {
        verified: nextVerified,
      });
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, verificationStatus: res.data.verificationStatus, verifiedAt: res.data.verifiedAt }
            : r
        )
      );
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update verification status.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8 text-gray-200">
      <div className="max-w-6xl mx-auto">
        <div className={`flex flex-wrap justify-between items-center gap-4 mb-6 pb-4 border-b ${BRONZE_BORDER}`}>
          <div>
            <Link to="/admin" className="text-sm text-amber-400 hover:underline inline-flex items-center mb-2">
              <ArrowLeft size={16} className="mr-1" /> Back to Admin Dashboard
            </Link>
            <h1 className={`text-2xl md:text-3xl font-semibold ${BRONZE_COLOR}`}>
              {config.title}
              {workTypeFilter ? ` — ${workTypeFilter}` : ''}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchRows}
              className="py-2 px-3 bg-gray-700 hover:bg-gray-600 rounded-md text-sm inline-flex items-center"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={openAdd}
              className="py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-md text-sm inline-flex items-center"
            >
              <Plus size={16} className="mr-1.5" /> Add {config.singular}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {config.searchable && (
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${config.title.toLowerCase()}...`}
                className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}
          {config.verifiable && (
            <label className="inline-flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={unverifiedOnly}
                onChange={(e) => setUnverifiedOnly(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-amber-500"
              />
              Unverified only
            </label>
          )}
          <span className="text-xs text-gray-400 ml-auto">{rows.length} record(s)</span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-md text-red-200 text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-900/70 text-gray-400 uppercase text-xs">
              <tr>
                <th className="py-3 px-4">ID</th>
                {config.columns.map((col) => (
                  <th key={col.key} className="py-3 px-4">
                    {col.label}
                  </th>
                ))}
                {config.verifiable && <th className="py-3 px-4">Verification</th>}
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={config.columns.length + 3} className="py-8 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={config.columns.length + 3} className="py-8 text-center text-gray-400">
                    No records found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-750/50">
                    <td className="py-3 px-4 text-gray-400">#{row.id}</td>
                    {config.columns.map((col) => (
                      <td key={col.key} className="py-3 px-4 text-gray-100">
                        {col.render(row)}
                      </td>
                    ))}
                    {config.verifiable && (
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleVerify(row)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition ${
                            row.verificationStatus === 'VERIFIED'
                              ? 'bg-emerald-900/60 text-emerald-300 hover:bg-emerald-800/80'
                              : row.verificationStatus === 'DISPUTED'
                                ? 'bg-red-900/60 text-red-300 hover:bg-red-800/80'
                                : 'bg-amber-900/60 text-amber-300 hover:bg-amber-800/80'
                          }`}
                          title={row.verificationStatus === 'VERIFIED' ? 'Click to mark unverified' : 'Click to mark verified'}
                        >
                          {row.verificationStatus === 'VERIFIED' ? (
                            <>
                              <CheckCircle2 size={13} /> Verified
                            </>
                          ) : (
                            <>
                              <AlertCircle size={13} /> {row.verificationStatus || 'UNVERIFIED'}
                            </>
                          )}
                        </button>
                      </td>
                    )}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEdit(row)}
                        className="text-amber-400 hover:text-amber-300 mr-3 inline-flex items-center"
                        title="Edit"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(row)}
                        className="text-red-400 hover:text-red-300 inline-flex items-center"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-700">
              <h2 className={`text-xl font-semibold ${BRONZE_COLOR}`}>
                {editingRow ? `Edit ${config.singular} #${editingRow.id}` : `Add ${config.singular}`}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4">
              {formError && (
                <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
                  {formError}
                </div>
              )}

              {config.fields.map((field) => (
                <div key={field.name}>
                  {field.type === 'checkbox' ? (
                    <label className="inline-flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(formData[field.name])}
                        onChange={(e) => setFormData({ ...formData, [field.name]: e.target.checked })}
                        className="rounded border-gray-600 bg-gray-900 text-amber-500"
                      />
                      {field.label}
                    </label>
                  ) : (
                    <>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        {field.label}
                        {field.required && <span className="text-red-400 ml-1">*</span>}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          rows={3}
                          required={field.required}
                          value={formData[field.name] ?? ''}
                          onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                        />
                      ) : field.type === 'select' ? (
                        <select
                          required={field.required}
                          value={formData[field.name] ?? ''}
                          onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                        >
                          <option value="">-- Select --</option>
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'lookup' ? (
                        <select
                          required={field.required}
                          value={formData[field.name] ?? ''}
                          onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                        >
                          <option value="">-- Select --</option>
                          {(lookups[field.lookupKey] || []).map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {field.optionLabel(opt)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          required={field.required}
                          value={formData[field.name] ?? ''}
                          onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                        />
                      )}
                    </>
                  )}
                </div>
              ))}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold rounded-md text-sm"
                >
                  {saving ? 'Saving...' : editingRow ? 'Save Changes' : `Create ${config.singular}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminResourcePage;
