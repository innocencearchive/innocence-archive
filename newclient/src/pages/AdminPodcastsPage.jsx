// src/pages/AdminPodcastsPage.jsx
// Podcast Pipeline Monitor: view configured RSS feeds, series progress, and recently staged episodes

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, CheckCircle2, ExternalLink, RefreshCw, Edit3 } from 'lucide-react';
import apiClient from '../apiClient';
import { BRONZE_COLOR } from '../components/themeconstants';

function AdminPodcastsPage() {
  const [data, setData] = useState({ configuredFeeds: [], series: [], recentEpisodes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/admin/tools/podcasts');
      setData(res.data || { configuredFeeds: [], series: [], recentEpisodes: [] });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load podcast pipeline data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleQuickVerify = async (episodeId) => {
    setVerifyingId(episodeId);
    try {
      await apiClient.patch(`/admin/verify/mediaitems/${episodeId}`, {
        verificationStatus: 'VERIFIED',
        verified: true,
      });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to verify episode.');
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8 text-gray-200">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-700 pb-4">
          <div>
            <h1 className={`text-2xl md:text-3xl font-semibold ${BRONZE_COLOR} flex items-center`}>
              <Radio size={28} className="mr-3" /> Podcast Pipeline Monitor
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Monitor automated RSS feeds, podcast series totals, and newly ingested episodes ready for verification.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/manage/mediaitems?unverified=true"
              className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-medium"
            >
              Unverified Media Items →
            </Link>
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md text-xs"
            >
              <RefreshCw size={14} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-950/70 border border-red-700 rounded text-sm text-red-300">{error}</div>
        )}

        {/* Configured RSS Feeds */}
        {data.configuredFeeds.length > 0 && (
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-5 space-y-3">
            <h2 className="text-base font-semibold text-amber-400">
              Configured Daily Capture Feeds (feeds.json)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {data.configuredFeeds.map((f, idx) => (
                <div key={idx} className="p-3 bg-gray-900 border border-gray-700 rounded text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-100">{f.podcastTitle}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        f.active ? 'bg-green-900/70 text-green-300' : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {f.active ? 'ACTIVE' : 'PAUSED'}
                    </span>
                  </div>
                  <div className="text-gray-400">{f.publisherOrNetwork} · Host: {f.defaultHost}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Podcast Series in DB */}
        <section className="bg-gray-800 border border-gray-700 rounded-lg p-5 space-y-3">
          <h2 className="text-base font-semibold text-amber-400">Podcast Series in Database</h2>
          {data.series.length === 0 ? (
            <p className="text-xs text-gray-400">No podcast series ingested yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {data.series.map((s) => (
                <div key={s.id} className="p-3 bg-gray-900 border border-gray-700 rounded text-xs space-y-1">
                  <div className="font-semibold text-gray-100">{s.title}</div>
                  <div className="text-gray-400">{s.publisherOrNetwork || s.creatorName || '—'}</div>
                  <div className="text-gray-300">
                    <strong>{s.totalEpisodes}</strong> episode(s)
                    {s.unverifiedEpisodes > 0 && (
                      <span className="ml-2 text-amber-400">({s.unverifiedEpisodes} unverified)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Episodes */}
        <section className="bg-gray-800 border border-gray-700 rounded-lg p-5 space-y-3">
          <h2 className="text-base font-semibold text-amber-400">
            Recent Podcast Episodes ({data.recentEpisodes.length})
          </h2>
          {loading ? (
            <p className="text-xs text-gray-400">Loading episodes...</p>
          ) : data.recentEpisodes.length === 0 ? (
            <p className="text-xs text-gray-400">No podcast episodes in the database yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="py-2 pr-3">Episode</th>
                    <th className="py-2 pr-3">Series</th>
                    <th className="py-2 pr-3">Linked Individuals &amp; Factors</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/60">
                  {data.recentEpisodes.map((ep) => (
                    <tr key={ep.id} className="hover:bg-gray-700/30 align-top">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-gray-100">{ep.itemTitle || `Episode #${ep.id}`}</div>
                        <div className="text-gray-500">
                          {ep.releaseDate ? String(ep.releaseDate).slice(0, 10) : 'No date'}
                          {ep.ingestionSource ? ` · ${ep.ingestionSource}` : ''}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-gray-300">{ep.work?.title || '—'}</td>
                      <td className="py-2.5 pr-3 space-y-1">
                        {ep.individualsFeatured?.length > 0 ? (
                          <div className="text-amber-300">
                            {ep.individualsFeatured.map((i) => `${i.firstName} ${i.lastName}`).join(', ')}
                          </div>
                        ) : (
                          <span className="text-gray-500 italic">No individual linked</span>
                        )}
                        {ep.contributingFactorsMentioned?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {ep.contributingFactorsMentioned.map((f) => (
                              <span key={f.id} className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px]">
                                {f.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                            ep.verificationStatus === 'VERIFIED'
                              ? 'bg-green-900/60 text-green-300'
                              : 'bg-amber-900/60 text-amber-300'
                          }`}
                        >
                          {ep.verificationStatus}
                        </span>
                      </td>
                      <td className="py-2.5 text-right space-x-2 whitespace-nowrap">
                        {ep.sourceUrl && (
                          <a
                            href={ep.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-blue-300"
                          >
                            Listen <ExternalLink size={11} className="ml-1" />
                          </a>
                        )}
                        {ep.verificationStatus !== 'VERIFIED' && (
                          <button
                            type="button"
                            disabled={verifyingId === ep.id}
                            onClick={() => handleQuickVerify(ep.id)}
                            className="inline-flex items-center px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-white"
                          >
                            <CheckCircle2 size={12} className="mr-1" /> Verify
                          </button>
                        )}
                        <Link
                          to="/admin/manage/mediaitems"
                          className="inline-flex items-center px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-200"
                        >
                          <Edit3 size={12} className="mr-1" /> Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default AdminPodcastsPage;
