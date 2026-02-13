import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AppContext = createContext();

const STORAGE_KEY = '@dinder_state';

const initialState = {
  // Auth & User
  firebaseUser: null,       // { uid, email }
  userProfile: null,         // Firestore user doc (displayName, inviteCode, partnerUID, etc.)
  isAuthReady: false,        // Has auth state been determined?

  // Location
  userLocation: null,        // { lat, lng }

  // Eat In (Recipes)
  mealPlan: [],
  groceryList: [],
  skippedIds: [],

  // Kroger
  krogerToken: null,
  krogerRefreshToken: null,
  krogerStore: null,
  isKrogerConnected: false,
};

function appReducer(state, action) {
  switch (action.type) {
    case 'LOAD_STATE':
      return { ...state, ...action.payload };

    // ---- Auth ----
    case 'SET_FIREBASE_USER':
      return { ...state, firebaseUser: action.payload, isAuthReady: true };

    case 'SET_USER_PROFILE':
      return { ...state, userProfile: action.payload };

    case 'SIGN_OUT':
      return {
        ...initialState,
        isAuthReady: true,
        // Keep local meal plan data
        mealPlan: state.mealPlan,
        groceryList: state.groceryList,
      };

    // ---- Location ----
    case 'SET_USER_LOCATION':
      return { ...state, userLocation: action.payload };

    // ---- Eat In (Recipes) ----
    case 'ADD_TO_MEAL_PLAN': {
      if (state.mealPlan.some(r => r.id === action.payload.id)) return state;
      return { ...state, mealPlan: [...state.mealPlan, action.payload] };
    }

    case 'REMOVE_FROM_MEAL_PLAN':
      return {
        ...state,
        mealPlan: state.mealPlan.filter(r => r.id !== action.payload),
      };

    case 'CLEAR_MEAL_PLAN':
      return { ...state, mealPlan: [], groceryList: [] };

    case 'SKIP_RECIPE':
      return { ...state, skippedIds: [...state.skippedIds, action.payload] };

    case 'SET_GROCERY_LIST':
      return { ...state, groceryList: action.payload };

    case 'TOGGLE_GROCERY_ITEM':
      return {
        ...state,
        groceryList: state.groceryList.map(item =>
          item.id === action.payload
            ? { ...item, checked: !item.checked }
            : item
        ),
      };

    case 'REMOVE_GROCERY_ITEM':
      return {
        ...state,
        groceryList: state.groceryList.filter(item => item.id !== action.payload),
      };

    // ---- Kroger ----
    case 'SET_KROGER_AUTH':
      return {
        ...state,
        krogerToken: action.payload.accessToken,
        krogerRefreshToken: action.payload.refreshToken,
        isKrogerConnected: true,
      };

    case 'SET_KROGER_STORE':
      return { ...state, krogerStore: action.payload };

    case 'DISCONNECT_KROGER':
      return {
        ...state,
        krogerToken: null,
        krogerRefreshToken: null,
        krogerStore: null,
        isKrogerConnected: false,
      };

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load persisted state on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          dispatch({ type: 'LOAD_STATE', payload: parsed });
        }
      } catch (e) {
        console.log('Failed to load state:', e);
      }
    })();
  }, []);

  // Persist state on changes (debounced)
  useEffect(() => {
    const timeout = setTimeout(async () => {
      try {
        // Only persist safe, non-sensitive data
        const {
          krogerToken, krogerRefreshToken,
          firebaseUser, isAuthReady,
          ...safeState
        } = state;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(safeState));
      } catch (e) {
        console.log('Failed to persist state:', e);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
