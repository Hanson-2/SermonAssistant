import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./navbar.css";
import "../../styles/custom-folder-dropdown.css";

function CustomNavDropdown({ label, children }) {
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef(null);
  const panelRef = React.useRef(null);
  React.useEffect(() => {
    function handle(e) {
      if (
        open &&
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
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
      const el = child;
      const existingOnClick = el.props.onClick;
      return React.cloneElement(el, {
        onClick: (e) => {
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
        aria-expanded={open ? "true" : "false"}
        onClick={() => setOpen((v) => !v)}
        style={{ minWidth: 120 }}
      >
        <span>{label}</span>
        <span className="custom-folder-dropdown-arrow" aria-hidden="true">v</span>
      </button>
      {open && (
        <div
          ref={panelRef}
          className="custom-folder-dropdown-list navbar-dropdown"
          role="menu"
          aria-label={`${label} menu`}
        >
          {enhancedChildren}
        </div>
      )}
    </div>
  );
}

export default function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <nav className="navbar relative">
        <div className="navbar-left">
          <img src="/logo.png" alt="Logo" className="navbar-logo" />
        </div>

        {/* Desktop Nav */}
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
            <div className="border-t border-gray-600 my-1" role="separator"></div>
            <span className="block px-4 py-1 text-xs text-gray-400 uppercase tracking-wide" role="presentation">Advanced Features</span>
            <Link to="/smart-categorization" className="custom-folder-dropdown-option" role="menuitem">Smart Categorization</Link>
            <Link to="/advanced-search" className="custom-folder-dropdown-option" role="menuitem">Advanced Search</Link>
            <Link to="/sermon-series-management" className="custom-folder-dropdown-option" role="menuitem">Series Management</Link>
            <Link to="/analytics-dashboard" className="custom-folder-dropdown-option" role="menuitem">Analytics Dashboard</Link>
            <div className="border-t border-gray-600 my-1 mx-4" role="separator"></div>
            <span className="block px-4 py-1 text-xs text-gray-400 uppercase tracking-wide" role="presentation">Data Management</span>
            <Link to="/tag-management" className="custom-folder-dropdown-option" role="menuitem">Tag Management</Link>
            <Link to="/import-export" className="custom-folder-dropdown-option" role="menuitem">Import/Export</Link>
          </CustomNavDropdown>
          <span className="navbar-separator">|</span>
          <CustomNavDropdown label="Settings">
            <Link to="/user-profile" className="custom-folder-dropdown-option" role="menuitem">User Profile</Link>
            <div className="border-t border-gray-600 my-1" role="separator"></div>
            <span className="block px-4 py-1 text-xs text-gray-400 uppercase tracking-wide" role="presentation">Theme Options</span>
            <Link to="/theme-settings" className="custom-folder-dropdown-option" role="menuitem">Theme Settings</Link>
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
          className="navbar-mobile-menu-btn"
          aria-label="Toggle menu"
        >
          ☰
        </button>

        {/* Mobile Full-Screen Menu Panel */}
        {menuOpen && (
          <div className="navbar-mobile-menu-panel">
            <button className="close-btn" aria-label="Close menu" onClick={closeMenu}>&times;</button>
            <Link to="/" onClick={closeMenu}>Dashboard</Link>
            {/* Scripture Group */}
            <div className="mobile-group">
              <span className="mobile-label">Scripture</span>
              <Link to="/add-scripture" onClick={closeMenu} className="mobile-sub">Add Scripture</Link>
              <Link to="/scripture-search" onClick={closeMenu} className="mobile-sub">Search All Scripture</Link>
              <Link to="/currently-added-scripture" onClick={closeMenu} className="mobile-sub">Currently Added Scripture</Link>
              <Link to="/themes-and-topics" onClick={closeMenu} className="mobile-sub">Themes & Topics</Link>
            </div>
            {/* Admin Group */}
            <div className="mobile-group">
              <span className="mobile-label">Admin</span>
              <Link to="/sermon-folder-management" onClick={closeMenu} className="mobile-sub">Sermon Folder Management</Link>
              <div className="mobile-divider"></div>
              <span className="mobile-label mobile-label-sm">Advanced Features</span>
              <Link to="/smart-categorization" onClick={closeMenu} className="mobile-sub">Smart Categorization</Link>
              <Link to="/advanced-search" onClick={closeMenu} className="mobile-sub">Advanced Search</Link>
              <Link to="/sermon-series-management" onClick={closeMenu} className="mobile-sub">Series Management</Link>
              <Link to="/analytics-dashboard" onClick={closeMenu} className="mobile-sub">Analytics Dashboard</Link>
              <div className="mobile-divider"></div>
              <span className="mobile-label mobile-label-sm">Data Management</span>
              <Link to="/tag-management" onClick={closeMenu} className="mobile-sub">Tag Management</Link>
              <Link to="/import-export" onClick={closeMenu} className="mobile-sub">Import/Export</Link>
            </div>
            {/* Settings Group */}
            <div className="mobile-group">
              <span className="mobile-label">Settings</span>
              <Link to="/user-profile" onClick={closeMenu} className="mobile-sub">User Profile</Link>
              <div className="mobile-divider"></div>
              <span className="mobile-label mobile-label-sm">Theme Options</span>
              <Link to="/theme-settings" onClick={closeMenu} className="mobile-sub">Theme Settings</Link>
            </div>
            <Link to="/about" onClick={closeMenu}>About</Link>
            <Link to="/new-sermon" onClick={closeMenu}>New Expository</Link>
          </div>
        )}
      </nav>

      {/* Sticky bottom nav for very small screens */}
      <div className="navbar-bottom-nav md:hidden">
        <Link to="/">
          <span className="bottomnav-icon" aria-label="Home">🏠</span>
        </Link>
        <Link to="/scripture-search">
          <span className="bottomnav-icon" aria-label="Search">🔍</span>
        </Link>
        <Link to="/new-sermon">
          <span className="bottomnav-icon" aria-label="Add Expository">➕</span>
        </Link>
        <Link to="/user-profile">
          <span className="bottomnav-icon" aria-label="Settings">⚙️</span>
        </Link>
      </div>
    </>
  );
}
