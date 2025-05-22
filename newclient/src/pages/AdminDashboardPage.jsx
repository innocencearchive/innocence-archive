// src/pages/AdminDashboardPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Settings,
  PlusSquare, // Changed from PlusCircle for a "boxier" feel
  Edit3,      // Icon for Edit
  BookOpen,
  Film,
  Radio,      // For Podcast Series
  Mic,        // For Podcast Episode
  Newspaper,  // For News Story
  Building2,  // For Organization (lucide has Building, Building2)
  Users,      // For Individuals
  LayoutDashboard,
  LogOut
} from 'lucide-react';
import { BRONZE_COLOR, BRONZE_BORDER } from '../components/themeconstants';

function AdminDashboardPage() {
  const { user, logout } = useAuth();

  // Styling for the action "buttons" (which are Links or divs)
  const actionItemStyle = `flex flex-col items-center justify-center p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors duration-150 ease-in-out text-gray-200 hover:text-amber-400 aspect-square`;
  const liveLinkStyle = `${actionItemStyle}`; // Live links
  const disabledLinkStyle = `${actionItemStyle} opacity-50 cursor-not-allowed`; // Disabled links
  const iconInBoxStyle = "mb-2 h-8 w-8 text-amber-500"; // Icon style for items within boxes
  const boxTitleStyle = `text-xl font-semibold ${BRONZE_COLOR} mb-4 pb-2 border-b ${BRONZE_BORDER}`;

  const dataTypes = [
    { name: 'Book', icon: BookOpen, live: true, addPath: '/admin/add/book', editPath: '/admin/edit/book' },
    { name: 'Film', icon: Film, live: true, addPath: '/admin/add/film', editPath: '/admin/edit/film' },
    { name: 'Podcast Series', icon: Radio, live: false, addPath: '#', editPath: '#' },
    { name: 'Podcast Episode', icon: Mic, live: false, addPath: '#', editPath: '#' },
    { name: 'News Story', icon: Newspaper, live: false, addPath: '#', editPath: '#' },
    { name: 'Organization', icon: Building2, live: false, addPath: '#', editPath: '#' },
    { name: 'Wrongfully Convicted Individual', icon: Users, live: false, addPath: '#', editPath: '#' }
  ];

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8 text-gray-200">
      <div className="max-w-6xl mx-auto"> {/* Increased max-width for more content */}
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
            <Link to="/adminsettings"
              className={`py-2 px-4 text-sm bg-gray-700 hover:bg-gray-600 text-amber-400 font-semibold rounded-md transition duration-150 ease-in-out flex items-center`}
              title="Site Settings"
            >
              <Settings size={16} className="mr-1.5" /> Settings
            </Link>
            <button
              onClick={logout}
              className={`py-2 px-4 text-sm bg-red-700 hover:bg-red-800 text-white font-semibold rounded-md transition duration-150 ease-in-out flex items-center`}
              aria-label="Logout"
              title="Logout"
            >
              <LogOut size={16} className="mr-1.5" /> Logout
            </button>
          </div>
        </div>

        {/* Section for Adding Data */}
        <section className="mb-12">
          <h2 className={boxTitleStyle}>
            <PlusSquare size={24} className="mr-2 inline-block" /> Add New Data
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {dataTypes.map((type) => {
              const IconComponent = type.icon;
              if (type.live) {
                return (
                  <Link key={`add-${type.name}`} to={type.addPath} className={liveLinkStyle} title={`Add New ${type.name}`}>
                    <IconComponent size={32} className={iconInBoxStyle} />
                    <span className="text-sm text-center">{type.name}</span>
                  </Link>
                );
              }
              return (
                <div key={`add-${type.name}`} className={disabledLinkStyle} title={`${type.name} - Coming Soon`}>
                  <IconComponent size={32} className={iconInBoxStyle} />
                  <span className="text-sm text-center">{type.name}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section for Editing Data */}
        <section>
          <h2 className={boxTitleStyle}>
            <Edit3 size={24} className="mr-2 inline-block" /> Edit Existing Data
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {dataTypes.map((type) => {
              const IconComponent = type.icon;
              // For now, all edit links are disabled placeholders
              return (
                <div key={`edit-${type.name}`} className={disabledLinkStyle} title={`Edit ${type.name} - Coming Soon`}>
                  <IconComponent size={32} className={iconInBoxStyle} />
                  <span className="text-sm text-center">{type.name}</span>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
}

export default AdminDashboardPage;
