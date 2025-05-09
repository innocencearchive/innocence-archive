/* ========================================================================== */
/* --- File: src/pages/MediaWorkPage.jsx (Refactored v2) ---                  */
/* --- Separates WC/OIP lists, new layout block ---                         */
/* ========================================================================== */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// --- Import Icons ---
import { ArrowLeft, AlertCircle, BookOpen, Tv, Mic, Clapperboard, Building, ListTree, Info } from 'lucide-react'; // Added Building

// --- Import Theme Constants ---
import { BRONZE_BORDER, BRONZE_COLOR } from '../components/themeconstants';

// --- Import Sub-Components ---
import Breadcrumbs from '../components/Breadcrumbs';
// Block 1 Components
import WorkDetails from '../components/WorkDetails';
import WorkSummaryDisplay from '../components/WorkSummaryDisplay';
// Block 1.5 Component (NEW LOCATION)
import WrongfullyConvictedList from '../components/WrongfullyConvictedList'; // Renamed from IndividualsMentionedList
// Block 2 Components
import ItemList from '../components/ItemList'; // Using ItemList for Episodes
import OrganizationsMentionedList from '../components/OrganizationsMentionedList';
import ContributingFactorsList from '../components/ContributingFactorsList';
import OtherSourcesList from '../components/OtherSourcesList';
import OtherInvolvedPersonsList from '../components/OtherInvolvedPersonsList'; // New component for OIPs
import AIDisclaimer from '../components/AIDisclaimer';

// --- Helper Functions ---
const getMediaTypeIcon = (mediaType) => { /* ... icon mapping ... */
    switch (mediaType) {
        case 'BOOK': return <BookOpen size={20} className="inline mr-2" />;
        case 'FILM': case 'DOCUMENTARY': case 'DOCUSERIES': return <Clapperboard size={20} className="inline mr-2" />;
        case 'PODCAST_SERIES': return <Mic size={20} className="inline mr-2" />;
        case 'TV_SERIES': return <Tv size={20} className="inline mr-2" />;
        default: return null;
    }
};
const formatMediaType = (mediaType) => { /* ... type formatting ... */
    if (!mediaType) return 'Unknown Type';
    return mediaType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};


// --- Main MediaWorkPage Component ---
function MediaWorkPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    // --- State Hooks ---
    const [workData, setWorkData] = useState(null);
    const [loadingWork, setLoadingWork] = useState(true);
    const [errorWork, setErrorWork] = useState(null);

    // State for Wrongfully Convicted Individuals
    const [wrongfullyConvicted, setWrongfullyConvicted] = useState([]);
    const [loadingWC, setLoadingWC] = useState(false);
    const [errorWC, setErrorWC] = useState(null);

    // State for Other Involved Persons
    const [otherInvolvedPersons, setOtherInvolvedPersons] = useState([]);
    const [loadingOIPs, setLoadingOIPs] = useState(false);
    const [errorOIPs, setErrorOIPs] = useState(null);

    // State for Factors (assuming fetched separately for consistency)
    const [relatedFactors, setRelatedFactors] = useState([]);
    const [loadingFactors, setLoadingFactors] = useState(false);
    const [errorFactors, setErrorFactors] = useState(null);

    // State for Organizations (assuming fetched separately)
    const [relatedOrganizations, setRelatedOrganizations] = useState([]);
    const [loadingOrganizations, setLoadingOrganizations] = useState(false);
    const [errorOrganizations, setErrorOrganizations] = useState(null);

    // State for Other Sources (assuming fetched separately or part of workData)
    const [otherSources, setOtherSources] = useState([]);
    const [loadingSources, setLoadingSources] = useState(false);
    const [errorSources, setErrorSources] = useState(null);


    // --- Effect 1: Fetch main MediaWork data (including items/episodes) ---
    useEffect(() => {
        const fetchWorkData = async () => {
            setLoadingWork(true); setErrorWork(null); setWorkData(null);
            // Reset related data states
            setWrongfullyConvicted([]); setErrorWC(null);
            setOtherInvolvedPersons([]); setErrorOIPs(null);
            setRelatedFactors([]); setErrorFactors(null);
            setRelatedOrganizations([]); setErrorOrganizations(null);
            setOtherSources([]); setErrorSources(null);

            const apiUrl = `http://localhost:3001/api/mediaworks/${id}?include=items`; // Ensure items are included
            console.log(`Fetching main work data from: ${apiUrl}`);
            try {
                const response = await fetch(apiUrl);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                setWorkData(data);
                // If other sources are part of workData, set them here
                // setOtherSources(data.otherSourcesField || []);
            } catch (err) { console.error("Fetch work error:", err); setErrorWork(err.message); }
            finally { setLoadingWork(false); }
        };
        if (id) { fetchWorkData(); }
        else { setErrorWork("No media work ID provided."); setLoadingWork(false); }
    }, [id]);

    // --- Effect 2: Fetch related data AFTER workData is loaded ---
    useEffect(() => {
        if (!workData?.id) return;
        const workId = workData.id;

        // Fetch Wrongfully Convicted Individuals
        const fetchWC = async () => {
            setLoadingWC(true); setErrorWC(null);
            const wcApiUrl = `http://localhost:3001/api/mediaworks/${workId}/individuals`; // Endpoint for WC
            try {
                const response = await fetch(wcApiUrl);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                setWrongfullyConvicted(data);
            } catch (err) { console.error("Fetch WC error:", err); setErrorWC(err.message); setWrongfullyConvicted([]); }
            finally { setLoadingWC(false); }
        };

        // Fetch Other Involved Persons
        const fetchOIPs = async () => {
            setLoadingOIPs(true); setErrorOIPs(null);
            const oipsApiUrl = `http://localhost:3001/api/mediaworks/${workId}/involvedpersons`; // Endpoint for OIPs
            try {
                const response = await fetch(oipsApiUrl);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                setOtherInvolvedPersons(data);
            } catch (err) { console.error("Fetch OIPs error:", err); setErrorOIPs(err.message); setOtherInvolvedPersons([]); }
            finally { setLoadingOIPs(false); }
        };

        // Fetch Factors
        const fetchFactors = async () => {
            setLoadingFactors(true); setErrorFactors(null);
            const factorsApiUrl = `http://localhost:3001/api/mediaworks/${workId}/factors`;
            try {
                const response = await fetch(factorsApiUrl);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                setRelatedFactors(data);
            } catch (err) { console.error("Fetch factors error:", err); setErrorFactors(err.message); setRelatedFactors([]); }
            finally { setLoadingFactors(false); }
        };

        // Fetch Organizations
        const fetchOrganizations = async () => {
             setLoadingOrganizations(true); setErrorOrganizations(null);
             const orgsApiUrl = `http://localhost:3001/api/mediaworks/${workId}/organizations`;
             try {
                 const response = await fetch(orgsApiUrl);
                 if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                 const data = await response.json();
                 setRelatedOrganizations(data);
             } catch (err) { console.error("Fetch organizations error:", err); setErrorOrganizations(err.message); setRelatedOrganizations([]); }
             finally { setLoadingOrganizations(false); }
         };

        // Fetch Other Sources (if not part of main workData)
         const fetchSources = async () => {
             setLoadingSources(true); setErrorSources(null);
             const sourcesApiUrl = `http://localhost:3001/api/mediaworks/${workId}/othersources`; // Example endpoint
             try {
                 // If sources are fetched separately:
                 // const response = await fetch(sourcesApiUrl);
                 // if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                 // const data = await response.json();
                 // setOtherSources(data);

                 // If sources are part of workData (already set in Effect 1), maybe just set loading false
                 setLoadingSources(false); // Example if already loaded
             } catch (err) { console.error("Fetch sources error:", err); setErrorSources(err.message); setOtherSources([]); setLoadingSources(false); }
             // finally { setLoadingSources(false); } // Use if fetch is async
         };

        // Call all fetch functions
        fetchWC();
        fetchOIPs();
        fetchFactors();
        fetchOrganizations();
        fetchSources();

    }, [workData]); // Depend only on workData

    // --- Breadcrumb Logic ---
    let breadcrumbItems = [{ label: "Home", link: "/" }];
    const workTitle = workData?.title ?? 'Media Work';
    if (loadingWork) breadcrumbItems.push({ label: "Loading..." });
    else if (errorWork) breadcrumbItems.push({ label: "Error" });
    else if (workData) breadcrumbItems.push({ label: workTitle });
    else breadcrumbItems.push({ label: "Not Found" });

    // --- Loading State ---
    if (loadingWork) { /* ... loading JSX ... */
         return ( <div className="bg-black text-gray-400 p-8 rounded-lg shadow-lg text-center"><p>Loading media work...</p></div> );
    }
    // --- Error State ---
    if (errorWork) { /* ... error JSX ... */
         return ( <div className="bg-black text-red-500 p-8 rounded-lg shadow-lg text-center"><div className="w-full px-4 md:px-8 py-4"><Breadcrumbs items={breadcrumbItems} /></div><AlertCircle className="mx-auto h-12 w-12 text-red-400 my-4" /><h2 className="text-xl font-semibold mb-2">Error Loading Media Work</h2><p className="text-sm">{errorWork}</p><button onClick={() => navigate(-1)} className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"><ArrowLeft className="mr-2 h-5 w-5" /> Go Back</button></div> );
    }
    // --- Not Found State ---
    if (!workData) { /* ... not found JSX ... */
         return ( <div className="bg-black text-gray-400 p-8 rounded-lg shadow-lg text-center"><div className="w-full px-4 md:px-8 py-4"><Breadcrumbs items={breadcrumbItems} /></div><p>Media work data not available.</p></div> );
    }

    // --- Render MediaWork Page ---
    const formattedType = formatMediaType(workData.workType);
    const itemListLabel = workData.workType === 'BOOK' ? 'Content' : 'Episodes'; // Adjust label for ItemList

    return (
        <div className="text-gray-50 bg-black rounded-lg shadow-lg overflow-hidden">
            {/* Header Area / Breadcrumbs */}
            <div className="w-full px-4 md:px-8 py-4">
                <Breadcrumbs items={breadcrumbItems} />
            </div>

            {/* === BLOCK 1: Summary / Details === */}
            <div className="flex flex-col items-center justify-start px-4 md:px-8 pt-16 pb-8"> {/* Reduced bottom padding */}
                <div className="w-full">
                    {/* Main Title & Type */}
                    <h1 className={`text-4xl md:text-5xl ${BRONZE_COLOR} mb-4 text-center font-serif font-bold tracking-wider uppercase`}>
                        {workTitle}
                    </h1>
                    <p className="text-center text-lg text-gray-400 mb-12">
                        {getMediaTypeIcon(workData.workType)} {formattedType}
                    </p>
                    {/* Two-column grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
                        {/* Details Sidebar (Left) */}
                        <div className="lg:col-span-1 order-last lg:order-first bg-gray-800 p-6 rounded-lg shadow-lg">
                            <WorkDetails work={workData} />
                        </div>
                        {/* Summary (Right) */}
                        <div className={`lg:col-span-2 border ${BRONZE_BORDER} p-6 rounded-lg shadow-lg`}>
                            <WorkSummaryDisplay summaryText={workData.summaryNotes} />
							
                            {/* *** ADDED AI DISCLAIMER HERE *** */}
                            {/* Show disclaimer if aiGenerated is true (or null/undefined if using default) */}
                            {/* Ensure individualData includes the 'aiGenerated' field from your API */}
                            {workData.aiGenerated !== false && <AIDisclaimer />}
                            {/* Using !== false allows it to show if true OR if the field is missing (null/undefined) */}
                        </div>
                    </div>
                </div>
            </div>

            {/* === **NEW** BLOCK 1.5: Wrongfully Convicted Individuals Mentioned === */}
            <div className="flex flex-col items-center justify-start px-4 md:px-8 py-8"> {/* Adjusted padding */}
                <div className="w-full">
                     {/* Container div */}
                     <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                        <WrongfullyConvictedList
                            individuals={wrongfullyConvicted}
                            isLoading={loadingWC}
                            error={errorWC}
                        />
                    </div>
                </div>
            </div>

            {/* === BLOCK 2: Learn More === */}
            <div className="flex flex-col items-center justify-start px-4 md:px-8 pt-8 pb-16"> {/* Adjusted padding */}
                <div className="w-full">
                    <h2 className={`text-3xl md:text-4xl font-semibold mb-10 text-center ${BRONZE_COLOR}`}>Learn More</h2>
                    {/* Grid layout - adjust cols as needed */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                        {/* Episodes (Spans 2 cols) */}
                        <div className="md:col-span-2">
                            {/* Container div */}
                            <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                                {/* Using ItemList for episodes */}
                                <ItemList
                                    items={workData.items ?? []}
                                    itemTypeLabel={itemListLabel}
                                    // Pass loading/error if ItemList supports them
                                />
                            </div>
                        </div>

                        {/* Other Involved Persons (NEW in this block) */}
                        {/* Container div */}
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <OtherInvolvedPersonsList
                                people={otherInvolvedPersons}
                                isLoading={loadingOIPs}
                                error={errorOIPs}
                            />
                        </div>

                        {/* Related Organizations Mentioned */}
                        {/* Container div */}
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                             <OrganizationsMentionedList
                                 organizations={relatedOrganizations}
                                 isLoading={loadingOrganizations}
                                 error={errorOrganizations}
                             />
                         </div>

                        {/* Contributing Factors */}
                        {/* Container div */}
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                             <ContributingFactorsList
                                factors={relatedFactors}
                                isLoading={loadingFactors}
                                error={errorFactors}
                             />
                        </div>

                        {/* Other Sources */}
                        {/* Container div */}
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                             <OtherSourcesList
                                 sources={otherSources}
                                 isLoading={loadingSources}
                                 error={errorSources}
                             />
                        </div>
                    </div>
                </div>
            </div>
        </div> 
    );
}

export default MediaWorkPage;
