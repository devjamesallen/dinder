# GrubSwipe Setup Guide

A couples dinner app with three features: **Eat Out** (restaurant swiping & matching), **Eat In** (recipe swiping), and **Meal Plan** (smart grocery list → Kroger Clicklist).

## Quick Start

### 1. Install Dependencies

```bash
cd GrubSwipe
npm install
npx expo install firebase expo-location
```

### 2. Set Up Firebase (Required for Eat Out + Accounts)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Create a project"** → name it something like `grubswipe-app`
3. Once created, click the **Web** icon (`</>`) to add a web app
4. Copy the config object — you'll need these values

**Enable Authentication:**
1. In the Firebase console sidebar → **Build** → **Authentication**
2. Click **Get started**
3. Under **Sign-in providers**, enable **Email/Password**

**Enable Firestore:**
1. Sidebar → **Build** → **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (you can tighten rules later)
4. Select the region closest to you

**Add your Firebase config to the app:**

Open `src/config.js` and replace the Firebase placeholder values:

```js
export const FIREBASE_CONFIG = {
  apiKey: 'your-actual-api-key',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: 'your-sender-id',
  appId: 'your-app-id',
};
```

### 3. Set Up Google Places API (Required for Eat Out)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select or create a project (you can use the same one as Firebase)
3. Go to **APIs & Services** → **Library**
4. Search for **"Places API"** and click **Enable**
5. Go to **APIs & Services** → **Credentials**
6. Click **Create Credentials** → **API Key**
7. Copy the key

**Add your Google Places key to the app:**

Open `src/config.js` and replace the placeholder:

```js
export const GOOGLE_PLACES_API_KEY = 'your-actual-google-places-api-key';
```

> **Tip:** In the Credentials page, click your API key → **Restrict key** → under "API restrictions", select **Places API** only. This prevents misuse.

### 4. Kroger API (Already Configured!)

Your Kroger credentials are already set in `src/config.js`:
- Client ID: `dinder-bbcc0ltk` (registered under old "Dinder" name — still valid)
- Redirect URI: `grubswipe://auth/callback`

### 5. Run the App

```bash
npx expo start
```

Scan the QR code with:
- **iPhone**: Camera app → tap the banner
- **Android**: Expo Go app → scan QR code

## How It Works

### Landing Screen
When you open the app, you'll see the GrubSwipe logo with three feature cards:
- **Eat Out** — Swipe on nearby restaurants with your partner
- **Eat In** — Swipe on recipes to build a dinner menu
- **Meal Plan** — View selected recipes and build a grocery list

### Accounts & Pairing
- Sign up with email/password to create your account
- Share your 6-character invite code with your partner
- Your partner enters your code (or vice versa) to link your accounts
- Once paired, your Eat Out swipes are matched in real-time

### Eat Out (Restaurant Swiper)
- Swipe **right** (or tap the heart) if you'd eat there
- Swipe **left** (or tap the X) to skip
- When both you and your partner swipe right on the same restaurant, it's a **match!**
- View all matches in the Matches screen — get directions or mark as visited
- Adjust your search radius in Settings

### Eat In (Recipe Swiper)
- Swipe through recipes powered by Spoonacular
- Swipe right to add to your meal plan
- Swipe left to skip

### Meal Plan & Grocery List
- View all recipes you've selected
- Hit "Generate Grocery List" to get a smart-merged shopping list
- Items are grouped by aisle with similar ingredients combined
- "Send to Kroger Clicklist" adds items to your Kroger cart

### Settings
- View/edit your account info
- Adjust restaurant search radius (miles)
- Connect/disconnect Kroger account
- Select your preferred Kroger store

## Troubleshooting

**"Location permission needed"**
→ Make sure you've granted location access. On iOS, check Settings → GrubSwipe → Location.

**No restaurants showing up**
→ Verify your Google Places API key is correct in `src/config.js`. Try increasing the search radius in Settings.

**Firebase auth errors**
→ Double-check that Email/Password auth is enabled in Firebase console and your config values match exactly.

**"Token exchange failed" (Kroger)**
→ Make sure your Kroger redirect URI matches exactly: `grubswipe://auth/callback`

**Products not found on Kroger**
→ Make sure you've selected a store in Settings — product availability varies by location.

## Tech Stack

- React Native + Expo (SDK 54)
- Firebase Auth + Firestore (accounts, pairing, real-time matching)
- Google Places API (restaurant data + photos)
- Spoonacular API (recipe data)
- Kroger Public API (products, cart, locations)
- OAuth 2.0 PKCE (Kroger mobile auth)
