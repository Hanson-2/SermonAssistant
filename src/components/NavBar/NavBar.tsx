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
      <div className="hidden md:flex space-x-4 items-center">
        <Link to="/">Dashboard</Link>
        <Link to="/new-sermon">New Expository</Link>
        <div className="navbar-dropdown-group relative group">
          <button className="navbar-dropdown-btn group-hover:text-yellow-400 focus:text-yellow-400">Scripture ▾</button>
          <div className="navbar-dropdown absolute left-0 mt-2 w-56 bg-gray-800 rounded shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-50">
            <Link to="/add-scripture" className="block px-4 py-2 hover:bg-gray-700">Add Scripture</Link>
            <Link to="/currently-added-scripture" className="block px-4 py-2 hover:bg-gray-700">Currently Added Scripture</Link>
          </div>
        </div>
        <Link to="/about">About</Link>
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
          <Link to="/new-sermon" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>New Expository</Link>
          <div className="border-t border-gray-700 my-1" />
          <div className="navbar-dropdown-mobile">
            <Link to="/add-scripture" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Add Scripture</Link>
            <Link to="/currently-added-scripture" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>Currently Added Scripture</Link>
          </div>
          <div className="border-t border-gray-700 my-1" />
          <Link to="/about" className="block px-4 py-2 hover:bg-gray-700" onClick={() => setMenuOpen(false)}>About</Link>
        </div>
      )}
    </nav>
  );
}
