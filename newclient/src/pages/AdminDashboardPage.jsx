// src/pages/AdminDashboardPage.jsx
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
  LogOut,
  FileSpreadsheet,
  Link2,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { BRONZE_COLOR, BRONZE_BORDER } from '../components/themeconstants';

function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    apiClient
      .get('/admin/stats')
      .then((res) => setStats(res.data))
      .catch((err) => console.error('Failed to load admin stats:', err));
  }, []);

  const actionItemStyle =
    'relative flex flex-col items-center justify-center p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors duration-150 ease-in-out text-gray-200 hover:text-amber-400 aspect-square';
  const iconInBoxStyle = 'mb-2 h-8 w-8 text-amber-500';
  const boxTitleStyle = `text-xl font-semibold ${BRONZE_COLOR} mb-4 pb-2 border-b ${BRONZE_BORDER}`;

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
    { name: 'Book', icon: BookOpen, path: '/admin/manage/mediaworks?workType=BOOK&action=add' },
    { name: 'Film (TMDB)', icon: Film, path: '/admin/film/add' },
    { name: 'Podcast Series', icon: Radio, path: '/admin/manage/mediaworks?workType=PODCAST_SERIES&action=add' },
    { name: 'Media Item / Episode', icon: Mic, path: '/admin/manage/mediaitems?action=add' },
    { name: 'Organization', icon: Building2, path: '/admin/manage/organizations?action=add' },
    { name: 'Individual', icon: Users, path: '/admin/manage/individuals?action=add' },
  ];

  const totalUnverified =
    (stats?.individuals?.unverified || 0) +
    (stats?.mediaWorks?.unverified || 0) +
    (stats?.mediaItems?.unverified || 0) +
    (stats?.organizations?.unverified || 0) +
    (stats?.involvedPersons?.unverified || 0);

  const adminTools = [
    {
      name: 'Import Staging Queue',
      description: 'Initialize core lookup tables, preview CSV/JSON uploads, check duplicates, and commit batches.',
      path: '/admin/import',
      icon: FileSpreadsheet,
    },
    {
      name: 'Validation Queue',
      description:
        totalUnverified > 0
          ? `${totalUnverified} unverified record(s) waiting for review and approval.`
          : 'Review and verify newly imported or AI-assisted records.',
      path: '/admin/manage/individuals?unverified=true',
      icon: ShieldCheck,
      badge: totalUnverified > 0 ? `${totalUnverified} pending` : null,
    },
    {
      name: 'Homepage Settings',
      description: 'Configure featured story, book, podcast, film, organization, and contributing factors.',
      path: '/adminsettings',
      icon: Settings,
    },
    {
      name: 'TMDB Film Importer',
      description: 'Search TMDB for films/documentaries, pull metadata & streaming providers, and save to DB.',
      path: '/admin/film/add',
      icon: Film,
    },
    {
      name: 'Source Provenance Catalog',
      description: 'Manage Information Sources (NRE, Innocence Project, Wikipedia, etc.) used for citations.',
      path: '/admin/manage/informationsources',
      icon: Link2,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8 text-gray-200">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10 border-b border-gray-700 pb-5">
          <div>
            <h1 className={`text-3xl md:text-4xl font-semibold ${BRONZE_COLOR} flex items-center`}>
              <LayoutDashboard size={36} className="mr-3" /> Admin Dashboard
            </h1>
            {user && (
              <p className="text-sm text-gray-400 mt-1.5">
                Welcome, {user.firstName || user.email}! (Role: {user.role})
              </p>
            )}
          </div>
        </div>

        {/* Admin Tools Menu */}
        <section className="mb-12">
          <h2 className={boxTitleStyle}>
            <Wrench size={24} className="mr-2 inline-block" /> Admin Tools
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {adminTools.map((tool) => {
              const IconComponent = tool.icon;
              return (
                <Link
                  key={tool.name}
                  to={tool.path}
                  className="flex flex-col justify-between p-5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-amber-500/60 rounded-lg transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center text-amber-400 font-semibold">
                        <IconComponent size={20} className="mr-2" />
                        <span>{tool.name}</span>
                      </div>
                      {tool.badge && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-amber-900/80 text-amber-200 font-medium">
                          {tool.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{tool.description}</p>
                  </div>
                  <span className="text-xs text-amber-400 mt-3 font-medium">Open tool →</span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Manage, Verify & Edit Existing Data */}
        <section className="mb-12">
          <h2 className={boxTitleStyle}>
            <Edit3 size={24} className="mr-2 inline-block" /> Manage, Verify &amp; Edit Data
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
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
                  <IconComponent size={32} className={iconInBoxStyle} />
                  <span className="text-sm font-medium text-center">{item.name}</span>
                  {stat && (
                    <span className="text-xs text-gray-400 mt-1">
                      {stat.total} total
                      {typeof stat.unverified === 'number' && stat.unverified > 0 && (
                        <span className="ml-1 text-amber-400">({stat.unverified} unverified)</span>
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
            <PlusSquare size={24} className="mr-2 inline-block" /> Add New Data
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
            {quickAddActions.map((type) => {
              const IconComponent = type.icon;
              return (
                <Link
                  key={`add-${type.name}`}
                  to={type.path}
                  className={actionItemStyle}
                  title={`Add New ${type.name}`}
                >
                  <IconComponent size={32} className={iconInBoxStyle} />
                  <span className="text-sm text-center">{type.name}</span>
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
