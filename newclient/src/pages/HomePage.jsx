// src/pages/HomePage.jsx
import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react'; // Added Loader2
// Assuming these components are correctly located relative to HomePage.jsx
import ExploreGrid from '../components/ExploreGrid';
import FeaturedStory from '../components/FeaturedStory';
import HowToUse from '../components/HowToUse';
import MissionStatement from '../components/MissionStatement';
import RecentUpdates from '../components/RecentUpdates'; // Assuming this is still needed or uses separate logic
import HeroSection from '../components/HeroSection';

// Static data can remain if still used by StatsModule directly
const staticStats = [
  { id: 1, text: "Over 3,000 exonerations nationwide since 1989." },
  { id: 2, text: "Official misconduct contributed to over 50% of known wrongful convictions." },
  { id: 3, text: "Average time served by exonerees: 9 years." }
];

const HomePage = () => {
  // State hooks for the featured content
  const [featuredStory, setFeaturedStory] = useState(null);
  const [featuredMedia, setFeaturedMedia] = useState({ book: null, podcast: null, film: null });
  const [featuredOrg, setFeaturedOrg] = useState(null);
  const [featuredFactors, setFeaturedFactors] = useState([]);
  // Keep recent updates state if it's fetched separately or static
  const [recentUpdates, setRecentUpdates] = useState([]);
  // Keep stats if they are static or fetched differently
  const [stats, setStats] = useState(staticStats);

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // useEffect hook to fetch settings and then featured content
  useEffect(() => {
    const fetchHomepageData = async () => {
      setIsLoading(true);
      setError(null);
      console.log("Fetching homepage settings...");

      try {
        // 1. Fetch the settings
        const settingsResponse = await fetch('/api/settings/featured');
        if (!settingsResponse.ok) {
          const errorData = await settingsResponse.json().catch(() => ({}));
          throw new Error(`Failed to fetch settings: ${errorData.message || settingsResponse.statusText}`);
        }
        const settings = await settingsResponse.json();
        console.log("Homepage settings fetched:", settings);

        // 2. Prepare fetch promises based on settings IDs
        const fetchPromises = [];

        // --- Fetch Featured Story (Individual) ---
        if (settings.featuredStoryId) {
          console.log(`Fetching featured story (Individual ID: ${settings.featuredStoryId})`);
          fetchPromises.push(
            fetch(`/api/individuals/${settings.featuredStoryId}`)
              .then(res => res.ok ? res.json() : Promise.reject(`Story fetch failed: ${res.statusText}`))
              .then(data => ({ type: 'story', data }))
              .catch(err => ({ type: 'story', error: err })) // Catch specific fetch error
          );
        } else {
           fetchPromises.push(Promise.resolve({ type: 'story', data: null })); // Resolve null if no ID
        }

        // --- Fetch Featured Media (Book, Podcast, Film - MediaWorks) ---
        // Book
        if (settings.featuredBookId) {
          console.log(`Fetching featured book (MediaWork ID: ${settings.featuredBookId})`);
          fetchPromises.push(
            // Assuming book links to combined page, fetch work data
            fetch(`/api/mediaworks/${settings.featuredBookId}`)
              .then(res => res.ok ? res.json() : Promise.reject(`Book fetch failed: ${res.statusText}`))
              .then(data => ({ type: 'book', data }))
              .catch(err => ({ type: 'book', error: err }))
          );
        } else {
           fetchPromises.push(Promise.resolve({ type: 'book', data: null }));
        }
        // Podcast
        if (settings.featuredPodcastId) {
           console.log(`Fetching featured podcast (MediaWork ID: ${settings.featuredPodcastId})`);
           fetchPromises.push(
             fetch(`/api/mediaworks/${settings.featuredPodcastId}`)
               .then(res => res.ok ? res.json() : Promise.reject(`Podcast fetch failed: ${res.statusText}`))
               .then(data => ({ type: 'podcast', data }))
               .catch(err => ({ type: 'podcast', error: err }))
           );
        } else {
            fetchPromises.push(Promise.resolve({ type: 'podcast', data: null }));
        }
        // Film/Doc
        if (settings.featuredFilmId) {
            console.log(`Fetching featured film/doc (MediaWork ID: ${settings.featuredFilmId})`);
            fetchPromises.push(
              // Assuming film/doc links to combined page, fetch work data
              fetch(`/api/mediaworks/${settings.featuredFilmId}`)
                .then(res => res.ok ? res.json() : Promise.reject(`Film fetch failed: ${res.statusText}`))
                .then(data => ({ type: 'film', data }))
                .catch(err => ({ type: 'film', error: err }))
            );
        } else {
             fetchPromises.push(Promise.resolve({ type: 'film', data: null }));
        }

        // --- Fetch Featured Organization ---
        if (settings.featuredOrgId) {
          console.log(`Fetching featured organization (Org ID: ${settings.featuredOrgId})`);
          fetchPromises.push(
            fetch(`/api/organizations/${settings.featuredOrgId}`)
              .then(res => res.ok ? res.json() : Promise.reject(`Org fetch failed: ${res.statusText}`))
              .then(data => ({ type: 'org', data }))
              .catch(err => ({ type: 'org', error: err }))
          );
        } else {
           fetchPromises.push(Promise.resolve({ type: 'org', data: null }));
        }

        // --- Fetch Featured Factors ---
        // Assumes backend handles GET /api/factors?ids=1,2,3 or similar
        // Or fetch individually if needed
        if (Array.isArray(settings.featuredFactorIds) && settings.featuredFactorIds.length > 0) {
          const factorIdsQuery = settings.featuredFactorIds.join(',');
          console.log(`Fetching featured factors (Factor IDs: ${factorIdsQuery})`);
          fetchPromises.push(
            fetch(`/api/factors?ids=${factorIdsQuery}`) // Adjust endpoint if needed
              .then(res => res.ok ? res.json() : Promise.reject(`Factors fetch failed: ${res.statusText}`))
              .then(data => ({ type: 'factors', data }))
              .catch(err => ({ type: 'factors', error: err }))
          );
        } else {
          fetchPromises.push(Promise.resolve({ type: 'factors', data: [] })); // Resolve empty array if no IDs
        }

        // --- Fetch Recent Updates (if needed, otherwise remove) ---
        // Example: fetchPromises.push(fetch('/api/updates/recent').then(...));
        // For now, assuming it's static or handled elsewhere


        // 3. Execute all fetches concurrently and process results
        console.log(`Executing ${fetchPromises.length} fetches for featured content...`);
        const results = await Promise.allSettled(fetchPromises);
        console.log("Featured content fetch results:", results);

        // Process results and update state
        let fetchError = null; // Track if any fetch failed
        const newMedia = { book: null, podcast: null, film: null };

        results.forEach(result => {
          if (result.status === 'fulfilled') {
            const { type, data } = result.value;
            switch (type) {
              case 'story': setFeaturedStory(data); break;
              case 'book': newMedia.book = data; break;
              case 'podcast': newMedia.podcast = data; break;
              case 'film': newMedia.film = data; break;
              case 'org': setFeaturedOrg(data); break;
              case 'factors': setFeaturedFactors(data || []); break; // Ensure it's an array
              // Add cases for other fetched data like recent updates
            }
          } else {
            // Handle rejected promises (fetch errors)
            console.error(`Failed to fetch ${result.reason?.type || 'data'}:`, result.reason);
            // Set a general error message, could be more specific
            fetchError = fetchError || "Failed to load some homepage content. Please try again later.";
          }
        });

        setFeaturedMedia(newMedia); // Update media state object

        if (fetchError) {
            setError(fetchError); // Set error state if any fetch failed
        }

      } catch (err) {
        // Catch errors from fetching settings or processing results
        console.error("Error in fetchHomepageData:", err);
        setError(err.message || "An unexpected error occurred loading homepage data.");
        // Reset states on error
        setFeaturedStory(null);
        setFeaturedMedia({ book: null, podcast: null, film: null });
        setFeaturedOrg(null);
        setFeaturedFactors([]);
      } finally {
        setIsLoading(false);
        console.log("Finished fetching homepage data.");
      }
    };

    fetchHomepageData();

    // Viewport Height (vh) Fix - Remains the same
    const setVh = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVh();
    window.addEventListener('resize', setVh);
    return () => window.removeEventListener('resize', setVh);

  }, []); // Empty dependency array means this runs once on mount

  // Loading state
  if (isLoading) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-center py-40 text-gray-400 text-xl">
            <Loader2 className="h-12 w-12 animate-spin text-amber-500 mb-4" />
            Loading Innocence Archive...
        </div>
    );
  }

  // Error state (displays general error if any fetch failed)
  if (error && !featuredStory && !featuredOrg) { // Only show full error page if critical data failed
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-center py-20 px-4 text-red-500">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Homepage</h2>
        <p className="text-sm">{error}</p>
        {/* Optionally add a retry button */}
      </div>
    );
  }

  // --- Render Page Content ---
  // Passes the fetched (or null) data down to the components
  return (
    <>
      <HeroSection />

      <main className="bg-black py-16 md:py-20 lg:py-24 px-4 md:px-8">
        {/* Display error inline if some data loaded but not all */}
        {error && (
            <div className="max-w-6xl mx-auto mb-10 p-3 rounded-md bg-red-900/50 text-red-300 flex items-center">
               <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" />
               <span>Warning: {error} Some content might be missing.</span>
            </div>
        )}

        {/* Featured Story - Pass the fetched story state */}
        {/* Conditionally render or let FeaturedStory handle null */}
        {featuredStory && (
             <div className="mb-16 md:mb-20 lg:mb-24">
                <FeaturedStory story={featuredStory} />
             </div>
        )}
        {/* Or always render and let component show placeholder:
         <div className="mb-16 md:mb-20 lg:mb-24">
             <FeaturedStory story={featuredStory} />
         </div>
        */}


        {/* Explore Grid - Pass the fetched media, org, factors */}
        <div className="mb-16 md:mb-20 lg:mb-24">
           <ExploreGrid
              featuredMedia={featuredMedia} // Contains fetched book/podcast/film or null
              featuredOrg={featuredOrg}     // Contains fetched org or null
              stats={stats}                 // Static stats for now
              factors={featuredFactors}     // Contains fetched factors or []
            />
        </div>

        {/* How To Use - Static or fetched elsewhere */}
        <div className="mb-16 md:mb-20 lg:mb-24">
           <HowToUse />
        </div>

        {/* Recent Updates - Static or fetched elsewhere */}
        <div className="mb-16 md:mb-20 lg:mb-24">
           <RecentUpdates updates={recentUpdates} />
        </div>

        {/* Mission Statement - Static or fetched elsewhere */}
        <div>
           <MissionStatement />
        </div>
      </main>
    </>
  );
};

export default HomePage;
