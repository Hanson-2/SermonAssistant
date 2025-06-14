import React, { useState, useEffect, Suspense, lazy } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

// Layout
import NavBar from "./components/NavBar/NavBar";
import SplashScreen from "./components/SplashScreen";
import UniversalBackground from "./components/UniversalBackground";

// Critical pages (loaded immediately)
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";

// Lazy-loaded pages (only loaded when needed)
const NewExpositoryPage = lazy(() => import("./pages/NewExpositoryPage"));
const EditExpositoryPage = lazy(() => import("./pages/EditExpositoryPage"));
const ExpositoryDetailPage = lazy(() => import("./pages/ExpositoryDetailPage"));
const PresentationPage = lazy(() => import("./pages/PresentationPage"));
const AddScripturePage = lazy(() => import("./pages/AddScripturePage"));
const CurrentlyAddedScripturePage = lazy(() => import("./pages/CurrentlyAddedScripturePage"));
const ScriptureBookPage = lazy(() => import("./pages/ScriptureBookPage"));
const ThemesAndTopicsPage = lazy(() => import("./pages/ThemesAndTopicsPage").then(module => ({ default: module.ThemesAndTopicsPage })));
const TaggedVersesPage = lazy(() => import("./pages/ThemesAndTopicsPage").then(module => ({ default: module.TaggedVersesPage })));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const UniversalSearchPage = lazy(() => import("./pages/UniversalSearchPage"));
const TagManagementPage = lazy(() => import("./pages/TagManagementPage"));
const SermonFolderManagementPage = lazy(() => import("./pages/SermonFolderManagementPage"));
const SmartCategorizationPage = lazy(() => import("./pages/SmartCategorizationPage"));
const AdvancedSearchPage = lazy(() => import("./pages/AdvancedSearchPage"));
const SermonSeriesManagementPage = lazy(() => import("./pages/SermonSeriesManagementPage"));
const AnalyticsDashboardPage = lazy(() => import("./pages/AnalyticsDashboardPage"));
const ImportExportPage = lazy(() => import("./pages/ImportExportPage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const ThemeSettingsPage = lazy(() => import("./pages/ThemeSettingsPage"));
const SimpleTestEditorPage = lazy(() => import("./pages/SimpleTestEditorPage"));
const DuplicateVerseCleanupPage = lazy(() => import("./pages/DuplicateVerseCleanupPage"));

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user && window.location.pathname !== "/login") {
        navigate("/login");
      }
    });
    return unsubscribe;
  }, [navigate]);
  return showSplash ? (
    <SplashScreen onFinish={() => setShowSplash(false)} />
  ) : (
    <ThemeProvider>
      {/* Universal background overlay, appears on all pages except login/splash */}
      {location.pathname !== "/login" && !showSplash && <UniversalBackground />}
      <div className="min-h-screen text-white">
        {location.pathname !== "/login" && <NavBar />}        <main className="pt-[56px]">
          <Suspense fallback={
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '50vh',
              color: '#ffd700'
            }}>
              <div>Loading...</div>
            </div>
          }>
            <Routes>
              {/* Redirect root to dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Dashboard and Sermon Management */}
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/new-sermon" element={<NewExpositoryPage />} />
              <Route path="/edit-expository/:id" element={<EditExpositoryPage />} />
              <Route path="/expository/:id" element={<ExpositoryDetailPage />} />
              <Route path="/presentation/:id" element={<PresentationPage />} />

              {/* Scripture Management */}
              <Route path="/add-scripture" element={<AddScripturePage />} />
              <Route path="/scripture/:bookName/:chapter" element={<ScriptureBookPage />} />
              <Route path="/scripture/:bookName" element={<ScriptureBookPage />} />
              <Route path="/scripture-search" element={<UniversalSearchPage />} />
              <Route path="/currently-added-scripture" element={<CurrentlyAddedScripturePage />} />
              <Route path="/themes-and-topics" element={<ThemesAndTopicsPage />} />
              <Route path="/themes-and-topics/:tag" element={<TaggedVersesPage />} />

              {/* Admin Pages */}
              <Route path="/tag-management" element={<TagManagementPage />} />
              <Route path="/duplicate-cleanup" element={<DuplicateVerseCleanupPage />} />

              {/* Login Page */}
              <Route path="/login" element={<LoginPage />} />

              {/* About Page */}
              <Route path="/about" element={<AboutPage />} />

              {/* Settings Pages */}
              <Route path="/user-profile" element={<UserProfilePage />} />
              <Route path="/theme-settings" element={<ThemeSettingsPage />} />
              <Route path="/sermon-folder-management" element={<SermonFolderManagementPage />} />
              <Route path="/smart-categorization" element={<SmartCategorizationPage />} />
              <Route path="/advanced-search" element={<AdvancedSearchPage />} />
              <Route path="/sermon-series-management" element={<SermonSeriesManagementPage />} />
              <Route path="/analytics-dashboard" element={<AnalyticsDashboardPage />} />
              <Route path="/import-export" element={<ImportExportPage />} />
              <Route path="/simple-test-editor" element={<SimpleTestEditorPage />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
