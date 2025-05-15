import React from 'react';
import { Link } from 'react-router-dom';
import './navbar.css';

export default function NavBar() {
  return (
    <nav className="navbar">
      <div className="flex items-center space-x-2">
        <img src="/logo.png" alt="Logo" className="navbar-logo" />
        <h1>Sermon Notes Assistant</h1>
      </div>
      <div>
        <Link to="/">Dashboard</Link>
        <Link to="/new-sermon">New Expository</Link>
        <Link to="/add-scripture">Add Scripture</Link>
        <Link to="/about">About</Link>
      </div>
    </nav>
  );
}
