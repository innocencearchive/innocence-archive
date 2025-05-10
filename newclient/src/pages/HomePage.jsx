// src/pages/HomePage.jsx
import apiClient from '../apiClient'; // Adjust the path if apiClient.js is elsewhere
import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import ExploreGrid from '../components/ExploreGrid';
import FeaturedStory from '../components/FeaturedStory';
import HowToUse from '../components/HowToUse';
import MissionStatement from '../components/MissionStatement';
import RecentUpdates from '../components/RecentUpdates';
import HeroSection from '../components/HeroSection';

const staticStats = [
  { id: 1, text: "Over 3,000 exonerations nationwide since 1989." },
  { id: 2, text: "Official misconduct contributed to over 50% of known wrongful convictions." },
  { id: 3, text: "Average time served by exonerees: 9 years." }
];

const HomePage = () => {
  const [featuredStory, setFeaturedStory] = useState(null);
  const [featuredMedia, setFeaturedMedia] = useState({ book: null, podcast: null, film: null });
  const [featuredOrg, setFeaturedOrg] = useState(null);
  const [featuredFactors, setFeaturedFactors] = useState([]);
  const [recentUpdates, setRecentUpdates] = useState([]);
  const [stats, setStats] = useState(staticStats);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHomepageData = async () => {
      setIsLoading(true);
      setError(null);
      console.log("Fetching homepage settings...");

      try {
        // 1. Fetch the settings using apiClient
        const settingsResponse = await apiClient.get('/api/settings/featured');
        // With Axios, data is in settingsResponse.data.
        // Axios throws an error for non-2xx responses, so !settingsResponse.ok check is not standard here.
        // The catch block below will handle HTTP errors.
        const settings = settingsResponse.data;
        console.log("Homepage settings fetched:", settings);

        // 2. Prepare fetch promises based on settings IDs using apiClient
        const fetchPromises = [];

        // Helper function to create a fetch promise with apiClient
        const createFetchPromise = (type, endpoint) => {
          console.log(`Fetching featured ${type} from: ${endpoint}`);
          return apiClient.get(endpoint)
            .then(response => ({ type, data: response.data })) // Axios provides data directly
            .catch(err => {
              // Construct a more informative error object for Promise.allSettled
              const errorMessage = err.response?.data?.message || err.message || `Failed to fetch ${type}`;
              console.error(`Error fetching ${type} from ${endpoint}:`, errorMessage, err.response || err);
              return Promise.reject({ type, error: new Error(errorMessage), originalError: err });
            });
        };

        // --- Fetch Featured Story (Individual) ---
        if (settings.featuredStoryId) {
          fetchPromises.push(createFetchPromise('story', `/api/individuals/${settings.featuredStoryId}`));
        } else {
          fetchPromises.push(Promise.resolve({ type: 'story', data: null }));
        }

        // --- Fetch Featured Media (Book, Podcast, Film - MediaWorks) ---
        // Book
        if (settings.featuredBookId) {
          fetchPromises.push(createFetchPromise('book', `/api/mediaworks/${settings.featuredBookId}`));
        } else {
          fetchPromises.push(Promise.resolve({ type: 'book', data: null }));
        }
        // Podcast
        if (settings.featuredPodcastId) {
          fetchPromises.push(createFetchPromise('podcast', `/api/mediaworks/${settings.featuredPodcastId}`));
        } else {
          fetchPromises.push(Promise.resolve({ type: 'podcast', data: null }));
        }
        // Film/Doc
        if (settings.featuredFilmId) {
          fetchPromises.push(createFetchPromise('film', `/api/mediaworks/${settings.featuredFilmId}`));
        } else {
          fetchPromises.push(Promise.resolve({ type: 'film', data: null }));
        }

        // --- Fetch Featured Organization ---
        if (settings.featuredOrgId) {
          fetchPromises.push(createFetchPromise('org', `/api/organizations/${settings.featuredOrgId}`));
        } else {
          fetchPromises.push(Promise.resolve({ type: 'org', data: null }));
        }

        // --- Fetch Featured Factors ---
        if (Array.isArray(settings.featuredFactorIds) && settings.featuredFactorIds.length > 0) {
          const factorIdsQuery = settings.featuredFactorIds.join(',');
          fetchPromises.push(createFetchPromise('factors', `/api/factors?ids=${factorIdsQuery}`));
        } else {
          fetchPromises.push(Promise.resolve({ type: 'factors', data: [] }));
        }

        // 3. Execute all fetches concurrently and process results
        console.log(`Executing ${fetchPromises.length} fetches for featured content...`);
        const results = await Promise.allSettled(fetchPromises);
        console.log("Featured content fetch results:", results);

        let fetchErrorOccurred = false;
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
              case 'factors': setFeaturedFactors(data || []); break;
              default: break;
            }
          } else { // result.status === 'rejected'
            console.error(`Failed to fetch data for type '${result.reason?.type || 'unknown'}':`, result.reason?.error?.message || result.reason);
            fetchErrorOccurred = true;
          }
        });

        setFeaturedMedia(newMedia);

        if (fetchErrorOccurred) {
          setError("Failed to load some homepage content. Please try again later.");
        }

      } catch (err) { // This catch block is primarily for the initial settings fetch or unexpected errors
        console.error("Error in fetchHomepageData (likely settings fetch):", err);
        const errorMessage = err.response?.data?.message || err.message || "An unexpected error occurred loading homepage data.";
        setError(errorMessage);
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

    const setVh = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVh();
    window.addEventListener('resize', setVh);
    return () => window.removeEventListener('resize', setVh);

  }, []);

  if (isLoading) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-center py-40 text-gray-400 text-xl">
            <Loader2 className="h-12 w-12 animate-spin text-amber-500 mb-4" />
            Loading Innocence Archive...
        </div>
    );
  }

  if (error && !featuredStory && !featuredOrg && featuredMedia.book === null && featuredMedia.podcast === null && featuredMedia.film === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-center py-20 px-4 text-red-500">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Homepage</h2>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <>
      <HeroSection />
      <main className="bg-black py-16 md:py-20 lg:py-24 px-4 md:px-8">
        {error && ( // Display inline error if some content failed but not all
            <div className="max-w-6xl mx-auto mb-10 p-3 rounded-md bg-red-900/50 text-red-300 flex items-center">
               <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" />
               <span>Warning: {error} Some content might be missing.</span>
            </div>
        )}
        {featuredStory && (
             <div className="mb-16 md:mb-20 lg:mb-24">
                <FeaturedStory story={featuredStory} />
             </div>
        )}
        <div className="mb-16 md:mb-20 lg:mb-24">
           <ExploreGrid
              featuredMedia={featuredMedia}
              featuredOrg={featuredOrg}
              stats={stats}
              factors={featuredFactors}
            />
        </div>
        <div className="mb-16 md:mb-20 lg:mb-24">
           <HowToUse />
        </div>
        <div className="mb-16 md:mb-20 lg:mb-24">
           <RecentUpdates updates={recentUpdates} />
        </div>
        <div>
           <MissionStatement />
        </div>
      </main>
    </>
  );
};

export default HomePage;
