/* ========================================================================== */
/* --- File: src/pages/IndividualProfilePage.jsx (Disclaimer Added) ---     */
/* ========================================================================== */

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
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
import AIDisclaimer from '../components/AIDisclaimer'; // *** IMPORT THE DISCLAIMER ***

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
            setLoading(true); setError(null); setIndividualData(null);
            // *** Ensure your API call fetches the 'aiGenerated' field ***
            const apiUrl = `http://localhost:3001/api/individuals/${id}`;
            console.log(`Fetching data from: ${apiUrl}`);
            try {
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    let errorMsg = `HTTP error! status: ${response.status}`;
                    try { const errorData = await response.json(); errorMsg = errorData.message || errorMsg; } catch (parseError) {}
                    throw new Error(errorMsg);
                 }
                const data = await response.json();
                console.log("Fetched individual data:", data); // Check if aiGenerated is present
                setIndividualData(data);
            } catch (err) {
                console.error("Fetch error:", err);
                setError(err.message || "An unknown error occurred");
             }
            finally { setLoading(false); }
        };
        if (id) { fetchData(); }
        else { setError("No individual ID provided."); setLoading(false); }
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
    if (loading) { return ( <div className="bg-black text-gray-400 p-8 rounded-lg shadow-lg text-center"><p>Loading profile...</p></div> ); }
    // --- Error State ---
    if (error) { return ( <div className="bg-black text-red-500 p-8 rounded-lg shadow-lg text-center"><div className="w-full px-4 md:px-8 py-4"><Breadcrumbs items={breadcrumbItems} /></div><AlertCircle className="mx-auto h-12 w-12 text-red-400 my-4" /><h2 className="text-xl font-semibold mb-2">Error Loading Profile</h2> <p className="text-sm">{error}</p><button onClick={() => navigate(-1)} className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"> <ArrowLeft className="mr-2 h-5 w-5" /> Go Back </button></div> ); }
    // --- Not Found State ---
    if (!individualData) { return ( <div className="bg-black text-gray-400 p-8 rounded-lg shadow-lg text-center"><div className="w-full px-4 md:px-8 py-4"><Breadcrumbs items={breadcrumbItems} /></div><p>Profile data not available for ID: {id}.</p></div> ); }

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

                            {/* *** ADDED AI DISCLAIMER HERE *** */}
                            {/* Show disclaimer if aiGenerated is true (or null/undefined if using default) */}
                            {/* Ensure individualData includes the 'aiGenerated' field from your API */}
                            {individualData.aiGenerated !== false && <AIDisclaimer />}
                            {/* Using !== false allows it to show if true OR if the field is missing (null/undefined) */}

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
                                isLoading={loading} // Pass loading/error for context
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
                         {/* Other Sources */}
                         {individualData.sourceLinks && individualData.sourceLinks.length > 0 && (
                            <div className="md:col-span-2">
                                <div className={`p-4 border ${BRONZE_BORDER} rounded-lg h-full overflow-y-auto max-h-96`}>
                                    <OtherSourcesList
                                        sources={individualData.sourceLinks.map(link => ({
                                            id: link.informationSource.id,
                                            name: link.informationSource.name,
                                            url: link.specificUrl || link.informationSource.baseUrl
                                        })) ?? []}
                                        isLoading={loading}
                                        error={error}
                                    />
                                </div>
                            </div>
                         )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default IndividualProfilePage;
