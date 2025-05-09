// src/pages/ContributingFactorPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// --- Import Icons ---
import { Users, List, ArrowLeft, AlertCircle, FileText, Building, UserCheck } from 'lucide-react';

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
import { BRONZE_COLOR, BRONZE_BORDER } from '../components/themeConstants';
import AIDisclaimer from '../components/AIDisclaimer';

// --- Main ContributingFactorPage Component ---
function ContributingFactorPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // State variables (remain the same)
  const [factorData, setFactorData] = useState(null);
  const [relatedOIPs, setRelatedOIPs] = useState([]);
  const [relatedOrgs, setRelatedOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Effect: Fetch All Data (remains the same as v4) ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setFactorData(null);
      setRelatedOIPs([]);
      setRelatedOrgs([]);

      const apiUrl = `http://localhost:3001/api/contributingfactors/${id}`;
      console.log(`Fetching contributing factor data (incl. relations) from: ${apiUrl}`);

      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`HTTP error! status: ${response.status} - ${errorData.message || 'Failed to fetch contributing factor data'}`);
        }
        const data = await response.json();

        setFactorData(data);
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
        console.error("Fetch error:", err);
        setError(err.message);
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

  // --- Construct Breadcrumbs (remains the same) ---
  const getBreadcrumbItems = () => {
      let items = [{ label: "Home", link: "/" }];
      if (loading) items.push({ label: "Loading Factor..." });
      else if (error) items.push({ label: "Error" });
      else if (factorData) items.push({ label: factorData.name ?? 'Factor Details' });
      else items.push({ label: "Factor Not Found" });
      return items;
  };

  // --- Render Loading State (remains the same) ---
  if (loading) {
       return (
          <>
              <Breadcrumbs items={getBreadcrumbItems()} />
              <div className="text-center py-20 text-gray-400">Loading contributing factor details...</div>
          </>
      );
  }

  // --- Render Error State (remains the same) ---
  if (error) {
       return (
          <>
              <Breadcrumbs items={getBreadcrumbItems()} />
              <div className="text-center py-20 px-4 text-red-500 bg-black rounded-lg shadow-md max-w-4xl mx-auto mt-4">
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

   // --- Render Not Found State (remains the same) ---
   if (!factorData) {
        return (
           <>
               <Breadcrumbs items={getBreadcrumbItems()} />
               <div className="text-center py-20 text-gray-400 bg-black rounded-lg shadow-md max-w-4xl mx-auto mt-4">
                   Contributing factor not found.
               </div>
           </>
        );
   }


  // --- Render the ContributingFactor Page Content ---
  return (
    <>
      {/* Render breadcrumbs outside the main content blocks */}
      <Breadcrumbs items={getBreadcrumbItems()} />

      {/* === Block 1: Description & Related WC Cases === */}
      <div className="bg-black rounded-lg shadow-md max-w-6xl mx-auto p-6 md:p-8 mt-6 mb-8">
        {/* Factor Header - UPDATED STYLING */}
        <h1 className={`text-3xl md:text-4xl font-serif ${BRONZE_COLOR} text-center mb-8 uppercase`}>
          {factorData.name ?? 'Unnamed Factor'}
        </h1>

        {/* Layout Grid: Description (Sidebar - Left 1/3) and WC Cases (Main - Right 2/3) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Sidebar: Description */}
          <div className="md:col-span-1 p-6 bg-gray-800 rounded-md">
            {/* Title for Description Section */}
            <h2 className={`text-xl font-semibold ${BRONZE_COLOR} mb-4 flex items-center`}>
              <FileText className="mr-2 h-5 w-5" /> Description
            </h2>
            <p className="text-gray-300 whitespace-pre-wrap text-sm">
              {factorData.description?.trim() ? factorData.description : 'No description provided.'}
            </p>
          </div>

          {/* Main Section: Related Wrongfully Convicted Cases */}
          <div className={`md:col-span-2 p-6 border ${BRONZE_BORDER} rounded-md bg-gray-900/30`}>
             {/* REMOVED the H2 from here - WrongfullyConvictedList has its own title */}
             {/* Use individualCases from factorData */}
            <WrongfullyConvictedList
              individuals={factorData.individualCases ?? []}
              isLoading={loading}
              error={error} // Pass error state down
              emptyMessage="No wrongfully convicted cases directly linked to this factor found."
            />
			
                            {/* *** ADDED AI DISCLAIMER HERE *** */}
                            {/* Show disclaimer if aiGenerated is true (or null/undefined if using default) */}
                            {/* Ensure individualData includes the 'aiGenerated' field from your API */}
                            {factorData.aiGenerated !== false && <AIDisclaimer />}
                            {/* Using !== false allows it to show if true OR if the field is missing (null/undefined) */}
          </div>
        </div>
      </div> {/* End Block 1 */}

      {/* === Block 2: Learn More === */}
      <div className="bg-black rounded-lg shadow-md max-w-6xl mx-auto p-6 md:p-8 mt-6 mb-8">
        {/* Title for the Learn More Block */}
        <h2 className={`text-2xl font-semibold ${BRONZE_COLOR} mb-6 text-center`}>
          Learn More
        </h2>

        {/* Grid for Learn More Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Related Media Items Container */}
          <div className="p-4 bg-gray-800 rounded-md">
             <RelatedMediaList
                mediaItems={factorData.mediaItemMentions ?? []}
                isLoading={loading}
                error={error}
                emptyMessage="Not mentioned in any indexed media items."
             />
          </div>

          {/* Related Other Involved Persons (OIPs) Container */}
          <div className="p-4 bg-gray-800 rounded-md">
             <OtherInvolvedPersonsList
                persons={relatedOIPs}
                isLoading={loading}
                error={error}
                emptyMessage="No specific related people (experts, witnesses, etc.) linked to this factor."
             />
          </div>

          {/* Related Organizations Container */}
          <div className="p-4 bg-gray-800 rounded-md">
            <OrganizationsMentionedList
                organizations={relatedOrgs}
                isLoading={loading}
                error={error}
                emptyMessage="No specific organizations linked to addressing this factor."
            />
          </div>

        </div> {/* End Learn More Grid */}
      </div> {/* End Block 2 */}

      {/* Optional: Navigation Buttons at the bottom */}
      <PageNavigationButtons navigate={navigate} className="max-w-6xl mx-auto my-8" />
    </>
  );
}

export default ContributingFactorPage;
