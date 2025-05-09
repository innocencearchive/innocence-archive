/* ========================================================================== */
/* --- File: src/pages/OrganizationInfoPage.jsx (Refactored Block Design v1) */
/* --- Implements block layout for organization details ---                 */
/* ========================================================================== */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// --- Import Icons ---
import { Building, Users, Tv, Link as LinkIcon, ArrowLeft, AlertCircle, Loader2, BookOpen, FileText } from 'lucide-react'; // Added Tv, LinkIcon, Loader2, BookOpen, FileText

// --- Import Theme Constants ---
import { BRONZE_BORDER, BRONZE_COLOR } from '../components/themeconstants';

// --- Import Sub-Components ---
import Breadcrumbs from '../components/Breadcrumbs';
// Block 1 Components
import OrganizationContactDetails from '../components/OrganizationContactDetails'; // Renamed/Refactored from OrganizationContactInfo
import OrganizationMissionDisplay from '../components/OrganizationMissionDisplay'; // Renamed/Refactored from OrganizationMission
// Block 1.5 Component
import WrongfullyConvictedList from '../components/WrongfullyConvictedList'; // For WC individuals related to this org
// Block 2 Components ("Learn More")
import MentionedInMediaList from '../components/MentionedInMediaList'; // NEW component needed
import OtherInvolvedPersonsList from '../components/OtherInvolvedPersonsList'; // Existing component
import RelatedOrganizationsList from '../components/RelatedOrganizationsList'; // NEW component needed
import ExternalSourcesList from '../components/ExternalSourcesList'; // NEW component needed (or adapt OtherSourcesList)
import AIDisclaimer from '../components/AIDisclaimer';

// --- Helper Functions ---
const formatOrgType = (orgType) => {
    if (!orgType) return 'Unknown Type';
    // Example: INNOCENCE_ORG -> Innocence Org
    return orgType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

// --- Main OrganizationInfoPage Component ---
function OrganizationInfoPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    // --- State Hooks ---
    // Main Organization Data
    const [orgData, setOrgData] = useState(null);
    const [loadingOrg, setLoadingOrg] = useState(true);
    const [errorOrg, setErrorOrg] = useState(null);

    // Related Data States (Fetched Separately)
    const [wrongfullyConvicted, setWrongfullyConvicted] = useState([]);
    const [loadingWC, setLoadingWC] = useState(false);
    const [errorWC, setErrorWC] = useState(null);

    const [mentionedInMedia, setMentionedInMedia] = useState([]);
    const [loadingMedia, setLoadingMedia] = useState(false);
    const [errorMedia, setErrorMedia] = useState(null);

    const [otherInvolvedPersons, setOtherInvolvedPersons] = useState([]);
    const [loadingOIPs, setLoadingOIPs] = useState(false);
    const [errorOIPs, setErrorOIPs] = useState(null);

    const [relatedOrganizations, setRelatedOrganizations] = useState([]);
    const [loadingOrgs, setLoadingOrgs] = useState(false);
    const [errorOrgs, setErrorOrgs] = useState(null);

    const [externalSources, setExternalSources] = useState([]);
    const [loadingSources, setLoadingSources] = useState(false);
    const [errorSources, setErrorSources] = useState(null);

    // --- Effect 1: Fetch main Organization data ---
    useEffect(() => {
        const fetchOrgData = async () => {
            setLoadingOrg(true); setErrorOrg(null); setOrgData(null);
            // Reset related data states
            setWrongfullyConvicted([]); setErrorWC(null);
            setMentionedInMedia([]); setErrorMedia(null);
            setOtherInvolvedPersons([]); setErrorOIPs(null);
            setRelatedOrganizations([]); setErrorOrgs(null);
            setExternalSources([]); setErrorSources(null);

            const apiUrl = `http://localhost:3001/api/organizations/${id}`;
            console.log(`Fetching main organization data from: ${apiUrl}`);
            try {
                const response = await fetch(apiUrl);
                if (!response.ok) {
                     const errorData = await response.json().catch(() => ({}));
                     throw new Error(`HTTP error! status: ${response.status} - ${errorData.message || 'Failed to fetch organization data'}`);
                }
                const data = await response.json();
                setOrgData(data);
            } catch (err) {
                console.error("Fetch organization error:", err);
                setErrorOrg(err.message);
            } finally {
                setLoadingOrg(false);
            }
        };
        if (id) { fetchOrgData(); }
        else { setErrorOrg("No organization ID provided."); setLoadingOrg(false); }
    }, [id]);

    // --- Effect 2: Fetch ALL related data AFTER orgData is loaded ---
    useEffect(() => {
        if (!orgData?.id) return;
        const orgId = orgData.id;

        // Helper function to fetch related data
        const fetchRelated = async (endpoint, setData, setLoading, setError, typeLabel) => {
            setLoading(true); setError(null);
            const apiUrl = `http://localhost:3001/api/organizations/${orgId}/${endpoint}`;
            console.log(`Fetching ${typeLabel} from: ${apiUrl}`);
            try {
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`HTTP error loading ${typeLabel}! status: ${response.status} - ${errorData.message || 'Failed to fetch'}`);
                }
                const data = await response.json();
                setData(data);
            } catch (err) {
                console.error(`Fetch ${typeLabel} error:`, err);
                setError(err.message);
                setData([]);
            } finally {
                setLoading(false);
            }
        };

        // Fetch all related data types needed for Blocks 1.5 and 2
        fetchRelated('individuals', setWrongfullyConvicted, setLoadingWC, setErrorWC, 'Wrongfully Convicted');
        fetchRelated('media', setMentionedInMedia, setLoadingMedia, setErrorMedia, 'Mentioned In Media'); // Assumes endpoint '/media'
        fetchRelated('involvedpersons', setOtherInvolvedPersons, setLoadingOIPs, setErrorOIPs, 'Other Involved Persons');
        fetchRelated('relatedorgs', setRelatedOrganizations, setLoadingOrgs, setErrorOrgs, 'Related Organizations'); // Assumes endpoint '/relatedorgs'
        fetchRelated('externalsources', setExternalSources, setLoadingSources, setErrorSources, 'External Sources'); // Assumes endpoint '/externalsources'

    }, [orgData]); // Depend only on orgData

    // --- Breadcrumb Logic ---
    let breadcrumbItems = [{ label: "Home", link: "/" }];
    const orgName = orgData?.name ?? 'Organization';

    if (loadingOrg) {
        breadcrumbItems.push({ label: "Loading..." });
    } else if (errorOrg) {
        breadcrumbItems.push({ label: "Error" });
    } else if (orgData) {
        breadcrumbItems.push({ label: orgName }); // Current page, no link
    } else {
        breadcrumbItems.push({ label: "Not Found" });
    }

    // --- Loading State ---
    if (loadingOrg) {
         return ( <div className="bg-black text-gray-400 p-8 rounded-lg shadow-lg text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /> <p className="mt-4">Loading organization details...</p></div> );
    }
    // --- Error State ---
    if (errorOrg) {
         return (
             <div className="bg-black text-red-500 p-8 rounded-lg shadow-lg text-center">
                 <div className="w-full px-4 md:px-8 py-4"><Breadcrumbs items={breadcrumbItems} /></div>
                 <AlertCircle className="mx-auto h-12 w-12 text-red-400 my-4" />
                 <h2 className="text-xl font-semibold mb-2">Error Loading Organization</h2>
                 <p className="text-sm">{errorOrg}</p>
                 <button onClick={() => navigate(-1)} className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500">
                     <ArrowLeft className="mr-2 h-5 w-5" /> Go Back
                 </button>
             </div>
         );
    }
    // --- Not Found State ---
    if (!orgData) {
         return (
             <div className="bg-black text-gray-400 p-8 rounded-lg shadow-lg text-center">
                 <div className="w-full px-4 md:px-8 py-4"><Breadcrumbs items={breadcrumbItems} /></div>
                 <p>Organization data not available.</p>
             </div>
         );
    }

    // --- Render OrganizationInfo Page ---
    const formattedType = formatOrgType(orgData.type);

    return (
        // Root element with black background
        <div className="text-gray-50 bg-black rounded-lg shadow-lg overflow-hidden">
            {/* Header Area / Breadcrumbs */}
            <div className="w-full px-4 md:px-8 py-4">
                <Breadcrumbs items={breadcrumbItems} />
            </div>

            {/* === BLOCK 1: Information === */}
            <div className="flex flex-col items-center justify-start px-4 md:px-8 pt-16 pb-8"> {/* Align content top */}
                <div className="w-full">
                    {/* Main Title & Type */}
                    <h1 className={`text-4xl md:text-5xl ${BRONZE_COLOR} mb-2 text-center font-serif font-bold tracking-wider uppercase`}>
                        {orgName}
                    </h1>
                    <p className="text-center text-lg text-gray-400 mb-12">
                        <Building size={20} className="inline mr-2" /> {formattedType}
                    </p>

                    {/* Two-column grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
                        {/* Contact Details Sidebar (Left) */}
                        <div className="lg:col-span-1 order-last lg:order-first p-6 rounded-lg shadow-inner bg-gray-800">
                            {/* Use OrganizationContactDetails component */}
                            <OrganizationContactDetails org={orgData} />
                        </div>
                        {/* Mission Statement (Right) */}
                        <div className={`lg:col-span-2 border ${BRONZE_BORDER} p-6 rounded-lg shadow-lg`}>
                            {/* Use OrganizationMissionDisplay component */}
                            {/* Pass 'notes' field from schema as mission text */}
                            <OrganizationMissionDisplay missionText={orgData.notes} />
							
                            {/* *** ADDED AI DISCLAIMER HERE *** */}
                            {/* Show disclaimer if aiGenerated is true (or null/undefined if using default) */}
                            {/* Ensure individualData includes the 'aiGenerated' field from your API */}
                            {orgData.aiGenerated !== false && <AIDisclaimer />}
                            {/* Using !== false allows it to show if true OR if the field is missing (null/undefined) */}
                        </div>
                    </div>
                </div>
            </div>

            {/* === BLOCK 1.5: Wrongfully Convicted Individuals Related === */}
            <div className="flex flex-col items-center justify-start px-4 md:px-8 py-8"> {/* Align content top */}
                <div className="w-full">
                     {/* Container div with border, padding, scroll */}
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
            <div className="flex flex-col items-center justify-start px-4 md:px-8 pt-8 pb-16"> {/* Align content top */}
                <div className="w-full">
                    <h2 className={`text-3xl md:text-4xl font-semibold mb-10 text-center ${BRONZE_COLOR}`}>Learn More</h2>
                    {/* 2x2 Grid layout */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">

                        {/* Mentioned In Media */}
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <MentionedInMediaList
                                mediaItems={mentionedInMedia} // Pass the fetched media items
                                isLoading={loadingMedia}
                                error={errorMedia}
                            />
                        </div>

                        {/* Other Individuals */}
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <OtherInvolvedPersonsList
                                people={otherInvolvedPersons}
                                isLoading={loadingOIPs}
                                error={errorOIPs}
                            />
                        </div>

                        {/* Related Organizations */}
                         <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                             <RelatedOrganizationsList
                                 organizations={relatedOrganizations} // Pass fetched related orgs
                                 isLoading={loadingOrgs}
                                 error={errorOrgs}
                             />
                         </div>

                        {/* External Sources */}
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                             <ExternalSourcesList
                                 sources={externalSources} // Pass fetched external sources
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

export default OrganizationInfoPage;
