import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

// Layout
import NavBar from "./components/NavBar/NavBar";
import SplashScreen from "./components/SplashScreen";
import UniversalBackground from "./components/UniversalBackground";

// Pages
import DashboardPage from "./pages/DashboardPage";
import NewExpositoryPage from "./pages/NewExpositoryPage";
import EditExpositoryPage from "./pages/EditExpositoryPage";
import ExpositoryDetailPage from "./pages/ExpositoryDetailPage";
import PresentationPage from "./pages/PresentationPage";
import AddScripturePage from "./pages/AddScripturePage";
import CurrentlyAddedScripturePage from "./pages/CurrentlyAddedScripturePage";
import ScriptureBookPage from "./pages/ScriptureBookPage";
import LoginPage from "./pages/LoginPage";
import { ThemesAndTopicsPage, TaggedVersesPage } from "./pages/ThemesAndTopicsPage"; // Added import
import AboutPage from "./pages/AboutPage"; // Added import for AboutPage
import UniversalSearchPage from "./pages/UniversalSearchPage";
import TagManagementPage from "./pages/TagManagementPage";
import SermonFolderManagementPage from "./pages/SermonFolderManagementPage";
import SmartCategorizationPage from "./pages/SmartCategorizationPage";
import AdvancedSearchPage from "./pages/AdvancedSearchPage";
import SermonSeriesManagementPage from "./pages/SermonSeriesManagementPage";
import AnalyticsDashboardPage from "./pages/AnalyticsDashboardPage";
import ImportExportPage from "./pages/ImportExportPage";
import UserProfilePage from "./pages/UserProfilePage";
import ThemeSettingsPage from "./pages/ThemeSettingsPage";
import SimpleTestEditorPage from "./pages/SimpleTestEditorPage";
import DuplicateVerseCleanupPage from "./pages/DuplicateVerseCleanupPage";

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
        {location.pathname !== "/login" && <NavBar />}
        <main className="pt-[56px]">
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
            <Route path="/themes-and-topics/:tag" element={<TaggedVersesPage />} />            {/* Admin Pages */}
            <Route path="/tag-management" element={<TagManagementPage />} />
            <Route path="/duplicate-cleanup" element={<DuplicateVerseCleanupPage />} />

            {/* Login Page */}
            <Route path="/login" element={<LoginPage />} />          {/* About Page */}
            <Route path="/about" element={<AboutPage />} />            {/* Settings Pages */}
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
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
