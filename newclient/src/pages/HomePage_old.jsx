// src/pages/HomePage.jsx
import React, { useState, useEffect } from 'react';
// Removed unused Link import for now, may be needed by child components
// import { Link } from 'react-router-dom';

// Import icons - Keep icons used by child components rendered here
import { Search, ArrowLeft, AlertCircle } from 'lucide-react';

// Import Child Components (assuming they exist)
import ExploreGrid from '../components/ExploreGrid'; // Will now receive props including factors
import FeaturedStory from '../components/FeaturedStory';
import HowToUse from '../components/HowToUse';
import MissionStatement from '../components/MissionStatement';
// import ModuleCard from '../components/ModuleCard'; // Not used directly in this structure yet
import RecentUpdates from '../components/RecentUpdates';
import SearchBar from '../components/SearchBar';

// --- Static Data (Example - could be fetched) ---
const staticStats = [
  { id: 1, text: "Over 3,000 exonerations nationwide since 1989." },
  { id: 2, text: "Official misconduct contributed to over 50% of known wrongful convictions." },
  { id: 3, text: "Average time served by exonerees: 9 years." }
];


// --- HomePage Component Definition ---
const HomePage = () => {
  // --- State Variables ---
  const [featuredStory, setFeaturedStory] = useState(null);
  const [featuredMedia, setFeaturedMedia] = useState({ book: null, podcast: null, film: null });
  const [featuredOrg, setFeaturedOrg] = useState(null);
  const [recentUpdates, setRecentUpdates] = useState([]);
  const [stats, setStats] = useState(staticStats);
  // *** ADDED State for factors ***
  const [featuredFactors, setFeaturedFactors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Data Fetching Effect ---
  useEffect(() => {
    const fetchHomepageData = async () => {
      setIsLoading(true);
      setError(null);
      console.log("Fetching homepage data...");

      try {
        // Define API endpoints (adjust URLs as needed)
        const individualApiUrl = '/api/individuals?latest=1';
        const mediaApiUrl = '/api/homepage/featured-media';
        const orgApiUrl = '/api/organizations?latest=1';
        const updatesApiUrl = '/api/updates?limit=3';
        // *** ADDED API URL for factors (e.g., get latest 3) ***
        const factorsApiUrl = '/api/contributingfactors?latest=3'; // Assumes returns [{...}, ...]

        // Fetch all data concurrently
        const [storyRes, mediaRes, orgRes, updatesRes, factorsRes] = await Promise.all([ // Added factorsRes
          fetch(individualApiUrl),
          fetch(mediaApiUrl),
          fetch(orgApiUrl),
          fetch(updatesApiUrl),
          fetch(factorsApiUrl) // Added fetch for factors
        ]);

        // Process responses - Check 'ok' status and parse JSON safely
        const storyData = storyRes.ok ? await storyRes.json() : null;
        const mediaData = mediaRes.ok ? await mediaRes.json() : { book: null, podcast: null, film: null };
        const orgData = orgRes.ok ? await orgRes.json() : null;
        const updatesData = updatesRes.ok ? await updatesRes.json() : [];
        // *** ADDED Processing for factors ***
        const factorsData = factorsRes.ok ? await factorsRes.json() : [];

        // Update state
        setFeaturedStory(Array.isArray(storyData) && storyData.length > 0 ? storyData[0] : null);
        setFeaturedMedia(mediaData ?? { book: null, podcast: null, film: null });
        setFeaturedOrg(Array.isArray(orgData) && orgData.length > 0 ? orgData[0] : null);
        setRecentUpdates(updatesData ?? []);
        // *** ADDED State update for factors ***
        setFeaturedFactors(factorsData ?? []); // Ensure it's an array

        console.log("Homepage data fetched successfully.");

      } catch (err) {
        console.error("Error fetching homepage data:", err);
        setError("Failed to load homepage content. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHomepageData();
  }, []); // Empty dependency array ensures this runs only once on mount

  // --- Render Loading State ---
  if (isLoading) {
    return <div className="text-center py-40 text-gray-400">Loading Innocence Archive...</div>;
  }

  // --- Render Error State ---
  if (error) {
    return (
      <div className="text-center py-20 px-4 text-red-500">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Homepage</h2>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  // --- Render Page Content ---
  return (
    <>
      <SearchBar />
      <MissionStatement />

      {featuredStory ? (
        <FeaturedStory story={featuredStory} />
      ) : (
        <div className="text-center py-10 text-gray-500">No featured story available right now.</div>
      )}

      {/* *** UPDATED ExploreGrid CALL TO PASS factors PROP *** */}
      <ExploreGrid
          featuredMedia={featuredMedia}
          featuredOrg={featuredOrg}
          stats={stats}
          factors={featuredFactors} 
      />

      <HowToUse />

      <RecentUpdates updates={recentUpdates} />

    </>
  );
};

export default HomePage;
