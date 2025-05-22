// src/pages/AdminSettingsPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import { Save, AlertCircle, CheckCircle, RefreshCw, LogOut, UserCircle } from 'lucide-react';
import { BRONZE_COLOR, BRONZE_BORDER } from '../components/themeconstants';
import apiClient from '../apiClient';

function AdminSettingsPage() {
  const { user, isAuthenticated, isLoading: authIsLoading, logout } = useAuth(); // Get auth state
  const navigate = useNavigate();

  // State for featured item IDs (remains the same)
  const [featuredStoryId, setFeaturedStoryId] = useState('');
  const [featuredBookId, setFeaturedBookId] = useState('');
  const [featuredPodcastId, setFeaturedPodcastId] = useState('');
  const [featuredFilmId, setFeaturedFilmId] = useState('');
  const [featuredOrgId, setFeaturedOrgId] = useState('');
  const [featuredFactorIds, setFeaturedFactorIds] = useState('');

  // State for loading/saving feedback (remains the same)
  const [isFetchingSettings, setIsFetchingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ message: '', type: '' });

  const fetchSettings = async () => {
    if (!isAuthenticated) return; // Don't fetch if not authenticated

    setIsFetchingSettings(true);
    setSaveStatus({ message: '', type: '' });
    console.log("AdminSettingsPage: Fetching current featured settings...");

    try {
      const response = await apiClient.get('/settings/featured'); // apiClient now includes token
      const currentSettings = response.data;
      console.log("AdminSettingsPage: Current settings fetched:", currentSettings);

      setFeaturedStoryId(currentSettings.featuredStoryId || '');
      setFeaturedBookId(currentSettings.featuredBookId || '');
      setFeaturedPodcastId(currentSettings.featuredPodcastId || '');
      setFeaturedFilmId(currentSettings.featuredFilmId || '');
      setFeaturedOrgId(currentSettings.featuredOrgId || '');
      setFeaturedFactorIds(Array.isArray(currentSettings.featuredFactorIds) ? currentSettings.featuredFactorIds.join(', ') : (currentSettings.featuredFactorIds || ''));
    } catch (error) {
      console.error("AdminSettingsPage: Error fetching settings:", error);
      const errorMessage = error.response?.data?.message || error.message || "An unknown error occurred while fetching settings.";
      setSaveStatus({ message: `Error fetching settings: ${errorMessage}`, type: 'error' });
    } finally {
      setIsFetchingSettings(false);
    }
  };

  // Fetch settings when the component mounts and user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings();
    }
  }, [isAuthenticated]); // Depend on isAuthenticated from useAuth

 

  const handleSave = async (event) => {
    event.preventDefault();
    if (!isAuthenticated) return; // Don't save if not authenticated

    setIsSavingSettings(true);
    setSaveStatus({ message: '', type: '' });
    console.log("AdminSettingsPage: Attempting to save settings...");

    const factorIdArray = featuredFactorIds.split(',')
      .map(id => id.trim())
      .filter(id => id !== '' && !isNaN(Number(id))) // Ensure IDs are numbers
      .map(Number);

    const newSettings = {
      featuredStoryId: featuredStoryId ? parseInt(featuredStoryId) : null,
      featuredBookId: featuredBookId ? parseInt(featuredBookId) : null,
      featuredPodcastId: featuredPodcastId ? parseInt(featuredPodcastId) : null,
      featuredFilmId: featuredFilmId ? parseInt(featuredFilmId) : null,
      featuredOrgId: featuredOrgId ? parseInt(featuredOrgId) : null,
      featuredFactorIds: factorIdArray,
    };

    console.log("AdminSettingsPage: Saving settings payload:", newSettings);

    try {
      const response = await apiClient.put('/settings/featured', newSettings); // apiClient now includes token
      const responseData = response.data;
      console.log("AdminSettingsPage: Settings saved successfully:", responseData);
      setSaveStatus({ message: responseData.message || 'Settings saved successfully!', type: 'success' });
    } catch (error) {
      console.error("AdminSettingsPage: Error saving settings:", error);
      const errorMessage = error.response?.data?.message || error.message || "An unknown error occurred while saving settings.";
      setSaveStatus({ message: `Error saving settings: ${errorMessage}`, type: 'error' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleLogout = () => {
    logout(); // Call logout from AuthContext
  };

  // Show loading spinner if auth is still loading
  if (authIsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
        <svg className="animate-spin h-10 w-10 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  // If not authenticated (after auth check), this part might not be reached due to redirect,
  // but it's good practice for components that might be rendered conditionally.
  if (!isAuthenticated) {
     // The useEffect above should handle redirection.
     // You could show a message here if preferred over immediate redirect.
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-4 text-gray-300">
            <p className="mb-4 text-lg">Access Denied. Please log in to view this page.</p>
            <button
                onClick={() => navigate('/login')}
                className={`py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-md transition duration-150 ease-in-out ${BRONZE_BORDER} border-2`}
            >
                Go to Login
            </button>
        </div>
    );
  }

  // If authenticated, render the settings page
  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8 text-gray-200">
      <div className="max-w-3xl mx-auto bg-gray-800 p-6 md:p-8 rounded-lg shadow-xl">
        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
          <div>
            <h1 className={`text-3xl font-semibold ${BRONZE_COLOR}`}>
              Homepage Settings
            </h1>
            {user && (
              <p className="text-sm text-gray-400 mt-1 flex items-center">
                <UserCircle size={16} className="mr-1.5" /> Logged in as: {user.email} (Role: {user.role})
              </p>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
                onClick={fetchSettings}
                disabled={isFetchingSettings || isSavingSettings}
                className={`p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                aria-label="Refresh settings"
                title="Refresh Settings"
            >
                <RefreshCw size={20} className={isFetchingSettings ? 'animate-spin' : ''}/>
            </button>
            <button
                onClick={handleLogout}
                className={`py-2 px-4 text-sm bg-red-700 hover:bg-red-800 text-white font-semibold rounded-md transition duration-150 ease-in-out flex items-center disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label="Logout"
                title="Logout"
            >
                <LogOut size={16} className="mr-1.5" /> Logout
            </button>
          </div>
        </div>

        {isFetchingSettings && (
          <div className="text-center py-4 text-gray-400">Loading current settings...</div>
        )}

        {saveStatus.message && !isFetchingSettings && (
          <div className={`flex items-center p-3 rounded-md mb-4 ${saveStatus.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
            {saveStatus.type === 'success' ? <CheckCircle className="mr-2 h-5 w-5" /> : <AlertCircle className="mr-2 h-5 w-5" />}
            {saveStatus.message}
          </div>
        )}

        {!isFetchingSettings && (
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label htmlFor="featuredStoryId" className="block text-sm font-medium text-gray-300 mb-1">
                  Featured Story (Individual ID)
                </label>
                <input
                  type="number"
                  id="featuredStoryId"
                  value={featuredStoryId}
                  onChange={(e) => setFeaturedStoryId(e.target.value)}
                  placeholder="Enter Individual ID"
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <fieldset className={`border ${BRONZE_BORDER} p-4 rounded-md`}>
                <legend className={`text-lg font-medium mb-2 px-1 ${BRONZE_COLOR}`}>Explore Grid: Featured Media</legend>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="featuredBookId" className="block text-sm font-medium text-gray-300 mb-1">Book (MediaWork ID)</label>
                    <input type="number" id="featuredBookId" value={featuredBookId} onChange={(e) => setFeaturedBookId(e.target.value)} placeholder="Enter MediaWork ID" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-amber-500"/>
                  </div>
                  <div>
                    <label htmlFor="featuredPodcastId" className="block text-sm font-medium text-gray-300 mb-1">Podcast (MediaWork ID)</label>
                    <input type="number" id="featuredPodcastId" value={featuredPodcastId} onChange={(e) => setFeaturedPodcastId(e.target.value)} placeholder="Enter MediaWork ID" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-amber-500"/>
                  </div>
                  <div>
                    <label htmlFor="featuredFilmId" className="block text-sm font-medium text-gray-300 mb-1">Film/Doc (MediaWork ID)</label>
                    <input type="number" id="featuredFilmId" value={featuredFilmId} onChange={(e) => setFeaturedFilmId(e.target.value)} placeholder="Enter MediaWork ID" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-amber-500"/>
                  </div>
                </div>
              </fieldset>

              <div>
                <label htmlFor="featuredOrgId" className="block text-sm font-medium text-gray-300 mb-1">
                  Explore Grid: Featured Organization (Org ID)
                </label>
                <input
                  type="number"
                  id="featuredOrgId"
                  value={featuredOrgId}
                  onChange={(e) => setFeaturedOrgId(e.target.value)}
                  placeholder="Enter Organization ID"
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label htmlFor="featuredFactorIds" className="block text-sm font-medium text-gray-300 mb-1">
                  Explore Grid: Featured Factors (Comma-separated Factor IDs)
                </label>
                <input
                  type="text" // Keep as text to allow comma separation
                  id="featuredFactorIds"
                  value={featuredFactorIds}
                  onChange={(e) => setFeaturedFactorIds(e.target.value)}
                  placeholder="e.g., 1, 5, 12"
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                 <p className="text-xs text-gray-400 mt-1">Enter multiple Factor IDs separated by commas.</p>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSavingSettings || isFetchingSettings}
                  className={`w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-md transition duration-150 ease-in-out flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${BRONZE_BORDER} border-2`}
                >
                  <Save className="mr-2 h-5 w-5" />
                  {isSavingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
        )}
      </div>
    </div>
  );
}

export default AdminSettingsPage;
