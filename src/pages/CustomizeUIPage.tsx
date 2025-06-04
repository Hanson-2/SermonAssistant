import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { app } from '../lib/firebase';
import { getUserProfile, updateUserProfile, UserProfile } from '../services/firebaseService';
import './CustomizeUIPage.css';

interface UICustomization {
  // Layout Settings
  sidebarPosition: 'left' | 'right' | 'hidden';
  navigationStyle: 'horizontal' | 'vertical' | 'compact';
  contentWidth: 'narrow' | 'medium' | 'wide' | 'full';
  
  // Component Visibility
  showWelcomeMessage: boolean;
  showQuickActions: boolean;
  showRecentSermons: boolean;
  showStatistics: boolean;
  showSearchSuggestions: boolean;
  
  // Grid Layout
  dashboardColumns: 1 | 2 | 3 | 4;
  cardSize: 'compact' | 'normal' | 'large';
  cardSpacing: 'tight' | 'normal' | 'loose';
  
  // Typography & Spacing
  interfaceScale: 80 | 90 | 100 | 110 | 120;
  lineHeight: 'compact' | 'normal' | 'relaxed';
  buttonSize: 'small' | 'medium' | 'large';
  
  // Toolbar & Actions
  showToolbarLabels: boolean;
  toolbarPosition: 'top' | 'bottom' | 'floating';
  quickActionButtons: string[];
  
  // Advanced Options
  enableAnimations: boolean;
  showTooltips: boolean;
  enableKeyboardNavigation: boolean;
  autoCollapseSidebar: boolean;
}

const CustomizeUIPage: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const navigate = useNavigate();
  const [uiSettings, setUISettings] = useState<UICustomization>({
    // Layout Settings
    sidebarPosition: 'left',
    navigationStyle: 'vertical',
    contentWidth: 'medium',
    
    // Component Visibility
    showWelcomeMessage: true,
    showQuickActions: true,
    showRecentSermons: true,
    showStatistics: true,
    showSearchSuggestions: true,
    
    // Grid Layout
    dashboardColumns: 2,
    cardSize: 'normal',
    cardSpacing: 'normal',
    
    // Typography & Spacing
    interfaceScale: 100,
    lineHeight: 'normal',
    buttonSize: 'medium',
    
    // Toolbar & Actions
    showToolbarLabels: true,
    toolbarPosition: 'top',
    quickActionButtons: ['new-sermon', 'search', 'recent'],
    
    // Advanced Options
    enableAnimations: true,
    showTooltips: true,
    enableKeyboardNavigation: true,
    autoCollapseSidebar: false
  });

  const [originalSettings, setOriginalSettings] = useState<UICustomization>({
    // Layout Settings
    sidebarPosition: 'left',
    navigationStyle: 'vertical',
    contentWidth: 'medium',
    
    // Component Visibility
    showWelcomeMessage: true,
    showQuickActions: true,
    showRecentSermons: true,
    showStatistics: true,
    showSearchSuggestions: true,
    
    // Grid Layout
    dashboardColumns: 2,
    cardSize: 'normal',
    cardSpacing: 'normal',
    
    // Typography & Spacing
    interfaceScale: 100,
    lineHeight: 'normal',
    buttonSize: 'medium',
    
    // Toolbar & Actions
    showToolbarLabels: true,
    toolbarPosition: 'top',
    quickActionButtons: ['new-sermon', 'search', 'recent'],
    
    // Advanced Options
    enableAnimations: true,
    showTooltips: true,
    enableKeyboardNavigation: true,
    autoCollapseSidebar: false
  });

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await loadUserProfile(currentUser.uid);
      } else {
        navigate('/login');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  const loadUserProfile = async (userId: string) => {
    try {
      const userProfile = await getUserProfile();
      setProfile(userProfile);
      
      if (userProfile?.uiCustomization) {
        const customization = userProfile.uiCustomization;
        setUISettings(customization);
        setOriginalSettings(customization);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setMessage({ type: 'error', text: 'Failed to load UI settings' });
    }
  };  const handleSave = async () => {
    if (!user || !profile) return;

    setSaving(true);
    try {
      await updateUserProfile({
        uiCustomization: uiSettings
      });
      setOriginalSettings(uiSettings);
      setMessage({ type: 'success', text: 'UI settings saved successfully!' });
    } catch (error) {
      console.error('Error saving UI settings:', error);
      setMessage({ type: 'error', text: 'Failed to save UI settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setUISettings(originalSettings);
    setMessage({ type: 'success', text: 'Settings reset to saved values' });
  };

  const handlePreview = () => {
    setPreviewMode(!previewMode);
    // Apply preview styles to body or root element
    if (!previewMode) {
      document.body.classList.add('ui-preview-mode');
      applyPreviewStyles();
    } else {
      document.body.classList.remove('ui-preview-mode');
      removePreviewStyles();
    }
  };
  const applyPreviewStyles = () => {
    const root = document.documentElement;
    root.style.setProperty('--interface-scale', `${uiSettings.interfaceScale}%`);
    root.style.setProperty('--sidebar-position', uiSettings.sidebarPosition);
    root.style.setProperty('--navigation-style', uiSettings.navigationStyle);
    root.style.setProperty('--content-width', uiSettings.contentWidth);
    root.style.setProperty('--dashboard-columns', uiSettings.dashboardColumns.toString());
    root.style.setProperty('--card-size', uiSettings.cardSize);
    root.style.setProperty('--card-spacing', uiSettings.cardSpacing);
    root.style.setProperty('--line-height', uiSettings.lineHeight);
    root.style.setProperty('--button-size', uiSettings.buttonSize);
    root.style.setProperty('--toolbar-position', uiSettings.toolbarPosition);
    
    if (!uiSettings.enableAnimations) {
      root.classList.add('no-animations');
    }
    if (!uiSettings.showTooltips) {
      root.classList.add('no-tooltips');
    }
  };

  const removePreviewStyles = () => {
    const root = document.documentElement;
    root.style.removeProperty('--interface-scale');
    root.style.removeProperty('--sidebar-position');
    root.style.removeProperty('--navigation-style');
    root.style.removeProperty('--content-width');
    root.style.removeProperty('--dashboard-columns');
    root.style.removeProperty('--card-size');
    root.style.removeProperty('--card-spacing');
    root.style.removeProperty('--line-height');
    root.style.removeProperty('--button-size');
    root.style.removeProperty('--toolbar-position');
    root.classList.remove('no-animations', 'no-tooltips');
  };

  if (loading) {
    return (
      <div className="customize-ui-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading UI settings...</p>
        </div>
      </div>
    );
  }

  const hasChanges = JSON.stringify(uiSettings) !== JSON.stringify(originalSettings);

  return (
    <div className={`customize-ui-page ${previewMode ? 'preview-mode' : ''}`}>
      <div className="page-header">
        <h1>Customize UI</h1>
        <p>Personalize the interface layout and appearance</p>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}      <div className="ui-settings-container">
        {/* Layout Settings */}
        <div className="settings-section">
          <h2>Layout Settings</h2>
          
          <div className="setting-row">
            <label>Sidebar Position</label>
            <select
              value={uiSettings.sidebarPosition}
              onChange={(e) => setUISettings(prev => ({ ...prev, sidebarPosition: e.target.value as 'left' | 'right' | 'hidden' }))}
              aria-label="Sidebar Position"
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>

          <div className="setting-row">
            <label>Navigation Style</label>
            <select
              value={uiSettings.navigationStyle}
              onChange={(e) => setUISettings(prev => ({ ...prev, navigationStyle: e.target.value as 'horizontal' | 'vertical' | 'compact' }))}
              aria-label="Navigation Style"
            >
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
              <option value="compact">Compact</option>
            </select>
          </div>

          <div className="setting-row">
            <label>Content Width</label>
            <select
              value={uiSettings.contentWidth}
              onChange={(e) => setUISettings(prev => ({ ...prev, contentWidth: e.target.value as 'narrow' | 'medium' | 'wide' | 'full' }))}
              aria-label="Content Width"
            >
              <option value="narrow">Narrow</option>
              <option value="medium">Medium</option>
              <option value="wide">Wide</option>
              <option value="full">Full</option>
            </select>
          </div>
        </div>

        {/* Component Visibility */}
        <div className="settings-section">
          <h2>Component Visibility</h2>
          
          <div className="setting-row">
            <label>
              <input
                type="checkbox"
                checked={uiSettings.showWelcomeMessage}
                onChange={(e) => setUISettings(prev => ({ ...prev, showWelcomeMessage: e.target.checked }))}
                aria-label="Show Welcome Message"
              />
              Show Welcome Message
            </label>
          </div>

          <div className="setting-row">
            <label>
              <input
                type="checkbox"
                checked={uiSettings.showQuickActions}
                onChange={(e) => setUISettings(prev => ({ ...prev, showQuickActions: e.target.checked }))}
                aria-label="Show Quick Actions"
              />
              Show Quick Actions
            </label>
          </div>

          <div className="setting-row">
            <label>
              <input
                type="checkbox"
                checked={uiSettings.showRecentSermons}
                onChange={(e) => setUISettings(prev => ({ ...prev, showRecentSermons: e.target.checked }))}
                aria-label="Show Recent Sermons"
              />
              Show Recent Sermons
            </label>
          </div>

          <div className="setting-row">
            <label>
              <input
                type="checkbox"
                checked={uiSettings.showStatistics}
                onChange={(e) => setUISettings(prev => ({ ...prev, showStatistics: e.target.checked }))}
                aria-label="Show Statistics"
              />
              Show Statistics
            </label>
          </div>

          <div className="setting-row">
            <label>
              <input
                type="checkbox"
                checked={uiSettings.showSearchSuggestions}
                onChange={(e) => setUISettings(prev => ({ ...prev, showSearchSuggestions: e.target.checked }))}
                aria-label="Show Search Suggestions"
              />
              Show Search Suggestions
            </label>
          </div>
        </div>

        {/* Grid Layout */}
        <div className="settings-section">
          <h2>Grid Layout</h2>
          
          <div className="setting-row">
            <label>Dashboard Columns</label>
            <select
              value={uiSettings.dashboardColumns}
              onChange={(e) => setUISettings(prev => ({ ...prev, dashboardColumns: parseInt(e.target.value) as 1 | 2 | 3 | 4 }))}
              aria-label="Dashboard Columns"
            >
              <option value="1">1 Column</option>
              <option value="2">2 Columns</option>
              <option value="3">3 Columns</option>
              <option value="4">4 Columns</option>
            </select>
          </div>

          <div className="setting-row">
            <label>Card Size</label>
            <select
              value={uiSettings.cardSize}
              onChange={(e) => setUISettings(prev => ({ ...prev, cardSize: e.target.value as 'compact' | 'normal' | 'large' }))}
              aria-label="Card Size"
            >
              <option value="compact">Compact</option>
              <option value="normal">Normal</option>
              <option value="large">Large</option>
            </select>
          </div>

          <div className="setting-row">
            <label>Card Spacing</label>
            <select
              value={uiSettings.cardSpacing}
              onChange={(e) => setUISettings(prev => ({ ...prev, cardSpacing: e.target.value as 'tight' | 'normal' | 'loose' }))}
              aria-label="Card Spacing"
            >
              <option value="tight">Tight</option>
              <option value="normal">Normal</option>
              <option value="loose">Loose</option>
            </select>
          </div>
        </div>

        {/* Typography & Spacing */}
        <div className="settings-section">
          <h2>Typography & Spacing</h2>
          
          <div className="setting-row">
            <label>Interface Scale</label>
            <div className="scale-control">
              <input
                type="range"
                min="80"
                max="120"
                step="10"
                value={uiSettings.interfaceScale}
                onChange={(e) => setUISettings(prev => ({ ...prev, interfaceScale: parseInt(e.target.value) as 80 | 90 | 100 | 110 | 120 }))}
                aria-label="Interface Scale"
              />
              <span>{uiSettings.interfaceScale}%</span>
            </div>
          </div>

          <div className="setting-row">
            <label>Line Height</label>
            <select
              value={uiSettings.lineHeight}
              onChange={(e) => setUISettings(prev => ({ ...prev, lineHeight: e.target.value as 'compact' | 'normal' | 'relaxed' }))}
              aria-label="Line Height"
            >
              <option value="compact">Compact</option>
              <option value="normal">Normal</option>
              <option value="relaxed">Relaxed</option>
            </select>
          </div>

          <div className="setting-row">
            <label>Button Size</label>
            <select
              value={uiSettings.buttonSize}
              onChange={(e) => setUISettings(prev => ({ ...prev, buttonSize: e.target.value as 'small' | 'medium' | 'large' }))}
              aria-label="Button Size"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
        </div>

        {/* Toolbar & Actions */}
        <div className="settings-section">
          <h2>Toolbar & Actions</h2>
          
          <div className="setting-row">
            <label>
              <input
                type="checkbox"
                checked={uiSettings.showToolbarLabels}
                onChange={(e) => setUISettings(prev => ({ ...prev, showToolbarLabels: e.target.checked }))}
                aria-label="Show Toolbar Labels"
              />
              Show Toolbar Labels
            </label>
          </div>

          <div className="setting-row">
            <label>Toolbar Position</label>
            <select
              value={uiSettings.toolbarPosition}
              onChange={(e) => setUISettings(prev => ({ ...prev, toolbarPosition: e.target.value as 'top' | 'bottom' | 'floating' }))}
              aria-label="Toolbar Position"
            >
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
              <option value="floating">Floating</option>
            </select>
          </div>
        </div>

        {/* Advanced Options */}
        <div className="settings-section">
          <h2>Advanced Options</h2>
          
          <div className="setting-row">
            <label>
              <input
                type="checkbox"
                checked={uiSettings.enableAnimations}
                onChange={(e) => setUISettings(prev => ({ ...prev, enableAnimations: e.target.checked }))}
                aria-label="Enable Animations"
              />
              Enable Animations
            </label>
          </div>

          <div className="setting-row">
            <label>
              <input
                type="checkbox"
                checked={uiSettings.showTooltips}
                onChange={(e) => setUISettings(prev => ({ ...prev, showTooltips: e.target.checked }))}
                aria-label="Show Tooltips"
              />
              Show Tooltips
            </label>
          </div>

          <div className="setting-row">
            <label>
              <input
                type="checkbox"
                checked={uiSettings.enableKeyboardNavigation}
                onChange={(e) => setUISettings(prev => ({ ...prev, enableKeyboardNavigation: e.target.checked }))}
                aria-label="Enable Keyboard Navigation"
              />
              Enable Keyboard Navigation
            </label>
          </div>

          <div className="setting-row">
            <label>
              <input
                type="checkbox"
                checked={uiSettings.autoCollapseSidebar}
                onChange={(e) => setUISettings(prev => ({ ...prev, autoCollapseSidebar: e.target.checked }))}
                aria-label="Auto Collapse Sidebar"
              />
              Auto Collapse Sidebar
            </label>
          </div>
        </div>
      </div>

      <div className="actions-container">
        <button
          onClick={handlePreview}
          className={`btn preview-btn ${previewMode ? 'active' : ''}`}
        >
          {previewMode ? 'Exit Preview' : 'Preview Changes'}
        </button>
        
        <button
          onClick={handleReset}
          disabled={!hasChanges || saving}
          className="btn reset-btn"
        >
          Reset
        </button>
        
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="btn save-btn"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default CustomizeUIPage;
