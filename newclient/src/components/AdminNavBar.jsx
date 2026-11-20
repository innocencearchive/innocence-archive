// src/components/AdminNavBar.jsx
// Persistent top navigation bar across all /admin* tools

import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSpreadsheet,
  ShieldCheck,
  Settings,
  Film,
  Link2,
  LogOut,
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

  const isActive = (matchFn) =>
    matchFn(location.pathname, location.search)
      ? 'bg-amber-600 text-white'
      : 'text-gray-300 hover:bg-gray-800 hover:text-amber-400';

  const navItems = [
    {
      label: 'Dashboard',
      to: '/admin',
      icon: LayoutDashboard,
      match: (p) => p === '/admin',
    },
    {
      label: 'Import Queue',
      to: '/admin/import',
      icon: FileSpreadsheet,
      match: (p) => p.startsWith('/admin/import'),
    },
    {
      label: 'Validation Queue',
      to: '/admin/manage/individuals?unverified=true',
      icon: ShieldCheck,
      badge: unverifiedTotal > 0 ? unverifiedTotal : null,
      match: (p, s) => p.startsWith('/admin/manage/') && s.includes('unverified=true'),
    },
    {
      label: 'Homepage Settings',
      to: '/adminsettings',
      icon: Settings,
      match: (p) => p.startsWith('/adminsettings'),
    },
    {
      label: 'Film Importer',
      to: '/admin/film/add',
      icon: Film,
      match: (p) => p.startsWith('/admin/film'),
    },
    {
      label: 'Sources',
      to: '/admin/manage/informationsources',
      icon: Link2,
      match: (p) => p === '/admin/manage/informationsources',
    },
  ];

  return (
    <nav className="bg-gray-950 border-b border-gray-800 px-4 md:px-8 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-500 mr-2 hidden sm:inline">
            Admin
          </span>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${isActive(
                  item.match
                )}`}
              >
                <Icon size={14} className="mr-1.5" />
                {item.label}
                {item.badge && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-900/90 text-amber-200 font-semibold">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          {user && (
            <span className="hidden md:inline">
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
