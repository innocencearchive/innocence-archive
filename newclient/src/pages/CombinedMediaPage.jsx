/* ========================================================================== */
/* --- File: src/pages/CombinedMediaPage.jsx (v3) ---                       */
/* --- Displays a unified view for Book/Film Work & Item Content ---        */
/* --- FIX: Calls correct 'othersources' endpoint for external links ---    */
/* --- MODIFIED: Uses apiClient for all fetch operations ---                */
/* ========================================================================== */
import apiClient from '../apiClient'; // Adjust the path if apiClient.js is elsewhere
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

// --- Import Icons ---
import { ArrowLeft, AlertCircle, BookOpen, Clapperboard, Users, Building, Info, FileText, ListTree, Loader2 } from 'lucide-react';

// --- Import Theme Constants ---
import { BRONZE_BORDER, BRONZE_COLOR } from '../components/themeconstants';

// --- Import Sub-Components ---
import Breadcrumbs from '../components/Breadcrumbs';
import WorkDetails from '../components/WorkDetails';
import ItemDetails from '../components/ItemDetails';
import ItemSummaryDisplay from '../components/ItemSummaryDisplay';
import WrongfullyConvictedList from '../components/WrongfullyConvictedList';
import OtherInvolvedPersonsList from '../components/OtherInvolvedPersonsList';
import OrganizationsMentionedList from '../components/OrganizationsMentionedList';
import ContributingFactorsList from '../components/ContributingFactorsList';
import ExternalSourcesList from '../components/ExternalSourcesList';
import RelatedMediaList from '../components/RelatedMediaList';
import AIDisclaimer from '../components/AIDisclaimer';

// --- Helper Functions ---
const getMediaTypeIcon = (mediaType) => {
    if (mediaType === 'BOOK' || mediaType === 'BOOK_CONTENT') {
        return <BookOpen size={20} className="inline mr-2" />;
    }
    if (mediaType === 'FILM' || mediaType === 'FILM_CONTENT' || mediaType === 'DOCUMENTARY' || mediaType === 'DOCUMENTARY_CONTENT') {
        return <Clapperboard size={20} className="inline mr-2" />;
    }
    return <FileText size={20} className="inline mr-2" />; // Fallback
};

const formatMediaType = (mediaType) => {
    if (!mediaType) return 'Media';
    const baseType = mediaType.replace('_CONTENT', '');
    return baseType.charAt(0).toUpperCase() + baseType.slice(1).toLowerCase();
};


// --- Main CombinedMediaPage Component ---
function CombinedMediaPage() {
    const { id: workId } = useParams();
    const navigate = useNavigate();

    // --- State Hooks ---
    const [workData, setWorkData] = useState(null);
    const [itemData, setItemData] = useState(null);
    const [loadingPage, setLoadingPage] = useState(true);
    const [errorPage, setErrorPage] = useState(null);

    // Related data lists states
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


    // --- Effect 1: Fetch Core Work and Item Data ---
    useEffect(() => {
        if (!workId) {
            setErrorPage("No media ID provided in URL.");
            setLoadingPage(false);
            return;
        }
        const fetchCoreData = async () => {
            setLoadingPage(true); setErrorPage(null); setWorkData(null); setItemData(null);
            console.log(`Fetching combined data for Work ID: ${workId}`);
            try {
                // Use apiClient. The VITE_API_URL (e.g., http://localhost:3001 or https://your-api.onrender.com)
                // will be prepended to '/api/mediaworks/...'
                const workApiUrl = `/mediaworks/${workId}?include=items`;
                console.log(`Fetching work data from (using apiClient): ${workApiUrl}`);
                const response = await apiClient.get(workApiUrl);
                const fetchedWorkData = response.data; // Axios provides data directly

                if (fetchedWorkData.workType !== 'BOOK' && fetchedWorkData.workType !== 'FILM' && fetchedWorkData.workType !== 'DOCUMENTARY') {
                     throw new Error(`This page is only for Books, Films, or Documentaries. Found type: ${fetchedWorkData.workType}`);
                }
                setWorkData(fetchedWorkData);
                const contentItem = fetchedWorkData.items?.find(item =>
                    item.itemMediaType === 'BOOK_CONTENT' ||
                    item.itemMediaType === 'FILM_CONTENT' ||
                    item.itemMediaType === 'DOCUMENTARY_CONTENT'
                );
                if (!contentItem) {
                    throw new Error(`Could not find the primary content MediaItem for Work ID ${workId}.`);
                }
                setItemData(contentItem);
                console.log("Found content item:", contentItem);
            } catch (err) {
                console.error("Error fetching core combined data:", err);
                const errorMessage = err.response?.data?.message || err.message || "Failed to fetch core data.";
                setErrorPage(errorMessage); 
                setWorkData(null); 
                setItemData(null);
            } finally {
                setLoadingPage(false);
            }
        };
        fetchCoreData();
    }, [workId, navigate]);

    // --- Effect 2: Fetch Related Lists Data (after core data is loaded) ---
    useEffect(() => {
        if (!workId || loadingPage || errorPage || !workData || !itemData?.id) {
             setWrongfullyConvicted([]); setOtherInvolvedPersons([]); setRelatedOrganizations([]);
             setRelatedFactors([]); setExternalSources([]); setRelatedMediaItems([]);
            return;
        }
        const itemId = itemData.id;

        // Fetch lists related to the WORK
        const fetchWorkRelatedList = async (endpoint, setData, setLoading, setError, typeLabel) => {
            setLoading(true); setError(null); setData([]);
            const apiUrl = `/api/mediaworks/${workId}/${endpoint}`;
            console.log(`Fetching ${typeLabel} for Work ID ${workId} from (using apiClient): ${apiUrl}`);
            try {
                const response = await apiClient.get(apiUrl);
                setData(response.data); // Axios provides data directly
            } catch (err) {
                console.error(`Fetch ${typeLabel} error:`, err);
                // Handle 501 specifically if needed, though Axios might not expose status directly in simple catch
                if (err.response && err.response.status === 501) {
                    console.warn(`Endpoint /${endpoint} is not implemented for MediaWorks.`);
                    setError(`Feature not available (${endpoint}).`);
                } else {
                    const errorMessage = err.response?.data?.message || err.message || `Failed to fetch ${typeLabel}.`;
                    setError(errorMessage);
                }
            }
            finally { setLoading(false); }
        };

        // Fetch lists related to the ITEM
        const fetchItemRelatedList = async (endpoint, setData, setLoading, setError, typeLabel) => {
            setLoading(true); setError(null); setData([]);
            const apiUrl = `/api/mediaitems/${itemId}/${endpoint}`;
            console.log(`Fetching ${typeLabel} for Item ID ${itemId} from (using apiClient): ${apiUrl}`);
            try {
                const response = await apiClient.get(apiUrl);
                setData(response.data); // Axios provides data directly
            } catch (err) {
                console.error(`Fetch ${typeLabel} error:`, err);
                if (err.response && err.response.status === 501) {
                     console.warn(`Endpoint /${endpoint} is not implemented for MediaItems.`);
                     setError(`Feature not available (${endpoint}).`);
                } else {
                    const errorMessage = err.response?.data?.message || err.message || `Failed to fetch ${typeLabel}.`;
                    setError(errorMessage);
                }
            }
            finally { setLoading(false); }
        };

        // Fetch WORK-related lists
        fetchWorkRelatedList('individuals', setWrongfullyConvicted, setLoadingWC, setErrorWC, 'Wrongfully Convicted');
        fetchWorkRelatedList('involvedpersons', setOtherInvolvedPersons, setLoadingOIPs, setErrorOIPs, 'Other Involved Persons');
        fetchWorkRelatedList('organizations', setRelatedOrganizations, setLoadingOrganizations, setErrorOrganizations, 'Organizations');
        fetchWorkRelatedList('factors', setRelatedFactors, setLoadingFactors, setErrorFactors, 'Factors');

        // Fetch ITEM-related lists
        fetchItemRelatedList('othersources', setExternalSources, setLoadingSources, setErrorSources, 'External Sources');
        fetchItemRelatedList('relatedmedia', setRelatedMediaItems, setLoadingMedia, setErrorMedia, 'Related Media');

    }, [workId, itemData, loadingPage, errorPage]);

    // --- Breadcrumb Logic ---
    let breadcrumbItems = [{ label: "Home", link: "/" }];
    const pageTitle = workData?.title ?? 'Media';
    const pageType = workData?.workType ? formatMediaType(workData.workType) : 'Media';
    if (loadingPage) { breadcrumbItems.push({ label: "Loading..." }); }
    else if (errorPage) { breadcrumbItems.push({ label: "Error" }); }
    else if (workData) { breadcrumbItems.push({ label: pageTitle }); }
    else { breadcrumbItems.push({ label: "Not Found" }); }

    // --- Render Logic ---
    if (loadingPage) {
        return (
            <div className="bg-black text-gray-400 p-8 rounded-lg shadow-lg text-center min-h-screen flex flex-col justify-center items-center">
                <Loader2 className="h-12 w-12 animate-spin text-amber-500" />
                <p className="mt-4 text-lg">Loading Media...</p>
            </div>
        );
     }
    if (errorPage) {
        return (
            <div className="bg-black text-red-500 p-8 rounded-lg shadow-lg text-center min-h-screen flex flex-col justify-center items-center">
                <div className="w-full px-4 md:px-8 py-4 absolute top-0 left-0"><Breadcrumbs items={breadcrumbItems} /></div>
                <AlertCircle className="mx-auto h-16 w-16 text-red-400 my-4" />
                <h2 className="text-2xl font-semibold mb-3">Error Loading Media</h2>
                <p className="text-md mb-6 max-w-lg">{errorPage}</p>
                <button onClick={() => navigate(-1)} className="mt-6 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-amber-500 transition-colors">
                    <ArrowLeft className="mr-2 h-5 w-5" /> Go Back
                </button>
            </div>
        );
    }
    if (!workData || !itemData) {
         return (
            <div className="bg-black text-gray-400 p-8 rounded-lg shadow-lg text-center min-h-screen flex flex-col justify-center items-center">
                 <div className="w-full px-4 md:px-8 py-4 absolute top-0 left-0"><Breadcrumbs items={breadcrumbItems} /></div>
                <h2 className="text-2xl font-semibold mb-3">Media Not Found</h2>
                <p>The requested book or film could not be found.</p>
                 <button onClick={() => navigate('/')} className="mt-6 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-amber-500 transition-colors">
                     Go Home
                 </button>
            </div>
        );
     }

    // --- Render Combined Page ---
    return (
        <div className="text-gray-50 bg-black rounded-lg shadow-lg overflow-hidden">
            {/* Header Area / Breadcrumbs */}
            <div className="w-full px-4 md:px-8 py-4">
                <Breadcrumbs items={breadcrumbItems} />
            </div>

            {/* === BLOCK 1: Core Details & Summary === */}
            <div className="flex flex-col items-center justify-start px-4 md:px-8 pt-16 pb-8">
                <div className="w-full max-w-6xl mx-auto">
                    <h1 className={`text-4xl md:text-5xl ${BRONZE_COLOR} mb-4 text-center font-serif font-bold tracking-wider uppercase`}>
                        {workData.title}
                    </h1>
                    <p className="text-center text-lg text-gray-400 mb-12">
                        {getMediaTypeIcon(workData.workType)} {pageType}
                    </p>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
                        <div className="lg:col-span-1 order-last lg:order-first bg-gray-800 p-6 rounded-lg shadow-lg">
                            <WorkDetails work={workData} />
                        </div>
                        <div className={`lg:col-span-2 border ${BRONZE_BORDER} p-6 rounded-lg shadow-lg`}>
                            <ItemSummaryDisplay summaryText={itemData.summaryNotes} />
							
                            {itemData.aiGenerated !== false && <AIDisclaimer />}
                        </div>
                    </div>
                </div>
            </div>

            {/* === BLOCK 1.5: Wrongfully Convicted Individuals === */}
            {(loadingWC || wrongfullyConvicted.length > 0 || errorWC) && (
                <div className="flex flex-col items-center justify-start px-4 md:px-8 py-8">
                    <div className="w-full max-w-6xl mx-auto">
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <WrongfullyConvictedList individuals={wrongfullyConvicted} isLoading={loadingWC} error={errorWC} />
                        </div>
                    </div>
                </div>
            )}

            {/* === BLOCK 2: Learn More (Related Lists) === */}
            <div className="flex flex-col items-center justify-start px-4 md:px-8 pt-8 pb-16">
                <div className="w-full max-w-6xl mx-auto">
                    <h2 className={`text-3xl md:text-4xl font-semibold mb-10 text-center ${BRONZE_COLOR}`}>Learn More</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                        {/* Related Media */}
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <RelatedMediaList mediaItems={relatedMediaItems} isLoading={loadingMedia} error={errorMedia} />
                        </div>
                        {/* Other Involved Persons */}
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <OtherInvolvedPersonsList people={otherInvolvedPersons} isLoading={loadingOIPs} error={errorOIPs} />
                        </div>
                        {/* Organizations Mentioned */}
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <OrganizationsMentionedList organizations={relatedOrganizations} isLoading={loadingOrganizations} error={errorOrganizations} />
                        </div>
                        {/* Contributing Factors */}
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <ContributingFactorsList factors={relatedFactors} isLoading={loadingFactors} error={errorFactors} />
                        </div>
                        {/* External Sources */}
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96 md:col-span-2 lg:col-span-1`}>
                            <ExternalSourcesList sources={externalSources} isLoading={loadingSources} error={errorSources} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CombinedMediaPage;
