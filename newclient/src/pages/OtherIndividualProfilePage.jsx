// src/pages/OtherIndividualProfilePage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// --- Import Icons ---
import { User, ArrowLeft, AlertCircle, Info, BookOpen, Users, Building, FileQuestion, ListTree } from 'lucide-react'; // Added ListTree

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
import { BRONZE_COLOR, BRONZE_BORDER } from '../components/themeConstants';

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
      setOtherSources([]);
      setRelatedPeople([]);

      const apiUrl = `http://localhost:3001/api/persons/${id}`;
      console.log(`Fetching OIP data from: ${apiUrl}`);

      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`HTTP error! status: ${response.status} - ${errorData.message || 'Failed to fetch person data'}`);
        }
        const data = await response.json();
        setPersonData(data);

        // Log warnings if expected relations are missing from API response
        if (!data.mediaItemMentions) {
            console.warn(`API response for person ${id} missing 'mediaItemMentions'. Related Media list will be empty.`);
        }
        if (!data.affiliatedOrgs) {
            console.warn(`API response for person ${id} missing 'affiliatedOrgs'. Related Organizations list will be empty.`);
        }
         if (!data.involvedCases) {
            console.warn(`API response for person ${id} missing 'involvedCases'. Related People list may be incomplete.`);
        }


        // --- Placeholder Logic for Other Sources & Related People ---
        // TODO: Implement actual logic using data.mediaItemMentions, data.involvedCases etc.
        console.warn("Placeholder: Other Sources data derivation needed.");
        setOtherSources([]);

        console.warn("Placeholder: Related People data derivation needed.");
        setRelatedPeople([]);

      } catch (err) {
        console.error("Fetch error:", err);
        setError(err.message);
      } finally {
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
    // ... loading JSX ...
     return (
      <>
        <Breadcrumbs items={getBreadcrumbItems()} />
        <div className="text-center py-20 text-gray-400">Loading person's profile...</div>
      </>
    );
  }

  // --- Render Error State ---
  if (error) {
    // ... error JSX ...
     return (
      <>
        <Breadcrumbs items={getBreadcrumbItems()} />
        <div className="text-center py-20 px-4 text-red-500 bg-black rounded-lg shadow-md max-w-4xl mx-auto mt-4">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400 my-4" />
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
    // ... not found JSX ...
      return (
      <>
        <Breadcrumbs items={getBreadcrumbItems()} />
        <div className="text-center py-20 text-gray-400 bg-black rounded-lg shadow-md max-w-4xl mx-auto mt-4">
          Person not found.
        </div>
      </>
    );
  }

  // --- Render the OtherIndividualProfilePage Content ---
  const personName = `${personData.firstName || ''} ${personData.lastName || ''}`.trim() || 'Person Profile';

  return (
    <>
      <Breadcrumbs items={getBreadcrumbItems()} />

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
			
                            {/* *** ADDED AI DISCLAIMER HERE *** */}
                            {/* Show disclaimer if aiGenerated is true (or null/undefined if using default) */}
                            {/* Ensure individualData includes the 'aiGenerated' field from your API */}
                            {personData.aiGenerated !== false && <AIDisclaimer />}
                            {/* Using !== false allows it to show if true OR if the field is missing (null/undefined) */}
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
             {/* RelatedMediaList expects 'mediaItems' prop */}
             <RelatedMediaList
                mediaItems={personData.mediaItemMentions ?? []} // Use nullish coalescing
                isLoading={loading}
                error={error}
                emptyMessage="Not mentioned in any indexed media items."
             />
          </div>
          {/* Related Organizations Container */}
          <div className="p-4 bg-gray-800 rounded-md">
             {/* OrganizationsMentionedList expects 'organizations' prop */}
             <OrganizationsMentionedList
                organizations={personData.affiliatedOrgs ?? []} // Use nullish coalescing
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
             {/* OtherSourcesList expects 'sources' prop */}
             <OtherSourcesList
                sources={otherSources}
                isLoading={loading}
                error={error}
                emptyMessage="Other sources data requires specific implementation."
             />
          </div>
          {/* Related People Container - Placeholder */}
          <div className="p-4 bg-gray-800 rounded-md">
             <h3 className={`text-lg font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
                <Users className="mr-2 h-5 w-5" /> Related People
            </h3>
              {/* RelatedPeopleList expects 'people' prop */}
              <RelatedPeopleList
                people={relatedPeople}
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
