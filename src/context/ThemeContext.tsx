import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
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
  refreshTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<ThemeSettings>(defaultThemeSettings);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  // Listen for authentication state changes
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('ThemeContext: Auth state changed:', user ? `User: ${user.email}` : 'No user');
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  // Initialize theme on mount and when user auth state changes
  useEffect(() => {
    console.log('ThemeContext: Triggering theme initialization, user:', currentUser ? currentUser.email : 'None');
    initializeTheme();
  }, [currentUser]);
  const initializeTheme = async () => {
    try {
      console.log('ThemeContext: Starting theme initialization...');
      setLoading(true);
      
      // Try to get theme from localStorage first for immediate application
      const localTheme = loadThemeFromStorage();
      if (localTheme) {
        console.log('ThemeContext: Local theme found, applying immediately:', localTheme);
        const mergedSettings = mergeWithDefaults(localTheme);
        setSettings(mergedSettings);
        applyThemeGlobally(mergedSettings);
      } else {
        console.log('ThemeContext: No local theme found');
      }

      // If user is authenticated, get theme from Firebase and override localStorage
      if (currentUser) {
        console.log('ThemeContext: User authenticated, loading theme from Firebase...');
        try {
          const profile = await getUserProfile();
          if (profile?.themeSettings) {
            console.log('ThemeContext: Firebase theme settings found:', profile.themeSettings);
            // Convert Firebase themeSettings to our ThemeSettings format
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
            console.log('ThemeContext: Applying Firebase theme:', mergedSettings);
            setSettings(mergedSettings);
            applyThemeGlobally(mergedSettings);
            saveThemeToStorage(mergedSettings); // Sync with localStorage
            console.log('Theme loaded from Firebase and applied:', mergedSettings);
          } else {
            console.log('ThemeContext: No theme settings in Firebase profile');
          }
        } catch (error) {
          console.error('Error loading theme from Firebase:', error);
          // If Firebase fails, use localStorage or defaults
          if (!localTheme) {
            console.log('ThemeContext: Falling back to defaults after Firebase error');
            const defaultSettings = mergeWithDefaults({});
            setSettings(defaultSettings);
            applyThemeGlobally(defaultSettings);
          }
        }
      } else {
        console.log('ThemeContext: No user authenticated, using local theme or defaults');
        // Not authenticated, use localStorage or defaults
        if (!localTheme) {
          console.log('ThemeContext: Applying default theme settings');
          const defaultSettings = mergeWithDefaults({});
          setSettings(defaultSettings);
          applyThemeGlobally(defaultSettings);
        }
      }
    } catch (error) {
      console.error('Error initializing theme:', error);
      const defaultSettings = mergeWithDefaults({});
      setSettings(defaultSettings);
      applyThemeGlobally(defaultSettings);
    } finally {
      console.log('ThemeContext: Theme initialization complete');
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

  const refreshTheme = async () => {
    await initializeTheme();
  };

  return (
    <ThemeContext.Provider value={{ settings, loading, updateTheme, resetTheme, refreshTheme }}>
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
