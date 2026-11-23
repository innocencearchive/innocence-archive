// src/App.jsx — The Innocence Archive React Frontend
import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';

// Import shared layout components
import Header from './components/Header'; // Ensure path is correct
import Footer from './components/Footer'; // Ensure path is correct
import ScrollToTop from './components/ScrollToTop'; // Adjust path if needed
import AdminNavBar from './components/AdminNavBar';

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
import AdminFilmPage from './pages/AdminFilmPage'; 
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminResourcePage from './pages/AdminResourcePage';
import AdminImportPage from './pages/AdminImportPage';
import AdminVerifyPage from './pages/AdminVerifyPage';
import AdminBatchesPage from './pages/AdminBatchesPage';
import AdminAuditPage from './pages/AdminAuditPage';
import AdminPodcastsPage from './pages/AdminPodcastsPage';
import NewsHubPage from './pages/NewsHubPage';
import AdminNewsPage from './pages/AdminNewsPage';


function App() {
  const location = useLocation();
  const showHeader = location.pathname !== '/';
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-gray-900 text-gray-50 font-sans flex flex-col py-8">
	<ScrollToTop /> {/* Add the ScrollToTop component here */}
      
        <div className="w-full max-w-[90%] mx-auto bg-black rounded-lg shadow-lg flex flex-col flex-grow overflow-hidden">
            {showHeader && <Header />}
            {isAdminRoute && <AdminNavBar />}
            <main className="flex-grow">
                <Routes>
                  <Route path="/search" element={<SearchResultsPage />} />
                  <Route path="/news" element={<NewsHubPage />} />
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
			<Route path="/admin/film/add" // For adding a new film
                    element={<ProtectedRoute><AdminFilmPage /></ProtectedRoute>}
                  />
                  <Route
                    path="/admin/film/edit/:id" // For editing an existing film
                    element={<ProtectedRoute><AdminFilmPage /></ProtectedRoute>}
                  />
                  <Route
                    path="/admin/manage/:resource"
                    element={<ProtectedRoute><AdminResourcePage /></ProtectedRoute>}
                  />
                  <Route
                    path="/admin/import"
                    element={<ProtectedRoute><AdminImportPage /></ProtectedRoute>}
                  />
                  <Route
                    path="/admin/verify"
                    element={<ProtectedRoute><AdminVerifyPage /></ProtectedRoute>}
                  />
                  <Route
                    path="/admin/batches"
                    element={<ProtectedRoute><AdminBatchesPage /></ProtectedRoute>}
                  />
                  <Route
                    path="/admin/audit"
                    element={<ProtectedRoute><AdminAuditPage /></ProtectedRoute>}
                  />
                  <Route
                    path="/admin/podcasts"
                    element={<ProtectedRoute><AdminPodcastsPage /></ProtectedRoute>}
                  />
                  <Route
                    path="/admin/news"
                    element={<ProtectedRoute><AdminNewsPage /></ProtectedRoute>}
                  />
                </Routes>
            </main>
            <Footer />
        </div>
    </div>
  );
}

export default App;
