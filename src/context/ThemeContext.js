import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, getColors } from '../theme';

const ThemeContext = createContext();
const STORAGE_KEY = '@grubswipe_dark_mode';

const initialState = {
  isDarkMode: false,
  colors: lightColors,
};

function themeReducer(state, action) {
  switch (action.type) {
    case 'LOAD_THEME': {
      const isDark = action.payload === true;
      return { isDarkMode: isDark, colors: getColors(isDark) };
    }
    case 'TOGGLE_DARK_MODE': {
      const isDark = !state.isDarkMode;
      return { isDarkMode: isDark, colors: getColors(isDark) };
    }
    default:
      return state;
  }
}

export function ThemeProvider({ children }) {
  const [state, dispatch] = useReducer(themeReducer, initialState);

  // Load persisted preference on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored !== null) {
          dispatch({ type: 'LOAD_THEME', payload: stored === 'true' });
        }
      } catch (e) {
        console.log('Failed to load theme preference:', e);
      }
    })();
  }, []);

  // Persist when dark mode changes
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, String(state.isDarkMode)).catch(() => {});
  }, [state.isDarkMode]);

  return (
    <ThemeContext.Provider value={{ ...state, dispatch }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme — returns { colors, isDarkMode, dispatch }
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
