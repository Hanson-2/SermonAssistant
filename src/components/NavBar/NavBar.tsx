import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./navbar.css";

export default function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar relative">
      <div className="flex items-center space-x-2">
        <img src="/logo.png" alt="Logo" className="navbar-logo" />
        <h1 className="navbar-title">Expository Notes</h1>
      </div>

      {/* Desktop Links */}
      <div className="hidden md:flex space-x-0 items-center"> {/* Changed space-x-4 to space-x-0 */}
        <Link to="/">Dashboard</Link>
        <span className="navbar-separator">|</span>
        <div className="navbar-dropdown-group relative group">
          <button className="navbar-dropdown-btn group-hover:text-yellow-400 focus:text-yellow-400">Scripture</button>
          <div className="navbar-dropdown absolute left-0 mt-2 w-56 bg-gray-800 rounded shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-50">
            {/* <Link to="/add-scripture" className="block px-4 py-2 hover:bg-gray-700">Add Scripture</Link> */}
            <Link to="/scripture-search" className="block px-4 py-2 hover:bg-gray-700">Search All Scripture</Link> {/* Added this line */}
            <Link to="/currently-added-scripture" className="block px-4 py-2 hover:bg-gray-700">Available Scripture</Link>
            <Link to="/themes-and-topics" className="block px-4 py-2 hover:bg-gray-700">Themes & Topics</Link>
          </div>
        </div>
        <span className="navbar-separator">|</span>
        <div className="navbar-dropdown-group relative group">
          <button className="navbar-dropdown-btn group-hover:text-yellow-400 focus:text-yellow-400">Admin</button>
          <div className="navbar-dropdown absolute left-0 mt-2 w-56 bg-gray-800 rounded shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-50">
            <Link to="/add-scripture" className="block px-4 py-2 hover:bg-gray-700">Add Scripture</Link>
            <Link to="/add-tags" className="block px-4 py-2 hover:bg-gray-700">Add/Edit Tags</Link>
          </div>
        </div>
        <span className="navbar-separator">|</span>        <div className="navbar-dropdown-group relative group">
          <button className="navbar-dropdown-btn group-hover:text-yellow-400 focus:text-yellow-400">Settings</button>
          <div className="navbar-dropdown absolute left-0 mt-2 w-64 bg-gray-800 rounded shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-50">
            <Link to="/user-tag-management" className="block px-4 py-2 hover:bg-gray-700">User Tag Management</Link>
            <Link to="/sermon-folder-management" className="block px-4 py-2 hover:bg-gray-700">Sermon Folder Management</Link>
            <div className="border-t border-gray-600 my-1"></div>
            <span className="block px-4 py-1 text-xs text-gray-400 uppercase tracking-wide">Advanced Features</span>            <Link to="/smart-categorization" className="block px-4 py-2 hover:bg-gray-700">Smart Categorization</Link>
            <Link to="/advanced-search" className="block px-4 py-2 hover:bg-gray-700">Advanced Search</Link>
            <Link to="/sermon-series-management" className="block px-4 py-2 hover:bg-gray-700">Series Management</Link>
            <Link to="/analytics-dashboard" className="block px-4 py-2 hover:bg-gray-700">Analytics Dashboard</Link>
            <div className="border-t border-gray-600 my-1"></div>
            <span className="block px-4 py-1 text-xs text-gray-400 uppercase tracking-wide">Data Management</span>
            <Link to="/import-export" className="block px-4 py-2 hover:bg-gray-700">Import/Export</Link>
          </div>
        </div>
        <span className="navbar-separator">|</span>
        <Link to="/about">About</Link>
      </div>

      {/* New Expository Link moved to the right, replacing OverlayWebviews */}
      <div className="hidden md:flex items-center space-x-4 ml-auto">
        <div className="border-l border-gray-600 h-6 mx-2"></div>
        <Link to="/new-sermon" className="new-expository-link">New Expository</Link>
      </div>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="md:hidden ml-auto"
        aria-label="Toggle menu"
      >
        ☰
      </button>

      {/* Slide-Out Panel */}
      {menuOpen && (
        <div className="absolute top-full right-0 bg-gray-800 text-white w-48 mt-2 rounded shadow-lg z-50">
          <Link to="/" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Dashboard</Link>
          <div className="border-t border-gray-700 my-1" />
          <div className="navbar-dropdown-mobile">
            {/* <Link to="/add-scripture" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Add Scripture</Link> */}
            <Link to="/scripture-search" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Search All Scripture</Link> {/* Added this line */}
            <Link to="/currently-added-scripture" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Currently Added Scripture</Link>
            <Link to="/themes-and-topics" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Themes & Topics</Link> {/* Added link */}
          </div>
          <div className="border-t border-gray-700 my-1" />
          {/* Admin Dropdown for Mobile */}
          <div className="navbar-dropdown-mobile">
            <span className="block px-4 py-2 text-gray-400">Admin</span> {/* Optional: Header for the section */}
            <Link to="/add-scripture" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Add Scripture</Link>
            <Link to="/add-tags" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Add/Edit Tags</Link>
          </div>
          <div className="border-t border-gray-700 my-1" />          {/* Settings Dropdown for Mobile */}
          <div className="navbar-dropdown-mobile">
            <span className="block px-4 py-2 text-gray-400">Settings</span>
            <Link to="/user-tag-management" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>User Tag Management</Link>
            <Link to="/sermon-folder-management" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Sermon Folder Management</Link>
            <div className="border-t border-gray-600 my-1 mx-4"></div>
            <span className="block px-4 py-1 text-xs text-gray-400 uppercase tracking-wide">Advanced Features</span>            <Link to="/smart-categorization" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Smart Categorization</Link>
            <Link to="/advanced-search" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Advanced Search</Link>
            <Link to="/sermon-series-management" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Series Management</Link>
            <Link to="/analytics-dashboard" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Analytics Dashboard</Link>
            <div className="border-t border-gray-600 my-1 mx-4"></div>
            <span className="block px-4 py-1 text-xs text-gray-400 uppercase tracking-wide">Data Management</span>
            <Link to="/import-export" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Import/Export</Link>
          </div>
          <div className="border-t border-gray-700 my-1" />
          <Link to="/about" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>About</Link>
          <Link to="/new-sermon" className="block px-4 py-2 hover:bg-gray-700 new-expository-link-mobile" onClick={() => setMenuOpen(false)}>New Expository</Link> {/* Moved and added class */}
        </div>
      )}
    </nav>
  );
}
