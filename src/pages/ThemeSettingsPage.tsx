import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { app } from '../lib/firebase';
import { getUserProfile, updateUserProfile } from '../services/firebaseService';
import './ThemeSettingsPage.css';

interface ThemeSettings {
  theme: 'light' | 'dark' | 'auto';
  primaryColor: string;
  accentColor: string;
  backgroundImage: string;
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: string;
  compactMode: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  customCSS: string;
}

const colorPresets = [
  { name: 'Gold & Blue', primary: '#fbbf24', accent: '#3b82f6' },
  { name: 'Purple & Pink', primary: '#8b5cf6', accent: '#ec4899' },
  { name: 'Green & Teal', primary: '#10b981', accent: '#06b6d4' },
  { name: 'Orange & Red', primary: '#f59e0b', accent: '#ef4444' },
  { name: 'Indigo & Cyan', primary: '#6366f1', accent: '#22d3ee' },
];

const backgroundImages = [
  { name: 'Blue Wall', path: '/Blue Wall Background.png' },
  { name: 'Red Wall', path: '/Red Wall Background.png' },
  { name: 'Texas Logo', path: '/Texas_Logo_Wallpaper.png' },
  { name: 'None', path: '' },
];

const fontFamilies = [
  'Georgia, serif',
  'Trajan Pro, serif',
  'Arial, sans-serif',
  'Helvetica, sans-serif',
  'Times New Roman, serif',
  'Roboto, sans-serif',
  'Open Sans, sans-serif',
];

export default function ThemeSettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const [settings, setSettings] = useState<ThemeSettings>({
    theme: 'dark',
    primaryColor: '#fbbf24',
    accentColor: '#3b82f6',
    backgroundImage: '/Blue Wall Background.png',
    fontSize: 'medium',
    fontFamily: 'Georgia, serif',
    compactMode: false,
    highContrast: false,
    reducedMotion: false,
    customCSS: ''
  });

  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await loadThemeSettings();
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

  // Apply theme preview
  useEffect(() => {
    if (previewMode) {
      applyThemePreview();
    } else {
      removeThemePreview();
    }
    return () => removeThemePreview();
  }, [settings, previewMode]);
  const loadThemeSettings = async () => {
    try {
      const profile = await getUserProfile();
      if (profile && profile.themeSettings) {        setSettings({
          theme: profile.themeSettings.themeMode ?? 'dark',
          primaryColor: profile.themeSettings.primaryColor ?? '#fbbf24',
          accentColor: profile.themeSettings.accentColor ?? '#3b82f6',
          backgroundImage: profile.themeSettings.backgroundImage ?? '/Blue Wall Background.png',
          fontSize: profile.themeSettings.fontSize ?? 'medium',
          fontFamily: profile.themeSettings.fontFamily ?? 'Georgia, serif',
          compactMode: profile.themeSettings.compactMode ?? false,
          highContrast: profile.themeSettings.highContrast ?? false,
          reducedMotion: profile.themeSettings.reducedMotion ?? false,
          customCSS: profile.themeSettings.customCSS ?? ''
        });
      }
    } catch (error) {
      console.error('Error loading theme settings:', error);
      setError('Failed to load theme settings.');
    }
  };

  const applyThemePreview = () => {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', settings.primaryColor);
    root.style.setProperty('--accent-color', settings.accentColor);
    root.style.setProperty('--font-family', settings.fontFamily);
    
    // Apply font size
    const fontSizes = { small: '14px', medium: '16px', large: '18px' };
    root.style.setProperty('--base-font-size', fontSizes[settings.fontSize]);
    
    // Apply background
    if (settings.backgroundImage) {
      document.body.style.backgroundImage = `url('${settings.backgroundImage}')`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
    } else {
      document.body.style.backgroundImage = 'none';
    }

    // Apply theme class
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${settings.theme}`);

    // Apply accessibility settings
    if (settings.highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }

    if (settings.reducedMotion) {
      document.body.classList.add('reduced-motion');
    } else {
      document.body.classList.remove('reduced-motion');
    }

    if (settings.compactMode) {
      document.body.classList.add('compact-mode');
    } else {
      document.body.classList.remove('compact-mode');
    }

    // Apply custom CSS
    let customStyleEl = document.getElementById('custom-theme-css');
    if (!customStyleEl) {
      customStyleEl = document.createElement('style');
      customStyleEl.id = 'custom-theme-css';
      document.head.appendChild(customStyleEl);
    }
    customStyleEl.textContent = settings.customCSS;
  };

  const removeThemePreview = () => {
    const root = document.documentElement;
    root.style.removeProperty('--primary-color');
    root.style.removeProperty('--accent-color');
    root.style.removeProperty('--font-family');
    root.style.removeProperty('--base-font-size');
    
    document.body.style.backgroundImage = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundAttachment = '';
    
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.remove('high-contrast', 'reduced-motion', 'compact-mode');

    const customStyleEl = document.getElementById('custom-theme-css');
    if (customStyleEl) {
      customStyleEl.remove();
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setError(null);
    setSuccess(null);    try {
      await updateUserProfile({ themeSettings: settings });
      setSuccess('Theme settings saved successfully!');
      setPreviewMode(false);
    } catch (error) {
      console.error('Error saving theme settings:', error);
      setError('Failed to save theme settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePreset = (preset: typeof colorPresets[0]) => {
    setSettings({
      ...settings,
      primaryColor: preset.primary,
      accentColor: preset.accent
    });
  };

  const handleReset = () => {
    setSettings({
      theme: 'dark',
      primaryColor: '#fbbf24',
      accentColor: '#3b82f6',
      backgroundImage: '/Blue Wall Background.png',
      fontSize: 'medium',
      fontFamily: 'Georgia, serif',
      compactMode: false,
      highContrast: false,
      reducedMotion: false,
      customCSS: ''
    });
  };

  if (loading) {
    return (
      <>
        <div className="universal-search-bg" />
        <div className="theme-settings-page">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading theme settings...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="universal-search-bg" />
      <div className="theme-settings-page">
        <div className="page-header">
          <h1>Theme Settings</h1>
          <p>Customize the appearance and visual style of the application</p>
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

        <div className="theme-container">
          {/* Preview Toggle */}
          <div className="preview-toggle">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={previewMode}
                onChange={(e) => setPreviewMode(e.target.checked)}
              />
              Live Preview Mode
            </label>
          </div>

          <div className="theme-grid">
            
            {/* Basic Theme Settings */}
            <div className="section">
              <div className="section-header">
                <h2>Basic Theme</h2>
              </div>
              
              <div className="form-group">
                <label>Theme Mode</label>
                <div className="radio-group">
                  {(['light', 'dark', 'auto'] as const).map(mode => (
                    <label key={mode} className="radio-label">
                      <input
                        type="radio"
                        name="theme"
                        value={mode}
                        checked={settings.theme === mode}
                        onChange={(e) => setSettings({...settings, theme: e.target.value as any})}
                      />
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Background Image</label>
                <div className="background-grid">
                  {backgroundImages.map(bg => (
                    <div
                      key={bg.name}
                      className={`background-option ${settings.backgroundImage === bg.path ? 'selected' : ''}`}
                      onClick={() => setSettings({...settings, backgroundImage: bg.path})}
                    >
                      {bg.path ? (
                        <img src={bg.path} alt={bg.name} />
                      ) : (
                        <div className="no-background">None</div>
                      )}
                      <span>{bg.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Color Customization */}
            <div className="section">
              <div className="section-header">
                <h2>Colors</h2>
              </div>

              <div className="form-group">
                <label>Color Presets</label>
                <div className="preset-grid">
                  {colorPresets.map(preset => (
                    <button
                      key={preset.name}
                      className="color-preset"
                      onClick={() => handlePreset(preset)}
                    >
                      <div className="preset-colors">
                        <div 
                          className="color-circle"
                          style={{ backgroundColor: preset.primary }}
                        ></div>
                        <div 
                          className="color-circle"
                          style={{ backgroundColor: preset.accent }}
                        ></div>
                      </div>
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="form-group">
                <label>Primary Color</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) => setSettings({...settings, primaryColor: e.target.value})}
                    title="Primary Color Picker"
                  />
                  <input
                    type="text"
                    value={settings.primaryColor}
                    onChange={(e) => setSettings({...settings, primaryColor: e.target.value})}
                    title="Primary Color Hex"
                    placeholder="#fbbf24"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Accent Color</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={settings.accentColor}
                    onChange={(e) => setSettings({...settings, accentColor: e.target.value})}
                    title="Accent Color Picker"
                  />
                  <input
                    type="text"
                    value={settings.accentColor}
                    onChange={(e) => setSettings({...settings, accentColor: e.target.value})}
                    title="Accent Color Hex"
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
            </div>

            {/* Typography */}
            <div className="section">
              <div className="section-header">
                <h2>Typography</h2>
              </div>
              
              <div className="form-group">
                <label>Font Family</label>
                <select
                  value={settings.fontFamily}
                  onChange={(e) => setSettings({...settings, fontFamily: e.target.value})}
                  aria-label="Font Family"
                  title="Font Family"
                >
                  {fontFamilies.map(font => (
                    <option key={font} value={font} style={{ fontFamily: font }}>
                      {font.split(',')[0]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Font Size</label>
                <div className="radio-group">
                  {(['small', 'medium', 'large'] as const).map(size => (
                    <label key={size} className="radio-label">
                      <input
                        type="radio"
                        name="fontSize"
                        value={size}
                        checked={settings.fontSize === size}
                        onChange={(e) => setSettings({...settings, fontSize: e.target.value as any})}
                      />
                      {size.charAt(0).toUpperCase() + size.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Accessibility */}
            <div className="section">
              <div className="section-header">
                <h2>Accessibility</h2>
              </div>
              
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.compactMode}
                    onChange={(e) => setSettings({...settings, compactMode: e.target.checked})}
                  />
                  Compact Mode
                </label>
                <small>Reduce spacing and padding for denser layouts</small>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.highContrast}
                    onChange={(e) => setSettings({...settings, highContrast: e.target.checked})}
                  />
                  High Contrast
                </label>
                <small>Increase contrast for better visibility</small>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.reducedMotion}
                    onChange={(e) => setSettings({...settings, reducedMotion: e.target.checked})}
                  />
                  Reduced Motion
                </label>
                <small>Minimize animations and transitions</small>
              </div>
            </div>

            {/* Custom CSS */}
            <div className="section full-width">
              <div className="section-header">
                <h2>Advanced Customization</h2>
              </div>
              
              <div className="form-group">
                <label>Custom CSS</label>
                <textarea
                  value={settings.customCSS}
                  onChange={(e) => setSettings({...settings, customCSS: e.target.value})}
                  placeholder="/* Add your custom CSS here */&#10;.custom-class {&#10;  color: #ff0000;&#10;}"
                  rows={8}
                />
                <small>Add custom CSS to further customize the appearance. Use with caution.</small>
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
              className="btn btn-secondary"
              onClick={() => setPreviewMode(!previewMode)}
            >
              {previewMode ? 'Exit Preview' : 'Preview Changes'}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Theme'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
