import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import {
  KROGER_CLIENT_ID,
  KROGER_CLIENT_SECRET,
  KROGER_BASE_URL,
  KROGER_AUTH_URL,
  KROGER_REDIRECT_URI,
} from '../config';

const TOKEN_KEY = 'kroger_tokens';

// ============================================================
// Authentication
// ============================================================

/**
 * Build the Kroger OAuth authorization URL for PKCE flow
 */
export function getAuthRequest() {
  const discovery = {
    authorizationEndpoint: `${KROGER_AUTH_URL}/authorize`,
    tokenEndpoint: `${KROGER_AUTH_URL}/token`,
  };

  return AuthSession.useAuthRequest(
    {
      clientId: KROGER_CLIENT_ID,
      redirectUri: KROGER_REDIRECT_URI,
      scopes: ['product.compact', 'cart.basic:write', 'profile.compact'],
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    discovery
  );
}

/**
 * Exchange auth code for tokens
 */
export async function exchangeCodeForTokens(code, codeVerifier) {
  const tokenUrl = `${KROGER_AUTH_URL}/token`;

  const credentials = btoa(`${KROGER_CLIENT_ID}:${KROGER_CLIENT_SECRET}`);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: KROGER_REDIRECT_URI,
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
  }

  const tokens = await response.json();

  // Save tokens securely
  await SecureStore.setItemAsync(
    TOKEN_KEY,
    JSON.stringify({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    })
  );

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken) {
  const credentials = btoa(`${KROGER_CLIENT_ID}:${KROGER_CLIENT_SECRET}`);

  const response = await fetch(`${KROGER_AUTH_URL}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  const tokens = await response.json();

  await SecureStore.setItemAsync(
    TOKEN_KEY,
    JSON.stringify({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    })
  );

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  };
}

/**
 * Get a valid access token (refresh if needed)
 */
export async function getValidToken(currentToken, currentRefreshToken) {
  try {
    const stored = await SecureStore.getItemAsync(TOKEN_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.expiresAt > Date.now() + 60000) {
        return parsed.accessToken;
      }
      // Token is expired or about to expire, refresh it
      try {
        const refreshed = await refreshAccessToken(
          parsed.refreshToken || currentRefreshToken
        );
        return refreshed.accessToken;
      } catch (refreshErr) {
        // Refresh token is also dead — clear stale tokens and tell caller
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        throw new Error('SESSION_EXPIRED');
      }
    }
  } catch (e) {
    if (e.message === 'SESSION_EXPIRED') throw e;
    console.log('Token retrieval error:', e);
  }
  // No stored tokens — try whatever was passed in (may also be stale)
  if (currentToken) return currentToken;
  throw new Error('SESSION_EXPIRED');
}

/**
 * Load saved tokens from SecureStore
 */
export async function loadSavedTokens() {
  try {
    const stored = await SecureStore.getItemAsync(TOKEN_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.log('Error loading saved tokens:', e);
  }
  return null;
}

/**
 * Clear saved tokens (disconnect)
 */
export async function clearTokens() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ============================================================
// Product Search
// ============================================================

/**
 * Search Kroger products by ingredient name
 * Returns array of matching products with UPC, name, price, image
 */
export async function searchProducts(accessToken, ingredientName, locationId) {
  const params = new URLSearchParams({
    'filter.term': ingredientName,
    'filter.limit': '15',
  });

  if (locationId) {
    params.append('filter.locationId', locationId);
  }

  const response = await fetch(
    `${KROGER_BASE_URL}/products?${params.toString()}`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Product search failed: ${response.status}`);
  }

  const data = await response.json();

  return (data.data || []).map(product => ({
    productId: product.productId,
    upc: product.upc,
    name: product.description,
    brand: product.brand,
    image: product.images?.[0]?.sizes?.find(s => s.size === 'medium')?.url ||
           product.images?.[0]?.sizes?.[0]?.url || null,
    price: product.items?.[0]?.price?.regular || null,
    size: product.items?.[0]?.size || '',
  }));
}

// ============================================================
// Cart Management
// ============================================================

/**
 * Add items to the Kroger Clicklist cart
 * Items should be: [{ upc: '0001234567890', quantity: 1 }]
 */
export async function addToCart(accessToken, items) {
  const response = await fetch(`${KROGER_BASE_URL}/cart/add`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      items: items.map(item => ({
        upc: item.upc,
        quantity: item.quantity || 1,
      })),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Add to cart failed: ${response.status} - ${errorText}`);
  }

  return true;
}

// ============================================================
// Store Locations
// ============================================================

/**
 * Search for nearby Kroger store locations
 */
export async function searchLocations(accessToken, zipCode, radius = 10) {
  const params = new URLSearchParams({
    'filter.zipCode.near': zipCode,
    'filter.radiusInMiles': radius.toString(),
    'filter.limit': '10',
  });

  const response = await fetch(
    `${KROGER_BASE_URL}/locations?${params.toString()}`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Location search failed: ${response.status}`);
  }

  const data = await response.json();

  return (data.data || []).map(loc => ({
    locationId: loc.locationId,
    name: loc.name,
    address: `${loc.address.addressLine1}, ${loc.address.city}, ${loc.address.state} ${loc.address.zipCode}`,
    phone: loc.phone,
    chain: loc.chain,
  }));
}
