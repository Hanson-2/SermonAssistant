import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut, deleteUser, updateProfile } from 'firebase/auth';
import { app } from '../lib/firebase';
import { getUserProfile, updateUserProfile, getUserStats, exportUserData, deleteUserAccount, UserProfile } from '../services/firebaseService';
import './UserProfilePage.css';

interface UserStats {
  totalSermons: number;
  totalVerses: number;
  totalTags: number;
  totalFolders: number;
  totalVersions: number;
  joinDate: string;
  lastActivity: string;
}

const UserProfilePage: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    displayName: '',
    defaultBibleVersion: 'ESV',
    theme: 'dark' as 'light' | 'dark' | 'auto',
    language: 'en',
    emailNotifications: true,
    autoSave: true,
    sermonBackupFrequency: 'weekly' as 'never' | 'daily' | 'weekly' | 'monthly'
  });

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await loadUserProfile(currentUser.uid);
        await loadUserStats(currentUser.uid);
      } else {
        navigate('/login');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [navigate]);
  const loadUserProfile = async (userId: string) => {
    try {
      const profileData = await getUserProfile();
      
      if (profileData) {
        setProfile(profileData);
        setFormData({
          displayName: profileData.displayName || '',
          defaultBibleVersion: profileData.preferences?.defaultBibleVersion || 'ESV',
          theme: profileData.preferences?.theme || 'dark',
          language: profileData.preferences?.language || 'en',
          emailNotifications: profileData.preferences?.emailNotifications ?? true,
          autoSave: profileData.preferences?.autoSave ?? true,
          sermonBackupFrequency: profileData.preferences?.sermonBackupFrequency || 'weekly'
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadUserStats = async (userId: string) => {
    try {
      const statsData = await getUserStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    
    try {
      await updateUserProfile({
        displayName: formData.displayName,
        preferences: {
          defaultBibleVersion: formData.defaultBibleVersion,
          theme: formData.theme,
          language: formData.language,
          emailNotifications: formData.emailNotifications,
          autoSave: formData.autoSave,
          sermonBackupFrequency: formData.sermonBackupFrequency
        }
      });

      // Update Firebase Auth profile
      await updateProfile(user, {
        displayName: formData.displayName
      });

      await loadUserProfile(user.uid);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    
    try {
      const data = await exportUserData();
      
      // Create and download JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sermon-notes-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    try {
      await deleteUserAccount();
      await deleteUser(user);
      navigate('/login');
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please try again.');
    }
  };

  const handleLogout = async () => {
    const auth = getAuth(app);
    await signOut(auth);
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">
          <div className="loading-spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        {/* Header */}
        <div className="profile-header">
          <div className="profile-avatar">
            <img 
              src={user?.photoURL || '/default-avatar.png'} 
              alt="Profile"
              className="avatar-image"
            />
          </div>
          <div className="profile-info">
            <h1>{profile?.displayName || user?.displayName || 'User'}</h1>
            <p className="profile-email">{user?.email}</p>
            <p className="profile-join-date">
              Member since {new Date(user?.metadata?.creationTime || '').toLocaleDateString()}
            </p>
          </div>
          <div className="profile-actions">
            <button
              className={`btn-primary ${isEditing ? 'active' : ''}`}
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </button>
            <button className="btn-secondary" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </div>

        {/* Statistics Dashboard */}
        <div className="profile-stats">
          <h2>Your Activity</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">{stats?.totalSermons || 0}</div>
              <div className="stat-label">Sermons</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats?.totalVerses || 0}</div>
              <div className="stat-label">Verses</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats?.totalTags || 0}</div>
              <div className="stat-label">Tags</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats?.totalFolders || 0}</div>
              <div className="stat-label">Folders</div>
            </div>
          </div>
        </div>

        {/* Profile Settings */}
        <div className="profile-settings">
          <h2>Settings</h2>
          <div className="settings-form">
            <div className="form-group">
              <label htmlFor="displayName">Display Name</label>
              <input
                id="displayName"
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                disabled={!isEditing}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="defaultBibleVersion">Default Bible Version</label>
              <select
                id="defaultBibleVersion"
                value={formData.defaultBibleVersion}
                onChange={(e) => setFormData({...formData, defaultBibleVersion: e.target.value})}
                disabled={!isEditing}
                className="form-select"
              >
                <option value="ESV">English Standard Version (ESV)</option>
                <option value="NIV">New International Version (NIV)</option>
                <option value="KJV">King James Version (KJV)</option>
                <option value="NASB">New American Standard Bible (NASB)</option>
                <option value="NLT">New Living Translation (NLT)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="theme">Theme</label>
              <select
                id="theme"
                value={formData.theme}
                onChange={(e) => setFormData({...formData, theme: e.target.value as 'light' | 'dark' | 'auto'})}
                disabled={!isEditing}
                className="form-select"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="auto">Auto</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="backupFrequency">Backup Frequency</label>
              <select
                id="backupFrequency"
                value={formData.sermonBackupFrequency}
                onChange={(e) => setFormData({...formData, sermonBackupFrequency: e.target.value as any})}
                disabled={!isEditing}
                className="form-select"
              >
                <option value="never">Never</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.emailNotifications}
                  onChange={(e) => setFormData({...formData, emailNotifications: e.target.checked})}
                  disabled={!isEditing}
                  className="form-checkbox"
                />
                Email Notifications
              </label>
            </div>

            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.autoSave}
                  onChange={(e) => setFormData({...formData, autoSave: e.target.checked})}
                  disabled={!isEditing}
                  className="form-checkbox"
                />
                Auto-save Changes
              </label>
            </div>

            {isEditing && (
              <div className="form-actions">
                <button
                  className="btn-primary"
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Data Management */}
        <div className="profile-data">
          <h2>Data Management</h2>
          <div className="data-actions">
            <button className="btn-secondary" onClick={handleExportData}>
              Export All Data
            </button>
            <button 
              className="btn-danger" 
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Account
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Delete Account</h3>
              <p>
                Are you sure you want to delete your account? This will permanently delete all your sermons, 
                notes, tags, and other data. This action cannot be undone.
              </p>
              <div className="modal-actions">
                <button 
                  className="btn-secondary" 
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn-danger" 
                  onClick={handleDeleteAccount}
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfilePage;
function httpsCallable(functions: any, arg1: string) {
    throw new Error('Function not implemented.');
}

