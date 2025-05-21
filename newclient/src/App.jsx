// src/App.jsx
import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';

// Import shared layout components
import Header from './components/Header'; // Ensure path is correct
import Footer from './components/Footer'; // Ensure path is correct

// Import page components
import HomePage from './pages/HomePage';
import IndividualProfilePage from './pages/IndividualProfilePage';
import OrganizationInfoPage from './pages/OrganizationInfoPage';
import MediaWorkPage from './pages/MediaWorkPage';
import MediaItemPage from './pages/MediaItemPage';
import ContributingFactorsPage from './pages/ContributingFactorsPage';
import OtherIndividualProfilePage from './pages/OtherIndividualProfilePage';
import SearchResultsPage from './pages/SearchResultsPage'; // Adjust path if needed
import CombinedMediaPage from './pages/CombinedMediaPage'; // Adjust path if needed
import FilmPage from './pages/FilmPage'; // <-- NEW: Import FilmPage
import AdminSettingsPage from './pages/AdminSettingsPage'; // Adjust path if needed

function App() {
  const location = useLocation();
  // Only render the standard header if not on the homepage
  const showHeader = location.pathname !== '/';

  return (
    // Outermost container
    <div className="min-h-screen bg-gray-900 text-gray-50 font-sans flex flex-col py-8">

        {/* Centered Content Container */}
        <div className="w-full max-w-[90%] mx-auto bg-black rounded-lg shadow-lg flex flex-col flex-grow overflow-hidden">

            {/* Conditionally render Header */}
            {showHeader && <Header />}

            {/* Main Content Area */}
            <main className="flex-grow">
                <Routes>
                  <Route path="/search" element={<SearchResultsPage />} />
                  {/* Route for the Home Page */}
                  <Route path="/" element={<HomePage />} />

                  {/* Routes for Wrongfully Convicted Individuals */}
                  <Route path="/profile/:id" element={<IndividualProfilePage />} />

                  {/* Route for Other Involved Persons */}
                  <Route path="/person/:id" element={<OtherIndividualProfilePage />} />

                  {/* Routes for Media */}
                  {/* NEW: Route for standalone Films/Documentaries */}
                  <Route path="/film/:id" element={<FilmPage />} />
                  {/* CombinedMediaPage will now primarily be for Books or other non-film/non-series media */}
                  <Route path="/combined/:id" element={<CombinedMediaPage />} />
                  {/* MediaWorkPage is for series (Podcasts, Docuseries, TV Series) */}
                  <Route path="/media/:id" element={<MediaWorkPage />} />
                  <Route path="/item/:id" element={<MediaItemPage />} />

                  {/* Route for Organizations */}
                  <Route path="/organization/:id" element={<OrganizationInfoPage />} />

                  {/* Route for Contributing Factors */}
                  <Route path="/factor/:id" element={<ContributingFactorsPage />} />
                  
                  {/* Route for Admin Settings */}
                  <Route path="/adminsettings" element={<AdminSettingsPage />} />
                  
                  {/* TODO: Add routes for other pages (e.g., About) */}
                </Routes>
            </main>

            {/* Footer */}
            <Footer />

        </div> {/* End Centered Content Container */}
    </div> // End Outermost Container
  );
}

export default App;
