// src/pages/OtherIndividualProfilePage.jsx
import apiClient from '../apiClient'; // Adjust the path if apiClient.js is elsewhere
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// --- Import Icons ---
import { User, ArrowLeft, AlertCircle, Info, BookOpen, Users, Building, FileQuestion, ListTree, Loader2 } from 'lucide-react'; // Added Loader2 for consistency

// --- Import Components ---
import Breadcrumbs from '../components/Breadcrumbs';
import OipKeyInfo from '../components/OipKeyInfo';
import OipStoryNarrative from '../components/OipStoryNarrative';
import RelatedMediaList from '../components/RelatedMediaList';
import OrganizationsMentionedList from '../components/OrganizationsMentionedList';
import OtherSourcesList from '../components/OtherSourcesList';
import RelatedPeopleList from '../components/RelatedPeopleList';
import PageNavigationButtons from '../components/PageNavigationButtons';
import AIDisclaimer from '../components/AIDisclaimer';

// --- Import Theme Constants ---
import { BRONZE_COLOR, BRONZE_BORDER } from '../components/themeconstants';

// --- Helper Function to Format Role (Consider moving to utils) ---
const formatRole = (role) => {
    if (!role) return 'N/A';
    return role.split('_')
               .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
               .join(' ');
};

// --- Main OtherIndividualProfilePage Component ---
function OtherIndividualProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [personData, setPersonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for data requiring complex fetching/derivation
  const [otherSources, setOtherSources] = useState([]);
  const [relatedPeople, setRelatedPeople] = useState([]);

  // --- Effect: Fetch InvolvedPerson data from Backend API ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setPersonData(null);
      setOtherSources([]); // Reset these as they might depend on personData
      setRelatedPeople([]);  // Reset these as they might depend on personData

      const apiUrl = `/api/persons/${id}`;
      console.log(`Fetching OIP data from (using apiClient): ${apiUrl}`);

      try {
        const response = await apiClient.get(apiUrl);
       
        // With Axios, data is directly in response.data, no need for extra await
        const data = response.data; 
        setPersonData(data);

        // Log warnings if expected relations are missing from API response
        if (!data.mediaItemMentions) {
            console.warn(`API response for person ${id} missing 'mediaItemMentions'. Related Media list will be empty.`);
        }
        if (!data.affiliatedOrgs) {
            console.warn(`API response for person ${id} missing 'affiliatedOrgs'. Related Organizations list will be empty.`);
        }
         if (!data.involvedCases) { // This might be used for deriving relatedPeople
            console.warn(`API response for person ${id} missing 'involvedCases'. Related People list may be incomplete.`);
        }

        // --- Placeholder Logic for Other Sources & Related People ---
        // TODO: Implement actual logic using data.mediaItemMentions, data.involvedCases etc.
        // For example, if otherSources are derived from personData.sourceLinks:
        // if (data.sourceLinks) { setOtherSources(data.sourceLinks.map(...)); }
        console.warn("Placeholder: Other Sources data derivation needed.");
        setOtherSources([]); // Keep as placeholder for now

        console.warn("Placeholder: Related People data derivation needed.");
        setRelatedPeople([]); // Keep as placeholder for now

      } catch (err) {
                console.error("Fetch error for OIP:", err);
                let errorMessage = "An unknown error occurred while fetching this person's profile data.";
                if (err.response) {
                    console.error("Error response data:", err.response.data);
                    console.error("Error response status:", err.response.status);
                    errorMessage = err.response.data?.message || `Error: ${err.response.status} - ${err.response.statusText}`;
                } else if (err.request) {
                    console.error("Error request:", err.request);
                    errorMessage = "No response received from server. Please check your network connection.";
                } else {
                    console.error('Error message:', err.message);
                    errorMessage = err.message;
                }
                setError(errorMessage);
            }
            finally { 
                setLoading(false); 
            }
        };

    if (id) {
      fetchData();
    } else {
      setError("No person ID provided in URL.");
      setLoading(false);
    }
  }, [id]);

  // --- Construct Breadcrumbs ---
  const getBreadcrumbItems = () => {
    let items = [{ label: "Home", link: "/" }];
    if (loading) items.push({ label: "Loading Profile..." });
    else if (error) items.push({ label: "Error" });
    else if (personData) {
      const name = `${personData.firstName || ''} ${personData.lastName || ''}`.trim() || 'Person Profile';
      items.push({ label: name });
    } else items.push({ label: "Person Not Found" });
    return items;
  };

  // --- Prepare Data for Child Components ---
  const keyInfoData = personData ? {
    'Name': `${personData.firstName || ''} ${personData.lastName || ''}`.trim(),
    'Role': formatRole(personData.role),
    // Add other relevant OIP key facts here if available from API
  } : {};

  const storyData = personData?.notes ?? '';

  // --- Render Loading State ---
  if (loading) {
     return (
      <>
        <div className="w-full px-4 md:px-8 py-4"><Breadcrumbs items={getBreadcrumbItems()} /></div>
        <div className="min-h-screen flex flex-col items-center justify-center bg-black text-center py-20 text-gray-400">
            <Loader2 className="h-12 w-12 animate-spin text-amber-500 mb-4" />
            Loading person's profile...
        </div>
      </>
    );
  }

  // --- Render Error State ---
  if (error) {
     return (
      <>
        <div className="w-full px-4 md:px-8 py-4"><Breadcrumbs items={getBreadcrumbItems()} /></div>
        <div className="min-h-screen flex flex-col items-center justify-center bg-black text-center py-20 px-4 text-red-500">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error Loading Profile</h2>
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
  if (!personData) {
      return (
      <>
        <div className="w-full px-4 md:px-8 py-4"><Breadcrumbs items={getBreadcrumbItems()} /></div>
        <div className="min-h-screen flex flex-col items-center justify-center bg-black text-center py-20 text-gray-400">
          Person not found for ID: {id}.
        </div>
      </>
    );
  }

  // --- Render the OtherIndividualProfilePage Content ---
  const personName = `${personData.firstName || ''} ${personData.lastName || ''}`.trim() || 'Person Profile';

  return (
    <>
      <div className="w-full px-4 md:px-8 py-4">
        <Breadcrumbs items={getBreadcrumbItems()} />
      </div>

      {/* === Block 1: Profile (Key Facts & Story) === */}
      <div className="bg-black rounded-lg shadow-md max-w-6xl mx-auto p-6 md:p-8 mt-6 mb-8">
        <h1 className={`text-3xl md:text-4xl font-serif ${BRONZE_COLOR} text-center mb-8 uppercase`}>
          {personName}
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Sidebar: Key Facts */}
          <div className="md:col-span-1 p-6 bg-gray-800 rounded-md">
             <OipKeyInfo title="Key Facts" icon={Info} data={keyInfoData} isLoading={loading} />
          </div>
          {/* Main Section: Story / Notes */}
          <div className={`md:col-span-2 p-6 border ${BRONZE_BORDER} rounded-md bg-gray-900/30`}>
             <h2 className={`text-xl font-semibold ${BRONZE_COLOR} mb-4 flex items-center`}>
                <BookOpen className="mr-2 h-5 w-5" /> Profile Notes / Story
            </h2>
            <OipStoryNarrative storyText={storyData} isLoading={loading} />
            {personData.aiGenerated !== false && <AIDisclaimer />}
          </div>
        </div>
      </div> {/* End Block 1 */}

      {/* === Block 2: Learn More === */}
      <div className="bg-black rounded-lg shadow-md max-w-6xl mx-auto p-6 md:p-8 mt-6 mb-8">
        <h2 className={`text-2xl font-semibold ${BRONZE_COLOR} mb-6 text-center`}>
          Learn More
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Related Media Items Container */}
          <div className="p-4 bg-gray-800 rounded-md">
             <RelatedMediaList
                mediaItems={personData.mediaItemMentions ?? []}
                isLoading={loading} // Pass main loading state, or implement separate loading for these sections
                error={error}       // Pass main error state, or implement separate error for these sections
                emptyMessage="Not mentioned in any indexed media items."
             />
          </div>
          {/* Related Organizations Container */}
          <div className="p-4 bg-gray-800 rounded-md">
             <OrganizationsMentionedList
                organizations={personData.affiliatedOrgs ?? []}
                isLoading={loading}
                error={error}
                emptyMessage="No affiliated organizations listed."
            />
          </div>
          {/* Other Sources Container - Placeholder */}
          <div className="p-4 bg-gray-800 rounded-md">
             <h3 className={`text-lg font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
                <FileQuestion className="mr-2 h-5 w-5" /> Other Sources
            </h3>
             <OtherSourcesList
                sources={otherSources} // Uses state variable, which is currently placeholder
                isLoading={loading}    // Consider if separate loading/error states are needed for these derived/future fetches
                error={error}
                emptyMessage="Other sources data requires specific implementation."
             />
          </div>
          {/* Related People Container - Placeholder */}
          <div className="p-4 bg-gray-800 rounded-md">
             <h3 className={`text-lg font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
                <Users className="mr-2 h-5 w-5" /> Related People
            </h3>
              <RelatedPeopleList
                people={relatedPeople} // Uses state variable, which is currently placeholder
                isLoading={loading}
                error={error}
                emptyMessage="Related people data requires specific implementation."
              />
          </div>
        </div> {/* End Learn More Grid */}
      </div> {/* End Block 2 */}

      <PageNavigationButtons navigate={navigate} className="max-w-6xl mx-auto my-8" />
    </>
  );
}

export default OtherIndividualProfilePage;
