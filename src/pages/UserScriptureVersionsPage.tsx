import React, { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth, User } from 'firebase/auth';
import './UserScriptureVersionsPage.css'; // CSS file to be created later

// Interface for user-defined scripture versions
interface UserScriptureVersion {
  id: string; // Firestore document ID
  userId: string;
  name: string; // User-friendly name, e.g., "My Personal Commentary"
  abbreviation: string; // User-defined abbreviation, e.g., "MPC"
  description?: string;
  // createdAt?: firebase.firestore.Timestamp; // Future addition
  // updatedAt?: firebase.firestore.Timestamp; // Future addition
}

// Add this type for the function call
interface AddUserScriptureVersionData {
  name: string;
  abbreviation: string;
  description?: string;
}

export default function UserScriptureVersionsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userVersions, setUserVersions] = useState<UserScriptureVersion[]>([]);
  
  // Form states
  const [versionName, setVersionName] = useState('');
  const [versionAbbreviation, setVersionAbbreviation] = useState('');
  const [versionDescription, setVersionDescription] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const functions = getFunctions();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        setUserVersions([]); // Clear versions if user logs out
        setError("Please log in to manage your scripture versions.");
      }
    });
    return () => unsubscribe();
  }, [auth]);

  // Fetch user's custom scripture versions
  const fetchUserVersions = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setError(null);
    try {
      const getUserVersionsCallable = httpsCallable<void, { versions: UserScriptureVersion[] }>(functions, 'getUserScriptureVersions');
      const result = await getUserVersionsCallable();
      setUserVersions(result.data.versions || []);
      setSuccessMessage(null);
    } catch (err: any) {
      console.error("Error fetching user versions:", err);
      setError(`Failed to load versions: ${err.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, functions]);

  useEffect(() => {
    if (currentUser) {
      fetchUserVersions();
    }
  }, [currentUser, fetchUserVersions]);

  const handleAddVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setError("You must be logged in to add a version.");
      return;
    }
    if (!versionName.trim() || !versionAbbreviation.trim()) {
      setError("Version Name and Abbreviation are required.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const addVersionCallable = httpsCallable<AddUserScriptureVersionData, { versionId: string }>(
        functions, 
        'addUserScriptureVersion'
      );
      await addVersionCallable({
        name: versionName,
        abbreviation: versionAbbreviation,
        description: versionDescription,
      });
      setSuccessMessage(`Version "${versionName}" added successfully.`);
      setVersionName('');
      setVersionAbbreviation('');
      setVersionDescription('');
      fetchUserVersions(); 
    } catch (err: any) {
      console.error("Error adding version:", err);
      setError(`Failed to add version: ${err.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser && !auth.currentUser) { // Check auth.currentUser for initial load
    return <div className="user-versions-page"><p>Loading user information or please log in to manage your scripture versions.</p></div>;
  }
  
  return (
    <div className="user-versions-page">
      <h1>My Scripture Versions</h1>

      {error && <p className="user-versions-error">Error: {error}</p>}
      {successMessage && <p className="user-versions-success">{successMessage}</p>}

      <div className="add-version-form">
        <h2>Add New Version</h2>
        <form onSubmit={handleAddVersion}>
          <div className="form-row">
            <label htmlFor="versionName">Version Name: </label>
            <input
              type="text"
              id="versionName"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="versionAbbreviation">Abbreviation: </label>
            <input
              type="text"
              id="versionAbbreviation"
              value={versionAbbreviation}
              onChange={(e) => setVersionAbbreviation(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="versionDescription">Description (Optional): </label>
            <textarea
              id="versionDescription"
              value={versionDescription}
              onChange={(e) => setVersionDescription(e.target.value)}
              rows={3}
            />
          </div>
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Adding...' : 'Add Version'}
          </button>
        </form>
      </div>

      <div className="versions-list">
        <h2>Existing Custom Versions</h2>
        {isLoading && userVersions.length === 0 && <p>Loading versions...</p>}
        {!isLoading && userVersions.length === 0 && !error && (
          <p>You have not created any custom scripture versions yet.</p>
        )}
        {userVersions.length > 0 && (
          <ul>
            {userVersions.map(version => (
              <li key={version.id}>
                <strong>{version.name} ({version.abbreviation})</strong>
                {version.description && <p>{version.description}</p>}
                {/* Add Edit/Delete buttons here later */}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
