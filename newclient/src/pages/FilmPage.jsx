/* ========================================================================== */
/* --- File: src/pages/FilmPage.jsx ---                                     */
/* --- Displays a dedicated view for standalone Films/Documentaries ---     */
/* --- Features poster, TMDB summary, and streaming info placeholder ---    */
/* --- MODIFIED: Made TMDB logo/attribution clickable ---                 */
/* --- MODIFIED: Adjusted mobile order for image and summary ---          */
/* --- MODIFIED: AI Disclaimer logic and Summary Display Logic ---        */
/* ========================================================================== */
import apiClient from '../apiClient';
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

// --- Import Icons ---
import { ArrowLeft, AlertCircle, Clapperboard, Users, Building, Info, FileText, ListTree, Loader2, TvIcon, CalendarDaysIcon, CopyrightIcon } from 'lucide-react';

// --- Import Theme Constants ---
import { BRONZE_BORDER, BRONZE_COLOR } from '../components/themeconstants';

// --- Import Sub-Components ---
import Breadcrumbs from '../components/Breadcrumbs';
import ItemSummaryDisplay from '../components/ItemSummaryDisplay';
import WrongfullyConvictedList from '../components/WrongfullyConvictedList';
import OtherInvolvedPersonsList from '../components/OtherInvolvedPersonsList';
import OrganizationsMentionedList from '../components/OrganizationsMentionedList';
import ContributingFactorsList from '../components/ContributingFactorsList';
import ExternalSourcesList from '../components/ExternalSourcesList';
import RelatedMediaList from '../components/RelatedMediaList';
import AIDisclaimer from '../components/AIDisclaimer';

// --- Import Assets ---
import tmdbLogo from '../assets/tmdb.svg';

// --- Constants ---
const FALLBACK_IMAGE_URL = 'https://placehold.co/500x750/333333/CCCCCC?text=No+Poster';
const TMDB_BASE_URL = 'https://www.themoviedb.org/movie/';

// --- Helper Functions ---
const getMediaTypeIcon = (mediaType) => {
    return <Clapperboard size={20} className="inline mr-2" />;
};

const formatMediaType = (mediaType) => {
    if (!mediaType) return 'Media';
    if (mediaType === 'FILM') return 'Film';
    if (mediaType === 'DOCUMENTARY') return 'Documentary';
    const baseType = mediaType.replace('_CONTENT', '');
    return baseType.charAt(0).toUpperCase() + baseType.slice(1).toLowerCase();
};

// NEW: Helper function to convert title to kebab-case for TMDB URL
const toKebabCase = (str) => {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')         // Replace spaces with -
    .replace(/[^\w-]+/g, '')    // Remove all non-word chars except -
    .replace(/--+/g, '-')       // Replace multiple - with single -
    .replace(/^-+/, '')          // Trim - from start of text
    .replace(/-+$/, '');         // Trim - from end of text
};


// --- Main FilmPage Component ---
function FilmPage() {
    const { id: workId } = useParams();
    const navigate = useNavigate();

    // --- State Hooks ---
    const [workData, setWorkData] = useState(null);
    const [itemData, setItemData] = useState(null);
    const [loadingPage, setLoadingPage] = useState(true);
    const [errorPage, setErrorPage] = useState(null);

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
            console.log(`FilmPage: Fetching data for Work ID: ${workId}`);
            try {
                const workApiUrl = `/mediaworks/${workId}?include=items,streamingProviders`;
                console.log(`FilmPage: Fetching work data from (using apiClient): ${workApiUrl}`);
                const response = await apiClient.get(workApiUrl);
                const fetchedWorkData = response.data;

                if (fetchedWorkData.workType !== 'FILM' && fetchedWorkData.workType !== 'DOCUMENTARY') {
                     throw new Error(`FilmPage is only for Films or Documentaries. Found type: ${fetchedWorkData.workType}`);
                }
                setWorkData(fetchedWorkData);

                const contentItem = fetchedWorkData.items?.find(item =>
                    item.itemMediaType === 'FILM_CONTENT' ||
                    item.itemMediaType === 'DOCUMENTARY_CONTENT'
                );

                if (contentItem) {
                    setItemData(contentItem);
                    console.log("FilmPage: Found content item:", contentItem);
                } else {
                    console.warn(`FilmPage: Could not find a primary content MediaItem for Work ID ${workId}. Some related lists might be empty.`);
                    setItemData(null);
                }

            } catch (err) {
                console.error("FilmPage: Error fetching core data:", err);
                const errorMessage = err.response?.data?.message || err.message || "Failed to fetch film data.";
                setErrorPage(errorMessage);
                setWorkData(null);
                setItemData(null);
            } finally {
                setLoadingPage(false);
            }
        };
        fetchCoreData();
    }, [workId]);

    // --- Effect 2: Fetch Related Lists Data (after core data is loaded) ---
    useEffect(() => {
        if (!workId || loadingPage || errorPage || !workData) {
             setWrongfullyConvicted([]); setOtherInvolvedPersons([]); setRelatedOrganizations([]);
             setRelatedFactors([]); setExternalSources([]); setRelatedMediaItems([]);
            return;
        }

        const fetchWorkRelatedList = async (endpoint, setData, setLoading, setError, typeLabel) => {
            setLoading(true); setError(null); setData([]);
            const apiUrl = `/api/mediaworks/${workId}/${endpoint}`;
            console.log(`FilmPage: Fetching ${typeLabel} for Work ID ${workId} from: ${apiUrl}`);
            try {
                const response = await apiClient.get(apiUrl);
                setData(response.data);
            } catch (err) {
                console.error(`FilmPage: Fetch ${typeLabel} error:`, err);
                if (err.response && err.response.status === 501) {
                    console.warn(`FilmPage: Endpoint /${endpoint} is not implemented for MediaWorks.`);
                    setError(`Feature not available (${endpoint}).`);
                } else {
                    const errorMessage = err.response?.data?.message || err.message || `Failed to fetch ${typeLabel}.`;
                    setError(errorMessage);
                }
            }
            finally { setLoading(false); }
        };

        const fetchItemRelatedList = async (endpoint, setData, setLoading, setError, typeLabel) => {
            if (!itemData || !itemData.id) {
                console.warn(`FilmPage: Skipping fetch for ${typeLabel} as itemData is not available.`);
                setData([]);
                setLoading(false);
                return;
            }
            const itemId = itemData.id;
            setLoading(true); setError(null); setData([]);
            const apiUrl = `/api/mediaitems/${itemId}/${endpoint}`;
            console.log(`FilmPage: Fetching ${typeLabel} for Item ID ${itemId} from: ${apiUrl}`);
            try {
                const response = await apiClient.get(apiUrl);
                setData(response.data);
            } catch (err) {
                console.error(`FilmPage: Fetch ${typeLabel} error:`, err);
                if (err.response && err.response.status === 501) {
                     console.warn(`FilmPage: Endpoint /${endpoint} is not implemented for MediaItems.`);
                     setError(`Feature not available (${endpoint}).`);
                } else {
                    const errorMessage = err.response?.data?.message || err.message || `Failed to fetch ${typeLabel}.`;
                    setError(errorMessage);
                }
            }
            finally { setLoading(false); }
        };

        fetchWorkRelatedList('individuals', setWrongfullyConvicted, setLoadingWC, setErrorWC, 'Wrongfully Convicted');
        fetchWorkRelatedList('involvedpersons', setOtherInvolvedPersons, setLoadingOIPs, setErrorOIPs, 'Other Involved Persons');
        fetchWorkRelatedList('organizations', setRelatedOrganizations, setLoadingOrganizations, setErrorOrganizations, 'Organizations');
        fetchWorkRelatedList('factors', setRelatedFactors, setLoadingFactors, setErrorFactors, 'Factors');
        fetchItemRelatedList('othersources', setExternalSources, setLoadingSources, setErrorSources, 'External Sources');
        fetchItemRelatedList('relatedmedia', setRelatedMediaItems, setLoadingMedia, setErrorMedia, 'Related Media');

    }, [workId, workData, itemData, loadingPage, errorPage]);

    // --- Breadcrumb Logic ---
    let breadcrumbItems = [{ label: "Home", link: "/" }];
    const pageTitle = workData?.title ?? 'Film';
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
                <p className="mt-4 text-lg">Loading Film Data...</p>
            </div>
        );
     }
    if (errorPage) {
        return (
            <div className="bg-black text-red-500 p-8 rounded-lg shadow-lg text-center min-h-screen flex flex-col justify-center items-center">
                <div className="w-full px-4 md:px-8 py-4 absolute top-0 left-0"><Breadcrumbs items={breadcrumbItems} /></div>
                <AlertCircle className="mx-auto h-16 w-16 text-red-400 my-4" />
                <h2 className="text-2xl font-semibold mb-3">Error Loading Film</h2>
                <p className="text-md mb-6 max-w-lg">{errorPage}</p>
                <button onClick={() => navigate(-1)} className="mt-6 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-amber-500 transition-colors">
                    <ArrowLeft className="mr-2 h-5 w-5" /> Go Back
                </button>
            </div>
        );
    }
    if (!workData) {
         return (
            <div className="bg-black text-gray-400 p-8 rounded-lg shadow-lg text-center min-h-screen flex flex-col justify-center items-center">
                 <div className="w-full px-4 md:px-8 py-4 absolute top-0 left-0"><Breadcrumbs items={breadcrumbItems} /></div>
                <h2 className="text-2xl font-semibold mb-3">Film Not Found</h2>
                <p>The requested film or documentary could not be found.</p>
                 <button onClick={() => navigate('/')} className="mt-6 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-amber-500 transition-colors">
                     Go Home
                 </button>
            </div>
        );
     }

    const posterUrl = workData.imagePath || FALLBACK_IMAGE_URL;

    // Construct TMDB link if possible
    let tmdbLink = null;
    if (workData.SourcingCredit && workData.externalId && workData.title) {
        const kebabTitle = toKebabCase(workData.title);
        if (kebabTitle) { // Ensure kebabTitle is not empty
            tmdbLink = `${TMDB_BASE_URL}${workData.externalId}-${kebabTitle}`;
        } else { // Fallback if title becomes empty after kebab-casing (unlikely but good to handle)
            tmdbLink = `${TMDB_BASE_URL}${workData.externalId}`;
        }
    }


    // --- Render Film Page ---
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
                        {/* Left Column: Poster and Film Details */}
                        <div className="lg:col-span-1 flex flex-col items-center">
                            <img
                                src={posterUrl}
                                alt={`Poster for ${workData.title}`}
                                className="rounded-lg shadow-xl w-full max-w-md lg:max-w-full object-cover aspect-[2/3]"
                                onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE_URL; }}
                            />
                            <div className="mt-6 w-full bg-gray-800 p-4 rounded-lg shadow-lg text-sm">
                                <h3 className="text-lg font-semibold text-amber-500 mb-3">Film Details</h3>
                                {workData.creatorName && (
                                    <p className="mb-2 flex items-center"><TvIcon size={16} className="mr-2 text-gray-400" /> <strong className="text-gray-300">Director:</strong> <span className="ml-1">{workData.creatorName}</span></p>
                                )}
                                {workData.publicationOrReleaseYear && (
                                    <p className="mb-2 flex items-center"><CalendarDaysIcon size={16} className="mr-2 text-gray-400" /> <strong className="text-gray-300">Year:</strong> <span className="ml-1">{workData.publicationOrReleaseYear}</span></p>
                                )}
                                {workData.publisherOrNetwork && (
                                    <p className="mb-2 flex items-center"><CopyrightIcon size={16} className="mr-2 text-gray-400" /> <strong className="text-gray-300">Production:</strong> <span className="ml-1">{workData.publisherOrNetwork}</span></p>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Summary, How to Watch, Attribution */}
                        <div className={`lg:col-span-2 border ${BRONZE_BORDER} p-6 rounded-lg shadow-lg flex flex-col`}>
                            <div>
                                {/* --- CORRECTED SUMMARY DISPLAY LOGIC --- */}
                                <ItemSummaryDisplay summaryText={workData.summaryNotes || itemData?.summaryNotes} />
                            </div>

                            <div className="mt-6 pt-6 border-t border-gray-700">
                                <h2 className="text-2xl font-semibold ${BRONZE_COLOR} mb-4">How to Watch</h2>
                                {workData.streamingProviders && workData.streamingProviders.length > 0 ? (
                                    <div className="text-gray-300">
                                        {/* This will be replaced by StreamingProvidersComponent */}
                                        <p>Streaming information will be displayed here.</p>
                                        <ul>
                                            {workData.streamingProviders.map(provider => (
                                                <li key={provider.id}>{provider.providerName} - {provider.streamingType}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : (
                                    <p className="text-gray-400">Streaming information is currently unavailable for this title.</p>
                                )}
                            </div>
                            
                            <div className="mt-auto pt-6 border-t border-gray-700 text-xs text-gray-500">
                                {workData.SourcingCredit && tmdbLink ? (
                                    <a 
                                        href={tmdbLink} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="flex items-center hover:text-amber-400 transition-colors"
                                    >
                                        <img src={tmdbLogo} alt="TMDB Logo" className="h-5 w-auto mr-2" /> 
                                        <span>{workData.SourcingCredit}</span>
                                    </a>
                                ) : workData.SourcingCredit ? ( 
                                    <div className="flex items-center">
                                        <img src={tmdbLogo} alt="TMDB Logo" className="h-5 w-auto mr-2" /> 
                                        <span>Data Sourced From: {workData.SourcingCredit}</span>
                                    </div>
                                ) : (
                                    /* --- CORRECTED AI DISCLAIMER LOGIC --- */
                                    (workData.aiGenerated !== false && !workData.externalId) && <AIDisclaimer type="film data" />
                                )}
                            </div>
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
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <RelatedMediaList mediaItems={relatedMediaItems} isLoading={loadingMedia} error={errorMedia} />
                        </div>
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <OtherInvolvedPersonsList people={otherInvolvedPersons} isLoading={loadingOIPs} error={errorOIPs} />
                        </div>
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <OrganizationsMentionedList organizations={relatedOrganizations} isLoading={loadingOrganizations} error={errorOrganizations} />
                        </div>
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <ContributingFactorsList factors={relatedFactors} isLoading={loadingFactors} error={errorFactors} />
                        </div>
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96 md:col-span-2 lg:col-span-1`}>
                            <ExternalSourcesList sources={externalSources} isLoading={loadingSources} error={errorSources} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default FilmPage;
