/* ========================================================================== */
/* --- File: src/pages/MediaItemPage.jsx (Refactored Block Design v2) ---   */
/* --- Integrates RelatedMediaList & ExternalSourcesList correctly ---      */
/* --- MODIFIED: Corrected apiClient error handling and minor fixes ---     */
/* ========================================================================== */
import apiClient from '../apiClient'; // Adjust the path if apiClient.js is elsewhere
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

// --- Import Icons ---
import { ArrowLeft, AlertCircle, BookOpen, Tv, Mic, Clapperboard, Link as LinkIcon, Users, Building, Info, FileText, ListTree, Loader2 } from 'lucide-react';

// --- Import Theme Constants ---
import { BRONZE_BORDER, BRONZE_COLOR } from '../components/themeconstants';

// --- Import Sub-Components ---
import Breadcrumbs from '../components/Breadcrumbs';
import ItemDetails from '../components/ItemDetails';
import ItemSummaryDisplay from '../components/ItemSummaryDisplay';
import WrongfullyConvictedList from '../components/WrongfullyConvictedList';
import RelatedMediaList from '../components/RelatedMediaList';
import OtherInvolvedPersonsList from '../components/OtherInvolvedPersonsList';
import OrganizationsMentionedList from '../components/OrganizationsMentionedList';
import ContributingFactorsList from '../components/ContributingFactorsList';
import ExternalSourcesList from '../components/ExternalSourcesList';
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

    const [externalSources, setExternalSources] = useState([]);
    const [loadingSources, setLoadingSources] = useState(false);
    const [errorSources, setErrorSources] = useState(null);

    const [relatedMediaItems, setRelatedMediaItems] = useState([]);
    const [loadingMedia, setLoadingMedia] = useState(false);
    const [errorMedia, setErrorMedia] = useState(null);


    // --- Effect 1: Fetch main MediaItem data (including parent work) ---
    useEffect(() => {
        const fetchItemData = async () => {
            setLoadingItem(true); 
            setErrorItem(null); 
            setItemData(null);
            // Reset related data states as well, as they depend on itemData
            setWrongfullyConvicted([]); setErrorWC(null);
            setOtherInvolvedPersons([]); setErrorOIPs(null);
            setRelatedOrganizations([]); setErrorOrganizations(null);
            setRelatedFactors([]); setErrorFactors(null);
            setExternalSources([]); setErrorSources(null);
            setRelatedMediaItems([]); setErrorMedia(null);

            const apiUrl = `/mediaitems/${id}`;
            console.log(`Fetching main item data from (using apiClient): ${apiUrl}`);
            try {
                const response = await apiClient.get(apiUrl);
                const data = response.data; // Axios provides data directly
                setItemData(data);
            } catch (err) {
                console.error("Fetch item data error:", err);
                let errorMessage = "An unknown error occurred while fetching media item data.";
                if (err.response) {
                    errorMessage = err.response.data?.message || `Error: ${err.response.status} - ${err.response.statusText}`;
                } else if (err.request) {
                    errorMessage = "No response received from server. Please check your network connection.";
                } else {
                    errorMessage = err.message;
                }
                setErrorItem(errorMessage); // Use setErrorItem for the main item's error
            }
            finally { 
                setLoadingItem(false); // Use setLoadingItem for the main item's loading state
            }
        };

        if (id) { 
            fetchItemData(); 
        } else { 
            setErrorItem("No media item ID provided."); 
            setLoadingItem(false); 
        }
    }, [id]);

    // --- Effect 2: Fetch ALL related data AFTER itemData is loaded ---
    useEffect(() => {
        if (!itemData?.id || loadingItem || errorItem) { // Don't fetch if main item is loading or has an error
            return;
        }
        const itemId = itemData.id;

        const fetchRelated = async (endpoint, setData, setLoading, setErrorState, typeLabel) => {
            setLoading(true); 
            setErrorState(null); // Use the specific error setter passed for this related data type
            setData([]); 
            
            const apiUrl = `/mediaitems/${itemId}/${endpoint}`;
            console.log(`Fetching ${typeLabel} from (using apiClient): ${apiUrl}`);
            try {
                const response = await apiClient.get(apiUrl);
                const data = response.data; // Axios provides data directly
                setData(data);
            } catch (err) { // Corrected placement of catch block
                console.error(`Fetch ${typeLabel} error:`, err);
                let errorMessage = `An unknown error occurred while fetching ${typeLabel}.`;
                if (err.response) {
                    if (err.response.status === 501) {
                        console.warn(`Endpoint /${endpoint} is not implemented for MediaItems.`);
                        errorMessage = `Feature not available (${endpoint}).`;
                    } else {
                        errorMessage = err.response.data?.message || `Error fetching ${typeLabel}: ${err.response.status} - ${err.response.statusText}`;
                    }
                } else if (err.request) {
                    errorMessage = `No response received for ${typeLabel}. Check network.`;
                } else {
                    errorMessage = err.message;
                }
                setErrorState(errorMessage); // Use the specific error setter
            }
            finally { 
                setLoading(false); 
            }
        };

        // Fetch all related data types needed for Blocks 1.5 and 2
        fetchRelated('individuals', setWrongfullyConvicted, setLoadingWC, setErrorWC, 'Wrongfully Convicted');
        fetchRelated('involvedpersons', setOtherInvolvedPersons, setLoadingOIPs, setErrorOIPs, 'Other Involved Persons');
        fetchRelated('organizations', setRelatedOrganizations, setLoadingOrganizations, setErrorOrganizations, 'Organizations');
        fetchRelated('factors', setRelatedFactors, setLoadingFactors, setErrorFactors, 'Factors');
        fetchRelated('othersources', setExternalSources, setLoadingSources, setErrorSources, 'External Sources');
        fetchRelated('relatedmedia', setRelatedMediaItems, setLoadingMedia, setErrorMedia, 'Related Media');

    }, [itemData, loadingItem, errorItem]); // Depend on itemData, and also loadingItem/errorItem to prevent fetches if main item failed

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
         return ( <div className="bg-black text-gray-400 p-8 rounded-lg shadow-lg text-center min-h-screen flex flex-col justify-center items-center"><Loader2 className="mx-auto h-12 w-12 animate-spin text-amber-500" /><p className="mt-4 text-lg">Loading media item...</p></div> );
    }
    // --- Error State ---
    if (errorItem) {
         return (
             <div className="bg-black text-red-500 p-8 rounded-lg shadow-lg text-center min-h-screen flex flex-col justify-center items-center">
                 <div className="w-full px-4 md:px-8 py-4 absolute top-0 left-0"><Breadcrumbs items={breadcrumbItems} /></div>
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
    if (!itemData) { // This will likely be caught by errorItem if the fetch fails for a non-existent ID
         return (
             <div className="bg-black text-gray-400 p-8 rounded-lg shadow-lg text-center min-h-screen flex flex-col justify-center items-center">
                 <div className="w-full px-4 md:px-8 py-4 absolute top-0 left-0"><Breadcrumbs items={breadcrumbItems} /></div>
                 <p>Media item data not available for ID: {id}.</p>
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
                            {itemData.aiGenerated !== false && <AIDisclaimer />}
                        </div>
                    </div>
                </div>
            </div>

            {/* === BLOCK 1.5: Wrongfully Convicted Individuals Mentioned === */}
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
                             <ExternalSourcesList
                                 sources={externalSources}
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

export default MediaItemPage;
