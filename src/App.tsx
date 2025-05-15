import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import NavBar from './components/NavBar/NavBar';
import DashboardPage from './pages/DashboardPage';
import EditExpositoryPage from './pages/EditExpositoryPage';
import NewExpositoryPage from './pages/NewExpositoryPage';
import ExpositoryDetailPage from './pages/ExpositoryDetailPage';
import AddScripturePage from './pages/AddScripturePage';

function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <NavBar />
      <main className="pt-[56px]">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/new-sermon" element={<NewExpositoryPage />} />
          <Route path="/edit-expository/:id" element={<EditExpositoryPage />} />
          <Route path="/expository/:id" element={<ExpositoryDetailPage />} />
          <Route path="/add-scripture" element={<AddScripturePage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
