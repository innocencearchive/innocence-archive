// src/pages/ContributingFactorsPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../apiClient'; // Adjust the path if apiClient.js is elsewhere
// --- Import Icons ---
import { Users, List, ArrowLeft, AlertCircle, FileText, Building, UserCheck, Loader2 } from 'lucide-react'; // Added Loader2

// --- Import Components ---
// Assuming these components exist in ../components/
import Breadcrumbs from '../components/Breadcrumbs';
import WrongfullyConvictedList from '../components/WrongfullyConvictedList';
import RelatedMediaList from '../components/RelatedMediaList';
import OtherInvolvedPersonsList from '../components/OtherInvolvedPersonsList';
import OrganizationsMentionedList from '../components/OrganizationsMentionedList';
// Assuming FactorDescription is a simple styled div/p for now
import PageNavigationButtons from '../components/PageNavigationButtons';

// --- Import Theme Constants ---
// CORRECTED: Changed 'themeConstants' to 'themeconstants' (all lowercase)
import { BRONZE_COLOR, BRONZE_BORDER } from '../components/themeconstants'; 
import AIDisclaimer from '../components/AIDisclaimer';

// --- Main ContributingFactorsPage Component ---
function ContributingFactorsPage() { // Renamed from ContributingFactorPage to match filename convention
  const { id } = useParams();
  const navigate = useNavigate();

  // State variables
  const [factorData, setFactorData] = useState(null);
  const [relatedOIPs, setRelatedOIPs] = useState([]);
  const [relatedOrgs, setRelatedOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Effect: Fetch All Data ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setFactorData(null);
      setRelatedOIPs([]);
      setRelatedOrgs([]);

      const apiUrl = `/api/contributingfactors/${id}`;
      console.log(`Fetching contributing factor data (incl. relations) from: ${apiUrl}`);

      try {
        const response = await apiClient.get(apiUrl);
        // apiClient (axios instance) throws for non-2xx, so !response.ok check is not typical here
        const data = response.data;

        setFactorData(data);
        // Ensure relatedPersons and relatedOrganizations are arrays, even if null/undefined from API
        setRelatedOIPs(data.relatedPersons ?? []);
        setRelatedOrgs(data.relatedOrganizations ?? []);

        console.log(`Fetched data for factor ${id}:`, {
            factorName: data.name,
            wcCasesCount: data.individualCases?.length ?? 0,
            mediaMentionsCount: data.mediaItemMentions?.length ?? 0,
            relatedOIPsCount: data.relatedPersons?.length ?? 0,
            relatedOrgsCount: data.relatedOrganizations?.length ?? 0,
        });

      } catch (err) {
        console.error("Fetch error in ContributingFactorsPage:", err);
        let errorMessage = "An unknown error occurred.";
        if (err.response) { // Error from server (e.g., 404, 500)
            errorMessage = err.response.data?.message || `Server error: ${err.response.status}`;
        } else if (err.request) { // Request made but no response
            errorMessage = "Network error or no response from server.";
        } else { // Other errors (e.g., setup issue)
            errorMessage = err.message;
        }
        setError(errorMessage);
        // Ensure related states are empty on error
        setRelatedOIPs([]);
        setRelatedOrgs([]);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    } else {
      setError("No contributing factor ID provided in URL.");
      setLoading(false);
    }
  }, [id]);

  // --- Construct Breadcrumbs ---
  const getBreadcrumbItems = () => {
      let items = [{ label: "Home", link: "/" }];
      if (loading) items.push({ label: "Loading Factor..." });
      else if (error) items.push({ label: "Error" });
      else if (factorData) items.push({ label: factorData.name ?? 'Factor Details' });
      else items.push({ label: "Factor Not Found" });
      return items;
  };

  // --- Render Loading State ---
  if (loading) {
       return (
          <>
              <div className="w-full px-4 md:px-8 py-4"><Breadcrumbs items={getBreadcrumbItems()} /></div>
              <div className="text-center py-20 text-gray-400 min-h-screen flex flex-col justify-center items-center">
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-amber-500" />
                <p className="mt-4 text-lg">Loading contributing factor details...</p>
              </div>
          </>
      );
  }

  // --- Render Error State ---
  if (error) {
       return (
          <>
              <div className="w-full px-4 md:px-8 py-4"><Breadcrumbs items={getBreadcrumbItems()} /></div>
              <div className="text-center py-20 px-4 text-red-500 bg-black rounded-lg shadow-md max-w-4xl mx-auto mt-4 min-h-screen flex flex-col justify-center items-center">
                  <AlertCircle className="mx-auto h-12 w-12 text-red-400 my-4" />
                  <h2 className="text-xl font-semibold mb-2">Error Loading Contributing Factor</h2>
                  <p className="text-sm">{error}</p>
                  <button
                      onClick={() => navigate(-1)}
                      className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                  >
                      <ArrowLeft className="mr-2 h-5 w-5" /> Go Back
                  </button>
              </div>
          </>
      );
  }

   // --- Render Not Found State ---
   if (!factorData) {
        return (
           <>
               <div className="w-full px-4 md:px-8 py-4"><Breadcrumbs items={getBreadcrumbItems()} /></div>
               <div className="text-center py-20 text-gray-400 bg-black rounded-lg shadow-md max-w-4xl mx-auto mt-4 min-h-screen flex flex-col justify-center items-center">
                   Contributing factor not found.
               </div>
           </>
        );
   }


  // --- Render the ContributingFactorsPage Content ---
  return (
    <div className="bg-black text-gray-50 min-h-screen"> {/* Ensure full page background */}
      {/* Render breadcrumbs outside the main content blocks */}
      <div className="w-full px-4 md:px-8 py-4"><Breadcrumbs items={getBreadcrumbItems()} /></div>

      {/* === Block 1: Description & Related WC Cases === */}
      <div className="bg-black rounded-lg shadow-md max-w-6xl mx-auto p-6 md:p-8 mt-6 mb-8">
        {/* Factor Header */}
        <h1 className={`text-3xl md:text-4xl font-serif ${BRONZE_COLOR} text-center mb-8 uppercase`}>
          {factorData.name ?? 'Unnamed Factor'}
        </h1>

        {/* Layout Grid: Description (Sidebar - Left 1/3) and WC Cases (Main - Right 2/3) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Sidebar: Description */}
          <div className="md:col-span-1 p-6 bg-gray-800 rounded-md">
            <h2 className={`text-xl font-semibold ${BRONZE_COLOR} mb-4 flex items-center`}>
              <FileText className="mr-2 h-5 w-5" /> Description
            </h2>
            <p className="text-gray-300 whitespace-pre-wrap text-sm">
              {factorData.description?.trim() ? factorData.description : 'No description provided.'}
            </p>
          </div>

          {/* Main Section: Related Wrongfully Convicted Cases */}
          <div className={`md:col-span-2 p-6 border ${BRONZE_BORDER} rounded-md bg-gray-900/30`}>
            <WrongfullyConvictedList
              individuals={factorData.individualCases ?? []}
              isLoading={loading} // This loading is for the overall factorData
              error={error}     // This error is for the overall factorData
              emptyMessage="No wrongfully convicted cases directly linked to this factor found."
            />
            {factorData.aiGenerated !== false && <AIDisclaimer />}
          </div>
        </div>
      </div> {/* End Block 1 */}

      {/* === Block 2: Learn More === */}
      <div className="bg-black rounded-lg shadow-md max-w-6xl mx-auto p-6 md:p-8 mt-6 mb-8">
        <h2 className={`text-2xl font-semibold ${BRONZE_COLOR} mb-6 text-center`}>
          Learn More
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-gray-800 rounded-md">
             <RelatedMediaList
                mediaItems={factorData.mediaItemMentions ?? []}
                isLoading={loading}
                error={error}
                emptyMessage="Not mentioned in any indexed media items."
             />
          </div>
          <div className="p-4 bg-gray-800 rounded-md">
             <OtherInvolvedPersonsList
                persons={relatedOIPs} // Uses its own state
                isLoading={loading} // Could use a specific loading state for OIPs if fetched separately
                error={error}       // Could use a specific error state for OIPs
                emptyMessage="No specific related people (experts, witnesses, etc.) linked to this factor."
             />
          </div>
          <div className="p-4 bg-gray-800 rounded-md">
            <OrganizationsMentionedList
                organizations={relatedOrgs} // Uses its own state
                isLoading={loading} // Could use a specific loading state for Orgs if fetched separately
                error={error}       // Could use a specific error state for Orgs
                emptyMessage="No specific organizations linked to addressing this factor."
            />
          </div>
        </div> {/* End Learn More Grid */}
      </div> {/* End Block 2 */}

      <PageNavigationButtons navigate={navigate} className="max-w-6xl mx-auto my-8" />
    </div>
  );
}

export default ContributingFactorsPage; // Renamed to match filename convention
