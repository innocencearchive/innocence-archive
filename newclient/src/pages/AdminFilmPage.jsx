// src/pages/AdminFilmPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate }
from 'react-router-dom';
import { Search, Film, Save, XCircle, AlertTriangle, Loader2, Edit3, PlusSquare, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../apiClient';
import { BRONZE_COLOR, BRONZE_BORDER } from '../components/themeconstants';

// TMDB Image Base URL (for constructing full image paths)
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';

function AdminFilmPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();

  const [mode, setMode] = useState('search_tmdb');
  const [filmId, setFilmId] = useState(null); // Internal DB ID when editing

  const [searchTerm, setSearchTerm] = useState('');
  const [tmdbResults, setTmdbResults] = useState([]);
  // No longer need selectedTmdbFilm state, as we'll fetch full details immediately

  const [filmData, setFilmData] = useState({
    title: '',
    workType: 'FILM',
    creatorName: '', // Director
    publicationOrReleaseYear: '',
    publisherOrNetwork: '', // Production Companies (comma-separated)
    focusOrTheme: '', // Could store Genres (comma-separated) or Keywords here
    summaryNotes: '', // Overview/Plot
    imagePath: '', // Relative poster path from TMDB
    externalId: '', // TMDB ID
    imdb_id: '',     // IMDb ID (from TMDB)
    tagline: '',
    runtime: '',     // in minutes
    // For streaming_providers, we'll display them but saving them is a more complex step for handleSaveFilm
    streaming_providers: [],
  });
  const [fullPosterUrl, setFullPosterUrl] = useState(''); // For displaying the poster

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false); // Specific loading for details
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (location.pathname.includes('/edit/') && params.id) {
      setFilmId(params.id);
      setIsFetchingDetails(true);
      setError(null);
      apiClient
        .get(`/admin/mediaworks/${params.id}`)
        .then((res) => {
          const w = res.data;
          setFilmData({
            title: w.title || '',
            workType: w.workType || 'FILM',
            creatorName: w.creatorName || '',
            publicationOrReleaseYear: w.publicationOrReleaseYear?.toString() || '',
            publisherOrNetwork: w.publisherOrNetwork || '',
            focusOrTheme: w.focusOrTheme || '',
            summaryNotes: w.summaryNotes || '',
            imagePath: w.imagePath || '',
            externalId: w.externalId || '',
            imdb_id: '',
            tagline: '',
            runtime: '',
            streaming_providers: w.streamingProviders || [],
          });
          if (w.imagePath) {
            setFullPosterUrl(
              w.imagePath.startsWith('http') ? w.imagePath : `${TMDB_IMAGE_BASE_URL}w342${w.imagePath}`
            );
          } else {
            setFullPosterUrl('');
          }
          setMode('show_existing_film');
        })
        .catch((err) => {
          console.error('AdminFilmPage: Failed to load existing film:', err);
          setError(err.response?.data?.message || 'Failed to load existing film from database.');
        })
        .finally(() => setIsFetchingDetails(false));
    } else if (location.pathname.includes('/add')) {
      setMode('search_tmdb');
    }
  }, [location.pathname, params.id]);

  const handleTmdbSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      setError('Please enter a film title or TMDB ID to search.');
      setTmdbResults([]);
      return;
    }
    setIsLoading(true); // General loading for search action
    setError(null);
    setTmdbResults([]);
    setSuccessMessage(null);

    try {
      console.log(`AdminFilmPage: Searching TMDB via backend for: ${searchTerm}`);
      const response = await apiClient.post('/admin/external-search/film', { query: searchTerm.trim() });
      console.log('AdminFilmPage: Backend TMDB search response:', response.data);
      setTmdbResults(response.data || []);

      if (response.data && response.data.length === 0) {
        setSuccessMessage('No results found on TMDB for your query.');
      } else if (response.data && response.data.length > 0) {
        setSuccessMessage(`${response.data.length} result(s) found. Select one to fetch full details.`);
      }
    } catch (err) {
      console.error('AdminFilmPage: Error searching TMDB via backend:', err);
      setError(err.response?.data?.message || 'Failed to search TMDB. Check server logs.');
      setTmdbResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTmdbFilmAndFetchDetails = async (tmdbSearchResult) => {
    console.log('AdminFilmPage: Selected TMDB Film from search:', tmdbSearchResult);
    setIsFetchingDetails(true); // Specific loading for fetching details
    setError(null);
    setSuccessMessage(null);
    setFilmData({ // Reset film data before populating
        title: '', workType: 'FILM', creatorName: '', publicationOrReleaseYear: '',
        publisherOrNetwork: '', focusOrTheme: '', summaryNotes: '', imagePath: '',
        externalId: '', imdb_id: '', tagline: '', runtime: '', streaming_providers: []
    });
    setFullPosterUrl('');

    try {
      const tmdbIdToFetch = tmdbSearchResult.id;
      console.log(`AdminFilmPage: Fetching full details for TMDB ID: ${tmdbIdToFetch}`);
      // Call the new backend endpoint
      const response = await apiClient.get(`/admin/external-search/film-details/${tmdbIdToFetch}`);
      const detailedData = response.data;
      console.log('AdminFilmPage: Received full film details from backend:', detailedData);

      setFilmData({
        title: detailedData.title || '',
        workType: 'FILM',
        creatorName: detailedData.director || '',
        publicationOrReleaseYear: detailedData.release_date ? detailedData.release_date.substring(0, 4) : '',
        publisherOrNetwork: Array.isArray(detailedData.production_companies) ? detailedData.production_companies.join(', ') : '',
        focusOrTheme: Array.isArray(detailedData.genres) ? detailedData.genres.join(', ') : '', // Using genres for focusOrTheme
        summaryNotes: detailedData.overview || '',
        imagePath: detailedData.poster_path || '', // Relative path
        externalId: detailedData.tmdb_id?.toString() || '',
        imdb_id: detailedData.imdb_id || '',
        tagline: detailedData.tagline || '',
        runtime: detailedData.runtime?.toString() || '',
        streaming_providers: detailedData.streaming_providers || [],
      });

      if (detailedData.poster_path) {
        setFullPosterUrl(`${TMDB_IMAGE_BASE_URL}w342${detailedData.poster_path}`); // Or w500
      } else {
        setFullPosterUrl(''); // Or a placeholder
      }

      setMode('review_new_film');
      setTmdbResults([]); // Clear search results
      setSuccessMessage(`Details loaded for "${detailedData.title}". Please review and save.`);
    } catch (err) {
      console.error('AdminFilmPage: Error fetching full film details:', err);
      setError(err.response?.data?.message || 'Failed to fetch full film details.');
    } finally {
      setIsFetchingDetails(false);
    }
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
    
    const payload = {
      title: filmData.title,
      workType: filmData.workType || 'FILM',
      creatorName: filmData.creatorName,
      publicationOrReleaseYear: filmData.publicationOrReleaseYear ? parseInt(filmData.publicationOrReleaseYear, 10) : null,
      publisherOrNetwork: filmData.publisherOrNetwork,
      focusOrTheme: filmData.focusOrTheme,
      summaryNotes: filmData.summaryNotes,
      imagePath: filmData.imagePath,
      externalId: filmData.externalId,
      sourcingCredit: 'Information sourced from TMDB, but not endorsed or certified by TMDB.',
      ingestionSource: 'admin_film_tmdb',
      aiGenerated: false,
      verificationStatus: 'UNVERIFIED',
      streamingProviders: filmData.streaming_providers || [],
    };

    try {
      let response;
      if (mode === 'review_new_film') {
        response = await apiClient.post('/admin/mediaworks', payload);
        const saved = response.data;
        setSuccessMessage(`Film "${saved.title}" created successfully (ID #${saved.id}).`);
        setFilmId(saved.id);
        setFilmData((prev) => ({
          ...prev,
          ...saved,
          publicationOrReleaseYear: saved.publicationOrReleaseYear?.toString() || '',
          streaming_providers: saved.streamingProviders || prev.streaming_providers || [],
        }));
        if (saved.imagePath) {
          setFullPosterUrl(
            saved.imagePath.startsWith('http') ? saved.imagePath : `${TMDB_IMAGE_BASE_URL}w342${saved.imagePath}`
          );
        }
        setMode('show_existing_film');
      } else if (mode === 'edit_existing_film' && filmId) {
        response = await apiClient.put(`/admin/mediaworks/${filmId}`, payload);
        const saved = response.data;
        setSuccessMessage(`Film "${saved.title}" updated successfully.`);
        setFilmData((prev) => ({
          ...prev,
          ...saved,
          publicationOrReleaseYear: saved.publicationOrReleaseYear?.toString() || '',
          streaming_providers: saved.streamingProviders || prev.streaming_providers || [],
        }));
        if (saved.imagePath) {
          setFullPosterUrl(
            saved.imagePath.startsWith('http') ? saved.imagePath : `${TMDB_IMAGE_BASE_URL}w342${saved.imagePath}`
          );
        }
        setMode('show_existing_film');
      } else {
        throw new Error('Invalid mode for saving.');
      }
    } catch (err) {
      console.error('AdminFilmPage: Error saving film:', err);
      setError(err.response?.data?.message || 'Failed to save film. Check server logs.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setSearchTerm('');
    setTmdbResults([]);
    setFilmData({ title: '', workType: 'FILM', creatorName: '', publicationOrReleaseYear: '', publisherOrNetwork: '', focusOrTheme: '', summaryNotes: '', imagePath: '', externalId: '', imdb_id: '', tagline: '', runtime: '', streaming_providers: [] });
    setFullPosterUrl('');
    setError(null);
    setSuccessMessage(null);
    if (mode === 'review_new_film' || mode === 'edit_existing_film' || mode === 'show_existing_film') {
        if (filmId && (mode === 'edit_existing_film' || mode === 'show_existing_film')) {
            setMode('search_tmdb'); // Or fetch and show existing film data again
            setFilmId(null);
        } else {
            setMode('search_tmdb');
        }
    } else {
        navigate('/admin');
    }
  };

  const renderTmdbSearch = () => ( /* ... same as before ... */ <form onSubmit={handleTmdbSearch} className="mb-6">
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
    </form>);

  const renderTmdbResults = () => ( /* ... same as before, ensure poster_path is relative and construct full URL here if needed for display ... */ <div className="mt-6">
      <h3 className="text-lg font-semibold text-gray-300 mb-2">TMDB Search Results:</h3>
      {tmdbResults.length === 0 && !isLoading && !error && <p className="text-gray-400">No results found for "{searchTerm}", or waiting for search.</p>}
      <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {tmdbResults.map(film => (
          <li key={film.id} className="p-3 bg-gray-700 rounded-md hover:bg-gray-600/70 transition-colors">
            <div className="flex items-start space-x-3">
              {film.poster_path && (
                <img src={`${TMDB_IMAGE_BASE_URL}w92${film.poster_path}`} alt="" className="w-12 h-auto rounded flex-shrink-0 bg-gray-600" />
              )}
              {!film.poster_path && (
                <div className="w-12 h-[72px] rounded flex-shrink-0 bg-gray-600 flex items-center justify-center text-gray-400 text-xs"><Film size={24}/></div>
              )}
              <div className="flex-grow">
                <p className="font-semibold text-amber-400">{film.title} {film.release_date ? `(${film.release_date.substring(0,4)})` : ''}</p>
                <p className="text-xs text-gray-400 line-clamp-2">{film.overview}</p>
              </div>
              <button
                onClick={() => handleSelectTmdbFilmAndFetchDetails(film)} // Changed to new handler
                className="py-1.5 px-3 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-md self-center flex-shrink-0"
              >
                Select & Get Details
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>);

  const renderFilmForm = () => (
    <form onSubmit={handleSaveFilm} className="space-y-4">
      <h3 className={`text-xl font-semibold mb-4 ${BRONZE_COLOR}`}>
        {mode === 'review_new_film' ? 'Review & Add New Film' : 'Edit Film Details'}
      </h3>
      { (mode === 'review_new_film' || mode === 'edit_existing_film' || mode === 'show_existing_film') && filmData.externalId && (
        <p className="text-sm text-gray-400 mb-1">Original TMDB ID: <strong className="text-amber-400">{filmData.externalId}</strong>
        {filmData.imdb_id && (<> | IMDb ID: <strong className="text-amber-400">{filmData.imdb_id}</strong></>)}
        </p>
      )}
      {filmId && (mode === 'edit_existing_film' || mode === 'show_existing_film') && (
         <p className="text-sm text-gray-400 mb-3">Innocence Archive DB ID: <strong className="text-amber-400">{filmId}</strong></p>
      )}

      {fullPosterUrl && (
        <div className="my-4 text-center">
          <img src={fullPosterUrl} alt={`Poster for ${filmData.title}`} className="max-w-xs mx-auto rounded-lg shadow-md" />
        </div>
      )}

      {/* Form fields */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-300">Title</label>
        <input type="text" name="title" id="title" value={filmData.title} onChange={handleInputChange} required className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
      </div>
      <div>
        <label htmlFor="tagline" className="block text-sm font-medium text-gray-300">Tagline</label>
        <input type="text" name="tagline" id="tagline" value={filmData.tagline} onChange={handleInputChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
      </div>
      <div>
        <label htmlFor="creatorName" className="block text-sm font-medium text-gray-300">Director(s)</label>
        <input type="text" name="creatorName" id="creatorName" value={filmData.creatorName} onChange={handleInputChange} placeholder="e.g., Frank Darabont" className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
            <label htmlFor="publicationOrReleaseYear" className="block text-sm font-medium text-gray-300">Release Year</label>
            <input type="number" name="publicationOrReleaseYear" id="publicationOrReleaseYear" value={filmData.publicationOrReleaseYear} onChange={handleInputChange} placeholder="e.g., 1994" className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
            <label htmlFor="runtime" className="block text-sm font-medium text-gray-300">Runtime (minutes)</label>
            <input type="number" name="runtime" id="runtime" value={filmData.runtime} onChange={handleInputChange} placeholder="e.g., 142" className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
        </div>
      </div>
       <div>
        <label htmlFor="publisherOrNetwork" className="block text-sm font-medium text-gray-300">Production Companies (comma-separated)</label>
        <input type="text" name="publisherOrNetwork" id="publisherOrNetwork" value={filmData.publisherOrNetwork} onChange={handleInputChange} placeholder="e.g., Castle Rock Entertainment, Columbia Pictures" className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
      </div>
       <div>
        <label htmlFor="focusOrTheme" className="block text-sm font-medium text-gray-300">Genres/Keywords (comma-separated for Focus/Theme)</label>
        <input type="text" name="focusOrTheme" id="focusOrTheme" value={filmData.focusOrTheme} onChange={handleInputChange} placeholder="e.g., Drama, Crime, Prison" className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
      </div>
      <div>
        <label htmlFor="summaryNotes" className="block text-sm font-medium text-gray-300">Overview/Plot</label>
        <textarea name="summaryNotes" id="summaryNotes" rows="5" value={filmData.summaryNotes} onChange={handleInputChange} className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"></textarea>
      </div>
      <div>
        <label htmlFor="imagePath" className="block text-sm font-medium text-gray-300">Poster Path (relative, e.g., /q6y0Go1tsGEsmgIo6kdfV63nMui.jpg)</label>
        <input type="text" name="imagePath" id="imagePath" value={filmData.imagePath} onChange={handleInputChange} placeholder="From TMDB, relative path like /q6y0Go1tsGEsmgIo6kdfV63nMui.jpg" className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
      </div>
       <div>
        <label htmlFor="externalId" className="block text-sm font-medium text-gray-300">TMDB ID</label>
        <input type="text" name="externalId" id="externalId" value={filmData.externalId} readOnly className="mt-1 block w-full p-2 bg-gray-600 border border-gray-500 rounded-md text-gray-400 cursor-not-allowed" />
      </div>
       <div>
        <label htmlFor="imdb_id_display" className="block text-sm font-medium text-gray-300">IMDb ID (informational)</label>
        <input type="text" name="imdb_id_display" id="imdb_id_display" value={filmData.imdb_id} readOnly className="mt-1 block w-full p-2 bg-gray-600 border border-gray-500 rounded-md text-gray-400 cursor-not-allowed" />
      </div>

      {/* Display Streaming Providers (Read-only for now) */}
      {filmData.streaming_providers && filmData.streaming_providers.length > 0 && (
        <div className="mt-4">
          <h4 className="text-md font-semibold text-gray-300 mb-2">Streaming Availability (from WatchMode):</h4>
          <ul className="space-y-1 text-xs list-disc list-inside pl-1 max-h-40 overflow-y-auto bg-gray-700 p-2 rounded">
            {filmData.streaming_providers.map(provider => (
              <li key={`${provider.source_id}-${provider.type}-${provider.web_url}`} className="text-gray-300">
                <strong className="text-amber-400">{provider.name}</strong>: {provider.type}
                {provider.price && ` ($${provider.price})`}
                {provider.format && ` [${provider.format}]`}
                {provider.web_url && (
                  <a href={provider.web_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-sky-400 hover:text-sky-300 underline">
                    <ExternalLink size={12} className="inline"/> Link
                  </a>
                )}
              </li>
            ))}
          </ul>
           <p className="text-xs text-gray-500 mt-1">Note: Streaming data is for review. Saving this data will be implemented next.</p>
        </div>
      )}


      <div className="flex justify-end space-x-3 pt-4">
        <button type="button" onClick={handleCancel} disabled={isSaving} className="py-2 px-4 border border-gray-600 hover:bg-gray-600 text-gray-300 font-medium rounded-md flex items-center">
          <XCircle size={18} className="mr-2" /> Cancel
        </button>
        <button type="submit" disabled={isSaving || isLoading || isFetchingDetails} className={`py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md flex items-center justify-center disabled:opacity-50 ${BRONZE_BORDER} border-2`}>
          {isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Save size={18} className="mr-2" />}
          {isSaving ? 'Saving...' : (mode === 'review_new_film' ? 'Add Film to DB' : 'Save Changes')}
        </button>
      </div>
    </form>
  );
  
  const renderShowExistingFilm = () => ( renderFilmForm() );

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8 text-gray-200">
      <div className="max-w-3xl mx-auto bg-gray-800 p-6 md:p-8 rounded-lg shadow-xl">
        <div className="flex items-center mb-6 border-b border-gray-700 pb-3">
          { mode === 'search_tmdb' && <PlusSquare size={28} className={`mr-3 ${BRONZE_COLOR}`} /> }
          { (mode === 'review_new_film' || mode === 'edit_existing_film' || mode === 'show_existing_film') && <Edit3 size={28} className={`mr-3 ${BRONZE_COLOR}`} /> }
          <h1 className={`text-2xl md:text-3xl font-semibold ${BRONZE_COLOR}`}>
            {mode === 'search_tmdb' ? 'Add New Film - Step 1: Search' : 
             mode === 'review_new_film' ? 'Add New Film - Step 2: Review & Save' :
             (mode === 'edit_existing_film' || mode === 'show_existing_film') ? `Manage Film: ${filmData.title || 'Loading...'}` :
             'Manage Film Data'}
          </h1>
        </div>

        {error && ( <div className="mb-4 p-3 bg-red-900/30 border border-red-700 text-red-300 rounded-md flex items-center"> <AlertTriangle size={20} className="mr-2" /> {error} </div> )}
        {successMessage && !error && ( <div className="mb-4 p-3 bg-green-900/50 border border-green-700 text-green-300 rounded-md flex items-center"> {successMessage} </div> )}

        {mode === 'search_tmdb' && (
          <>
            {renderTmdbSearch()}
            {isLoading && <div className="text-center py-4"><Loader2 className="animate-spin h-8 w-8 text-amber-500 mx-auto" /></div>}
            {!isLoading && tmdbResults.length > 0 && renderTmdbResults()}
            {!isLoading && tmdbResults.length === 0 && searchTerm && !error && successMessage && ( <p className="text-gray-400 mt-4 text-center">{successMessage}</p> )}
          </>
        )}

        {(mode === 'review_new_film' || mode === 'edit_existing_film') && (
            <>
            {(isLoading || isFetchingDetails) && <div className="text-center py-4"><Loader2 className="animate-spin h-8 w-8 text-amber-500 mx-auto" /></div>}
            {!(isLoading || isFetchingDetails) && renderFilmForm()}
            </>
        )}
        
        {mode === 'show_existing_film' && !(isLoading || isFetchingDetails) && ( renderShowExistingFilm() )}

        <div className="mt-8 text-center">
            <button onClick={() => navigate('/admin')} className="text-sm text-amber-500 hover:text-amber-400 hover:underline">
                &larr; Back to Admin Dashboard
            </button>
        </div>
      </div>
    </div>
  );
}

export default AdminFilmPage;
