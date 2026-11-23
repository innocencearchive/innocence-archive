// src/components/AdminNavBar.jsx
// Persistent workflow-oriented navigation bar across all /admin* pages:
//   Dashboard | 1. Ingest (Import, Film, Podcasts) | 2. Verify (Validation Queue) | 3. Audit (Health, Batches) | 4. Site (Settings, Sources)

import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Film,
  Radio,
  ShieldCheck,
  Activity,
  History,
  Settings,
  Link2,
  LogOut,
  Newspaper,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../apiClient';

function AdminNavBar() {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const [unverifiedTotal, setUnverifiedTotal] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    apiClient
      .get('/admin/stats')
      .then((res) => {
        const s = res.data || {};
        const total =
          (s.individuals?.unverified || 0) +
          (s.mediaWorks?.unverified || 0) +
          (s.mediaItems?.unverified || 0) +
          (s.organizations?.unverified || 0) +
          (s.involvedPersons?.unverified || 0);
        setUnverifiedTotal(total);
      })
      .catch(() => {});
  }, [isAuthenticated, location.pathname]);

  if (!isAuthenticated) return null;

  const linkClass = (active) =>
    `inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
      active
        ? 'bg-amber-600 text-white'
        : 'text-gray-300 hover:bg-gray-800 hover:text-amber-400'
    }`;

  const groups = [
    {
      label: null,
      items: [
        {
          label: 'Dashboard',
          to: '/admin',
          icon: LayoutDashboard,
          active: location.pathname === '/admin',
        },
      ],
    },
    {
      label: '1. Ingest',
      items: [
        {
          label: 'Import Queue',
          to: '/admin/import',
          icon: FileSpreadsheet,
          active: location.pathname.startsWith('/admin/import'),
        },
        {
          label: 'Films',
          to: '/admin/film/add',
          icon: Film,
          active: location.pathname.startsWith('/admin/film'),
        },
        {
          label: 'Podcasts',
          to: '/admin/podcasts',
          icon: Radio,
          active: location.pathname.startsWith('/admin/podcasts'),
        },
        {
          label: 'News',
          to: '/admin/news',
          icon: Newspaper,
          active: location.pathname.startsWith('/admin/news'),
        },
      ],
    },
    {
      label: '2. Verify',
      items: [
        {
          label: 'Validation Queue',
          to: '/admin/verify',
          icon: ShieldCheck,
          badge: unverifiedTotal > 0 ? unverifiedTotal : null,
          active: location.pathname.startsWith('/admin/verify'),
        },
      ],
    },
    {
      label: '3. Audit',
      items: [
        {
          label: 'Data Health',
          to: '/admin/audit',
          icon: Activity,
          active: location.pathname.startsWith('/admin/audit'),
        },
        {
          label: 'Batches',
          to: '/admin/batches',
          icon: History,
          active: location.pathname.startsWith('/admin/batches'),
        },
      ],
    },
    {
      label: '4. Configure',
      items: [
        {
          label: 'Homepage',
          to: '/adminsettings',
          icon: Settings,
          active: location.pathname.startsWith('/adminsettings'),
        },
        {
          label: 'Sources',
          to: '/admin/manage/informationsources',
          icon: Link2,
          active: location.pathname === '/admin/manage/informationsources',
        },
      ],
    },
  ];

  return (
    <nav className="bg-gray-950 border-b border-gray-800 px-4 md:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-y-2">
          {groups.map((group, idx) => (
            <div
              key={group.label || 'root'}
              className={`flex items-center gap-1 ${
                idx > 0 ? 'pl-2.5 ml-2.5 border-l border-gray-800' : ''
              }`}
            >
              {group.label && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mr-1 hidden lg:inline">
                  {group.label}
                </span>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to} className={linkClass(item.active)}>
                    <Icon size={13} className="mr-1.5" />
                    {item.label}
                    {item.badge && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-900 text-amber-200 font-semibold">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          {user && (
            <span className="hidden xl:inline">
              {user.firstName || user.email} ({user.role})
            </span>
          )}
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center px-2.5 py-1.5 rounded bg-red-800/80 hover:bg-red-700 text-white text-xs font-medium"
          >
            <LogOut size={13} className="mr-1" /> Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

export default AdminNavBar;
