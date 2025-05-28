import React from "react";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { app } from "../lib/firebase";
import "./LoginPage.css";

const provider = new GoogleAuthProvider();

export default function LoginPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        setTimeout(() => navigate("/"), 800); // Redirect after login
      }
    });
    return unsubscribe;
  }, [navigate]);

  const handleLogin = async () => {
    setLoading(true);
    const auth = getAuth(app);
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      alert("Login failed. Please try again.");
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const auth = getAuth(app);
    await signOut(auth);
    setUser(null);
  };

  return (
    <div className="login-layout">
      <div className="login-logo-bg">
        <img src="/logo.png" alt="Logo" className="login-logo-img" />
      </div>
      <div className="login-card">
        {loading ? (
          <div className="login-spinner" />
        ) : user ? (
          <>
            <img src={user.photoURL} alt="avatar" className="login-avatar" />
            <div className="login-user-email">{user.email}</div>
            <button className="login-btn logout" onClick={handleLogout}>Sign Out</button>
          </>
        ) : (
          <button className="login-btn enhanced-google" onClick={handleLogin}>
            <span className="google-btn-icon">
              <svg className="login-google-icon" viewBox="0 0 48 48"><g><path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.23l6.85-6.85C35.64 2.09 30.18 0 24 0 14.82 0 6.73 5.48 2.69 13.44l7.98 6.2C12.13 13.09 17.62 9.5 24 9.5z"/><path fill="#34A853" d="M46.1 24.5c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.64 7.01l7.19 5.6C43.98 37.09 46.1 31.27 46.1 24.5z"/><path fill="#FBBC05" d="M10.67 28.65c-1.13-3.36-1.13-6.94 0-10.3l-7.98-6.2C.7 16.18 0 19.01 0 22c0 2.99.7 5.82 1.97 8.35l8.7-6.7z"/><path fill="#EA4335" d="M24 44c6.18 0 11.64-2.09 15.99-5.72l-7.19-5.6c-2.01 1.35-4.59 2.14-7.8 2.14-6.38 0-11.87-3.59-14.33-8.94l-8.7 6.7C6.73 42.52 14.82 48 24 48z"/></g></svg>
            </span>
            <span className="google-btn-text">Sign in with Google</span>
          </button>
        )}
      </div>
    </div>
  );
}
