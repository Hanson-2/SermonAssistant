import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { app } from '../lib/firebase';
import { getUserProfile, updateUserProfile } from '../services/firebaseService';
import { useTheme } from '../context/ThemeContext';
import { 
  ThemeSettings, 
  applyThemePreview, 
  removeThemePreview, 
  getSystemColorScheme 
} from '../utils/themeUtils';
import './ThemeSettingsPage.css';

const colorPresets = [
  { name: 'Default Theme', primary: '#e0c97f', accent: '#3b82f6' },
  { name: 'Golden Elegance', primary: '#fbbf24', accent: '#3b82f6' },
  { name: 'Royal Purple', primary: '#8b5cf6', accent: '#ec4899' },
  { name: 'Nature Green', primary: '#10b981', accent: '#06b6d4' },
  { name: 'Warm Sunset', primary: '#f59e0b', accent: '#ef4444' },
  { name: 'Ocean Blue', primary: '#3b82f6', accent: '#06b6d4' },
  { name: 'Forest Deep', primary: '#059669', accent: '#8b5cf6' },
  { name: 'Crimson Fire', primary: '#dc2626', accent: '#f59e0b' },
  { name: 'Midnight Azure', primary: '#1e40af', accent: '#ec4899' },
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
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [systemColorScheme, setSystemColorScheme] = useState<'light' | 'dark'>('dark');
  const navigate = useNavigate();
  const { settings: themeSettings, updateTheme } = useTheme();
  const [settings, setSettings] = useState<ThemeSettings>(themeSettings);

  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
  // Update local settings when theme context changes
    setSettings(themeSettings);
  }, [themeSettings]);
  // Detect system color scheme
  useEffect(() => {
    const updateSystemColorScheme = () => {
      setSystemColorScheme(getSystemColorScheme());
    };
    
    // Set initial value
    updateSystemColorScheme();
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => updateSystemColorScheme();
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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
  }, [success, error]);  // Apply theme preview
  useEffect(() => {
    if (previewMode) {
      applyThemePreview(settings);
    } else {
      removeThemePreview(themeSettings);
    }
    return () => {
      if (previewMode) {
        removeThemePreview(themeSettings);
      }
    };
  }, [settings, previewMode, themeSettings]);
  // Also apply preview when any settings change while in preview mode
  useEffect(() => {
    if (previewMode) {
      applyThemePreview(settings);
    }
  }, [
    previewMode,
    settings.primaryColor, 
    settings.accentColor, 
    settings.backgroundImage, 
    settings.fontSize, 
    settings.fontFamily, 
    settings.themeMode, 
    settings.compactMode, 
    settings.highContrast, 
    settings.reducedMotion,
    settings.largeClickTargets,
    settings.enhancedFocus,
    settings.dyslexiaFriendly,
    settings.lineHeight,
    settings.letterSpacing,
    settings.customCSS
  ]);const loadThemeSettings = async () => {
    try {
      const profile = await getUserProfile();
      if (profile && profile.themeSettings) {        const updatedSettings: ThemeSettings = {
          themeMode: profile.themeSettings.themeMode ?? 'dark',
          primaryColor: profile.themeSettings.primaryColor ?? '#e0c97f',
          accentColor: profile.themeSettings.accentColor ?? '#3b82f6',
          backgroundImage: profile.themeSettings.backgroundImage ?? '/Blue Wall Background.png',
          fontSize: profile.themeSettings.fontSize ?? 'medium',
          fontFamily: profile.themeSettings.fontFamily ?? 'Georgia, serif',
          compactMode: profile.themeSettings.compactMode ?? false,
          highContrast: profile.themeSettings.highContrast ?? false,
          reducedMotion: profile.themeSettings.reducedMotion ?? false,
          largeClickTargets: profile.themeSettings.largeClickTargets ?? false,
          enhancedFocus: profile.themeSettings.enhancedFocus ?? false,
          dyslexiaFriendly: profile.themeSettings.dyslexiaFriendly ?? false,
          lineHeight: profile.themeSettings.lineHeight ?? 'normal',
          letterSpacing: profile.themeSettings.letterSpacing ?? 'normal',
          customCSS: profile.themeSettings.customCSS ?? ''
        };
        setSettings(updatedSettings);
        updateTheme(updatedSettings);
      }    } catch (error) {
      console.error('Error loading theme settings:', error);
      setError('Failed to load theme settings.');
    }
  };
  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Save to Firebase
      await updateUserProfile({ themeSettings: settings });
      
      // Update theme context and apply globally
      updateTheme(settings);
      
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
  };  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all theme settings to defaults? This action cannot be undone.')) {
      setSettings({
        themeMode: 'dark',
        primaryColor: '#e0c97f',
        accentColor: '#3b82f6',
        backgroundImage: '/Blue Wall Background.png',
        fontSize: 'medium',
        fontFamily: 'Georgia, serif',
        compactMode: false,
        highContrast: false,
        reducedMotion: false,
        largeClickTargets: false,
        enhancedFocus: false,
        dyslexiaFriendly: false,
        lineHeight: 'normal',
        letterSpacing: 'normal',
        customCSS: ''
      });
      setSuccess('Theme settings reset to defaults.');
    }
  };const handleBackgroundUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Clear any previous errors
      setError(null);
      setUploading(true);
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file.');
        setUploading(false);
        return;
      }
      
      // Validate file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Image file size must be less than 10MB.');
        setUploading(false);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setSettings({...settings, backgroundImage: dataUrl});
        setSuccess('Background image uploaded successfully!');
        setUploading(false);
      };
      reader.onerror = () => {
        setError('Failed to read the image file.');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    }
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

        <div className="theme-container">          {/* Preview Toggle */}
          <div className="preview-toggle">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={previewMode}
                onChange={(e) => {
                  setPreviewMode(e.target.checked);
                  if (e.target.checked) {
                    setSuccess('Preview mode enabled. Changes will be applied temporarily.');
                  } else {
                    setSuccess('Preview mode disabled. Reverted to saved theme.');
                  }
                }}
              />
              Live Preview Mode
            </label>
            <small>Enable to see changes immediately without saving</small>
          </div>

          <div className="theme-grid">
            
            {/* Basic Theme Settings */}
            <div className="section">
              <div className="section-header">
                <h2>Basic Theme</h2>
              </div>
                <div className="form-group">
                <label>Theme Mode</label>
                <div className="theme-mode-toggles">
                  {(['light', 'dark', 'auto'] as const).map(mode => (
                    <button
                      key={mode}
                      className={`theme-toggle ${settings.themeMode === mode ? 'active' : ''}`}
                      onClick={() => setSettings({...settings, themeMode: mode})}
                    >                      <div className="toggle-icon">
                        {mode === 'light' && '☀️'}
                        {mode === 'dark' && '🌙'}
                        {mode === 'auto' && (systemColorScheme === 'dark' ? '🌙' : '☀️')}
                      </div>
                      <span className="toggle-label">
                        {mode === 'auto' ? `Auto (${systemColorScheme})` : mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>              <div className="form-group">
                <label>Background Image</label>
                <div className="background-grid">
                  {backgroundImages.map(bg => (
                    <div
                      key={bg.name}
                      className={`background-option ${settings.backgroundImage === bg.path ? 'selected' : ''}`}
                      onClick={() => setSettings({...settings, backgroundImage: bg.path})}
                    >
                      {bg.path ? (
                        <div className="background-thumbnail">
                          <img src={bg.path} alt={bg.name} />
                          <div className="background-overlay"></div>
                        </div>
                      ) : (
                        <div className="no-background">
                          <div className="no-bg-icon">🚫</div>
                          <span>None</span>
                        </div>
                      )}
                      <span className="background-label">{bg.name}</span>
                    </div>
                  ))}
                  
                  {/* Show custom uploaded image if it exists and is not a predefined one */}
                  {settings.backgroundImage && 
                   !backgroundImages.some(bg => bg.path === settings.backgroundImage) && (
                    <div className="background-option selected custom-bg">
                      <div className="background-thumbnail">
                        <img src={settings.backgroundImage} alt="Custom Background" />
                        <div className="background-overlay"></div>
                      </div>
                      <span className="background-label">Custom</span>
                      <button 
                        className="remove-custom-bg"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettings({...settings, backgroundImage: '/Blue Wall Background.png'});
                        }}
                        title="Remove custom background"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="form-group">
                <label>Upload Custom Background</label>
                <div className="upload-section">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBackgroundUpload}
                    id="background-upload"
                    style={{ display: 'none' }}
                  />                  <label 
                    htmlFor="background-upload" 
                    className="upload-button"
                    data-uploading={uploading}
                  >
                    <span className="upload-icon">
                      {uploading ? '⏳' : '📁'}
                    </span>
                    {uploading ? 'Uploading...' : 'Upload Background Image'}
                  </label>
                  <small className="upload-hint">Supports JPG, PNG, GIF. Recommended: 1920x1080 or higher</small>
                </div>
              </div>
            </div>

            {/* Color Customization */}
            <div className="section">
              <div className="section-header">
                <h2>Colors</h2>
              </div>              <div className="form-group">
                <label>Color Presets</label>
                <div className="preset-grid">
                  {colorPresets.map(preset => (
                    <div
                      key={preset.name}
                      className={`color-preset-card ${
                        settings.primaryColor === preset.primary && settings.accentColor === preset.accent 
                          ? 'selected' : ''
                      }`}
                      onClick={() => handlePreset(preset)}
                    >
                      <div className="preset-colors">
                        <div 
                          className="color-swatch primary"
                          style={{ backgroundColor: preset.primary }}
                          title={`Primary: ${preset.primary}`}
                        ></div>
                        <div 
                          className="color-swatch accent"
                          style={{ backgroundColor: preset.accent }}
                          title={`Accent: ${preset.accent}`}
                        ></div>
                      </div>
                      <div className="preset-info">
                        <span className="preset-name">{preset.name}</span>
                        <div className="preset-codes">
                          <small>{preset.primary}</small>
                          <small>{preset.accent}</small>
                        </div>
                      </div>
                    </div>
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
              </div>              <div className="form-group">
                <label>Font Size</label>
                <div className="font-size-toggles">
                  {(['small', 'medium', 'large'] as const).map(size => (
                    <button
                      key={size}
                      className={`font-size-toggle ${settings.fontSize === size ? 'active' : ''}`}
                      onClick={() => setSettings({...settings, fontSize: size})}
                    >
                      <div className="size-preview" data-size={size}>Aa</div>
                      <span className="size-label">{size.charAt(0).toUpperCase() + size.slice(1)}</span>
                    </button>
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

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.largeClickTargets || false}
                    onChange={(e) => setSettings({...settings, largeClickTargets: e.target.checked})}
                  />
                  Large Click Targets
                </label>
                <small>Increase button and link sizes for easier interaction</small>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.enhancedFocus || false}
                    onChange={(e) => setSettings({...settings, enhancedFocus: e.target.checked})}
                  />
                  Enhanced Focus Indicators
                </label>
                <small>Make keyboard navigation more visible</small>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.dyslexiaFriendly || false}
                    onChange={(e) => setSettings({...settings, dyslexiaFriendly: e.target.checked})}
                  />
                  Dyslexia-Friendly Font
                </label>
                <small>Use OpenDyslexic font for improved readability</small>
              </div>

              <div className="form-group">
                <label>Line Height</label>
                <div className="line-height-toggles">
                  {(['normal', 'relaxed', 'loose'] as const).map(height => (
                    <button
                      key={height}
                      className={`line-height-toggle ${(settings.lineHeight || 'normal') === height ? 'active' : ''}`}
                      onClick={() => setSettings({...settings, lineHeight: height})}
                    >
                      <div className="line-height-preview" data-height={height}>
                        <div>Line 1</div>
                        <div>Line 2</div>
                        <div>Line 3</div>
                      </div>
                      <span className="height-label">{height.charAt(0).toUpperCase() + height.slice(1)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Letter Spacing</label>
                <div className="letter-spacing-toggles">
                  {(['normal', 'wide', 'wider'] as const).map(spacing => (
                    <button
                      key={spacing}
                      className={`letter-spacing-toggle ${(settings.letterSpacing || 'normal') === spacing ? 'active' : ''}`}
                      onClick={() => setSettings({...settings, letterSpacing: spacing})}
                    >
                      <div className="spacing-preview" data-spacing={spacing}>ABC</div>
                      <span className="spacing-label">{spacing.charAt(0).toUpperCase() + spacing.slice(1)}</span>
                    </button>
                  ))}
                </div>
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
