import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// Layout
import NavBar from "./components/NavBar/NavBar";
import SplashScreen from "./components/SplashScreen";

// Pages
import DashboardPage from "./pages/DashboardPage";
import NewExpositoryPage from "./pages/NewExpositoryPage";
import EditExpositoryPage from "./pages/EditExpositoryPage";
import ExpositoryDetailPage from "./pages/ExpositoryDetailPage";
import AddScripturePage from "./pages/AddScripturePage";
import CurrentlyAddedScripturePage from "./pages/CurrentlyAddedScripturePage";
import ScriptureBookPage from "./pages/ScriptureBookPage";
import LoginPage from "./pages/LoginPage";
import { ThemesAndTopicsPage, TaggedVersesPage } from "./pages/ThemesAndTopicsPage"; // Added import

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
    <div className="min-h-screen bg-gray-900 text-white">
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

          {/* Scripture Management */}
          <Route path="/add-scripture" element={<AddScripturePage />} />
          <Route path="/currently-added-scripture" element={<CurrentlyAddedScripturePage />} />
          <Route path="/scripture/:book" element={<ScriptureBookPage />} />
          <Route path="/themes-and-topics" element={<ThemesAndTopicsPage />} /> {/* Added route */}
          <Route path="/themes-and-topics/:tag" element={<TaggedVersesPage />} /> {/* Added route for specific tag */}

          {/* Login Page */}
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
