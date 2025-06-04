import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./navbar.css";
import "../../styles/custom-folder-dropdown.css";

function CustomNavDropdown({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        open &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Inject onClick to close dropdown into each child if it's a valid React element
  const enhancedChildren = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      const el = child as React.ReactElement<any>;
      const existingOnClick = el.props.onClick;
      return React.cloneElement(el, {
        onClick: (e: React.MouseEvent) => {
          if (typeof existingOnClick === 'function') existingOnClick(e);
          setOpen(false);
        },
      });
    }
    return child;
  });

  return (
    <div className={`navbar-dropdown-group relative${open ? ' open' : ''}`} role="none">
      <button
        ref={btnRef}
        className="custom-folder-dropdown-btn navbar-dropdown-btn"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => setOpen((v) => !v)}
        style={{ minWidth: 120 }}
      >
        <span>{label}</span>
        <span className="custom-folder-dropdown-arrow" aria-hidden>v</span>
      </button>
      {open && (
        <div
          ref={panelRef}
          className="custom-folder-dropdown-list navbar-dropdown"
          role="menu"
        >
          {enhancedChildren}
        </div>
      )}
    </div>
  );
}

export default function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav className="navbar relative">
        <div className="navbar-left">
          <img src="/logo.png" alt="Logo" className="navbar-logo" />
          <h1 className="navbar-title">Expository Notes</h1>
        </div>

        <div className="navbar-center hidden md:flex space-x-4 items-center">
          <Link to="/">Dashboard</Link>
          <span className="navbar-separator">|</span>
          <CustomNavDropdown label="Scripture">
            <Link to="/add-scripture" className="custom-folder-dropdown-option" role="menuitem">Add Scripture</Link>
            <Link to="/scripture-search" className="custom-folder-dropdown-option" role="menuitem">Search All Scripture</Link>
            <Link to="/currently-added-scripture" className="custom-folder-dropdown-option" role="menuitem">Currently Added Scripture</Link>
            <Link to="/themes-and-topics" className="custom-folder-dropdown-option" role="menuitem">Themes & Topics</Link>
          </CustomNavDropdown>
          <span className="navbar-separator">|</span>
          <CustomNavDropdown label="Admin">
            <Link to="/sermon-folder-management" className="custom-folder-dropdown-option" role="menuitem">Sermon Folder Management</Link>
            <div className="border-t border-gray-600 my-1"></div>
            <span className="block px-4 py-1 text-xs text-gray-400 uppercase tracking-wide">Advanced Features</span>
            <Link to="/smart-categorization" className="custom-folder-dropdown-option" role="menuitem">Smart Categorization</Link>
            <Link to="/advanced-search" className="custom-folder-dropdown-option" role="menuitem">Advanced Search</Link>
            <Link to="/sermon-series-management" className="custom-folder-dropdown-option" role="menuitem">Series Management</Link>
            <Link to="/analytics-dashboard" className="custom-folder-dropdown-option" role="menuitem">Analytics Dashboard</Link>
            <div className="border-t border-gray-600 my-1 mx-4"></div>
            <span className="block px-4 py-1 text-xs text-gray-400 uppercase tracking-wide">Data Management</span>
            <Link to="/import-export" className="custom-folder-dropdown-option" role="menuitem">Import/Export</Link>
          </CustomNavDropdown>
          <span className="navbar-separator">|</span>
          <CustomNavDropdown label="Settings">
            <Link to="/user-profile" className="custom-folder-dropdown-option" role="menuitem">User Profile</Link>
            <Link to="/app-preferences" className="custom-folder-dropdown-option" role="menuitem">App Preferences</Link>
            <div className="border-t border-gray-600 my-1"></div>
            <span className="block px-4 py-1 text-xs text-gray-400 uppercase tracking-wide">Theme Options</span>
            <Link to="/theme-settings" className="custom-folder-dropdown-option" role="menuitem">Theme Settings</Link>
            <Link to="/customize-ui" className="custom-folder-dropdown-option" role="menuitem">Customize UI</Link>
          </CustomNavDropdown>
          <span className="navbar-separator">|</span>
          <Link to="/about">About</Link>
        </div>

        <div className="navbar-right hidden md:flex items-center space-x-4">
          <span className="navbar-separator">|</span>
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
              <Link to="/scripture-search" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Search All Scripture</Link>
              <Link to="/currently-added-scripture" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Currently Added Scripture</Link>
              <Link to="/themes-and-topics" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Themes & Topics</Link>
              <div className="border-t border-gray-700 my-1" />
              <span className="block px-4 py-2 text-gray-400">Admin</span>
              <Link to="/add-scripture" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Add Scripture</Link>
              <div className="border-t border-gray-600 my-1 mx-4"></div>
              <span className="block px-4 py-1 text-xs text-gray-400 uppercase tracking-wide">Advanced Features</span>
              <Link to="/smart-categorization" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Smart Categorization</Link>
              <Link to="/advanced-search" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Advanced Search</Link>
              <Link to="/sermon-series-management" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Series Management</Link>
              <Link to="/analytics-dashboard" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Analytics Dashboard</Link>              <div className="border-t border-gray-600 my-1 mx-4"></div>
              <span className="block px-4 py-1 text-xs text-gray-400 uppercase tracking-wide">Data Management</span>
              <Link to="/import-export" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Import/Export</Link>
              <div className="border-t border-gray-600 my-1 mx-4"></div>
              <span className="block px-4 py-1 text-xs text-gray-400 uppercase tracking-wide">Settings</span>
              <Link to="/user-profile" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>User Profile</Link>
              <Link to="/app-preferences" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>App Preferences</Link>
              <Link to="/theme-settings" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Theme Settings</Link>
              <Link to="/customize-ui" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Customize UI</Link>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
