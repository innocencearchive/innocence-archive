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
  ];

  const quickAddActions = [
    { name: 'Book', icon: BookOpen, path: '/admin/manage/mediaworks?workType=BOOK&action=add' },
    { name: 'Film (TMDB)', icon: Film, path: '/admin/film/add' },
    { name: 'Podcast Series', icon: Radio, path: '/admin/manage/mediaworks?workType=PODCAST_SERIES&action=add' },
    { name: 'Media Item / Episode', icon: Mic, path: '/admin/manage/mediaitems?action=add' },
    { name: 'Organization', icon: Building2, path: '/admin/manage/organizations?action=add' },
    { name: 'Individual', icon: Users, path: '/admin/manage/individuals?action=add' },
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
          <div className="flex items-center space-x-3">
            <Link
              to="/adminsettings"
              className="py-2 px-4 text-sm bg-gray-700 hover:bg-gray-600 text-amber-400 font-semibold rounded-md transition duration-150 ease-in-out flex items-center"
              title="Site Settings"
            >
              <Settings size={16} className="mr-1.5" /> Settings
            </Link>
            <button
              onClick={logout}
              className="py-2 px-4 text-sm bg-red-700 hover:bg-red-800 text-white font-semibold rounded-md transition duration-150 ease-in-out flex items-center"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut size={16} className="mr-1.5" /> Logout
            </button>
          </div>
        </div>

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
