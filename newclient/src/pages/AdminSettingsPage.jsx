// src/pages/AdminSettingsPage.jsx
import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Save, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
// Assuming theme constants are available
import { BRONZE_COLOR, BRONZE_BORDER } from '../components/themeconstants';
import apiClient from '../apiClient'; // Adjust the path if apiClient.js is elsewhere

// --- !!! IMPORTANT SECURITY NOTE !!! ---
// Storing passwords directly in frontend code is INSECURE.
// This is a basic implementation for demonstration only.
// For a real application, use proper authentication and secure backend validation.
const ADMIN_PASSWORD = 'danish123'; // CHANGE THIS! And ideally move to a secure auth system.

function AdminSettingsPage() {
  // --- State ---
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // State for featured item IDs
  const [featuredStoryId, setFeaturedStoryId] = useState('');
  const [featuredBookId, setFeaturedBookId] = useState('');
  const [featuredPodcastId, setFeaturedPodcastId] = useState('');
  const [featuredFilmId, setFeaturedFilmId] = useState('');
  const [featuredOrgId, setFeaturedOrgId] = useState('');
  const [featuredFactorIds, setFeaturedFactorIds] = useState(''); // Comma-separated IDs

  // State for loading/saving feedback
  const [isLoading, setIsLoading] = useState(false); // Combined loading state for general UI feedback
  const [isFetching, setIsFetching] = useState(false); // Specific state for fetching settings
  const [isSaving, setIsSaving] = useState(false);   // Specific state for saving settings
  const [saveStatus, setSaveStatus] = useState({ message: '', type: '' }); // type: 'success' or 'error'

  const fetchSettings = async () => {
    setIsFetching(true);
    setIsLoading(true);
    setSaveStatus({ message: '', type: '' });
    console.log("Fetching current featured settings using apiClient...");

    try {
      const response = await apiClient.get('/api/settings/featured');
      const currentSettings = response.data;
      console.log("Current settings fetched:", currentSettings);

      setFeaturedStoryId(currentSettings.featuredStoryId || '');
      setFeaturedBookId(currentSettings.featuredBookId || '');
      setFeaturedPodcastId(currentSettings.featuredPodcastId || '');
      setFeaturedFilmId(currentSettings.featuredFilmId || '');
      setFeaturedOrgId(currentSettings.featuredOrgId || '');
      setFeaturedFactorIds(Array.isArray(currentSettings.featuredFactorIds) ? currentSettings.featuredFactorIds.join(', ') : (currentSettings.featuredFactorIds || ''));

    } catch (error) {
      console.error("Error fetching settings in component:", error);
      const errorMessage = error.response?.data?.message || error.message || "An unknown error occurred while fetching settings.";
      setSaveStatus({ message: `Error fetching settings: ${errorMessage}`, type: 'error' });
    } finally {
      setIsFetching(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings();
    }
  }, [isAuthenticated]);

  const handleLogin = (event) => {
    event.preventDefault();
    setLoginError('');
    if (password === ADMIN_PASSWORD) {
      console.log("Admin authentication successful.");
      setIsAuthenticated(true);
    } else {
      console.log("Admin authentication failed.");
      setLoginError('Incorrect password.');
      setIsAuthenticated(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setIsLoading(true);
    setSaveStatus({ message: '', type: '' });
    console.log("Attempting to save settings...");

    const factorIdArray = featuredFactorIds.split(',')
      .map(id => id.trim())
      .filter(id => id !== '');

    const newSettings = {
      featuredStoryId: featuredStoryId || null,
      featuredBookId: featuredBookId || null,
      featuredPodcastId: featuredPodcastId || null,
      featuredFilmId: featuredFilmId || null,
      featuredOrgId: featuredOrgId || null,
      featuredFactorIds: factorIdArray,
    };

    console.log("Saving settings payload:", newSettings);

    try {
      const response = await apiClient.put('/api/settings/featured', newSettings);
      const responseData = response.data;
      console.log("Settings saved successfully:", responseData);
      setSaveStatus({ message: responseData.message || 'Settings saved successfully!', type: 'success' });
      // Optionally re-fetch settings to confirm they are updated
      // fetchSettings(); 
    } catch (error) {
      console.error("Error saving settings:", error);
      const errorMessage = error.response?.data?.message || error.message || "An unknown error occurred while saving settings.";
      setSaveStatus({ message: `Error saving settings: ${errorMessage}`, type: 'error' });
    } finally {
      setIsSaving(false);
      setIsLoading(false);
    }
  }; // This is the correct end of the handleSave function

  // --- Render Logic ---

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
        <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-sm">
          <h1 className={`text-2xl font-semibold mb-6 text-center ${BRONZE_COLOR}`}>Admin Access</h1>
          <div className="mb-4 relative">
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <div className="relative">
               <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <Lock size={18} />
               </span>
               <input
                 type={showPassword ? 'text' : 'password'}
                 id="password"
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 required
                 className="w-full pl-10 pr-10 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
               />
               <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
               >
                 {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
               </button>
            </div>
          </div>
          {loginError && (
            <p className="text-red-500 text-sm mb-4 text-center">{loginError}</p>
          )}
          <button
            type="submit"
            className={`w-full py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-md transition duration-150 ease-in-out flex items-center justify-center ${BRONZE_BORDER} border-2`}
          >
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8 text-gray-200">
      <div className="max-w-3xl mx-auto bg-gray-800 p-6 md:p-8 rounded-lg shadow-xl">
        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-3">
            <h1 className={`text-3xl font-semibold ${BRONZE_COLOR}`}>
              Homepage Featured Content IDs
            </h1>
            <button
                onClick={fetchSettings}
                disabled={isFetching || isSaving}
                className={`p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                aria-label="Refresh settings"
            >
                <RefreshCw size={20} className={isFetching ? 'animate-spin' : ''}/>
            </button>
        </div>

        {isFetching && (
          <div className="text-center py-4 text-gray-400">Loading current settings...</div>
        )}

        {saveStatus.message && !isFetching && (
          <div className={`flex items-center p-3 rounded-md mb-4 ${saveStatus.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
            {saveStatus.type === 'success' ? <CheckCircle className="mr-2 h-5 w-5" /> : <AlertCircle className="mr-2 h-5 w-5" />}
            {saveStatus.message}
          </div>
        )}

        {!isFetching && (
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label htmlFor="featuredStoryId" className="block text-sm font-medium text-gray-300 mb-1">
                  Featured Story (Individual ID)
                </label>
                <input
                  type="text"
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
                    <input type="text" id="featuredBookId" value={featuredBookId} onChange={(e) => setFeaturedBookId(e.target.value)} placeholder="Enter MediaWork ID" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-amber-500"/>
                  </div>
                  <div>
                    <label htmlFor="featuredPodcastId" className="block text-sm font-medium text-gray-300 mb-1">Podcast (MediaWork ID)</label>
                    <input type="text" id="featuredPodcastId" value={featuredPodcastId} onChange={(e) => setFeaturedPodcastId(e.target.value)} placeholder="Enter MediaWork ID" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-amber-500"/>
                  </div>
                  <div>
                    <label htmlFor="featuredFilmId" className="block text-sm font-medium text-gray-300 mb-1">Film/Doc (MediaWork ID)</label>
                    <input type="text" id="featuredFilmId" value={featuredFilmId} onChange={(e) => setFeaturedFilmId(e.target.value)} placeholder="Enter MediaWork ID" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-amber-500"/>
                  </div>
                </div>
              </fieldset>

              <div>
                <label htmlFor="featuredOrgId" className="block text-sm font-medium text-gray-300 mb-1">
                  Explore Grid: Featured Organization (Org ID)
                </label>
                <input
                  type="text"
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
                  type="text"
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
                  disabled={isSaving || isFetching}
                  className={`w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-md transition duration-150 ease-in-out flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${BRONZE_BORDER} border-2`}
                >
                  <Save className="mr-2 h-5 w-5" />
                  {isSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
        )}
      </div>
    </div>
  );
}

export default AdminSettingsPage;
