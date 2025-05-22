// src/pages/AdminPanelPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Settings, PlusCircle, BookOpen, Film, LayoutDashboard, LogOut } from 'lucide-react';
import { BRONZE_COLOR } from '../components/themeconstants';

function AdminPanelPage() {
  const { user, logout } = useAuth();

  // Basic styling for the links
  const linkStyle = `flex items-center p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors duration-150 ease-in-out text-gray-200 hover:text-amber-400`;
  const iconStyle = "mr-3 h-6 w-6 text-amber-500"; // Consistent icon styling

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8 text-gray-200">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
          <div>
            <h1 className={`text-3xl md:text-4xl font-semibold ${BRONZE_COLOR} flex items-center`}>
              <LayoutDashboard size={32} className="mr-3" /> Admin Dashboard
            </h1>
            {user && (
              <p className="text-sm text-gray-400 mt-1">
                Welcome, {user.firstName || user.email}! (Role: {user.role})
              </p>
            )}
          </div>
          <button
            onClick={logout}
            className={`py-2 px-4 text-sm bg-red-700 hover:bg-red-800 text-white font-semibold rounded-md transition duration-150 ease-in-out flex items-center`}
            aria-label="Logout"
            title="Logout"
          >
            <LogOut size={16} className="mr-1.5" /> Logout
          </button>
        </div>

        <p className="mb-8 text-lg text-gray-300">
          This is your central hub for managing The Innocence Archive. Select an option below to get started.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Link to Settings Page */}
          <Link to="/adminsettings" className={linkStyle}>
            <Settings size={24} className={iconStyle} />
            <div>
                <span className="font-semibold text-lg">Site Settings</span>
                <p className="text-sm text-gray-400">Manage homepage featured content.</p>
            </div>
          </Link>

          {/* Placeholder for Add New Film */}
          <div className={`${linkStyle} opacity-50 cursor-not-allowed`} title="Coming Soon">
            <Film size={24} className={iconStyle} />
            <div>
                <span className="font-semibold text-lg">Add New Film</span>
                <p className="text-sm text-gray-400">Manually add a new film entry.</p>
            </div>
          </div>

          {/* Placeholder for Add New Book */}
          <div className={`${linkStyle} opacity-50 cursor-not-allowed`} title="Coming Soon">
            <BookOpen size={24} className={iconStyle} />
             <div>
                <span className="font-semibold text-lg">Add New Book</span>
                <p className="text-sm text-gray-400">Manually add a new book entry.</p>
            </div>
          </div>

          {/* You can add more links here as features are developed */}
          {/* Example:
          <Link to="/admin/users" className={linkStyle}>
            <Users2 size={24} className={iconStyle} />
             <div>
                <span className="font-semibold text-lg">User Management</span>
                <p className="text-sm text-gray-400">Manage admin and editor accounts.</p>
            </div>
          </Link>
          */}
        </div>
      </div>
    </div>
  );
}

export default AdminPanelPage;
