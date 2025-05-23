// src/pages/AdminFilmPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate }
from 'react-router-dom';
import { Search, Film, Save, XCircle, AlertTriangle, Loader2, Edit3, PlusSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../apiClient';
import { BRONZE_COLOR, BRONZE_BORDER } from '../components/themeconstants';

function AdminFilmPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();

  const [mode, setMode] = useState('search_tmdb');
  const [filmId, setFilmId] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [tmdbResults, setTmdbResults] = useState([]);
  const [selectedTmdbFilm, setSelectedTmdbFilm] = useState(null);

  const [filmData, setFilmData] = useState({
    title: '',
    workType: 'FILM',
    creatorName: '',
    publicationOrReleaseYear: '',
    publisherOrNetwork: '',
    focusOrTheme: '',
    summaryNotes: '',
    imagePath: '',
    externalId: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (location.pathname.includes('/edit/') && params.id) {
      setMode('show_existing_film');
      setFilmId(params.id);
      console.log(`Editing film with internal ID: ${params.id}`);
      // TODO: Fetch existing film data from your DB
      // Example: fetchFilmFromDb(params.id);
    } else if (location.pathname.includes('/add')) {
      setMode('search_tmdb');
      console.log('Adding new film mode.');
    }
  }, [location.pathname, params.id]);

  const handleTmdbSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      setError('Please enter a film title or TMDB ID to search.');
      setTmdbResults([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    setTmdbResults([]);
    setSuccessMessage(null);
    setSelectedTmdbFilm(null); // Clear previous selection

    try {
      console.log(`Searching TMDB via backend for: ${searchTerm}`);
      // Actual API call to your backend
      // apiClient baseURL already includes /api, so path is relative to that
      const response = await apiClient.post('/admin/external-search/film', { query: searchTerm.trim() });
      
      console.log('Backend TMDB search response:', response.data);
      setTmdbResults(response.data || []); // Expecting an array from the backend

      if (response.data && response.data.length === 0) {
        setSuccessMessage('No results found on TMDB for your query.');
      } else if (response.data && response.data.length > 0) {
        setSuccessMessage(`${response.data.length} result(s) found.`);
      }
    } catch (err) {
      console.error('Error searching TMDB via backend:', err);
      setError(err.response?.data?.message || 'Failed to search TMDB. Check server logs.');
      setTmdbResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTmdbFilm = async (tmdbFilmFromResult) => {
    console.log('Selected TMDB Film from search results:', tmdbFilmFromResult);
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setSelectedTmdbFilm(tmdbFilmFromResult); // Store the selected film (which has id, title, overview, poster_path, release_date)

    // TODO: Next step is to implement a backend endpoint to fetch FULL details from TMDB
    // and streaming info from WatchMode using tmdbFilmFromResult.id (which is the TMDB ID).
    // For now, we'll use the basic info we got from the search.
    // Example: const detailedFilm = await apiClient.get(`/admin/fetch-film-details/${tmdbFilmFromResult.id}`);
    // Then populate filmData with detailedFilm.data

    // Using basic data from search result for now to pre-fill form:
    setFilmData({
      title: tmdbFilmFromResult.title || '',
      workType: 'FILM',
      creatorName: '', // TMDB search doesn't usually give director directly, detail call needed
      publicationOrReleaseYear: tmdbFilmFromResult.release_date ? tmdbFilmFromResult.release_date.substring(0, 4) : '',
      publisherOrNetwork: '', // Detail call needed
      summaryNotes: tmdbFilmFromResult.overview || '',
      imagePath: tmdbFilmFromResult.poster_path ? tmdbFilmFromResult.poster_path.replace('https://image.tmdb.org/t/p/w92', '') : '', // Store relative path
      externalId: tmdbFilmFromResult.id.toString(), // TMDB ID
    });
    setMode('review_new_film');
    setTmdbResults([]); // Clear search results from display
    setIsLoading(false);
    setSuccessMessage(`Selected "${tmdbFilmFromResult.title}". Please review details.`);
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
      let response;
      const payload = {
        ...filmData,
        workType: 'FILM', // Ensure workType is set
        // Convert year to int if it's a string and not empty
        publicationOrReleaseYear: filmData.publicationOrReleaseYear ? parseInt(filmData.publicationOrReleaseYear, 10) : null,
      };

      if (mode === 'review_new_film') {
        console.log('Calling backend to create new film with payload:', payload);
        // TODO: Replace with actual API call:
        // response = await apiClient.post('/admin/media', payload);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate
        response = { data: { message: 'Film created successfully (simulated)!', mediaWork: {...payload, id: 'db789'} } };
        setSuccessMessage(response.data.message);
        if (response.data.mediaWork) {
          setFilmId(response.data.mediaWork.id);
          setFilmData(response.data.mediaWork);
          setMode('show_existing_film');
        }

      } else if (mode === 'edit_existing_film' && filmId) {
        console.log(`Calling backend to update film ID ${filmId} with payload:`, payload);
        // TODO: Replace with actual API call:
        // response = await apiClient.put(`/admin/media/${filmId}`, payload);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate
        response = { data: { message: 'Film updated successfully (simulated)!', mediaWork: payload } };
        setSuccessMessage(response.data.message);
        if (response.data.mediaWork) {
          setFilmData(response.data.mediaWork);
          setMode('show_existing_film');
        }
      } else {
        throw new Error("Invalid mode for saving.");
      }
    } catch (err) {
      console.error('Error saving film:', err);
      setError(err.response?.data?.message || 'Failed to save film.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setSearchTerm('');
    setTmdbResults([]);
    setSelectedTmdbFilm(null);
    setFilmData({ title: '', workType: 'FILM', creatorName: '', publicationOrReleaseYear: '', publisherOrNetwork: '', focusOrTheme: '', summaryNotes: '', imagePath: '', externalId: '' });
    setError(null);
    setSuccessMessage(null);
    if (mode === 'review_new_film' || mode === 'edit_existing_film' || mode === 'show_existing_film') {
        if (filmId && (mode === 'edit_existing_film' || mode === 'show_existing_film')) {
             // If was editing/showing an existing film, go back to TMDB search for now,
             // or ideally fetch and show the film again.
             // For simplicity, back to search.
            setMode('search_tmdb');
            setFilmId(null); // Clear filmId if going back to search mode
        } else {
            setMode('search_tmdb');
        }
    } else {
        navigate('/admin');
    }
  };

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
          <span className="ml-2 hidden sm:inline">Search TMDB</span>
        </button>
      </div>
    </form>
  );

  const renderTmdbResults = () => (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-gray-300 mb-2">TMDB Search Results:</h3>
      {tmdbResults.length === 0 && !isLoading && !error && <p className="text-gray-400">No results found for "{searchTerm}", or waiting for search.</p>}
      <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {tmdbResults.map(film => (
          <li key={film.id} className="p-3 bg-gray-700 rounded-md hover:bg-gray-600/70 transition-colors">
            <div className="flex items-start space-x-3">
              {film.poster_path && (
                <img src={film.poster_path} alt="" className="w-12 h-auto rounded flex-shrink-0 bg-gray-600" />
              )}
              {!film.poster_path && (
                <div className="w-12 h-[72px] rounded flex-shrink-0 bg-gray-600 flex items-center justify-center text-gray-400 text-xs"><Film size={24}/></div>
              )}
              <div className="flex-grow">
                <p className="font-semibold text-amber-400">{film.title} {film.release_date ? `(${film.release_date.substring(0,4)})` : ''}</p>
                <p className="text-xs text-gray-400 line-clamp-2">{film.overview}</p>
              </div>
              <button
                onClick={() => handleSelectTmdbFilm(film)}
                className="py-1.5 px-3 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-md self-center flex-shrink-0"
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

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-300">Title</label>
        <input type="text" name="title" id="title" value={filmData.title} onChange={handleInputChange} required className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
      </div>
      <div>
        <label htmlFor="creatorName" className="block text-sm font-medium text-gray-300">Director(s)</label>
        <input type="text" name="creatorName" id="creatorName" value={filmData.creatorName} onChange={handleInputChange} placeholder="e.g., Frank Darabont" className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
      </div>
      <div>
        <label htmlFor="publicationOrReleaseYear" className="block text-sm font-medium text-gray-300">Release Year</label>
        <input type="number" name="publicationOrReleaseYear" id="publicationOrReleaseYear" value={filmData.publicationOrReleaseYear} onChange={handleInputChange} placeholder="e.g., 1994" className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
      </div>
       <div>
        <label htmlFor="publisherOrNetwork" className="block text-sm font-medium text-gray-300">Production Companies (comma-separated)</label>
        <input type="text" name="publisherOrNetwork" id="publisherOrNetwork" value={filmData.publisherOrNetwork} onChange={handleInputChange} placeholder="e.g., Castle Rock Entertainment, Columbia Pictures" className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
      </div>
      <div>
        <label htmlFor="summaryNotes" className="block text-sm font-medium text-gray-300">Overview/Plot</label>
        <textarea name="summaryNotes" id="summaryNotes" rows="4" value={filmData.summaryNotes} onChange={handleInputChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"></textarea>
      </div>
      <div>
        <label htmlFor="imagePath" className="block text-sm font-medium text-gray-300">Poster Path (relative, e.g., /q6y0Go1tsGEsmgIo6kdfV63nMui.jpg)</label>
        <input type="text" name="imagePath" id="imagePath" value={filmData.imagePath} onChange={handleInputChange} placeholder="From TMDB, relative path like /q6y0Go1tsGEsmgIo6kdfV63nMui.jpg" className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
      </div>
       <div>
        <label htmlFor="externalId" className="block text-sm font-medium text-gray-300">TMDB ID</label>
        <input type="text" name="externalId" id="externalId" value={filmData.externalId} readOnly className="mt-1 block w-full p-2 bg-gray-600 border border-gray-500 rounded-md text-gray-400 cursor-not-allowed" />
      </div>

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
          {isSaving ? 'Saving...' : (mode === 'review_new_film' ? 'Add Film to DB' : 'Save Changes')}
        </button>
      </div>
    </form>
  );
  
  const renderShowExistingFilm = () => (
    // For now, directly show editable form. Could be a read-only view later.
    renderFilmForm()
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
            {!isLoading && tmdbResults.length === 0 && searchTerm && !error && successMessage && /* Show "No results" only if a search was made */ (
              <p className="text-gray-400 mt-4 text-center">{successMessage}</p>
            )}
          </>
        )}

        {(mode === 'review_new_film' || mode === 'edit_existing_film') && (
            <>
            {isLoading && <div className="text-center py-4"><Loader2 className="animate-spin h-8 w-8 text-amber-500 mx-auto" /></div>}
            {!isLoading && renderFilmForm()}
            </>
        )}
        
        {mode === 'show_existing_film' && !isLoading && (
            renderShowExistingFilm()
        )}

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
