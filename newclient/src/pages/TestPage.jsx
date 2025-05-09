// src/pages/IndividualProfilePage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Import hooks for routing

// --- Import Icons ---
// Assuming lucide-react is installed
import { ArrowLeft, AlertCircle } from 'lucide-react';

// --- Import Sub-Components ---
// Assuming these components have been moved to separate files (e.g., under src/components/)
// You will need to create these files and move the corresponding JSX into them.
import Breadcrumbs from '../components/Breadcrumbs'; // Example path
import CaseSummary from '../components/CaseSummary'; // Example path
import KeyInfo from '../components/KeyInfo';       // Example path
import StoryNarrative from '../components/StoryNarrative'; // Example path
import LearnMoreGrid from '../components/LearnMoreGrid';   // Example path
import OrganizationsInvolved from '../components/OrganizationsInvolved'; // Example path
import PageNavigationButtons from '../components/PageNavigationButtons'; // Example path
import Individuals from '../components/Individuals';
// Note: PageNavigationButtons is defined internally below to easily access 'navigate'

// --- Mock Data (For Simulation) ---
// In a real app, this fetch logic would hit your API.
// Keep this mock data definition accessible for the simulation logic below.
const mockDatabase = {
  "jane-doe": {
    id: "jane-doe",
    name: "Jane Doe",
    caseSummary: "Jane Doe was wrongfully convicted in 1995 for a robbery she did not commit, based largely on mistaken eyewitness identification...",
    keyInfo: { state: "California", county: "Los Angeles", convictionYear: 1995, exonerationYear: 2010, status: "Exonerated", timeServed: "15 years", crimeConvictedOf: ["Robbery", "Assault"], contributingFactors: [{ id: 1, name: "Eyewitness Misidentification", link: "#factor-1" }, { id: 2, name: "Inadequate Legal Defense", link: "#factor-2" }] },
    story: [{ id: 's1', subheading: "The Crime", text: "On the evening of May 10th, 1994..." }, { id: 's2', subheading: "Investigation & Trial", text: "Several days later, Jane Doe was stopped..." }, { id: 's3', subheading: "The Fight for Innocence", text: "Jane maintained her innocence..." }, { id: 's4', subheading: "Exoneration & Life After", text: "In 2010, a judge reviewed the new evidence..." }],
    media: { books: [{ id: 'b1', title: "Justice Delayed: Jane Doe's Story", author: "Fictional Author", link: "#book-1" }], films: [{ id: 'f1', title: "Fifteen Years Lost", director: "Docu Productions", link: "#film-1" }], podcasts: [{ id: 'p1', series: "True Convictions", episode: "The Case of Jane Doe", link: "#podcast-1" }], articles: [{ id: 'a1', title: "Reviewing the Jane Doe Exoneration", source: "Local Law Journal", link: "#article-1" }] },
    organizations: [{ id: 'o1', name: "California Innocence Project", link: "#org-1" }, { id: 'o2', name: "After Innocence", link: "#org-2" }]
  },
  "richard-roe": {
     id: "richard-roe",
     name: "Richard Roe",
     caseSummary: "Richard Roe was convicted of arson in 2001 despite weak evidence...",
     // ... fill in other details for Richard Roe ...
     keyInfo: { state: "Michigan", county: "Kent", convictionYear: 2001, exonerationYear: null, status: "Active Appeal", timeServed: "23 years+", crimeConvictedOf: ["Arson"], contributingFactors: [{ id: 3, name: "Faulty Forensics", link: "#factor-3" }] },
     story: [{ id: 'rr1', subheading: "The Incident", text: "A fire broke out..." }],
     media: { books: [], films: [], podcasts: [], articles: [] },
     organizations: [{ id: 'o3', name: "Michigan Innocence Clinic", link: "#org-3" }]
  }
  // Add more mock profiles as needed
};

const findMockDataById = async (profileId) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  // Simulate API lookup
  if (mockDatabase[profileId]) {
    return mockDatabase[profileId];
  } else {
    throw new Error(`Profile not found for ID: ${profileId}`);
  }
};
// --- End Mock Data ---


// --- Main Individual Profile Page Component ---
function IndividualProfilePage() {
  const { id } = useParams(); // Get the 'id' parameter from the URL (e.g., "jane-doe")
  const navigate = useNavigate(); // Hook for programmatic navigation (e.g., back button)

  // State for fetched data, loading status, and errors
  const [individualData, setIndividualData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch data when the component mounts or the ID changes
  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        setError(null); // Reset error on new fetch
        try {
          // --- Replace this with your actual API call ---
          console.log(`Fetching data for profile ID: ${id}`);
          // Example: const response = await fetch(`/api/individuals/${id}`);
          // if (!response.ok) throw new Error('Network response was not ok');
          // const data = await response.json();

          // --- Using mock data simulation ---
          const data = await findMockDataById(id);
          setIndividualData(data);
          // --- End simulation ---

        } catch (err) {
          console.error("Fetch error:", err);
          setError(err.message);
        } finally {
          setLoading(false);
        }
    };

    fetchData();
  }, [id]); // Dependency array: re-run effect if the ID from the URL changes

  // --- Define PageNavigationButtons internally to access navigate ---
  // Alternatively, pass 'navigate' as a prop if this becomes a separate component

  // --- Render Loading State ---
  if (loading) {
    // You might want a more sophisticated loading spinner component later
    return <div className="text-center py-20 text-gray-400">Loading profile...</div>;
  }

  // --- Render Error State ---
  if (error) {
     return <div className="text-center py-20 text-red-500">Error loading profile: {error}</div>;
  }

  // --- Render Not Found State ---
   if (!individualData) {
     // This case might be redundant if the fetch simulation throws an error,
     // but good practice for real API calls where the API might return null/empty.
     return <div className="text-center py-20 text-gray-400">Profile not found.</div>;
   }

  // --- Render the Profile Page with Fetched Data ---
  return (
    // Using React Fragment because Header/Footer are handled by App.jsx
    <>
      {/* Breadcrumbs specific to this page */}
      <Breadcrumbs name={individualData.name} />

      {/* Main content container */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 mt-6">
        {/* Profile Header */}
        <h1 className="text-3xl md:text-4xl font-bold text-gray-50 mb-4 text-center">{individualData.name}</h1>
        <p className="text-lg text-amber-500 mb-6 text-center">Case Profile</p>

        {/* Case Summary Section */}
        <CaseSummary summary={individualData.caseSummary} />

        {/* Main content grid (Story + Key Info) */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Key Info Sidebar */}
          <div className="lg:col-span-1 order-last lg:order-first">
            <KeyInfo info={individualData.keyInfo} />
          </div>
          {/* Story Narrative */}
          <div className="lg:col-span-2">
             <StoryNarrative storySections={individualData.story} />
          </div>
        </div>

        {/* Learn More / Media Grid */}
        <LearnMoreGrid media={individualData.media} />

        {/* Organizations Involved */}
        <OrganizationsInvolved organizations={individualData.organizations} />

        {/* Page Navigation */}
        <PageNavigationButtons navigate={navigate} />
      </div>
    </>
  );
}

export default IndividualProfilePage;
