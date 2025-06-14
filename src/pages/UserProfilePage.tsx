import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut, deleteUser, updateProfile } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';
import { 
  getUserProfile, 
  updateUserProfile, 
  getUserStats, 
  exportUserData, 
  deleteUserAccount, 
  UserProfile,
  uploadProfileImage,
  updateUserProfilePhoto
} from '../services/firebaseService';
import './UserProfilePage.css';
import '../styles/theme_patch_all_pages.css';
import { ModernLoader } from '../components/ModernLoader';

interface Translation {
  id: string;
  name: string;
  displayName: string;
}

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
  const [isEditing, setIsEditing] = useState(false);  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  
  // Translation state
  const [availableTranslations, setAvailableTranslations] = useState<Translation[]>([]);
  const [loadingTranslations, setLoadingTranslations] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const functions = getFunctions(app);
  const [formData, setFormData] = useState({
    displayName: '',
    defaultBibleVersion: 'ESV',
    theme: 'dark' as 'light' | 'dark' | 'auto',
    language: 'en',
    emailNotifications: true,
    pushNotifications: false,
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
    });    return unsubscribe;
  }, [navigate]);

  // Fetch translations from Firestore
  useEffect(() => {
    const fetchTranslations = async () => {
      setLoadingTranslations(true);
      setTranslationError(null);
      try {
        const getAllUniqueTranslationsCallable = httpsCallable<
          void,
          { uniqueTranslations: Translation[] }
        >(functions, "getAllUniqueTranslations");
        const result = await getAllUniqueTranslationsCallable();
        const fetchedTranslations = result.data.uniqueTranslations || [];
        setAvailableTranslations(fetchedTranslations);
      } catch (err: any) {
        console.error("Error fetching translations:", err);
        setTranslationError(`Failed to load translations: ${err.message || "Unknown error"}`);
        // Fallback to hardcoded translations if fetch fails
        setAvailableTranslations([
          { id: 'ESV', name: 'esv', displayName: 'English Standard Version (ESV)' },
          { id: 'NIV', name: 'niv', displayName: 'New International Version (NIV)' },
          { id: 'KJV', name: 'kjv', displayName: 'King James Version (KJV)' },
          { id: 'NASB', name: 'nasb', displayName: 'New American Standard Bible (NASB)' },
          { id: 'NLT', name: 'nlt', displayName: 'New Living Translation (NLT)' }
        ]);
      } finally {
        setLoadingTranslations(false);
      }
    };

    fetchTranslations();
  }, [functions]);

  const loadUserProfile = async (userId: string) => {
    try {
      const profileData = await getUserProfile();
      
      if (profileData) {
        setProfile(profileData);        setFormData({
          displayName: profileData.displayName || '',
          defaultBibleVersion: profileData.preferences?.defaultBibleVersion || 'ESV',
          theme: profileData.preferences?.theme || 'dark',
          language: profileData.preferences?.language || 'en',
          emailNotifications: profileData.preferences?.emailNotifications ?? true,
          pushNotifications: profileData.preferences?.pushNotifications ?? false,
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
      // Set default stats if there's an error
      setStats({
        totalSermons: 0,
        totalVerses: 0,
        totalTags: 0,
        totalFolders: 0,
        totalVersions: 0,
        joinDate: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      });
    }
  };

  // Add effect to refresh stats periodically
  useEffect(() => {
    if (!user) return;
    
    // Refresh stats every 30 seconds
    const statsInterval = setInterval(() => {
      loadUserStats(user.uid);
    }, 30000);

    return () => clearInterval(statsInterval);
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateUserProfile({
        displayName: formData.displayName,        preferences: {
          defaultBibleVersion: formData.defaultBibleVersion,
          theme: formData.theme,
          language: formData.language,
          emailNotifications: formData.emailNotifications,
          pushNotifications: formData.pushNotifications,
          autoSave: formData.autoSave,
          sermonBackupFrequency: formData.sermonBackupFrequency
        }
      });
      // Persist default translation to localStorage for overlays/minicards
      localStorage.setItem('defaultBibleVersion', formData.defaultBibleVersion);

      // Update Firebase Auth profile
      await updateProfile(user, {
        displayName: formData.displayName
      });      await loadUserProfile(user.uid);
      setIsEditing(false);
      setSaveSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
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

  const handleProfilePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleProfilePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert('Please select an image smaller than 5MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      // Upload image to Firebase Storage
      const photoURL = await uploadProfileImage(file, user.uid);
      
      // Update user profile with new photo URL
      await updateUserProfilePhoto(photoURL);
      
      // Refresh user data
      await loadUserProfile(user.uid);
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      alert('Failed to upload profile photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemoveProfilePhoto = async () => {
    if (!user) return;
    
    if (!confirm('Are you sure you want to remove your profile picture?')) {
      return;
    }

    setUploadingPhoto(true);
    try {
      // Update user profile to remove photo URL
      await updateUserProfilePhoto('');
      
      // Refresh user data
      await loadUserProfile(user.uid);
    } catch (error) {
      console.error('Error removing profile photo:', error);
      alert('Failed to remove profile photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">
          <ModernLoader 
            text="Loading profile..." 
            size="large"
            className="profile-modern-loader"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-container">        {/* Header */}
        <div className="profile-header">
          <div className="profile-avatar">
            <div className="avatar-container">              <img 
                src={user?.photoURL || 'https://via.placeholder.com/100x100/3b82f6/ffffff?text=👤'} 
                alt="Profile"
                className="avatar-image"
                onClick={handleProfilePhotoClick}              />
              {uploadingPhoto && (
                <div className="avatar-loading">
                  <ModernLoader 
                    size="small"
                    className="avatar-modern-loader"
                  />
                </div>
              )}<div className="avatar-overlay" onClick={handleProfilePhotoClick}>
                <div className="avatar-overlay-content">
                  <span className="avatar-overlay-icon">📷</span>
                  <span className="avatar-overlay-text">
                    {user?.photoURL ? 'Replace Photo' : 'Add Photo'}
                  </span>
                </div>
              </div>
            </div>            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleProfilePhotoUpload}
              style={{ display: 'none' }}
              aria-label="Upload profile picture"
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
        </div>        {/* Profile Settings */}
        <div className="profile-settings">
          <h2>Settings</h2>
          
          {saveSuccess && (
            <div className="success-message">
              ✅ Settings saved successfully!
            </div>
          )}
          
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
            </div>            <div className="form-group">
              <label htmlFor="defaultBibleVersion">Default Bible Version</label>
              <select
                id="defaultBibleVersion"
                value={formData.defaultBibleVersion}
                onChange={(e) => setFormData({...formData, defaultBibleVersion: e.target.value})}
                disabled={!isEditing || loadingTranslations}
                className="form-select"
              >
                {loadingTranslations ? (
                  <option value="">Loading translations...</option>
                ) : translationError ? (
                  <option value="">Error loading translations</option>
                ) : availableTranslations.length > 0 ? (
                  availableTranslations.map(translation => (
                    <option key={translation.id} value={translation.id}>
                      {translation.displayName}
                    </option>
                  ))
                ) : (
                  <option value="">No translations available</option>
                )}
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
            </div>            {/* Notifications Section */}
            <div className="form-group">
              <h3>Notifications</h3>
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
              <small>Receive updates about backups and system notifications</small>
            </div>

            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.pushNotifications}
                  onChange={(e) => setFormData({...formData, pushNotifications: e.target.checked})}
                  disabled={!isEditing}
                  className="form-checkbox"
                />
                Push Notifications
              </label>
              <small>Receive browser notifications for important events</small>
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
              <small>Automatically save changes as you type</small>
            </div>{isEditing && (
              <div className="form-actions">
                <button
                  className="btn-primary"
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setIsEditing(false);
                    // Reset form data to original values
                    if (profile) {                      setFormData({
                        displayName: profile.displayName || '',
                        defaultBibleVersion: profile.preferences?.defaultBibleVersion || 'ESV',
                        theme: profile.preferences?.theme || 'dark',
                        language: profile.preferences?.language || 'en',
                        emailNotifications: profile.preferences?.emailNotifications ?? true,
                        pushNotifications: profile.preferences?.pushNotifications ?? false,
                        autoSave: profile.preferences?.autoSave ?? true,
                        sermonBackupFrequency: profile.preferences?.sermonBackupFrequency || 'weekly'
                      });
                    }
                  }}
                  disabled={saving}
                >
                  Cancel
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

