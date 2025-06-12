// main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';  // <--- This is the correct file in your case
import './styles/globals.css';
import './styles/scripture-overlay-fix.css'; // Added for mobile UI fixes
import App from './App';
import { AuthProvider } from './context/AuthContext';

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}
