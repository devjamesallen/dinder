// ============================================================
// Dinder Configuration
// ============================================================
// Copy this file to config.js and fill in your API keys:
//   cp src/config.example.js src/config.js

// ----- Firebase -----
// Get these from Firebase Console → Project Settings → Web app config
export const FIREBASE_CONFIG = {
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.firebasestorage.app',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

// ----- Google Places -----
// Get from Google Cloud Console → APIs & Services → Credentials
export const GOOGLE_PLACES_API_KEY = 'YOUR_GOOGLE_PLACES_API_KEY';
export const GOOGLE_PLACES_BASE_URL = 'https://maps.googleapis.com/maps/api/place';

// ----- Spoonacular (Recipes) -----
export const SPOONACULAR_API_KEY = 'YOUR_SPOONACULAR_API_KEY';
export const SPOONACULAR_BASE_URL = 'https://api.spoonacular.com';

// ----- Kroger (Grocery / Clicklist) -----
export const KROGER_CLIENT_ID = 'YOUR_KROGER_CLIENT_ID';
export const KROGER_CLIENT_SECRET = 'YOUR_KROGER_CLIENT_SECRET';
export const KROGER_BASE_URL = 'https://api.kroger.com/v1';
export const KROGER_AUTH_URL = 'https://api.kroger.com/v1/connect/oauth2';
export const KROGER_REDIRECT_URI = 'dinder://auth/callback';

// ----- App Settings -----
export const RECIPES_PER_BATCH = 10;
export const DEFAULT_RECIPE_TAGS = 'dinner,main course';
export const DEFAULT_SEARCH_RADIUS_MILES = 5;
export const MAX_SEARCH_RADIUS_MILES = 25;
export const RESTAURANTS_PER_BATCH = 20;
