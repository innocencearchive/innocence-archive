/* ========================================================================== */
/* --- File: src/pages/MediaItemPage.jsx (Refactored Block Design v2) ---   */
/* --- Integrates RelatedMediaList & ExternalSourcesList correctly ---      */
/* ========================================================================== */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

// --- Import Icons ---
import { ArrowLeft, AlertCircle, BookOpen, Tv, Mic, Clapperboard, Link as LinkIcon, Users, Building, Info, FileText, ListTree, Loader2 } from 'lucide-react'; // Added Loader2

// --- Import Theme Constants ---
import { BRONZE_BORDER, BRONZE_COLOR } from '../components/themeconstants';

// --- Import Sub-Components ---
import Breadcrumbs from '../components/Breadcrumbs';
// Block 1 Components
import ItemDetails from '../components/ItemDetails';
import ItemSummaryDisplay from '../components/ItemSummaryDisplay';
// Block 1.5 Component
import WrongfullyConvictedList from '../components/WrongfullyConvictedList';
// Block 2 Components ("Learn More")
import RelatedMediaList from '../components/RelatedMediaList'; // For related media links (M2M)
import OtherInvolvedPersonsList from '../components/OtherInvolvedPersonsList';
import OrganizationsMentionedList from '../components/OrganizationsMentionedList';
import ContributingFactorsList from '../components/ContributingFactorsList';
import ExternalSourcesList from '../components/ExternalSourcesList'; // UPDATED: Use ExternalSourcesList
import AIDisclaimer from '../components/AIDisclaimer';

// --- Helper Functions ---
const getMediaTypeIcon = (mediaType) => {
    switch (mediaType) {
        case 'PODCAST_EPISODE': return <Mic size={20} className="inline mr-2" />;
        case 'TV_EPISODE': return <Tv size={20} className="inline mr-2" />;
        case 'BOOK_CONTENT': case 'BOOK_CHAPTER': return <BookOpen size={20} className="inline mr-2" />;
        case 'FILM_CONTENT': case 'DOCUMENTARY_CONTENT': return <Clapperboard size={20} className="inline mr-2" />;
        default: return <FileText size={20} className="inline mr-2" />;
    }
};
const formatMediaType = (mediaType) => {
    if (!mediaType) return 'Unknown Type';
    return mediaType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};


// --- Main MediaItemPage Component ---
function MediaItemPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    // --- State Hooks ---
    const [itemData, setItemData] = useState(null);
    const [loadingItem, setLoadingItem] = useState(true);
    const [errorItem, setErrorItem] = useState(null);

    const [wrongfullyConvicted, setWrongfullyConvicted] = useState([]);
    const [loadingWC, setLoadingWC] = useState(false);
    const [errorWC, setErrorWC] = useState(null);

    const [otherInvolvedPersons, setOtherInvolvedPersons] = useState([]);
    const [loadingOIPs, setLoadingOIPs] = useState(false);
    const [errorOIPs, setErrorOIPs] = useState(null);

    const [relatedOrganizations, setRelatedOrganizations] = useState([]);
    const [loadingOrganizations, setLoadingOrganizations] = useState(false);
    const [errorOrganizations, setErrorOrganizations] = useState(null);

    const [relatedFactors, setRelatedFactors] = useState([]);
    const [loadingFactors, setLoadingFactors] = useState(false);
    const [errorFactors, setErrorFactors] = useState(null);

    // UPDATED: Renamed state variable for clarity, matches component prop
    const [externalSources, setExternalSources] = useState([]);
    const [loadingSources, setLoadingSources] = useState(false);
    const [errorSources, setErrorSources] = useState(null);

    // UPDATED: Renamed state variable for clarity, matches component prop
    const [relatedMediaItems, setRelatedMediaItems] = useState([]);
    const [loadingMedia, setLoadingMedia] = useState(false);
    const [errorMedia, setErrorMedia] = useState(null);


    // --- Effect 1: Fetch main MediaItem data (including parent work) ---
    useEffect(() => {
        const fetchItemData = async () => {
            setLoadingItem(true); setErrorItem(null); setItemData(null);
            // Reset related data states
            setWrongfullyConvicted([]); setErrorWC(null);
            setOtherInvolvedPersons([]); setErrorOIPs(null);
            setRelatedOrganizations([]); setErrorOrganizations(null);
            setRelatedFactors([]); setErrorFactors(null);
            setExternalSources([]); setErrorSources(null); // Reset external sources
            setRelatedMediaItems([]); setErrorMedia(null); // Reset related media

            // Fetch core item data + parent work
            // NOTE: Changed API endpoint slightly - removed '?include=work' as the base endpoint now includes it
            const apiUrl = `http://localhost:3001/api/mediaitems/${id}`;
            console.log(`Fetching main item data from: ${apiUrl}`);
            try {
                const response = await fetch(apiUrl);
                if (!response.ok) {
                     const errorData = await response.json().catch(() => ({}));
                     throw new Error(`HTTP error! status: ${response.status} - ${errorData.message || 'Failed to fetch item data'}`);
                }
                const data = await response.json();
                setItemData(data);
            } catch (err) {
                console.error("Fetch item error:", err);
                setErrorItem(err.message);
            } finally {
                setLoadingItem(false);
            }
        };
        if (id) { fetchItemData(); }
        else { setErrorItem("No media item ID provided."); setLoadingItem(false); }
    }, [id]);

    // --- Effect 2: Fetch ALL related data AFTER itemData is loaded ---
    useEffect(() => {
        if (!itemData?.id) return;
        const itemId = itemData.id;

        const fetchRelated = async (endpoint, setData, setLoading, setError, typeLabel) => {
            setLoading(true); setError(null); setData([]); // Reset data before fetch
            const apiUrl = `http://localhost:3001/api/mediaitems/${itemId}/${endpoint}`;
            console.log(`Fetching ${typeLabel} from: ${apiUrl}`);
            try {
                const response = await fetch(apiUrl);
                 // Check for 501 Not Implemented specifically
                 if (response.status === 501) {
                    console.warn(`Endpoint /${endpoint} is not implemented.`);
                    setError(`Feature not available (${endpoint}).`); // Set specific error message
                    return; // Stop processing for this fetch
                }
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`HTTP error loading ${typeLabel}! status: ${response.status} - ${errorData.message || 'Failed to fetch'}`);
                }
                const data = await response.json();
                setData(data);
            } catch (err) {
                console.error(`Fetch ${typeLabel} error:`, err);
                setError(err.message);
                // No need to setData([]) here as it was reset at the start
            } finally {
                setLoading(false);
            }
        };

        // Fetch all related data types needed for Blocks 1.5 and 2
        fetchRelated('individuals', setWrongfullyConvicted, setLoadingWC, setErrorWC, 'Wrongfully Convicted');
        fetchRelated('involvedpersons', setOtherInvolvedPersons, setLoadingOIPs, setErrorOIPs, 'Other Involved Persons');
        fetchRelated('organizations', setRelatedOrganizations, setLoadingOrganizations, setErrorOrganizations, 'Organizations');
        fetchRelated('factors', setRelatedFactors, setLoadingFactors, setErrorFactors, 'Factors');
        fetchRelated('othersources', setExternalSources, setLoadingSources, setErrorSources, 'External Sources'); // Fetches data for ExternalSourcesList
        fetchRelated('relatedmedia', setRelatedMediaItems, setLoadingMedia, setErrorMedia, 'Related Media'); // Fetches data for RelatedMediaList

    }, [itemData]); // Depend only on itemData

    // --- Breadcrumb Logic ---
    let breadcrumbItems = [{ label: "Home", link: "/" }];
    const itemTitle = itemData?.itemTitle ?? 'Media Item';
    const parentWork = itemData?.work;

    if (loadingItem) { breadcrumbItems.push({ label: "Loading..." }); }
    else if (errorItem) { breadcrumbItems.push({ label: "Error" }); }
    else if (itemData) {
        if (parentWork) { breadcrumbItems.push({ label: parentWork.title ?? 'Parent Work', link: `/media/${parentWork.id}` }); }
        else { breadcrumbItems.push({ label: "Unknown Work" }); }
        breadcrumbItems.push({ label: itemTitle });
    } else { breadcrumbItems.push({ label: "Not Found" }); }

    // --- Loading State ---
    if (loadingItem) {
         return ( <div className="bg-black text-gray-400 p-8 rounded-lg shadow-lg text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /><p className="mt-4">Loading media item...</p></div> );
    }
    // --- Error State ---
    if (errorItem) { /* ... error JSX unchanged ... */
         return (
             <div className="bg-black text-red-500 p-8 rounded-lg shadow-lg text-center">
                 <div className="w-full px-4 md:px-8 py-4"><Breadcrumbs items={breadcrumbItems} /></div>
                 <AlertCircle className="mx-auto h-12 w-12 text-red-400 my-4" />
                 <h2 className="text-xl font-semibold mb-2">Error Loading Media Item</h2>
                 <p className="text-sm">{errorItem}</p>
                 <button onClick={() => navigate(-1)} className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500">
                     <ArrowLeft className="mr-2 h-5 w-5" /> Go Back
                 </button>
             </div>
         );
    }
    // --- Not Found State ---
    if (!itemData) { /* ... not found JSX unchanged ... */
         return (
             <div className="bg-black text-gray-400 p-8 rounded-lg shadow-lg text-center">
                 <div className="w-full px-4 md:px-8 py-4"><Breadcrumbs items={breadcrumbItems} /></div>
                 <p>Media item data not available.</p>
             </div>
         );
    }

    // --- Render MediaItem Page ---
    const formattedType = formatMediaType(itemData.itemMediaType);

    return (
        <div className="text-gray-50 bg-black rounded-lg shadow-lg overflow-hidden">
            {/* Header Area / Breadcrumbs */}
            <div className="w-full px-4 md:px-8 py-4">
                <Breadcrumbs items={breadcrumbItems} />
            </div>

            {/* === BLOCK 1: Summary / Details === */}
            {/* ... Block 1 JSX unchanged ... */}
             <div className="flex flex-col items-center justify-start px-4 md:px-8 pt-16 pb-8">
                <div className="w-full">
                    <h1 className={`text-4xl md:text-5xl ${BRONZE_COLOR} mb-2 text-center font-serif font-bold tracking-wider uppercase`}>
                        {itemTitle}
                    </h1>
                    <p className="text-center text-lg text-gray-400 mb-12">
                        {getMediaTypeIcon(itemData.itemMediaType)} {formattedType}
                        {parentWork && (
                            <>
                                <span className="mx-2">|</span>
                                <span className='text-gray-500'>Part of:</span>
                                <Link to={`/media/${parentWork.id}`} className={`ml-2 ${BRONZE_COLOR} hover:underline`}>
                                    {parentWork.title}
                                </Link>
                            </>
                        )}
                    </p>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
                        <div className="lg:col-span-1 order-last lg:order-first p-6 rounded-lg shadow-inner bg-gray-800">
                            <ItemDetails item={itemData} />
                        </div>
                        <div className={`lg:col-span-2 border ${BRONZE_BORDER} p-6 rounded-lg shadow-lg`}>
                            <ItemSummaryDisplay summaryText={itemData.summaryNotes} />
							
                            {/* *** ADDED AI DISCLAIMER HERE *** */}
                            {/* Show disclaimer if aiGenerated is true (or null/undefined if using default) */}
                            {/* Ensure individualData includes the 'aiGenerated' field from your API */}
                            {itemData.aiGenerated !== false && <AIDisclaimer />}
                            {/* Using !== false allows it to show if true OR if the field is missing (null/undefined) */}
                        </div>
                    </div>
                </div>
            </div>


            {/* === BLOCK 1.5: Wrongfully Convicted Individuals Mentioned === */}
            {/* ... Block 1.5 JSX unchanged ... */}
             <div className="flex flex-col items-center justify-start px-4 md:px-8 py-8">
                <div className="w-full">
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
            <div className="flex flex-col items-center justify-start px-4 md:px-8 pt-8 pb-16">
                <div className="w-full">
                    <h2 className={`text-3xl md:text-4xl font-semibold mb-10 text-center ${BRONZE_COLOR}`}>Learn More</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">

                        {/* Related Media (Spans 2 cols) */}
                        <div className="md:col-span-2">
                            <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                                <RelatedMediaList
                                    // UPDATED Prop Name: Use 'mediaItems' to match component
                                    mediaItems={relatedMediaItems}
                                    isLoading={loadingMedia}
                                    error={errorMedia}
                                />
                            </div>
                        </div>

                        {/* Other Involved Persons */}
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <OtherInvolvedPersonsList
                                people={otherInvolvedPersons}
                                isLoading={loadingOIPs}
                                error={errorOIPs}
                            />
                        </div>

                        {/* Related Organizations Mentioned */}
                         <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                             <OrganizationsMentionedList
                                 organizations={relatedOrganizations}
                                 isLoading={loadingOrganizations}
                                 error={errorOrganizations}
                             />
                         </div>

                        {/* Contributing Factors */}
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                             <ContributingFactorsList
                                factors={relatedFactors}
                                isLoading={loadingFactors}
                                error={errorFactors}
                             />
                        </div>

                        {/* External Sources (was Other Sources) */}
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                             {/* UPDATED Component: Use ExternalSourcesList */}
                             <ExternalSourcesList
                                 sources={externalSources} // State variable name updated for clarity
                                 isLoading={loadingSources}
                                 error={errorSources}
                             />
                        </div>
                    </div>
                </div>
            </div>
        </div> // End root div
    );
}

export default MediaItemPage;
