/* ========================================================================== */
/* --- File: src/pages/OrganizationInfoPage.jsx (Refactored Block Design v1) */
/* --- Implements block layout for organization details ---                 */
/* --- MODIFIED: Corrected apiClient error handling for fetchOrgData ---    */
/* ========================================================================== */
import apiClient from '../apiClient'; // Adjust the path if apiClient.js is elsewhere
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// --- Import Icons ---
import { Building, Users, Tv, Link as LinkIcon, ArrowLeft, AlertCircle, Loader2, BookOpen, FileText } from 'lucide-react';

// --- Import Theme Constants ---
import { BRONZE_BORDER, BRONZE_COLOR } from '../components/themeconstants';

// --- Import Sub-Components ---
import Breadcrumbs from '../components/Breadcrumbs';
import OrganizationContactDetails from '../components/OrganizationContactDetails';
import OrganizationMissionDisplay from '../components/OrganizationMissionDisplay';
import WrongfullyConvictedList from '../components/WrongfullyConvictedList';
import MentionedInMediaList from '../components/MentionedInMediaList';
import OtherInvolvedPersonsList from '../components/OtherInvolvedPersonsList';
import RelatedOrganizationsList from '../components/RelatedOrganizationsList';
import ExternalSourcesList from '../components/ExternalSourcesList';
import AIDisclaimer from '../components/AIDisclaimer';

// --- Helper Functions ---
const formatOrgType = (orgType) => {
    if (!orgType) return 'Unknown Type';
    return orgType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

// --- Main OrganizationInfoPage Component ---
function OrganizationInfoPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    // --- State Hooks ---
    const [orgData, setOrgData] = useState(null);
    const [loadingOrg, setLoadingOrg] = useState(true);
    const [errorOrg, setErrorOrg] = useState(null);

    const [wrongfullyConvicted, setWrongfullyConvicted] = useState([]);
    const [loadingWC, setLoadingWC] = useState(false);
    const [errorWC, setErrorWC] = useState(null);

    const [mentionedInMedia, setMentionedInMedia] = useState([]);
    const [loadingMedia, setLoadingMedia] = useState(false);
    const [errorMedia, setErrorMedia] = useState(null);

    const [otherInvolvedPersons, setOtherInvolvedPersons] = useState([]);
    const [loadingOIPs, setLoadingOIPs] = useState(false);
    const [errorOIPs, setErrorOIPs] = useState(null);

    const [relatedOrganizationsData, setRelatedOrganizationsData] = useState([]);
    const [loadingOrgs, setLoadingOrgs] = useState(false);
    const [errorOrgs, setErrorOrgs] = useState(null);

    const [externalSourcesData, setExternalSourcesData] = useState([]);
    const [loadingSources, setLoadingSources] = useState(false);
    const [errorSources, setErrorSources] = useState(null);

    // --- Effect 1: Fetch main Organization data ---
    useEffect(() => {
        const fetchOrgData = async () => {
            setLoadingOrg(true); 
            setErrorOrg(null); 
            setOrgData(null);
            // Reset related data states
            setWrongfullyConvicted([]); setErrorWC(null);
            setMentionedInMedia([]); setErrorMedia(null);
            setOtherInvolvedPersons([]); setErrorOIPs(null);
            setRelatedOrganizationsData([]); setErrorOrgs(null);
            setExternalSourcesData([]); setErrorSources(null);

            const apiUrl = `/organizations/${id}`;
            console.log(`Fetching main organization data from (using apiClient): ${apiUrl}`);
            try {
                const response = await apiClient.get(apiUrl);
                const data = response.data;
                setOrgData(data);
            } catch (err) {
                console.error("Fetch organization error:", err);
                let errorMessage = "An unknown error occurred while fetching organization data.";
                if (err.response) {
                    errorMessage = err.response.data?.message || `Error: ${err.response.status} - ${err.response.statusText}`;
                } else if (err.request) {
                    errorMessage = "No response received from server. Please check your network connection.";
                } else {
                    errorMessage = err.message;
                }
                setErrorOrg(errorMessage);
            } finally {
                setLoadingOrg(false);
            }
        };
        if (id) { 
            fetchOrgData(); 
        } else { 
            setErrorOrg("No organization ID provided."); 
            setLoadingOrg(false); 
        }
    }, [id]);

    // --- Effect 2: Fetch ALL related data AFTER orgData is loaded ---
    useEffect(() => {
        if (!orgData?.id || loadingOrg || errorOrg) {
            setWrongfullyConvicted([]); 
            setMentionedInMedia([]); 
            setOtherInvolvedPersons([]); 
            setRelatedOrganizationsData([]); 
            setExternalSourcesData([]);
            return;
        }
        const orgId = orgData.id;

        const fetchRelated = async (endpoint, setData, setLoading, setErrorState, typeLabel) => {
            setLoading(true); 
            setErrorState(null); 
            setData([]);
            
            const apiUrl = `/api/organizations/${orgId}/${endpoint}`;
            console.log(`Fetching ${typeLabel} from (using apiClient): ${apiUrl}`);
            try {
                const response = await apiClient.get(apiUrl);
                const data = response.data;
                setData(data);
            } catch (err) {
                console.error(`Fetch ${typeLabel} error:`, err);
                let errorMessage = `An unknown error occurred while fetching ${typeLabel}.`;
                if (err.response) {
                    if (err.response.status === 501) {
                        console.warn(`Endpoint /${endpoint} is not implemented for Organizations.`);
                        errorMessage = `Feature not available (${endpoint}).`;
                    } else {
                        errorMessage = err.response.data?.message || `Error fetching ${typeLabel}: ${err.response.status} - ${err.response.statusText}`;
                    }
                } else if (err.request) {
                    errorMessage = `No response received for ${typeLabel}. Check network.`;
                } else {
                    errorMessage = err.message;
                }
                setErrorState(errorMessage);
            }
            finally { 
                setLoading(false); 
            }
        };

        fetchRelated('individuals', setWrongfullyConvicted, setLoadingWC, setErrorWC, 'Wrongfully Convicted');
        fetchRelated('mediaappearances', setMentionedInMedia, setLoadingMedia, setErrorMedia, 'Mentioned In Media');
        fetchRelated('involvedpersons', setOtherInvolvedPersons, setLoadingOIPs, setErrorOIPs, 'Other Involved Persons');
        fetchRelated('relatedorganizations', setRelatedOrganizationsData, setLoadingOrgs, setErrorOrgs, 'Related Organizations');
        fetchRelated('sourcelinks', setExternalSourcesData, setLoadingSources, setErrorSources, 'External Sources');

    }, [orgData, loadingOrg, errorOrg]);

    // --- Breadcrumb Logic ---
    let breadcrumbItems = [{ label: "Home", link: "/" }];
    const orgName = orgData?.name ?? 'Organization';

    if (loadingOrg) {
        breadcrumbItems.push({ label: "Loading..." });
    } else if (errorOrg) {
        breadcrumbItems.push({ label: "Error" });
    } else if (orgData) {
        breadcrumbItems.push({ label: orgName });
    } else {
        breadcrumbItems.push({ label: "Not Found" });
    }

    // --- Loading State ---
    if (loadingOrg) {
         return ( <div className="bg-black text-gray-400 p-8 rounded-lg shadow-lg text-center min-h-screen flex flex-col justify-center items-center"><Loader2 className="mx-auto h-12 w-12 animate-spin text-amber-500" /> <p className="mt-4 text-lg">Loading organization details...</p></div> );
    }
    // --- Error State ---
    if (errorOrg) {
         return (
             <div className="bg-black text-red-500 p-8 rounded-lg shadow-lg text-center min-h-screen flex flex-col justify-center items-center">
                 <div className="w-full px-4 md:px-8 py-4 absolute top-0 left-0"><Breadcrumbs items={breadcrumbItems} /></div>
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
             <div className="bg-black text-gray-400 p-8 rounded-lg shadow-lg text-center min-h-screen flex flex-col justify-center items-center">
                 <div className="w-full px-4 md:px-8 py-4 absolute top-0 left-0"><Breadcrumbs items={breadcrumbItems} /></div>
                 <p>Organization data not available for ID: {id}.</p>
             </div>
         );
    }

    // --- Render OrganizationInfo Page ---
    const formattedType = formatOrgType(orgData.type);

    return (
        <div className="text-gray-50 bg-black rounded-lg shadow-lg overflow-hidden">
            {/* Header Area / Breadcrumbs */}
            <div className="w-full px-4 md:px-8 py-4">
                <Breadcrumbs items={breadcrumbItems} />
            </div>

            {/* === BLOCK 1: Information === */}
            <div className="flex flex-col items-center justify-start px-4 md:px-8 pt-16 pb-8">
                <div className="w-full">
                    <h1 className={`text-4xl md:text-5xl ${BRONZE_COLOR} mb-2 text-center font-serif font-bold tracking-wider uppercase`}>
                        {orgName}
                    </h1>
                    <p className="text-center text-lg text-gray-400 mb-12">
                        <Building size={20} className="inline mr-2" /> {formattedType}
                    </p>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
                        <div className="lg:col-span-1 order-last lg:order-first p-6 rounded-lg shadow-inner bg-gray-800">
                            <OrganizationContactDetails org={orgData} />
                        </div>
                        <div className={`lg:col-span-2 border ${BRONZE_BORDER} p-6 rounded-lg shadow-lg`}>
                            <OrganizationMissionDisplay missionText={orgData.notes} />
                            {orgData.aiGenerated !== false && <AIDisclaimer />}
                        </div>
                    </div>
                </div>
            </div>

            {/* === BLOCK 1.5: Wrongfully Convicted Individuals Related === */}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <MentionedInMediaList
                                mediaItems={mentionedInMedia}
                                isLoading={loadingMedia}
                                error={errorMedia}
                            />
                        </div>
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <OtherInvolvedPersonsList
                                people={otherInvolvedPersons}
                                isLoading={loadingOIPs}
                                error={errorOIPs}
                            />
                        </div>
                         <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                             <RelatedOrganizationsList
                                 organizations={relatedOrganizationsData} 
                                 isLoading={loadingOrgs}
                                 error={errorOrgs}
                             />
                         </div>
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                             <ExternalSourcesList
                                 sources={externalSourcesData} 
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

export default OrganizationInfoPage;
// ENSURE THERE ARE NO CHARACTERS (INCLUDING SPACES OR NEWLINES) AFTER THIS LINE
