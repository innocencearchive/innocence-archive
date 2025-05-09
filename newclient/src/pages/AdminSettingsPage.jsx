// src/pages/AdminSettingsPage.jsx
import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Save, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'; // Added RefreshCw
// Assuming theme constants are available
import { BRONZE_COLOR, BRONZE_BORDER } from '../components/themeconstants';

// --- !!! IMPORTANT SECURITY NOTE !!! ---
// Storing passwords directly in frontend code is INSECURE.
// This is a basic implementation for demonstration only.
// For a real application, use proper authentication and secure backend validation.
const ADMIN_PASSWORD = 'danish123'; // CHANGE THIS!

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
  const [isLoading, setIsLoading] = useState(false); // Combined loading state
  const [isFetching, setIsFetching] = useState(false); // Specific state for fetching
  const [isSaving, setIsSaving] = useState(false);   // Specific state for saving
  const [saveStatus, setSaveStatus] = useState({ message: '', type: '' }); // type: 'success' or 'error'

  // --- Fetch Current Settings ---
  const fetchSettings = async () => {
    setIsFetching(true); // Indicate fetching started
    setIsLoading(true); // Use general loading state as well
    setSaveStatus({ message: '', type: '' }); // Clear previous status
    console.log("Fetching current featured settings...");
    try {
      // --- Actual API call ---
      const response = await fetch('/api/settings/featured'); // GET request by default
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to fetch settings: ${errorData.message || response.statusText}`);
      }
      const currentSettings = await response.json();
      // --- End API call ---

      console.log("Current settings fetched:", currentSettings);
      setFeaturedStoryId(currentSettings.featuredStoryId || '');
      setFeaturedBookId(currentSettings.featuredBookId || '');
      setFeaturedPodcastId(currentSettings.featuredPodcastId || '');
      setFeaturedFilmId(currentSettings.featuredFilmId || '');
      setFeaturedOrgId(currentSettings.featuredOrgId || '');
      // Join factor IDs array (which should come from backend) into a comma-separated string
      setFeaturedFactorIds(Array.isArray(currentSettings.featuredFactorIds) ? currentSettings.featuredFactorIds.join(', ') : '');

    } catch (error) {
      console.error("Error fetching settings:", error);
      // Display fetch error using the saveStatus state for simplicity
      setSaveStatus({ message: `Error fetching settings: ${error.message}`, type: 'error' });
    } finally {
      setIsFetching(false);
      setIsLoading(false);
    }
  };

  // --- Fetch settings on initial authentication ---
  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings();
    }
  }, [isAuthenticated]); // Re-fetch if authentication status changes

  // --- Handlers ---
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
    setIsSaving(true); // Indicate saving started
    setIsLoading(true); // Use general loading state
    setSaveStatus({ message: '', type: '' });
    console.log("Attempting to save settings...");

    // Prepare data payload
    const factorIdArray = featuredFactorIds.split(',')
                                         .map(id => id.trim())
                                         .filter(id => id !== ''); // Keep as array of strings for now, backend validates

    const newSettings = {
      featuredStoryId: featuredStoryId || null,
      featuredBookId: featuredBookId || null,
      featuredPodcastId: featuredPodcastId || null,
      featuredFilmId: featuredFilmId || null,
      featuredOrgId: featuredOrgId || null,
      featuredFactorIds: factorIdArray, // Send array of strings
    };

    console.log("Saving settings payload:", newSettings);

    try {
      // --- Actual API call ---
      const response = await fetch('/api/settings/featured', {
        method: 'PUT', // Use PUT to update/replace the settings
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });

      const responseData = await response.json(); // Always try to parse JSON response

      if (!response.ok) {
         // Use message from backend response if available
         throw new Error(responseData.message || `Failed to save settings (${response.status})`);
      }
      // --- End API call ---

      console.log("Settings saved successfully:", responseData);
      setSaveStatus({ message: responseData.message || 'Settings saved successfully!', type: 'success' });

      // Optionally re-fetch settings after save to confirm, or trust the response
      // fetchSettings();

    } catch (error) {
      console.error("Error saving settings:", error);
      setSaveStatus({ message: `Error saving settings: ${error.message}`, type: 'error' });
    } finally {
      setIsSaving(false);
      setIsLoading(false);
    }
  };

  // --- Render Logic ---

  // Login Form (remains the same)
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

  // Settings Form (after authentication)
  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8 text-gray-200">
      <div className="max-w-3xl mx-auto bg-gray-800 p-6 md:p-8 rounded-lg shadow-xl">
        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-3">
            <h1 className={`text-3xl font-semibold ${BRONZE_COLOR}`}>
              Homepage Featured Content IDs
            </h1>
            {/* Refresh Button */}
            <button
                onClick={fetchSettings}
                disabled={isFetching || isSaving}
                className={`p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                aria-label="Refresh settings"
            >
                <RefreshCw size={20} className={isFetching ? 'animate-spin' : ''}/>
            </button>
        </div>


        {/* Loading Indicator for fetching */}
        {isFetching && ( // Use specific fetching state
          <div className="text-center py-4 text-gray-400">Loading current settings...</div>
        )}

        {/* Save Status Message */}
        {saveStatus.message && !isFetching && ( // Don't show save status while fetching
          <div className={`flex items-center p-3 rounded-md mb-4 ${saveStatus.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
            {saveStatus.type === 'success' ? <CheckCircle className="mr-2 h-5 w-5" /> : <AlertCircle className="mr-2 h-5 w-5" />}
            {saveStatus.message}
          </div>
        )}

        {/* Settings Form - Only show form when not initially fetching */}
        {!isFetching && (
            <form onSubmit={handleSave} className="space-y-5">
              {/* Featured Story */}
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

              {/* Explore Grid - Media */}
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

              {/* Explore Grid - Organization */}
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

              {/* Explore Grid - Factors */}
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

              {/* Save Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSaving || isFetching} // Disable if saving OR fetching
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
