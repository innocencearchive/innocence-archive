// src/pages/AdminFilmPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate }
from 'react-router-dom'; // To determine mode (add/edit) and ID
import { Search, Film, Save, XCircle, AlertTriangle, Loader2, Edit3, PlusSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../apiClient';
import { BRONZE_COLOR, BRONZE_BORDER } from '../components/themeconstants';

function AdminFilmPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = useParams(); // To get :id if we are editing
  const location = useLocation(); // To get query params or state to determine mode

  // Modes: 'search_tmdb', 'review_new_film', 'edit_existing_film', 'show_existing_film'
  const [mode, setMode] = useState('search_tmdb'); // Default to search for adding a new film
  const [filmId, setFilmId] = useState(null); // For editing an existing film by internal ID

  const [searchTerm, setSearchTerm] = useState(''); // For TMDB search
  const [tmdbResults, setTmdbResults] = useState([]); // Results from TMDB search
  const [selectedTmdbFilm, setSelectedTmdbFilm] = useState(null); // Film selected from TMDB results

  const [filmData, setFilmData] = useState({ // Form data for the film
    title: '',
    workType: 'FILM', // Default for this page
    creatorName: '', // Director
    publicationOrReleaseYear: '',
    publisherOrNetwork: '', // Production Companies
    focusOrTheme: '',
    summaryNotes: '', // Overview/Plot
    imagePath: '', // Poster path
    externalId: '', // TMDB ID
    // Streaming info will be handled separately or as part of a more complex object
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Determine initial mode based on URL or state (simplified for now)
  useEffect(() => {
    // Example: if location.pathname includes '/edit/' or if params.id exists
    if (location.pathname.includes('/edit/') && params.id) {
      setMode('show_existing_film'); // Or 'edit_existing_film' directly
      setFilmId(params.id);
      // TODO: Fetch existing film data from your DB
      console.log(`Editing film with internal ID: ${params.id}`);
    } else if (location.pathname.includes('/add')) {
      setMode('search_tmdb');
      console.log('Adding new film mode.');
    }
    // More sophisticated mode detection can be added
  }, [location.pathname, params.id]);


  const handleTmdbSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      setError('Please enter a film title or TMDB ID to search.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setTmdbResults([]);
    setSuccessMessage(null);

    try {
      // This is where you'll call your backend endpoint that then calls TMDB
      // For now, we'll simulate it.
      // The backend endpoint would be something like: apiClient.post('/admin/search-external/film', { query: searchTerm })
      console.log(`Searching TMDB for: ${searchTerm}`);
      // SIMULATED API CALL
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
      const mockResults = [
        { id: 'tmdb123', title: `${searchTerm} - Mock Result 1 (2023)`, overview: 'Overview for mock result 1...' },
        { id: 'tmdb456', title: `${searchTerm} - Mock Result 2 (2022)`, overview: 'Overview for mock result 2...' },
      ];
      setTmdbResults(mockResults);
      if (mockResults.length === 0) {
        setSuccessMessage('No results found on TMDB for your query.');
      }
    } catch (err) {
      console.error('Error searching TMDB:', err);
      setError(err.response?.data?.message || 'Failed to search TMDB.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTmdbFilm = async (tmdbFilm) => {
    // This function would be called when a user selects a film from tmdbResults
    // It would then fetch more detailed data for that film (including Watchmode if integrated)
    // and populate filmData, then switch mode to 'review_new_film'.
    console.log('Selected TMDB Film:', tmdbFilm);
    setIsLoading(true);
    setError(null);
    setSelectedTmdbFilm(tmdbFilm); // Store the selected film for now

    // SIMULATE fetching detailed data & pre-filling form
    // In reality, another backend call: apiClient.get(`/admin/fetch-film-details/${tmdbFilm.id}`)
    await new Promise(resolve => setTimeout(resolve, 1000));
    setFilmData({
      title: tmdbFilm.title.split(' (')[0], // Basic parsing
      workType: 'FILM',
      creatorName: 'Mock Director',
      publicationOrReleaseYear: tmdbFilm.title.match(/\((\d{4})\)/)?.[1] || '',
      publisherOrNetwork: 'Mock Production Co.',
      summaryNotes: tmdbFilm.overview,
      imagePath: '/mock-poster.jpg', // Placeholder
      externalId: tmdbFilm.id,
    });
    setMode('review_new_film'); // Switch to review/edit mode for the new film
    setTmdbResults([]); // Clear search results
    setIsLoading(false);
  };


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFilmData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveFilm = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    console.log('Saving film data:', filmData);

    try {
      // Determine if it's a new film (mode === 'review_new_film') or an existing one (mode === 'edit_existing_film')
      let response;
      if (mode === 'review_new_film') {
        // Call backend to create new film: apiClient.post('/admin/media', { ...filmData, type: 'FILM' })
        response = { data: { message: 'Film created successfully (simulated)!', film: {...filmData, id: 'db789'} } }; // Mock
      } else if (mode === 'edit_existing_film' && filmId) {
        // Call backend to update existing film: apiClient.put(`/admin/media/${filmId}`, { ...filmData, type: 'FILM' })
        response = { data: { message: 'Film updated successfully (simulated)!', film: filmData } }; // Mock
      } else {
        throw new Error("Invalid mode for saving.");
      }

      // SIMULATED API CALL
      await new Promise(resolve => setTimeout(resolve, 1500));

      setSuccessMessage(response.data.message);
      // Potentially navigate away or reset form
      // navigate('/admin'); // Example: navigate back to dashboard
      if (response.data.film && mode === 'review_new_film') {
        // If creating, maybe switch to viewing/editing the newly created film
        setFilmId(response.data.film.id); // Assuming backend returns the new DB ID
        setFilmData(response.data.film);
        setMode('show_existing_film'); // Or 'edit_existing_film'
      } else if (response.data.film && mode === 'edit_existing_film') {
        setFilmData(response.data.film);
        setMode('show_existing_film');
      }

    } catch (err) {
      console.error('Error saving film:', err);
      setError(err.response?.data?.message || 'Failed to save film.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset state and navigate or change mode
    setSearchTerm('');
    setTmdbResults([]);
    setSelectedTmdbFilm(null);
    setFilmData({ title: '', workType: 'FILM', creatorName: '', publicationOrReleaseYear: '', publisherOrNetwork: '', focusOrTheme: '', summaryNotes: '', imagePath: '', externalId: '' });
    setError(null);
    setSuccessMessage(null);
    if (mode === 'review_new_film' || mode === 'edit_existing_film') {
        if (filmId && mode === 'edit_existing_film') { // If was editing an existing film, go back to showing it
            setMode('show_existing_film');
        } else { // Otherwise, go back to TMDB search for adding
            setMode('search_tmdb');
        }
    } else {
        navigate('/admin'); // Default cancel action
    }
  };


  // --- Render different UI based on mode ---

  const renderTmdbSearch = () => (
    <form onSubmit={handleTmdbSearch} className="mb-6">
      <label htmlFor="tmdbSearch" className="block text-sm font-medium text-gray-300 mb-1">
        Search Film Title or TMDB ID
      </label>
      <div className="flex space-x-2">
        <input
          type="text"
          id="tmdbSearch"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="e.g., The Shawshank Redemption or 278"
          className="flex-grow p-2.5 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          type="submit"
          disabled={isLoading}
          className={`py-2.5 px-5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-md flex items-center justify-center disabled:opacity-50 ${BRONZE_BORDER} border-2`}
        >
          {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <Search size={20} />}
          <span className="ml-2">Search TMDB</span>
        </button>
      </div>
    </form>
  );

  const renderTmdbResults = () => (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-gray-300 mb-2">TMDB Search Results:</h3>
      {tmdbResults.length === 0 && !isLoading && <p className="text-gray-400">No results found, or waiting for search.</p>}
      <ul className="space-y-3">
        {tmdbResults.map(film => (
          <li key={film.id} className="p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-amber-400">{film.title}</p>
                <p className="text-xs text-gray-400 truncate max-w-md">{film.overview}</p>
              </div>
              <button
                onClick={() => handleSelectTmdbFilm(film)}
                className="py-1.5 px-3 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-md"
              >
                Select
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );

  const renderFilmForm = () => (
    <form onSubmit={handleSaveFilm} className="space-y-4">
      <h3 className={`text-xl font-semibold mb-4 ${BRONZE_COLOR}`}>
        {mode === 'review_new_film' ? 'Review & Add New Film' : 'Edit Film Details'}
      </h3>
      {selectedTmdbFilm && mode === 'review_new_film' && (
        <p className="text-sm text-gray-400 mb-3">Reviewing details for: <strong className="text-amber-400">{selectedTmdbFilm.title}</strong> (TMDB ID: {selectedTmdbFilm.id})</p>
      )}
      {filmId && (mode === 'edit_existing_film' || mode === 'show_existing_film') && (
         <p className="text-sm text-gray-400 mb-3">Database ID: <strong className="text-amber-400">{filmId}</strong></p>
      )}

      {/* Add form fields for filmData here, e.g.: */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-300">Title</label>
        <input type="text" name="title" id="title" value={filmData.title} onChange={handleInputChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
      </div>
      <div>
        <label htmlFor="creatorName" className="block text-sm font-medium text-gray-300">Director(s)</label>
        <input type="text" name="creatorName" id="creatorName" value={filmData.creatorName} onChange={handleInputChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
      </div>
      <div>
        <label htmlFor="publicationOrReleaseYear" className="block text-sm font-medium text-gray-300">Release Year</label>
        <input type="number" name="publicationOrReleaseYear" id="publicationOrReleaseYear" value={filmData.publicationOrReleaseYear} onChange={handleInputChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
      </div>
       <div>
        <label htmlFor="publisherOrNetwork" className="block text-sm font-medium text-gray-300">Production Companies</label>
        <input type="text" name="publisherOrNetwork" id="publisherOrNetwork" value={filmData.publisherOrNetwork} onChange={handleInputChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
      </div>
      <div>
        <label htmlFor="summaryNotes" className="block text-sm font-medium text-gray-300">Overview/Plot</label>
        <textarea name="summaryNotes" id="summaryNotes" rows="4" value={filmData.summaryNotes} onChange={handleInputChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"></textarea>
      </div>
      <div>
        <label htmlFor="imagePath" className="block text-sm font-medium text-gray-300">Poster Path (e.g., /abc.jpg)</label>
        <input type="text" name="imagePath" id="imagePath" value={filmData.imagePath} onChange={handleInputChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
      </div>
       <div>
        <label htmlFor="externalId" className="block text-sm font-medium text-gray-300">TMDB ID</label>
        <input type="text" name="externalId" id="externalId" value={filmData.externalId} onChange={handleInputChange} readOnly={mode === 'review_new_film'} className="mt-1 block w-full p-2 bg-gray-600 border border-gray-500 rounded-md text-gray-300" />
      </div>
      {/* TODO: Add fields for streaming providers if fetched */}

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSaving}
          className="py-2 px-4 border border-gray-600 hover:bg-gray-600 text-gray-300 font-medium rounded-md flex items-center"
        >
          <XCircle size={18} className="mr-2" /> Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving || isLoading}
          className={`py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md flex items-center justify-center disabled:opacity-50 ${BRONZE_BORDER} border-2`}
        >
          {isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Save size={18} className="mr-2" />}
          {isSaving ? 'Saving...' : 'Save Film'}
        </button>
      </div>
    </form>
  );
  
  const renderShowExistingFilm = () => (
    // Similar to renderFilmForm but fields might be read-only initially, with an "Edit" button
    // For now, let's just reuse the form and make it editable directly
    // Or switch to 'edit_existing_film' mode if we want a distinct view vs edit state
    renderFilmForm() // Simplified: directly show editable form
  );


  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8 text-gray-200">
      <div className="max-w-3xl mx-auto bg-gray-800 p-6 md:p-8 rounded-lg shadow-xl">
        <div className="flex items-center mb-6 border-b border-gray-700 pb-3">
          <Film size={32} className={`mr-3 ${BRONZE_COLOR}`} />
          <h1 className={`text-2xl md:text-3xl font-semibold ${BRONZE_COLOR}`}>
            Manage Film Data
          </h1>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700 text-red-300 rounded-md flex items-center">
            <AlertTriangle size={20} className="mr-2" /> {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-900/50 border border-green-700 text-green-300 rounded-md flex items-center">
            {successMessage}
          </div>
        )}

        {mode === 'search_tmdb' && (
          <>
            {renderTmdbSearch()}
            {isLoading && <div className="text-center py-4"><Loader2 className="animate-spin h-8 w-8 text-amber-500 mx-auto" /></div>}
            {!isLoading && tmdbResults.length > 0 && renderTmdbResults()}
          </>
        )}

        {(mode === 'review_new_film' || mode === 'edit_existing_film') && (
            <>
            {isLoading && <div className="text-center py-4"><Loader2 className="animate-spin h-8 w-8 text-amber-500 mx-auto" /></div>}
            {!isLoading && renderFilmForm()}
            </>
        )}
        
        {mode === 'show_existing_film' && !isLoading && (
            // This mode would typically show read-only data with an edit button
            // For now, it directly calls renderFilmForm which is editable.
            // You could add a button here to switch to 'edit_existing_film' explicitly if needed.
            renderShowExistingFilm()
        )}


        {/* Navigation back to dashboard */}
        <div className="mt-8 text-center">
            <button
                onClick={() => navigate('/admin')}
                className="text-sm text-amber-500 hover:text-amber-400 hover:underline"
            >
                &larr; Back to Admin Dashboard
            </button>
        </div>

      </div>
    </div>
  );
}

export default AdminFilmPage;
