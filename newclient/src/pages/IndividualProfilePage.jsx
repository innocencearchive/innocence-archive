/* ========================================================================== */
/* --- File: src/pages/IndividualProfilePage.jsx (Disclaimer Added) ---     */
/* --- MODIFIED: Updated error handling for apiClient (Axios) ---           */
/* --- MODIFIED: Moved OtherSourcesList into Story section ---            */
/* ========================================================================== */
import apiClient from '../apiClient'; // Adjust the path if apiClient.js is elsewhere
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react'; // Added Loader2 for consistency
import { BRONZE_BORDER, BRONZE_COLOR } from '../components/themeconstants';
import Breadcrumbs from '../components/Breadcrumbs';
import KeyInfo from '../components/KeyInfo';
import StoryNarrative from '../components/StoryNarrative';
import RelatedMediaList from '../components/RelatedMediaList';
import OrganizationsInvolved from '../components/OrganizationsInvolved';
import ContributingFactorsList from '../components/ContributingFactorsList';
import OtherSourcesList from '../components/OtherSourcesList';
import OtherInvolvedPersonsList from '../components/OtherInvolvedPersonsList';
import RelatedWrongfullyConvictedList from '../components/RelatedWrongfullyConvictedList';
import AIDisclaimer from '../components/AIDisclaimer';

// --- Helper Function to Format Status ---
const formatStatus = (status) => {
    if (!status) return 'Status Unknown';
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

// --- Main Individual Profile Page Component ---
function IndividualProfilePage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [individualData, setIndividualData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- Data Fetching Effect ---
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true); 
            setError(null); 
            setIndividualData(null);
            
            const apiUrl = `/individuals/${id}`;
            console.log(`Fetching data from (using apiClient): ${apiUrl}`);
            try {
                const response = await apiClient.get(apiUrl);
                const data = response.data;
                console.log("Fetched individual data:", data);
                setIndividualData(data);

            } catch (err) {
                console.error("Fetch error:", err);
                
                let errorMessage = "An unknown error occurred while fetching profile data.";
                if (err.response) {
                    console.error("Error response data:", err.response.data);
                    console.error("Error response status:", err.response.status);
                    errorMessage = err.response.data?.message || `Error: ${err.response.status} - ${err.response.statusText}`;
                } else if (err.request) {
                    console.error("Error request:", err.request);
                    errorMessage = "No response received from server. Please check your network connection.";
                } else {
                    console.error('Error message:', err.message);
                    errorMessage = err.message;
                }
                setError(errorMessage);
            }
            finally { 
                setLoading(false); 
            }
        };

        if (id) { 
            fetchData(); 
        } else { 
            setError("No individual ID provided."); 
            setLoading(false); 
        }
    }, [id]);

    // --- Prepare Data for StoryNarrative ---
    const storySectionsForNarrative = useMemo(() => {
        if (!individualData) return [];
        const sections = [];
        if (individualData.groups && individualData.groups.length > 0) {
            const groupNames = individualData.groups.map(g => g.name).join(', ');
            sections.push({ id: 'group-info-section', subheading: `Associated Group${individualData.groups.length > 1 ? 's' : ''}`, text: groupNames, isGroupInfo: true });
        }
        if (individualData.narrativeSummary) {
            sections.push({ id: 'summary-section', subheading: 'Narrative Overview', text: individualData.narrativeSummary });
        }
        return sections;
    }, [individualData]);
    
    // --- Prepare data for OtherSourcesList ---
    const otherSourcesData = useMemo(() => {
        if (!individualData || !individualData.sourceLinks || individualData.sourceLinks.length === 0) {
            return [];
        }
        return individualData.sourceLinks.map(link => ({
            id: link.id, // Using IndividualSourceLink id as key for the list item
            sourceName: link.informationSource.name, // Name of the source (e.g., "The Innocence Project")
            url: link.specificUrl, // The specific URL of the article
            headline: link.headline, // The headline of the article
            description: link.description // Optional: description from IndividualSourceLink
        }));
    }, [individualData]);


    // --- Prepare Combined List of Related Individuals ---
    const combinedRelatedIndividuals = useMemo(() => {
        if (!individualData) return [];
        const relatedMap = new Map();
        (individualData.relatedIndividuals || []).forEach(ind => { if (ind.id !== individualData.id) { relatedMap.set(ind.id, ind); } });
        (individualData.relatedToIndividuals || []).forEach(ind => { if (ind.id !== individualData.id) { relatedMap.set(ind.id, ind); } });
        return Array.from(relatedMap.values());
    }, [individualData]);

    // --- Breadcrumb Logic ---
    let breadcrumbItems = [{ label: "Home", link: "/" }];
    const profileName = individualData?.firstName && individualData?.lastName ? `${individualData.firstName} ${individualData.lastName}` : 'Profile';
    if (loading) breadcrumbItems.push({ label: "Loading..." });
    else if (error) breadcrumbItems.push({ label: "Error" });
    else if (individualData) breadcrumbItems.push({ label: profileName });
    else breadcrumbItems.push({ label: "Not Found" });

    // --- Loading State ---
    if (loading) { 
        return ( 
            <div className="bg-black text-gray-400 p-8 rounded-lg shadow-lg text-center min-h-screen flex flex-col justify-center items-center">
                <Loader2 className="h-12 w-12 animate-spin text-amber-500" />
                <p className="mt-4 text-lg">Loading Profile...</p>
            </div> 
        ); 
    }
    // --- Error State ---
    if (error) { 
        return ( 
            <div className="bg-black text-red-500 p-8 rounded-lg shadow-lg text-center min-h-screen flex flex-col justify-center items-center">
                <div className="w-full px-4 md:px-8 py-4 absolute top-0 left-0"><Breadcrumbs items={breadcrumbItems} /></div>
                <AlertCircle className="mx-auto h-12 w-12 text-red-400 my-4" />
                <h2 className="text-xl font-semibold mb-2">Error Loading Profile</h2> 
                <p className="text-sm">{error}</p>
                <button onClick={() => navigate(-1)} className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"> 
                    <ArrowLeft className="mr-2 h-5 w-5" /> Go Back 
                </button>
            </div> 
        ); 
    }
    // --- Not Found State ---
    if (!individualData) { 
        return ( 
            <div className="bg-black text-gray-400 p-8 rounded-lg shadow-lg text-center min-h-screen flex flex-col justify-center items-center">
                <div className="w-full px-4 md:px-8 py-4 absolute top-0 left-0"><Breadcrumbs items={breadcrumbItems} /></div>
                <p>Profile data not available for ID: {id}. This individual may not exist or there was an issue retrieving their data.</p>
            </div> 
        ); 
    }

    // --- Render Profile Page ---
    const formattedProfileStatus = formatStatus(individualData.status);

    return (
        <div className="text-gray-50 bg-black rounded-lg shadow-lg overflow-hidden">
            {/* Header Area / Breadcrumbs */}
            <div className="w-full px-4 md:px-8 py-4">
                <Breadcrumbs items={breadcrumbItems} />
            </div>

            {/* === BLOCK 1: Profile Details === */}
            <div className="flex flex-col items-center justify-start px-4 md:px-8 pt-16 pb-8">
                <div className="w-full">
                    {/* Profile Name & Status */}
                    <h1 className={`text-4xl md:text-5xl ${BRONZE_COLOR} mb-2 text-center font-serif font-bold tracking-wider uppercase`}>
                        {profileName}
                    </h1>
                    <p className="text-center text-lg text-gray-400 mb-10">
                        {formattedProfileStatus}
                    </p>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
                        {/* Key Facts Sidebar */}
                        <div className="lg:col-span-1 order-last lg:order-first bg-gray-800 p-6 rounded-lg shadow-lg">
                            <KeyInfo info={individualData} />
                        </div>
                        {/* Story Narrative Container */}
                        <div className={`lg:col-span-2 border ${BRONZE_BORDER} p-6 rounded-lg shadow-lg`}>
                            <StoryNarrative storySections={storySectionsForNarrative} />
                            
                            {/* MOVED: Other Sources List now here */}
                            {otherSourcesData.length > 0 && (
                                <div className="mt-6 pt-6 border-t border-gray-700"> {/* Added margin and top border for separation */}
                                    <h3 className={`text-xl font-semibold mb-4 ${BRONZE_COLOR}`}>Other Sources</h3>
                                    {/* Retaining inner div for consistent padding/styling if OtherSourcesList expects it or for direct styling */}
                                    <div className={`p-0`}> {/* Adjusted padding, can be styled further in OtherSourcesList or here */}
                                        <OtherSourcesList
                                            sources={otherSourcesData}
                                            isLoading={loading} //isLoading and error are for the whole page data
                                            error={error}
                                        />
                                    </div>
                                </div>
                            )}

                            {individualData.aiGenerated !== false && <AIDisclaimer />}
                        </div>
                    </div>
                </div>
            </div>

            {/* === BLOCK 1.5: Related Wrongfully Convicted === */}
            {combinedRelatedIndividuals.length > 0 && (
                 <div className="flex flex-col items-center justify-start px-4 md:px-8 py-8">
                    <div className="w-full">
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <RelatedWrongfullyConvictedList
                                individuals={combinedRelatedIndividuals}
                                isLoading={loading} 
                                error={error}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* === BLOCK 2: Learn More === */}
            <div className="flex flex-col items-center justify-start px-4 md:px-8 pt-8 pb-16">
                <div className="w-full">
                    <h2 className={`text-3xl md:text-4xl font-semibold mb-10 text-center ${BRONZE_COLOR}`}>Learn More</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                        {/* Related Media */}
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <RelatedMediaList mediaItems={individualData.mediaItemAppearances ?? []} />
                        </div>
                        {/* Related Organizations */}
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <OrganizationsInvolved organizations={individualData.organizationsInvolved ?? []} />
                        </div>
                        {/* Contributing Factors */}
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <ContributingFactorsList
                                factors={individualData.contributingFactors ?? []}
                                isLoading={loading}
                                error={error}
                            />
                        </div>
                        {/* Other Involved Persons */}
                        <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                            <OtherInvolvedPersonsList
                                people={individualData.involvedPersons ?? []}
                                isLoading={loading}
                                error={error}
                            />
                        </div>
                         {/* Other Sources section was here, now moved up */}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default IndividualProfilePage;
