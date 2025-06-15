// Theme utilities for global theme management

/**
 * Color utility functions
 */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

export const lightenColor = (hex: string, percent: number): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const { r, g, b } = rgb;
  const factor = (100 + percent) / 100;
  
  const newR = Math.min(255, Math.round(r * factor));
  const newG = Math.min(255, Math.round(g * factor));
  const newB = Math.min(255, Math.round(b * factor));
  
  return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1)}`;
};

export const darkenColor = (hex: string, percent: number): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const { r, g, b } = rgb;
  const factor = (100 - percent) / 100;
  
  const newR = Math.round(r * factor);
  const newG = Math.round(g * factor);
  const newB = Math.round(b * factor);
  
  return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1)}`;
};

export interface ThemeSettings {
  themeMode: 'light' | 'dark' | 'auto';
  primaryColor: string;
  accentColor: string;
  backgroundImage: string;
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: string;
  compactMode: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  largeClickTargets?: boolean;
  enhancedFocus?: boolean;
  dyslexiaFriendly?: boolean;
  lineHeight?: 'normal' | 'relaxed' | 'loose';
  letterSpacing?: 'normal' | 'wide' | 'wider';
  customCSS: string;
}

export const defaultThemeSettings: ThemeSettings = {
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
};

/**
 * Apply theme settings globally to the document
 */
export const applyThemeGlobally = (settings: ThemeSettings, isPreview: boolean = false): void => {
  const root = document.documentElement;
  
  // Force theme mode to dark
  const effectiveTheme = 'dark';
  
  // Set theme mode data attribute for CSS custom properties
  root.setAttribute('data-theme', effectiveTheme);
  
  // Set font size data attribute
  root.setAttribute('data-font-size', settings.fontSize);
  
  // Set accessibility attributes
  const accessibilityModes: string[] = [];
  if (settings.highContrast) accessibilityModes.push('high-contrast');
  if (settings.reducedMotion) accessibilityModes.push('reduced-motion');
  if (settings.compactMode) accessibilityModes.push('compact-mode');
  if (settings.largeClickTargets) accessibilityModes.push('large-click-targets');
  if (settings.enhancedFocus) accessibilityModes.push('enhanced-focus');
  if (settings.dyslexiaFriendly) accessibilityModes.push('dyslexia-friendly');
  
  if (accessibilityModes.length > 0) {
    root.setAttribute('data-accessibility', accessibilityModes.join(' '));
  } else {
    root.removeAttribute('data-accessibility');
  }
  
  // Set typography attributes
  if (settings.lineHeight) {
    root.setAttribute('data-line-height', settings.lineHeight);
  }
  if (settings.letterSpacing) {
    root.setAttribute('data-letter-spacing', settings.letterSpacing);
  }
  
  // Mark if this is a preview application
  if (isPreview) {
    root.setAttribute('data-theme-preview', 'true');
  } else {
    root.removeAttribute('data-theme-preview');
  }
  
  // Apply custom colors via CSS custom properties
  root.style.setProperty('--primary-color', settings.primaryColor);
  root.style.setProperty('--accent-color', settings.accentColor);
  root.style.setProperty('--font-family', settings.fontFamily);
  
  // Create derived color variations for primary color
  const primaryRgb = hexToRgb(settings.primaryColor);
  if (primaryRgb) {
    root.style.setProperty('--primary-color-rgb', `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`);
    root.style.setProperty('--primary-hover', lightenColor(settings.primaryColor, 10));
    root.style.setProperty('--primary-light', `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.3)`);
    root.style.setProperty('--primary-dark', darkenColor(settings.primaryColor, 20));
  }
  
  // Create derived color variations for accent color
  const accentRgb = hexToRgb(settings.accentColor);
  if (accentRgb) {
    root.style.setProperty('--accent-color-rgb', `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`);
    root.style.setProperty('--accent-hover', darkenColor(settings.accentColor, 10));
    root.style.setProperty('--accent-light', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.3)`);
  }
    // Apply background image
  if (settings.backgroundImage && settings.backgroundImage !== '') {
    console.log('Applying background image:', settings.backgroundImage);
    
    // Always set the CSS custom property for consistent styling
    root.style.setProperty('--bg-image-url', `url("${settings.backgroundImage}")`);
    
    // For consistency, also apply directly to body
    document.body.style.backgroundImage = `url("${settings.backgroundImage}")`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
    document.body.style.backgroundRepeat = 'no-repeat';
    
    // Remove any "no background" classes
    document.body.classList.remove('bg-none');
  } else {
    console.log('Removing background image');
    // Remove background
    root.style.setProperty('--bg-image-url', 'none');
    document.body.style.backgroundImage = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundAttachment = '';
    document.body.style.backgroundRepeat = '';
    document.body.classList.add('bg-none');
  }

  // Apply custom CSS
  let customStyleEl = document.getElementById('custom-theme-css');
  if (!customStyleEl) {
    customStyleEl = document.createElement('style');
    customStyleEl.id = 'custom-theme-css';
    document.head.appendChild(customStyleEl);
  }
  customStyleEl.textContent = settings.customCSS;

  // Save to localStorage for persistence (but not for preview)
  if (!isPreview) {
    saveThemeToStorage(settings);
  }
};

/**
 * Set up system theme preference listener for auto mode
 */
let autoThemeMediaQuery: MediaQueryList | null = null;
let autoThemeHandler: ((e: MediaQueryListEvent) => void) | null = null;

export const setupAutoThemeListener = (settings: ThemeSettings): void => {
  // Clean up existing listener
  if (autoThemeMediaQuery && autoThemeHandler) {
    autoThemeMediaQuery.removeEventListener('change', autoThemeHandler);
  }
  
  // Set up new listener
  autoThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  autoThemeHandler = (e: MediaQueryListEvent) => {
    if (settings.themeMode === 'auto') {
      const root = document.documentElement;
      root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  };
  
  autoThemeMediaQuery.addEventListener('change', autoThemeHandler);
};

/**
 * Clean up auto theme listener
 */
export const cleanupAutoThemeListener = (): void => {
  if (autoThemeMediaQuery && autoThemeHandler) {
    autoThemeMediaQuery.removeEventListener('change', autoThemeHandler);
    autoThemeMediaQuery = null;
    autoThemeHandler = null;
  }
};

/**
 * Remove all theme styles from the document
 */
export const removeThemeStyles = (): void => {
  const root = document.documentElement;
  
  // Remove custom theme attributes
  root.removeAttribute('data-theme');
  root.removeAttribute('data-font-size');
  root.removeAttribute('data-accessibility');
  
  // Remove custom CSS properties
  root.style.removeProperty('--color-primary');
  root.style.removeProperty('--color-accent');
  root.style.removeProperty('--font-family-primary');
  
  // Remove background styles and classes
  document.body.className = document.body.className.replace(/bg-[\w-]+/g, '');
  document.body.style.backgroundImage = '';
  document.body.style.backgroundSize = '';
  document.body.style.backgroundPosition = '';
  document.body.style.backgroundAttachment = '';

  // Remove custom CSS
  const customStyleEl = document.getElementById('custom-theme-css');
  if (customStyleEl) {
    customStyleEl.remove();
  }
};

/**
 * Local storage utilities
 */
const THEME_STORAGE_KEY = 'sermon-notes-theme-settings';

export const saveThemeToStorage = (settings: ThemeSettings): void => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save theme to localStorage:', error);
  }
};

export const loadThemeFromStorage = (): ThemeSettings | null => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as ThemeSettings;
    }
  } catch (error) {
    console.error('Failed to load theme from localStorage:', error);
  }
  return null;
};

export const clearThemeFromStorage = (): void => {
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear theme from localStorage:', error);
  }
};

/**
 * Merge partial theme settings with defaults
 */
export const mergeWithDefaults = (partialSettings: Partial<ThemeSettings>): ThemeSettings => {
  return {
    ...defaultThemeSettings,
    ...partialSettings
  };
};

/**
 * Apply theme preview without saving to storage
 */
export const applyThemePreview = (settings: ThemeSettings): void => {
  applyThemeGlobally(settings, true);
};

/**
 * Remove preview theme and restore saved theme
 */
export const removeThemePreview = (savedSettings: ThemeSettings): void => {
  // Simply reapply the saved settings without the preview flag
  applyThemeGlobally(savedSettings, false);
};

/**
 * Get current system color scheme preference
 */
export const getSystemColorScheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark'; // Default fallback
};
