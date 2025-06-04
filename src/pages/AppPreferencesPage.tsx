import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { app } from '../lib/firebase';
import { getUserProfile, updateUserProfile, UserProfile } from '../services/firebaseService';
import './AppPreferencesPage.css';

interface AppPreferences {
  autoSave: boolean;
  autoSaveInterval: number; // in minutes
  defaultBibleVersion: string;
  language: string;
  sermonBackupFrequency: 'never' | 'daily' | 'weekly' | 'monthly';
  emailNotifications: boolean;
  pushNotifications: boolean;
  showWelcomeScreen: boolean;
  enableKeyboardShortcuts: boolean;
  defaultSermonTemplate: string;
  pageSize: number;
  showPreviewPane: boolean;
}

export default function AppPreferencesPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const [preferences, setPreferences] = useState<AppPreferences>({
    autoSave: true,
    autoSaveInterval: 5,
    defaultBibleVersion: 'ESV',
    language: 'en',
    sermonBackupFrequency: 'weekly',
    emailNotifications: true,
    pushNotifications: false,
    showWelcomeScreen: true,
    enableKeyboardShortcuts: true,
    defaultSermonTemplate: 'expository',
    pageSize: 10,
    showPreviewPane: true
  });

  const bibleVersions = [
    'ESV', 'NIV', 'NASB', 'KJV', 'NLT', 'CSB', 'NKJV', 'RSV', 'ASV', 'NET'
  ];

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'pt', name: 'Portuguese' }
  ];

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await loadUserPreferences();
      } else {
        navigate('/login');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [navigate]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);
  const loadUserPreferences = async () => {
    try {
      const profile = await getUserProfile();
      if (profile && profile.preferences) {
        setPreferences({
          autoSave: profile.preferences.autoSave ?? true,
          autoSaveInterval: profile.preferences.autoSaveInterval ?? 5,
          defaultBibleVersion: profile.preferences.defaultBibleVersion ?? 'ESV',
          language: profile.preferences.language ?? 'en',
          sermonBackupFrequency: profile.preferences.sermonBackupFrequency ?? 'weekly',
          emailNotifications: profile.preferences.emailNotifications ?? true,
          pushNotifications: profile.preferences.pushNotifications ?? false,
          showWelcomeScreen: profile.preferences.showWelcomeScreen ?? true,
          enableKeyboardShortcuts: profile.preferences.enableKeyboardShortcuts ?? true,
          defaultSermonTemplate: profile.preferences.defaultSermonTemplate ?? 'expository',
          pageSize: profile.preferences.pageSize ?? 10,
          showPreviewPane: profile.preferences.showPreviewPane ?? true
        });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      setError('Failed to load preferences.');
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setError(null);
    setSuccess(null);    try {
      await updateUserProfile({ preferences });
      setSuccess('Preferences saved successfully!');
    } catch (error) {
      console.error('Error saving preferences:', error);
      setError('Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPreferences({
      autoSave: true,
      autoSaveInterval: 5,
      defaultBibleVersion: 'ESV',
      language: 'en',
      sermonBackupFrequency: 'weekly',
      emailNotifications: true,
      pushNotifications: false,
      showWelcomeScreen: true,
      enableKeyboardShortcuts: true,
      defaultSermonTemplate: 'expository',
      pageSize: 10,
      showPreviewPane: true
    });
  };
  if (loading) {
    return (
      <>
        <div className="universal-search-bg" />
        <div className="app-preferences-page">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading preferences...</p>
          </div>        </div>
      </>
    );
  }

  return (
    <>
      <div className="universal-search-bg" />
      <div className="app-preferences-page">
        <div className="page-header">
          <h1>App Preferences</h1>
          <p>Customize how the application behaves and functions</p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="message error">
            {error}
            <button onClick={() => setError(null)} className="close-btn">×</button>
          </div>
        )}
        {success && (
          <div className="message success">
            {success}
            <button onClick={() => setSuccess(null)} className="close-btn">×</button>
          </div>
        )}

        <div className="preferences-container">
          <div className="preferences-grid">
            
            {/* General Settings */}
            <div className="section">
              <div className="section-header">
                <h2>General Settings</h2>
              </div>
              
              <div className="form-group">
                <label>Default Bible Version</label>
                <select
                  value={preferences.defaultBibleVersion}
                  onChange={(e) => setPreferences({...preferences, defaultBibleVersion: e.target.value})}
                >
                  {bibleVersions.map(version => (
                    <option key={version} value={version}>{version}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Language</label>
                <select
                  value={preferences.language}
                  onChange={(e) => setPreferences({...preferences, language: e.target.value})}
                >
                  {languages.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Default Sermon Template</label>
                <select
                  value={preferences.defaultSermonTemplate}
                  onChange={(e) => setPreferences({...preferences, defaultSermonTemplate: e.target.value})}
                >
                  <option value="expository">Expository</option>
                  <option value="topical">Topical</option>
                  <option value="textual">Textual</option>
                  <option value="narrative">Narrative</option>
                </select>
              </div>

              <div className="form-group">
                <label>Items Per Page</label>
                <select
                  value={preferences.pageSize}
                  onChange={(e) => setPreferences({...preferences, pageSize: parseInt(e.target.value)})}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            {/* Auto-Save Settings */}
            <div className="section">
              <div className="section-header">
                <h2>Auto-Save Settings</h2>
              </div>
              
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={preferences.autoSave}
                    onChange={(e) => setPreferences({...preferences, autoSave: e.target.checked})}
                  />
                  Enable Auto-Save
                </label>
              </div>

              {preferences.autoSave && (
                <div className="form-group">
                  <label>Auto-Save Interval (minutes)</label>
                  <select
                    value={preferences.autoSaveInterval}
                    onChange={(e) => setPreferences({...preferences, autoSaveInterval: parseInt(e.target.value)})}
                  >
                    <option value={1}>1 minute</option>
                    <option value={2}>2 minutes</option>
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Backup Frequency</label>
                <select
                  value={preferences.sermonBackupFrequency}
                  onChange={(e) => setPreferences({...preferences, sermonBackupFrequency: e.target.value as any})}
                >
                  <option value="never">Never</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            {/* Notifications */}
            <div className="section">
              <div className="section-header">
                <h2>Notifications</h2>
              </div>
              
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={preferences.emailNotifications}
                    onChange={(e) => setPreferences({...preferences, emailNotifications: e.target.checked})}
                  />
                  Email Notifications
                </label>
                <small>Receive updates about backups and system notifications</small>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={preferences.pushNotifications}
                    onChange={(e) => setPreferences({...preferences, pushNotifications: e.target.checked})}
                  />
                  Push Notifications
                </label>
                <small>Receive browser notifications for important events</small>
              </div>
            </div>

            {/* Interface Settings */}
            <div className="section">
              <div className="section-header">
                <h2>Interface Settings</h2>
              </div>
              
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={preferences.showWelcomeScreen}
                    onChange={(e) => setPreferences({...preferences, showWelcomeScreen: e.target.checked})}
                  />
                  Show Welcome Screen
                </label>
                <small>Display welcome screen on app startup</small>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={preferences.enableKeyboardShortcuts}
                    onChange={(e) => setPreferences({...preferences, enableKeyboardShortcuts: e.target.checked})}
                  />
                  Enable Keyboard Shortcuts
                </label>
                <small>Use keyboard shortcuts for faster navigation</small>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={preferences.showPreviewPane}
                    onChange={(e) => setPreferences({...preferences, showPreviewPane: e.target.checked})}
                  />
                  Show Preview Pane
                </label>
                <small>Display content preview in list views</small>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="actions">
            <button
              className="btn btn-secondary"
              onClick={handleReset}
              disabled={saving}
            >
              Reset to Defaults
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
