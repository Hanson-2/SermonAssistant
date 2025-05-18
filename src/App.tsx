import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Layout
import NavBar from "./components/NavBar/NavBar";

// Pages
import DashboardPage from "./pages/DashboardPage";
import NewExpositoryPage from "./pages/NewExpositoryPage";
import EditExpositoryPage from "./pages/EditExpositoryPage";
import ExpositoryDetailPage from "./pages/ExpositoryDetailPage";
import AddScripturePage from "./pages/AddScripturePage";
import CurrentlyAddedScripturePage from "./pages/CurrentlyAddedScripturePage";
import ScriptureBookPage from "./pages/ScriptureBookPage";

function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <NavBar />
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
        </Routes>
      </main>
    </div>
  );
}

export default App;
