// server/routes/adminExternalApi.js
const express = require('express');
const axios = require('axios');
const { authenticateToken, authorizeRole } = require('../middleware/authenticateToken');

const router = express.Router();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const WATCHMODE_API_KEY = process.env.WATCHMODE_API_KEY; // Added
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const WATCHMODE_BASE_URL = 'https://api.watchmode.com/v1'; // Added

// --- POST /api/admin/external-search/film ---
// (Existing TMDB search endpoint - no changes here for now)
router.post(
  '/film',
  authenticateToken,
  authorizeRole(['ADMIN', 'EDITOR']),
  async (req, res) => {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({ message: 'A search query string is required.' });
    }
    if (!TMDB_API_KEY) {
      console.error('TMDB_API_KEY is not defined.');
      return res.status(500).json({ message: 'External API configuration error (TMDB).' });
    }
    console.log(`Admin TMDB Film Search: User ${req.user.email} searching for "${query}"`);
    try {
      const searchUrl = `${TMDB_BASE_URL}/search/movie`;
      const params = { api_key: TMDB_API_KEY, query: query.trim(), include_adult: false, language: 'en-US', page: 1 };
      const tmdbResponse = await axios.get(searchUrl, { params });
      if (tmdbResponse.data && tmdbResponse.data.results) {
        const simplifiedResults = tmdbResponse.data.results.map(film => ({
          id: film.id,
          title: film.title,
          release_date: film.release_date,
          overview: film.overview,
          poster_path: film.poster_path, // Send relative path
        }));
        console.log(`TMDB search for "${query}" returned ${simplifiedResults.length} results.`);
        res.json(simplifiedResults);
      } else {
        res.json([]);
      }
    } catch (error) {
      console.error('Error searching TMDB API:', error.response ? error.response.data : error.message);
      if (error.response && error.response.status === 401) {
        return res.status(500).json({ message: 'Error communicating with TMDB: Authentication failed.' });
      }
      res.status(500).json({ message: 'An error occurred while searching for films on TMDB.' });
    }
  }
);

// --- GET /api/admin/external-search/film-details/:tmdbId ---
// Fetches detailed film data from TMDB and streaming info from WatchMode
router.get(
  '/film-details/:tmdbId', // Renamed from just /film to avoid conflict if you add POST /film later
  authenticateToken,
  authorizeRole(['ADMIN', 'EDITOR']),
  async (req, res) => {
    const { tmdbId } = req.params;

    if (!TMDB_API_KEY || !WATCHMODE_API_KEY) {
      console.error('TMDB_API_KEY or WATCHMODE_API_KEY is not defined.');
      return res.status(500).json({ message: 'External API configuration error.' });
    }

    console.log(`Admin Fetch Film Details: User ${req.user.email} fetching details for TMDB ID: ${tmdbId}`);

    try {
      // 1. Fetch detailed movie data from TMDB
      const tmdbDetailsUrl = `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,keywords`;
      const tmdbDetailsResponse = await axios.get(tmdbDetailsUrl);
      const tmdbData = tmdbDetailsResponse.data;

      if (!tmdbData) {
        return res.status(404).json({ message: `No details found on TMDB for ID ${tmdbId}` });
      }

      // Prepare data structure for frontend
      const filmDetails = {
        tmdb_id: tmdbData.id,
        imdb_id: tmdbData.imdb_id, // Needed for WatchMode if searching by IMDb ID
        title: tmdbData.title,
        tagline: tmdbData.tagline,
        overview: tmdbData.overview,
        release_date: tmdbData.release_date,
        runtime: tmdbData.runtime, // in minutes
        poster_path: tmdbData.poster_path, // relative path
        backdrop_path: tmdbData.backdrop_path, // relative path
        genres: tmdbData.genres ? tmdbData.genres.map(g => g.name) : [],
        production_companies: tmdbData.production_companies ? tmdbData.production_companies.map(pc => pc.name) : [],
        director: tmdbData.credits?.crew?.find(person => person.job === 'Director')?.name || null,
        // You can extract more from credits (cast, writers etc.) if needed
        keywords: tmdbData.keywords?.keywords ? tmdbData.keywords.keywords.map(k => k.name) : [],
        streaming_providers: [] // Initialize, to be filled by WatchMode
      };

      // 2. Fetch streaming availability from WatchMode
      // WatchMode can be searched by IMDb ID (preferred if available) or title.
      // We'll use IMDb ID if TMDB provided it.
      let watchmodeSources = [];
      if (filmDetails.imdb_id) {
        const watchmodeUrl = `${WATCHMODE_BASE_URL}/title/${filmDetails.imdb_id}/sources/?apiKey=${WATCHMODE_API_KEY}`;
        // Alternative: Search by TMDB ID if Watchmode supports it directly, or search by title/year
        // const watchmodeSearchUrl = `${WATCHMODE_BASE_URL}/search/?apiKey=${WATCHMODE_API_KEY}&search_field=tmdb_movie_id&search_value=${tmdbId}`;
        
        try {
          console.log(`Workspaceing WatchMode sources for IMDb ID: ${filmDetails.imdb_id}`);
          const watchmodeResponse = await axios.get(watchmodeUrl);
          // WatchMode returns an array of sources
          if (Array.isArray(watchmodeResponse.data)) {
            watchmodeSources = watchmodeResponse.data.map(source => ({
              source_id: source.source_id, // WatchMode's internal ID for the source (e.g., Netflix, Hulu)
              name: source.name,           // e.g., "Netflix"
              type: source.type,         // e.g., "sub", "rent", "buy", "free"
              region: source.region,
              web_url: source.web_url,
              price: source.price,
              format: source.format,       // e.g., "HD", "SD", "4K"
            }));
            filmDetails.streaming_providers = watchmodeSources;
            console.log(`Found ${watchmodeSources.length} streaming sources from WatchMode.`);
          }
        } catch (wmError) {
          // It's common for WatchMode to not find sources for all titles, so don't treat as critical error
          console.warn('WatchMode API error or no sources found for IMDb ID:', filmDetails.imdb_id, wmError.response ? wmError.response.data : wmError.message);
          // If WatchMode returns 404, it means title not found or no sources.
          // We'll proceed without streaming info if this happens.
        }
      } else {
        console.warn(`No IMDb ID found for TMDB ID ${tmdbId}, skipping WatchMode lookup.`);
      }
      
      res.json(filmDetails);

    } catch (error) {
      console.error(`Error fetching film details for TMDB ID ${tmdbId}:`, error.response ? error.response.data : error.message);
      if (error.response && error.response.status === 404) {
        return res.status(404).json({ message: `Film with TMDB ID ${tmdbId} not found.` });
      }
      res.status(500).json({ message: 'An error occurred while fetching film details.' });
    }
  }
);


module.exports = router;
