// src/pages/AdminDashboardPage.jsx
// Workflow-oriented Admin Dashboard:
//   Step 1: Ingest -> Step 2: Verify -> Step 3: Audit & Maintain -> Step 4: Configure & Publish

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../apiClient';
import {
  Settings,
  PlusSquare,
  Edit3,
  BookOpen,
  Film,
  Radio,
  Mic,
  Building2,
  Users,
  UserCheck,
  AlertTriangle,
  Tags,
  Layers,
  LayoutDashboard,
  FileSpreadsheet,
  Link2,
  ShieldCheck,
  Activity,
  History,
  Wrench,
} from 'lucide-react';
import { BRONZE_COLOR, BRONZE_BORDER } from '../components/themeconstants';

function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    apiClient
      .get('/admin/stats')
      .then((res) => setStats(res.data))
      .catch((err) => console.error('Failed to load admin stats:', err));
  }, []);

  const actionItemStyle =
    'relative flex flex-col items-center justify-center p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700/80 hover:border-amber-500/50 rounded-lg transition-colors duration-150 ease-in-out text-gray-200 hover:text-amber-400 aspect-square';
  const iconInBoxStyle = 'mb-2 h-8 w-8 text-amber-500';
  const boxTitleStyle = `text-xl font-semibold ${BRONZE_COLOR} mb-4 pb-2 border-b ${BRONZE_BORDER}`;

  const totalUnverified =
    (stats?.individuals?.unverified || 0) +
    (stats?.mediaWorks?.unverified || 0) +
    (stats?.mediaItems?.unverified || 0) +
    (stats?.organizations?.unverified || 0) +
    (stats?.involvedPersons?.unverified || 0);

  const workflowStages = [
    {
      stage: 'Step 1 · Ingest',
      tools: [
        {
          name: 'Import Staging Queue',
          description: 'Initialize core lookup tables, preview CSV/JSON uploads, check duplicates, and commit batches.',
          path: '/admin/import',
          icon: FileSpreadsheet,
        },
        {
          name: 'TMDB Film Importer',
          description: 'Search TMDB, fetch metadata & streaming providers, and save films directly to the DB.',
          path: '/admin/film/add',
          icon: Film,
        },
        {
          name: 'Podcast Pipeline Monitor',
          description: 'Monitor automated RSS feeds and review newly captured podcast episodes.',
          path: '/admin/podcasts',
          icon: Radio,
        },
      ],
    },
    {
      stage: 'Step 2 · Verify & Curate',
      tools: [
        {
          name: 'Unified Validation Queue',
          description:
            totalUnverified > 0
              ? `${totalUnverified} unverified record(s) across all entities awaiting review.`
              : 'Review, verify, or dispute newly imported and AI-assisted records in one screen.',
          path: '/admin/verify',
          icon: ShieldCheck,
          badge: totalUnverified > 0 ? `${totalUnverified} pending` : null,
        },
      ],
    },
    {
      stage: 'Step 3 · Audit & Maintain',
      tools: [
        {
          name: 'Data Health & Duplicates',
          description: 'Find missing citations, incomplete fields, unlinked media, and safely merge duplicate individuals.',
          path: '/admin/audit',
          icon: Activity,
        },
        {
          name: 'Import Batch History',
          description: 'Inspect past import batches, bulk-verify trusted sources, or safely roll back a batch.',
          path: '/admin/batches',
          icon: History,
        },
      ],
    },
    {
      stage: 'Step 4 · Configure & Publish',
      tools: [
        {
          name: 'Homepage Settings',
          description: 'Set featured story, book, podcast, film, organization, and contributing factors.',
          path: '/adminsettings',
          icon: Settings,
        },
        {
          name: 'Source Provenance Catalog',
          description: 'Manage Information Sources (NRE, Innocence Project, Wikipedia, etc.) used for citations.',
          path: '/admin/manage/informationsources',
          icon: Link2,
        },
      ],
    },
  ];

  const manageSections = [
    { name: 'Individuals', resource: 'individuals', statsKey: 'individuals', icon: Users },
    { name: 'Media Works', resource: 'mediaworks', statsKey: 'mediaWorks', icon: BookOpen },
    { name: 'Media Items', resource: 'mediaitems', statsKey: 'mediaItems', icon: Mic },
    { name: 'Organizations', resource: 'organizations', statsKey: 'organizations', icon: Building2 },
    { name: 'Involved Persons', resource: 'involvedpersons', statsKey: 'involvedPersons', icon: UserCheck },
    { name: 'Contributing Factors', resource: 'contributingfactors', statsKey: 'contributingFactors', icon: AlertTriangle },
    { name: 'Crime Categories', resource: 'crimecategories', statsKey: 'crimeCategories', icon: Tags },
    { name: 'Individual Groups', resource: 'individualgroups', statsKey: 'individualGroups', icon: Layers },
    { name: 'Information Sources', resource: 'informationsources', statsKey: 'informationSources', icon: Link2 },
  ];

  const quickAddActions = [
    { name: 'Individual', icon: Users, path: '/admin/manage/individuals?action=add' },
    { name: 'Organization', icon: Building2, path: '/admin/manage/organizations?action=add' },
    { name: 'Book', icon: BookOpen, path: '/admin/manage/mediaworks?workType=BOOK&action=add' },
    { name: 'Film (TMDB)', icon: Film, path: '/admin/film/add' },
    { name: 'Podcast Series', icon: Radio, path: '/admin/manage/mediaworks?workType=PODCAST_SERIES&action=add' },
    { name: 'Media Item', icon: Mic, path: '/admin/manage/mediaitems?action=add' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8 text-gray-200">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 border-b border-gray-700 pb-5">
          <h1 className={`text-3xl md:text-4xl font-semibold ${BRONZE_COLOR} flex items-center`}>
            <LayoutDashboard size={34} className="mr-3" /> Admin Dashboard
          </h1>
          {user && (
            <p className="text-sm text-gray-400 mt-1.5">
              Welcome, {user.firstName || user.email}! Use the 4-stage workflow below or the top bar to jump between tools.
            </p>
          )}
        </div>

        {/* 4-Stage Curation Workflow */}
        <section className="mb-12 space-y-6">
          <h2 className={boxTitleStyle}>
            <Wrench size={22} className="mr-2 inline-block" /> Curation Workflow &amp; Admin Tools
          </h2>
          {workflowStages.map((group) => (
            <div key={group.stage} className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                {group.stage}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.tools.map((tool) => {
                  const IconComponent = tool.icon;
                  return (
                    <Link
                      key={tool.name}
                      to={tool.path}
                      className="flex flex-col justify-between p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-amber-500/60 rounded-lg transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center text-amber-400 font-semibold text-sm">
                            <IconComponent size={18} className="mr-2" />
                            <span>{tool.name}</span>
                          </div>
                          {tool.badge && (
                            <span className="px-2 py-0.5 text-[11px] rounded-full bg-amber-900/80 text-amber-200 font-medium">
                              {tool.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">{tool.description}</p>
                      </div>
                      <span className="text-xs text-amber-400 mt-3 font-medium">Open →</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {/* Manage, Cross-Link & Edit Existing Data */}
        <section className="mb-12">
          <h2 className={boxTitleStyle}>
            <Edit3 size={22} className="mr-2 inline-block" /> Manage, Cross-Link &amp; Edit Data
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {manageSections.map((item) => {
              const IconComponent = item.icon;
              const stat = stats?.[item.statsKey];
              return (
                <Link
                  key={`manage-${item.resource}`}
                  to={`/admin/manage/${item.resource}`}
                  className={actionItemStyle}
                  title={`Manage ${item.name}`}
                >
                  <IconComponent size={30} className={iconInBoxStyle} />
                  <span className="text-sm font-medium text-center">{item.name}</span>
                  {stat && (
                    <span className="text-xs text-gray-400 mt-1 text-center">
                      {stat.total} total
                      {typeof stat.unverified === 'number' && stat.unverified > 0 && (
                        <span className="block text-amber-400">({stat.unverified} unverified)</span>
                      )}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>

        {/* Quick Add New Data */}
        <section>
          <h2 className={boxTitleStyle}>
            <PlusSquare size={22} className="mr-2 inline-block" /> Quick Add Single Record
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {quickAddActions.map((type) => {
              const IconComponent = type.icon;
              return (
                <Link
                  key={`add-${type.name}`}
                  to={type.path}
                  className={actionItemStyle}
                  title={`Add New ${type.name}`}
                >
                  <IconComponent size={28} className={iconInBoxStyle} />
                  <span className="text-xs font-medium text-center">{type.name}</span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
