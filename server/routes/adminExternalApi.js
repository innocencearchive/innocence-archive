// server/routes/adminExternalApi.js
const express = require('express');
const axios = require('axios'); // For making HTTP requests to TMDB
const { authenticateToken, authorizeRole } = require('../middleware/authenticateToken');

const router = express.Router();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// --- POST /api/admin/external-search/film ---
// Searches TMDB for films based on a query.
router.post(
  '/film', // Mounted at /api/admin/external-search/film
  authenticateToken,
  authorizeRole(['ADMIN', 'EDITOR']),
  async (req, res) => {
    const { query } = req.body; // Expecting { query: "film title or tmdb_id" }

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({ message: 'A search query string is required.' });
    }

    if (!TMDB_API_KEY) {
      console.error('TMDB_API_KEY is not defined in environment variables.');
      return res.status(500).json({ message: 'External API configuration error.' });
    }

    console.log(`Admin TMDB Film Search: User ${req.user.email} searching for "${query}"`);

    try {
      const searchUrl = `${TMDB_BASE_URL}/search/movie`;
      const params = {
        api_key: TMDB_API_KEY,
        query: query.trim(),
        include_adult: false, // Optional: filter adult content
        language: 'en-US',    // Optional: set language
        page: 1,              // Optional: handle pagination if needed later
      };

      const tmdbResponse = await axios.get(searchUrl, { params });

      if (tmdbResponse.data && tmdbResponse.data.results) {
        // Transform results to a simpler format for the frontend
        const simplifiedResults = tmdbResponse.data.results.map(film => ({
          id: film.id, // TMDB ID
          title: film.title,
          release_date: film.release_date, // YYYY-MM-DD
          overview: film.overview,
          poster_path: film.poster_path ? `https://image.tmdb.org/t/p/w92${film.poster_path}` : null, // Smaller poster for search results
          // You can add more fields here if needed for the selection UI
        }));
        console.log(`TMDB search for "${query}" returned ${simplifiedResults.length} results.`);
        res.json(simplifiedResults);
      } else {
        console.log(`TMDB search for "${query}" returned no results or unexpected format.`);
        res.json([]); // Send empty array if no results
      }
    } catch (error) {
      console.error('Error searching TMDB API:', error.response ? error.response.data : error.message);
      // Avoid exposing too much detail from external API errors
      if (error.response && error.response.status === 401) {
        // Unauthorized - likely an issue with the TMDB API key
        return res.status(500).json({ message: 'Error communicating with external service: Authentication failed.' });
      }
      res.status(500).json({ message: 'An error occurred while searching for films.' });
    }
  }
);

// TODO: Add similar endpoint for '/book' to search Google Books API

module.exports = router;
