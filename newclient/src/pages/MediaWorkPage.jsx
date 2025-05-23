/* ========================================================================== */
/* --- File: src/pages/MediaWorkPage.jsx (Refactored v2) ---                  */
/* --- Separates WC/OIP lists, new layout block ---                         */
/* --- MODIFIED: Corrected apiClient usage and error handling ---           */
/* ========================================================================== */
import apiClient from '../apiClient'; // Adjust the path if apiClient.js is elsewhere
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// --- Import Icons ---
import { ArrowLeft, AlertCircle, BookOpen, Tv, Mic, Clapperboard, Building, ListTree, Info, Loader2 } from 'lucide-react'; // Added Loader2

// --- Import Theme Constants ---
import { BRONZE_BORDER, BRONZE_COLOR } from '../components/themeconstants';

// --- Import Sub-Components ---
import Breadcrumbs from '../components/Breadcrumbs';
import WorkDetails from '../components/WorkDetails';
import WorkSummaryDisplay from '../components/WorkSummaryDisplay';
import WrongfullyConvictedList from '../components/WrongfullyConvictedList';
import ItemList from '../components/ItemList';
import OrganizationsMentionedList from '../components/OrganizationsMentionedList';
import ContributingFactorsList from '../components/ContributingFactorsList';
import OtherSourcesList from '../components/OtherSourcesList';
import OtherInvolvedPersonsList from '../components/OtherInvolvedPersonsList';
import AIDisclaimer from '../components/AIDisclaimer';

// --- Helper Functions ---
const getMediaTypeIcon = (mediaType) => {
    switch (mediaType) {
        case 'BOOK': return <BookOpen size={20} className="inline mr-2" />;
        case 'FILM': case 'DOCUMENTARY': case 'DOCUSERIES': return <Clapperboard size={20} className="inline mr-2" />;
        case 'PODCAST_SERIES': return <Mic size={20} className="inline mr-2" />;
        case 'TV_SERIES': return <Tv size={20} className="inline mr-2" />;
        default: return null;
    }
};
const formatMediaType = (mediaType) => {
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

    const [wrongfullyConvicted, setWrongfullyConvicted] = useState([]);
    const [loadingWC, setLoadingWC] = useState(false);
    const [errorWC, setErrorWC] = useState(null);

    const [otherInvolvedPersons, setOtherInvolvedPersons] = useState([]);
    const [loadingOIPs, setLoadingOIPs] = useState(false);
    const [errorOIPs, setErrorOIPs] = useState(null);

    const [relatedFactors, setRelatedFactors] = useState([]);
    const [loadingFactors, setLoadingFactors] = useState(false);
    const [errorFactors, setErrorFactors] = useState(null);

    const [relatedOrganizations, setRelatedOrganizations] = useState([]);
    const [loadingOrganizations, setLoadingOrganizations] = useState(false);
    const [errorOrganizations, setErrorOrganizations] = useState(null);

    const [otherSources, setOtherSources] = useState([]);
    const [loadingSources, setLoadingSources] = useState(false);
    const [errorSources, setErrorSources] = useState(null);


    // --- Effect 1: Fetch main MediaWork data (including items/episodes) ---
    useEffect(() => {
        const fetchWorkData = async () => {
            setLoadingWork(true); 
            setErrorWork(null); 
            setWorkData(null);
            // Reset related data states as they depend on workData
            setWrongfullyConvicted([]); setErrorWC(null);
            setOtherInvolvedPersons([]); setErrorOIPs(null);
            setRelatedFactors([]); setErrorFactors(null);
            setRelatedOrganizations([]); setErrorOrganizations(null);
            setOtherSources([]); setErrorSources(null);

            const apiUrl = `/mediaworks/${id}?include=items`; // Ensure items are included
            console.log(`Fetching main work data from (using apiClient): ${apiUrl}`);
            try {
                const response = await apiClient.get(apiUrl);
                const data = response.data; // Axios provides data directly
                setWorkData(data);
                // Example: If other sources are directly part of workData and not fetched separately
                // if (data.sourceLinks) { 
                //     setOtherSources(data.sourceLinks.map(link => ({
                //         id: link.informationSource.id,
                //         name: link.informationSource.name,
                //         url: link.specificUrl || link.informationSource.baseUrl
                //     })));
                //     setLoadingSources(false); // If loaded here, set loading to false
                // }
            } catch (err) { 
                console.error("Fetch work error:", err);
                let errorMessage = "An unknown error occurred while fetching media work data.";
                if (err.response) {
                    errorMessage = err.response.data?.message || `Error: ${err.response.status} - ${err.response.statusText}`;
                } else if (err.request) {
                    errorMessage = "No response received from server. Please check your network connection.";
                } else {
                    errorMessage = err.message;
                }
                setErrorWork(errorMessage);
            }
            finally { setLoadingWork(false); }
        };
        if (id) { fetchWorkData(); }
        else { setErrorWork("No media work ID provided."); setLoadingWork(false); }
    }, [id]);

    // --- Effect 2: Fetch related data AFTER workData is loaded ---
    useEffect(() => {
        if (!workData?.id || loadingWork || errorWork) { // Don't fetch if main work data is loading or errored
            return;
        }
        const workId = workData.id;

        // Generic helper function to fetch related data for the work
        const fetchWorkRelatedData = async (endpoint, setData, setLoading, setErrorState, typeLabel) => {
            setLoading(true);
            setErrorState(null);
            setData([]); // Reset data before fetch

            const apiUrl = `/mediaworks/${workId}/${endpoint}`;
            console.log(`Fetching ${typeLabel} for Work ID ${workId} from (using apiClient): ${apiUrl}`);
            try {
                const response = await apiClient.get(apiUrl);
                setData(response.data);
            } catch (err) {
                console.error(`Fetch ${typeLabel} error:`, err);
                let errorMessage = `An unknown error occurred while fetching ${typeLabel}.`;
                if (err.response) {
                    if (err.response.status === 501) { // Not Implemented
                        errorMessage = `Feature not available for ${typeLabel} (${endpoint}).`;
                    } else {
                        errorMessage = err.response.data?.message || `Error fetching ${typeLabel}: ${err.response.status} - ${err.response.statusText}`;
                    }
                } else if (err.request) {
                    errorMessage = `No response received for ${typeLabel}. Check network.`;
                } else {
                    errorMessage = err.message;
                }
                setErrorState(errorMessage);
            } finally {
                setLoading(false);
            }
        };
        
        fetchWorkRelatedData('individuals', setWrongfullyConvicted, setLoadingWC, setErrorWC, 'Wrongfully Convicted');
        fetchWorkRelatedData('involvedpersons', setOtherInvolvedPersons, setLoadingOIPs, setErrorOIPs, 'Other Involved Persons');
        fetchWorkRelatedData('factors', setRelatedFactors, setLoadingFactors, setErrorFactors, 'Factors');
        fetchWorkRelatedData('organizations', setRelatedOrganizations, setLoadingOrganizations, setErrorOrganizations, 'Organizations');
        // Assuming 'othersources' is a valid endpoint for MediaWork related sources
        // If otherSources are part of the main workData, this fetch might not be needed or could be conditional
        fetchWorkRelatedData('othersources', setOtherSources, setLoadingSources, setErrorSources, 'Other Sources');


    }, [workData, loadingWork, errorWork]); // Depend on workData and its loading/error state

    // --- Breadcrumb Logic ---
    let breadcrumbItems = [{ label: "Home", link: "/" }];
    const workTitle = workData?.title ?? 'Media Work';
    if (loadingWork) breadcrumbItems.push({ label: "Loading..." });
    else if (errorWork) breadcrumbItems.push({ label: "Error" });
    else if (workData) breadcrumbItems.push({ label: workTitle });
    else breadcrumbItems.push({ label: "Not Found" });

    // --- Loading State ---
    if (loadingWork) {
         return ( <div className="bg-black text-gray-400 p-8 rounded-lg shadow-lg text-center min-h-screen flex flex-col justify-center items-center"><Loader2 className="mx-auto h-12 w-12 animate-spin text-amber-500" /> <p className="mt-4 text-lg">Loading media work...</p></div> );
    }
    // --- Error State ---
    if (errorWork) {
         return ( 
            <div className="bg-black text-red-500 p-8 rounded-lg shadow-lg text-center min-h-screen flex flex-col justify-center items-center">
                <div className="w-full px-4 md:px-8 py-4 absolute top-0 left-0"><Breadcrumbs items={breadcrumbItems} /></div>
                <AlertCircle className="mx-auto h-12 w-12 text-red-400 my-4" />
                <h2 className="text-xl font-semibold mb-2">Error Loading Media Work</h2>
                <p className="text-sm">{errorWork}</p>
                <button onClick={() => navigate(-1)} className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500">
                    <ArrowLeft className="mr-2 h-5 w-5" /> Go Back
                </button>
            </div> 
        );
    }
    // --- Not Found State ---
    if (!workData) { // This will likely be caught by errorWork if the fetch fails for a non-existent ID
         return ( 
            <div className="bg-black text-gray-400 p-8 rounded-lg shadow-lg text-center min-h-screen flex flex-col justify-center items-center">
                <div className="w-full px-4 md:px-8 py-4 absolute top-0 left-0"><Breadcrumbs items={breadcrumbItems} /></div>
                <p>Media work data not available for ID: {id}.</p>
            </div> 
        );
    }

    // --- Render MediaWork Page ---
    const formattedType = formatMediaType(workData.workType);
    const itemListLabel = workData.workType === 'BOOK' ? 'Content Sections' : 'Episodes / Parts';

    return (
        <div className="text-gray-50 bg-black rounded-lg shadow-lg overflow-hidden">
            {/* Header Area / Breadcrumbs */}
            <div className="w-full px-4 md:px-8 py-4">
                <Breadcrumbs items={breadcrumbItems} />
            </div>

            {/* === BLOCK 1: Summary / Details === */}
            <div className="flex flex-col items-center justify-start px-4 md:px-8 pt-16 pb-8">
                <div className="w-full">
                    <h1 className={`text-4xl md:text-5xl ${BRONZE_COLOR} mb-4 text-center font-serif font-bold tracking-wider uppercase`}>
                        {workTitle}
                    </h1>
                    <p className="text-center text-lg text-gray-400 mb-12">
                        {getMediaTypeIcon(workData.workType)} {formattedType}
                    </p>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
                        <div className="lg:col-span-1 order-last lg:order-first bg-gray-800 p-6 rounded-lg shadow-lg">
                            <WorkDetails work={workData} />
                        </div>
                        <div className={`lg:col-span-2 border ${BRONZE_BORDER} p-6 rounded-lg shadow-lg`}>
                            <WorkSummaryDisplay summaryText={workData.summaryNotes} />
                            {workData.aiGenerated !== false && <AIDisclaimer />}
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
                        <div className="md:col-span-2">
                            <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-[30rem]`}> {/* Example max height */}
                                <ItemList
                                    items={workData.items ?? []}
                                    itemTypeLabel={itemListLabel}
                                    // Pass loading/error if ItemList supports them, or if items are fetched separately
                                />
                            </div>
                        </div>
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <OtherInvolvedPersonsList
                                people={otherInvolvedPersons}
                                isLoading={loadingOIPs}
                                error={errorOIPs}
                            />
                        </div>
                         <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                             <OrganizationsMentionedList
                                 organizations={relatedOrganizations}
                                 isLoading={loadingOrganizations}
                                 error={errorOrganizations}
                             />
                         </div>
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                             <ContributingFactorsList
                                factors={relatedFactors}
                                isLoading={loadingFactors}
                                error={errorFactors}
                             />
                        </div>
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
