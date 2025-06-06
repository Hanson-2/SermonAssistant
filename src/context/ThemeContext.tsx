import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAuth } from 'firebase/auth';
import { getUserProfile } from '../services/firebaseService';
import { 
  ThemeSettings, 
  defaultThemeSettings, 
  applyThemeGlobally, 
  loadThemeFromStorage, 
  saveThemeToStorage,
  mergeWithDefaults 
} from '../utils/themeUtils';

interface ThemeContextType {
  settings: ThemeSettings;
  loading: boolean;
  updateTheme: (newSettings: Partial<ThemeSettings>) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<ThemeSettings>(defaultThemeSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeTheme();
  }, []);

  const initializeTheme = async () => {
    try {
      setLoading(true);
      
      // Try to get theme from localStorage first for immediate application
      const localTheme = loadThemeFromStorage();
      if (localTheme) {
        const mergedSettings = mergeWithDefaults(localTheme);
        setSettings(mergedSettings);
        applyThemeGlobally(mergedSettings);
      }

      // Check if user is authenticated and get theme from Firebase
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (user) {
        try {
          const profile = await getUserProfile();
          if (profile?.themeSettings) {            // Convert Firebase themeSettings to our ThemeSettings format
            const firebaseTheme: Partial<ThemeSettings> = {
              themeMode: profile.themeSettings.themeMode ?? 'dark',
              primaryColor: profile.themeSettings.primaryColor ?? '#e0c97f',
              accentColor: profile.themeSettings.accentColor ?? '#3b82f6',
              backgroundImage: profile.themeSettings.backgroundImage ?? '/Blue Wall Background.png',
              fontSize: profile.themeSettings.fontSize ?? 'medium',
              fontFamily: profile.themeSettings.fontFamily ?? 'Georgia, serif',
              compactMode: profile.themeSettings.compactMode ?? false,
              highContrast: profile.themeSettings.highContrast ?? false,
              reducedMotion: profile.themeSettings.reducedMotion ?? false,
              customCSS: profile.themeSettings.customCSS ?? ''
            };
            
            const mergedSettings = mergeWithDefaults(firebaseTheme);
            setSettings(mergedSettings);
            applyThemeGlobally(mergedSettings);
            saveThemeToStorage(mergedSettings); // Sync with localStorage
          }
        } catch (error) {
          console.error('Error loading theme from Firebase:', error);
          // If Firebase fails, use localStorage or defaults
          if (!localTheme) {
            applyThemeGlobally(defaultThemeSettings);
          }
        }
      } else {
        // Not authenticated, use localStorage or defaults
        if (!localTheme) {
          applyThemeGlobally(defaultThemeSettings);
        }
      }
    } catch (error) {
      console.error('Error initializing theme:', error);
      applyThemeGlobally(defaultThemeSettings);
    } finally {
      setLoading(false);
    }
  };

  const updateTheme = (newSettings: Partial<ThemeSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    applyThemeGlobally(updatedSettings);
    saveThemeToStorage(updatedSettings);
  };

  const resetTheme = () => {
    setSettings(defaultThemeSettings);
    applyThemeGlobally(defaultThemeSettings);
    saveThemeToStorage(defaultThemeSettings);
  };

  return (
    <ThemeContext.Provider value={{ settings, loading, updateTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
