// src/App.jsx
import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';

// Import shared layout components
import Header from './components/Header'; // Ensure path is correct
import Footer from './components/Footer'; // Ensure path is correct
import ScrollToTop from './components/ScrollToTop'; // Adjust path if needed

// Import page components
import HomePage from './pages/HomePage';
import IndividualProfilePage from './pages/IndividualProfilePage';
import OrganizationInfoPage from './pages/OrganizationInfoPage';
import MediaWorkPage from './pages/MediaWorkPage'; // For Series
import MediaItemPage from './pages/MediaItemPage'; // For Episodes/Chapters
import ContributingFactorsPage from './pages/ContributingFactorsPage';
import OtherIndividualProfilePage from './pages/OtherIndividualProfilePage';
import SearchResultsPage from './pages/SearchResultsPage';
import CombinedMediaPage from './pages/CombinedMediaPage'; // Might be deprecated or used for 'OTHER'
import FilmPage from './pages/FilmPage';
import BookPage from './pages/BookPage'; // <-- NEW: Import BookPage
import AdminSettingsPage from './pages/AdminSettingsPage';
import LoginPage from './pages/LoginPage'; // <<< IMPORT
import ProtectedRoute from './components/ProtectedRoute'; 
import AdminDashboardPage from './pages/AdminDashboardPage';


function App() {
  const location = useLocation();
  const showHeader = location.pathname !== '/';

  return (
    <div className="min-h-screen bg-gray-900 text-gray-50 font-sans flex flex-col py-8">
	<ScrollToTop /> {/* Add the ScrollToTop component here */}
      
        <div className="w-full max-w-[90%] mx-auto bg-black rounded-lg shadow-lg flex flex-col flex-grow overflow-hidden">
            {showHeader && <Header />}
            <main className="flex-grow">
                <Routes>
                  <Route path="/search" element={<SearchResultsPage />} />
                  <Route path="/" element={<HomePage />} />
                  <Route path="/profile/:id" element={<IndividualProfilePage />} />
                  <Route path="/person/:id" element={<OtherIndividualProfilePage />} />
                  
                  {/* Media Routes */}
                  <Route path="/film/:id" element={<FilmPage />} /> {/* For standalone Films/Documentaries */}
                  <Route path="/book/:id" element={<BookPage />} /> {/* NEW: For Books */}
                  <Route path="/media/:id" element={<MediaWorkPage />} /> {/* For Series (Podcast, Docuseries, TV Series) */}
                  <Route path="/item/:id" element={<MediaItemPage />} /> {/* For individual episodes/items within a series */}
                  {/* Fallback or specific use for CombinedMediaPage if still needed */}
                  <Route path="/combined/:id" element={<CombinedMediaPage />} /> 
                  <Route path="/organization/:id" element={<OrganizationInfoPage />} />
                  <Route path="/factor/:id" element={<ContributingFactorsPage />} />
				  <Route path="/login" element={<LoginPage />} /> {/* <<< ADD THIS */}
               {/* Authentication Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Admin Routes - Protected */}
            <Route
              path="/admin" // This is the path for the admin dashboard
              element={
                <ProtectedRoute>
                  <AdminDashboardPage /> {/* <<< USING RENAMED COMPONENT */}
                </ProtectedRoute>
              }
            />
            <Route
              path="/adminsettings"
              element={
                <ProtectedRoute>
                  <AdminSettingsPage />
                </ProtectedRoute>
              }
            />
        
                </Routes>
            </main>
            <Footer />
        </div>
    </div>
  );
}

export default App;
