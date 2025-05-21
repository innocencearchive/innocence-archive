/* ========================================================================== */
/* --- File: src/pages/BookPage.jsx ---                                     */
/* --- Displays a dedicated view for Books ---                              */
/* --- Features cover image, details, summary, and purchase/read info ---   */
/* ========================================================================== */
import apiClient from '../apiClient';
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// --- Import Icons ---
import { ArrowLeft, AlertCircle, BookOpen, Users, Building, Info, FileText, ListTree, Loader2, CalendarDaysIcon, Edit3Icon, DollarSignIcon, LibraryIcon, ExternalLinkIcon } from 'lucide-react'; // Added BookOpen, LibraryIcon, ExternalLinkIcon

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
import BookPurchaseInfo from '../components/BookPurchaseInfo'; // New component

// --- Constants ---
const FALLBACK_IMAGE_URL = 'https://placehold.co/500x750/333333/CCCCCC?text=No+Cover'; // Adjusted for book aspect ratio

// --- Helper Functions ---
const getMediaTypeIcon = (mediaType) => {
    return <BookOpen size={20} className="inline mr-2" />;
};

const formatMediaType = (mediaType) => {
    if (!mediaType) return 'Media';
    if (mediaType === 'BOOK') return 'Book';
    // Add other types if this page might be reused, though it's specific for books now
    return mediaType.charAt(0).toUpperCase() + mediaType.slice(1).toLowerCase();
};

// --- Main BookPage Component ---
function BookPage() {
    const { id: workId } = useParams();
    const navigate = useNavigate();

    // --- State Hooks ---
    const [workData, setWorkData] = useState(null);
    // itemData might not be as relevant for books if all info is on MediaWork and BookPurchaseDetails
    // but we'll keep the structure similar to FilmPage for related lists if they are tied to items.
    // For books, "items" might be chapters if you ever model that, or a single "content" item.
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

    const [externalSources, setExternalSources] = useState([]); // Typically linked to MediaItem
    const [loadingSources, setLoadingSources] = useState(false);
    const [errorSources, setErrorSources] = useState(null);

    const [relatedMediaItems, setRelatedMediaItems] = useState([]); // Typically linked to MediaItem
    const [loadingMedia, setLoadingMedia] = useState(false);
    const [errorMedia, setErrorMedia] = useState(null);

    // --- Effect 1: Fetch Core Work Data (including bookPurchaseDetails) ---
    useEffect(() => {
        if (!workId) {
            setErrorPage("No media ID provided in URL.");
            setLoadingPage(false);
            return;
        }
        const fetchCoreData = async () => {
            setLoadingPage(true); setErrorPage(null); setWorkData(null); setItemData(null);
            console.log(`BookPage: Fetching data for Work ID: ${workId}`);
            try {
                // The backend route /api/mediaworks/:id already includes bookPurchaseDetails
                const workApiUrl = `/api/mediaworks/${workId}`;
                console.log(`BookPage: Fetching work data from (using apiClient): ${workApiUrl}`);
                const response = await apiClient.get(workApiUrl);
                const fetchedWorkData = response.data;

                if (fetchedWorkData.workType !== 'BOOK') {
                     throw new Error(`BookPage is only for Books. Found type: ${fetchedWorkData.workType}`);
                }
                setWorkData(fetchedWorkData);
                console.log("BookPage: Fetched Work Data:", fetchedWorkData);
                console.log("BookPage: Book Purchase Details:", fetchedWorkData.bookPurchaseDetails);


                // For books, the primary content is the book itself.
                // If you have a MediaItem of type 'BOOK_CONTENT' linked, you can set it.
                // Otherwise, related lists might need to be fetched directly via workId if applicable,
                // or some lists might not apply directly to a "work" level for books.
                const contentItem = fetchedWorkData.items?.find(item =>
                    item.itemMediaType === 'BOOK_CONTENT' // Assuming you have such an item type
                );

                if (contentItem) {
                    setItemData(contentItem);
                    console.log("BookPage: Found content item (e.g., for related sources):", contentItem);
                } else {
                    // If no specific "BOOK_CONTENT" item, some related lists might rely on workData directly
                    // or might not be applicable.
                    console.warn(`BookPage: No specific 'BOOK_CONTENT' MediaItem found for Work ID ${workId}.`);
                    setItemData(null); // Or set a dummy item if needed for related list fetching logic
                }

            } catch (err) {
                console.error("BookPage: Error fetching core data:", err);
                const errorMessage = err.response?.data?.message || err.message || "Failed to fetch book data.";
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
        // This logic can be similar to FilmPage, but ensure endpoints are appropriate for books
        // Some lists might be fetched via workId, others via itemId if a contentItem exists
        if (!workId || loadingPage || errorPage || !workData) {
             setWrongfullyConvicted([]); setOtherInvolvedPersons([]); setRelatedOrganizations([]);
             setRelatedFactors([]); setExternalSources([]); setRelatedMediaItems([]);
            return;
        }

        // Fetch lists related to the MediaWork itself
        const fetchWorkRelatedList = async (endpoint, setData, setLoading, setError, typeLabel) => {
            setLoading(true); setError(null); setData([]);
            const apiUrl = `/api/mediaworks/${workId}/${endpoint}`;
            console.log(`BookPage: Fetching ${typeLabel} for Work ID ${workId} from: ${apiUrl}`);
            try {
                const response = await apiClient.get(apiUrl);
                setData(response.data);
            } catch (err) {
                console.error(`BookPage: Fetch ${typeLabel} error:`, err);
                setError(err.response?.data?.message || err.message || `Failed to fetch ${typeLabel}.`);
            } finally { setLoading(false); }
        };

        // Fetch lists related to the primary MediaItem (if one exists, e.g., for external sources)
        const fetchItemRelatedList = async (endpoint, setData, setLoading, setError, typeLabel) => {
            if (!itemData || !itemData.id) {
                console.warn(`BookPage: Skipping fetch for ${typeLabel} as itemData is not available.`);
                setData([]); setLoading(false); return;
            }
            const itemId = itemData.id;
            setLoading(true); setError(null); setData([]);
            const apiUrl = `/api/mediaitems/${itemId}/${endpoint}`;
            console.log(`BookPage: Fetching ${typeLabel} for Item ID ${itemId} from: ${apiUrl}`);
            try {
                const response = await apiClient.get(apiUrl);
                setData(response.data);
            } catch (err) {
                console.error(`BookPage: Fetch ${typeLabel} error:`, err);
                setError(err.response?.data?.message || err.message || `Failed to fetch ${typeLabel}.`);
            } finally { setLoading(false); }
        };

        // Adjust these calls based on how your data is structured for books
        fetchWorkRelatedList('individuals', setWrongfullyConvicted, setLoadingWC, setErrorWC, 'Wrongfully Convicted Mentioned');
        fetchWorkRelatedList('involvedpersons', setOtherInvolvedPersons, setLoadingOIPs, setErrorOIPs, 'Other Involved Persons Mentioned');
        fetchWorkRelatedList('organizations', setRelatedOrganizations, setLoadingOrganizations, setErrorOrganizations, 'Organizations Mentioned');
        fetchWorkRelatedList('factors', setRelatedFactors, setLoadingFactors, setErrorFactors, 'Factors Discussed');
        
        // These might be tied to a MediaItem if you have one for the book's content
        fetchItemRelatedList('othersources', setExternalSources, setLoadingSources, setErrorSources, 'External Sources (from item)');
        fetchItemRelatedList('relatedmedia', setRelatedMediaItems, setLoadingMedia, setErrorMedia, 'Related Media (from item)');

    }, [workId, workData, itemData, loadingPage, errorPage]);


    // --- Breadcrumb Logic ---
    let breadcrumbItems = [{ label: "Home", link: "/" }];
    const pageTitle = workData?.title ?? 'Book';
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
                <p className="mt-4 text-lg">Loading Book Data...</p>
            </div>
        );
     }
    if (errorPage) {
        return (
            <div className="bg-black text-red-500 p-8 rounded-lg shadow-lg text-center min-h-screen flex flex-col justify-center items-center">
                <div className="w-full px-4 md:px-8 py-4 absolute top-0 left-0"><Breadcrumbs items={breadcrumbItems} /></div>
                <AlertCircle className="mx-auto h-16 w-16 text-red-400 my-4" />
                <h2 className="text-2xl font-semibold mb-3">Error Loading Book</h2>
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
                <h2 className="text-2xl font-semibold mb-3">Book Not Found</h2>
                <p>The requested book could not be found.</p>
                 <button onClick={() => navigate('/')} className="mt-6 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-amber-500 transition-colors">
                     Go Home
                 </button>
            </div>
        );
     }

    // Use the heightModifiedImageLink_api or a fallback for the cover image
    // This assumes you will store this in workData.imagePath after seeding
    const coverImageUrl = workData.imagePath || 
                          workData.bookPurchaseDetails?.heightModifiedImageLink_api || // If you store it directly in bookPurchaseDetails
                          FALLBACK_IMAGE_URL;


    // --- Render Book Page ---
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
                    {workData.bookPurchaseDetails?.subtitle_api && (
                        <h2 className="text-2xl text-gray-400 mb-4 text-center font-serif">
                            {workData.bookPurchaseDetails.subtitle_api}
                        </h2>
                    )}
                    <p className="text-center text-lg text-gray-400 mb-12">
                        {getMediaTypeIcon(workData.workType)} {pageType}
                    </p>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
                        {/* Left Column: Cover Image and Book Details */}
                        <div className="lg:col-span-1 order-last lg:order-first flex flex-col items-center">
                            <img
                                src={coverImageUrl}
                                alt={`Cover for ${workData.title}`}
                                className="rounded-lg shadow-xl w-full max-w-xs md:max-w-sm lg:max-w-full object-contain" // Use object-contain for books
                                style={{ maxHeight: '600px' }} // Ensure it doesn't get too large if original is huge
                                onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE_URL; }}
                            />
                            <div className="mt-6 w-full bg-gray-800 p-4 rounded-lg shadow-lg text-sm">
                                <h3 className="text-lg font-semibold text-amber-500 mb-3">Book Details</h3>
                                {workData.creatorName && ( // Assuming creatorName is Author for books
                                    <p className="mb-2 flex items-center"><Edit3Icon size={16} className="mr-2 text-gray-400" /> <strong className="text-gray-300">Author:</strong> <span className="ml-1">{workData.creatorName}</span></p>
                                )}
                                {workData.publicationOrReleaseYear && (
                                    <p className="mb-2 flex items-center"><CalendarDaysIcon size={16} className="mr-2 text-gray-400" /> <strong className="text-gray-300">Year:</strong> <span className="ml-1">{workData.publicationOrReleaseYear}</span></p>
                                )}
                                {workData.publisherOrNetwork && ( // Assuming publisherOrNetwork is Publisher
                                    <p className="mb-2 flex items-center"><Building size={16} className="mr-2 text-gray-400" /> <strong className="text-gray-300">Publisher:</strong> <span className="ml-1">{workData.publisherOrNetwork}</span></p>
                                )}
                                {workData.bookPurchaseDetails?.pageCount_api && (
                                    <p className="mb-2 flex items-center"><FileText size={16} className="mr-2 text-gray-400" /> <strong className="text-gray-300">Pages:</strong> <span className="ml-1">{workData.bookPurchaseDetails.pageCount_api}</span></p>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Summary and How to Read */}
                        <div className={`lg:col-span-2 border ${BRONZE_BORDER} p-6 rounded-lg shadow-lg flex flex-col`}>
                            <div>
                                <h2 className="text-2xl font-semibold text-amber-500 mb-4">Summary</h2>
                                <ItemSummaryDisplay summaryText={workData.summaryNotes || workData.bookPurchaseDetails?.description_api} />
                            </div>

                            <div className="mt-6 pt-6 border-t border-gray-700">
                                <h2 className="text-2xl font-semibold text-amber-500 mb-4">How to Read</h2>
                                <BookPurchaseInfo
                                    details={workData.bookPurchaseDetails}
                                    externalId={workData.externalId} // Assuming this will be ISBN-13
                                />
                            </div>
                            
                            <div className="mt-auto pt-6 border-t border-gray-700 text-xs text-gray-500">
                                {(workData.aiGenerated !== false || workData.bookPurchaseDetails?.aiGenerated !== false ) && <AIDisclaimer type="book data" />}
                                {workData.SourcingCredit && ( // If you add sourcing credit for Google Books API
                                     <p className="mt-2">Data sourced from: {workData.SourcingCredit}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* === BLOCK 1.5: Wrongfully Convicted Individuals (if applicable to this book) === */}
            {(loadingWC || wrongfullyConvicted.length > 0 || errorWC) && (
                <div className="flex flex-col items-center justify-start px-4 md:px-8 py-8">
                    <div className="w-full max-w-6xl mx-auto">
                         <h2 className={`text-3xl md:text-4xl font-semibold mb-6 text-center ${BRONZE_COLOR}`}>Individuals Mentioned</h2>
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
                        {/* Adjust which lists are relevant for books */}
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <RelatedMediaList mediaItems={relatedMediaItems} isLoading={loadingMedia} error={errorMedia} itemTypeForEmpty="related items" />
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

export default BookPage;
