import { GOOGLE_PLACES_API_KEY, GOOGLE_PLACES_BASE_URL } from '../config';

// ============================================================
// Places API (New) — POST-based with field masks
// ============================================================

/**
 * Field mask — only request the fields we actually use.
 * Keeps responses fast and minimises billing.
 */
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.primaryType',
  'places.types',
  'places.photos',
  'places.currentOpeningHours',
  'places.location',
].join(',');

/**
 * Map the new API's string-based priceLevel → numeric 0-4
 */
const PRICE_MAP = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

/**
 * Google types that mean "not a food place" — filter these out
 */
const NON_FOOD_TYPES = new Set([
  'gas_station', 'car_wash', 'car_repair', 'car_dealer',
  'convenience_store', 'drugstore', 'pharmacy',
  'lodging', 'hotel', 'motel', 'extended_stay_hotel',
  'hospital', 'doctor', 'dentist', 'veterinary_care',
  'bank', 'atm', 'insurance_agency',
  'laundry', 'dry_cleaning', 'storage',
  'church', 'mosque', 'synagogue', 'hindu_temple',
  'gym', 'spa', 'hair_care', 'beauty_salon',
  'real_estate_agency', 'accounting', 'lawyer',
  'school', 'university', 'library',
  'post_office', 'city_hall', 'courthouse',
  'shopping_mall', 'department_store', 'furniture_store',
  'electronics_store', 'hardware_store', 'home_goods_store',
  'movie_theater', 'bowling_alley', 'amusement_park',
]);

const FOOD_TYPES = new Set([
  'restaurant', 'food', 'bakery', 'cafe', 'bar',
  'meal_takeaway', 'meal_delivery',
  // New API granular restaurant types
  'american_restaurant', 'chinese_restaurant', 'italian_restaurant',
  'japanese_restaurant', 'mexican_restaurant', 'thai_restaurant',
  'indian_restaurant', 'french_restaurant', 'korean_restaurant',
  'vietnamese_restaurant', 'mediterranean_restaurant', 'greek_restaurant',
  'pizza_restaurant', 'seafood_restaurant', 'steak_house',
  'sushi_restaurant', 'barbecue_restaurant', 'breakfast_restaurant',
  'brunch_restaurant', 'hamburger_restaurant', 'ice_cream_shop',
  'coffee_shop', 'tea_house', 'sandwich_shop', 'ramen_restaurant',
]);

/**
 * Check if a place is primarily a non-food business
 */
function isNonFoodPlace(types) {
  if (!types || types.length === 0) return false;
  const hasFood = types.some(t => FOOD_TYPES.has(t));
  const hasNonFood = types.some(t => NON_FOOD_TYPES.has(t));
  return hasNonFood && !hasFood;
}

// ============================================================
// Nearby Search (New)
// ============================================================

/**
 * Fetch nearby places for a given includedType using Places API (New).
 * POST  https://places.googleapis.com/v1/places:searchNearby
 */
async function fetchNearby(lat, lng, radiusMeters, includedType) {
  const url = `${GOOGLE_PLACES_BASE_URL}/places:searchNearby`;

  const body = {
    includedTypes: [includedType],
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radiusMeters,
      },
    },
    maxResultCount: 20,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.log(`Places API error for ${includedType}:`, response.status, errBody);
      return [];
    }

    const data = await response.json();
    return (data.places || [])
      .filter(place => !isNonFoodPlace(place.types))
      .map(place => formatPlace(place, lat, lng));
  } catch (err) {
    console.log(`Fetch error for ${includedType}:`, err);
    return [];
  }
}

/**
 * Search nearby with multiple food types in parallel.
 * Each type returns up to 20 results — after dedup we typically get 40-60.
 */
export async function searchAllNearbyRestaurants(lat, lng, radiusMeters = 8000) {
  const types = ['restaurant', 'cafe', 'bar', 'meal_takeaway'];
  const pages = await Promise.all(
    types.map(type => fetchNearby(lat, lng, radiusMeters, type))
  );

  // Merge all results
  const allResults = pages.flat();

  // Deduplicate by placeId (different type searches can return the same place)
  const seenIds = new Set();
  const unique = allResults.filter(r => {
    if (seenIds.has(r.placeId)) return false;
    seenIds.add(r.placeId);
    return true;
  });

  // Shuffle so it's not grouped by type
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }

  return unique;
}

// ============================================================
// Photo URL
// ============================================================

/**
 * Build a photo URL from a Places API (New) photo resource name.
 * Photo name looks like: "places/ChIJ.../photos/Aaw_..."
 */
function getPhotoUrl(photoName, maxHeight = 600) {
  if (!photoName) return null;
  return `${GOOGLE_PLACES_BASE_URL}/${photoName}/media?maxHeightPx=${maxHeight}&key=${GOOGLE_PLACES_API_KEY}`;
}

// ============================================================
// Format + Cuisine Detection
// ============================================================

function formatPlace(place, userLat, userLng) {
  const photoName = place.photos?.[0]?.name;

  const lat = place.location?.latitude;
  const lng = place.location?.longitude;

  return {
    placeId: place.id,
    name: place.displayName?.text || '',
    rating: place.rating || 0,
    totalRatings: place.userRatingCount || 0,
    priceLevel: PRICE_MAP[place.priceLevel] ?? undefined,
    address: place.shortFormattedAddress || place.formattedAddress || '',
    isOpenNow: place.currentOpeningHours?.openNow,
    photo: photoName ? getPhotoUrl(photoName) : null,
    cuisines: extractCuisines(place.types, place.primaryType, place.displayName?.text),
    location: { lat, lng },
    distance: (userLat && userLng && lat && lng)
      ? calculateDistance(userLat, userLng, lat, lng)
      : null,
  };
}

/**
 * Extract human-readable cuisine types.
 *
 * The new API gives us `primaryType` (e.g. "chinese_restaurant") which is
 * far more accurate than the old generic "restaurant" type.
 * We check primaryType first, then all types, then fall back to name keywords.
 */
function extractCuisines(types, primaryType, name) {
  // Map from Google type → display label
  const cuisineTypes = {
    'american_restaurant': 'American',
    'chinese_restaurant': 'Chinese',
    'italian_restaurant': 'Italian',
    'japanese_restaurant': 'Japanese',
    'mexican_restaurant': 'Mexican',
    'thai_restaurant': 'Thai',
    'indian_restaurant': 'Indian',
    'french_restaurant': 'French',
    'korean_restaurant': 'Korean',
    'vietnamese_restaurant': 'Vietnamese',
    'mediterranean_restaurant': 'Mediterranean',
    'greek_restaurant': 'Greek',
    'pizza_restaurant': 'Pizza',
    'seafood_restaurant': 'Seafood',
    'steak_house': 'Steakhouse',
    'sushi_restaurant': 'Sushi',
    'barbecue_restaurant': 'BBQ',
    'breakfast_restaurant': 'Breakfast',
    'brunch_restaurant': 'Brunch',
    'hamburger_restaurant': 'Burgers',
    'ramen_restaurant': 'Ramen',
    'sandwich_shop': 'Sandwiches',
    'ice_cream_shop': 'Desserts',
    'coffee_shop': 'Cafe',
    'tea_house': 'Tea',
    'cafe': 'Café',
    'bakery': 'Bakery',
    'bar': 'Bar',
    'meal_delivery': 'Delivery',
    'meal_takeaway': 'Takeout',
  };

  // Generic venue types that shouldn't block name-based detection
  const genericTypes = new Set(['Delivery', 'Takeout', 'Bar', 'Bakery', 'Café']);
  const found = [];

  // 1. Check primaryType first — most accurate signal
  if (primaryType && cuisineTypes[primaryType]) {
    const label = cuisineTypes[primaryType];
    if (!genericTypes.has(label)) {
      found.push(label);
    }
  }

  // 2. Check all types for additional cuisine tags
  if (types) {
    types.forEach(t => {
      if (cuisineTypes[t]) {
        const label = cuisineTypes[t];
        if (!genericTypes.has(label) && !found.includes(label)) {
          found.push(label);
        }
      }
    });
  }

  // 3. Name-based detection — fills gaps when Google types are generic
  if (found.length < 2 && name) {
    const lower = name.toLowerCase();

    const nameHints = [
      // Cuisine-specific keywords (high priority)
      ['italian', 'Italian'], ['pasta', 'Italian'], ['trattoria', 'Italian'],
      ['ristorante', 'Italian'], ['mamma', 'Italian'], ['mama', 'Italian'],
      ['disalvo', 'Italian'], ['nonna', 'Italian'], ['osteria', 'Italian'],
      ['mexican', 'Mexican'], ['taco', 'Mexican'], ['burrito', 'Mexican'],
      ['cantina', 'Mexican'], ['taqueria', 'Mexican'], ['meson', 'Mexican'],
      ['hacienda', 'Mexican'], ['cocina', 'Mexican'], ['el toro', 'Mexican'],
      ['chinese', 'Chinese'], ['china', 'Chinese'], ['wok', 'Chinese'], ['dumpling', 'Chinese'],
      ['chang', 'Chinese'], ['hunan', 'Chinese'], ['szechuan', 'Chinese'], ['peking', 'Chinese'],
      ['japanese', 'Japanese'], ['sushi', 'Japanese'], ['ramen', 'Japanese'],
      ['teriyaki', 'Japanese'], ['hibachi', 'Japanese'],
      ['thai', 'Thai'], ['pad thai', 'Thai'],
      ['india', 'Indian'], ['curry', 'Indian'], ['tandoori', 'Indian'], ['masala', 'Indian'],
      ['korean', 'Korean'], ['bibimbap', 'Korean'], ['bulgogi', 'Korean'],
      ['vietnam', 'Vietnamese'], ['pho', 'Vietnamese'], ['banh', 'Vietnamese'],
      ['mediterranean', 'Mediterranean'], ['hummus', 'Mediterranean'],
      ['falafel', 'Mediterranean'], ['gyro', 'Mediterranean'], ['shawarma', 'Mediterranean'],
      ['greek', 'Greek'], ['souvlaki', 'Greek'],
      ['french', 'French'], ['bistro', 'French'], ['brasserie', 'French'],
      ['noodle', 'Asian'],

      // Food-type keywords
      ['pizza', 'Pizza'], ['pizzeria', 'Pizza'], ['piazza', 'Pizza'],
      ['seafood', 'Seafood'], ['crab', 'Seafood'], ['lobster', 'Seafood'],
      ['oyster', 'Seafood'], ['shrimp', 'Seafood'], ['fish', 'Seafood'],
      ['steakhouse', 'Steakhouse'], ['steak', 'Steakhouse'], ['chop', 'Steakhouse'],
      ['bbq', 'BBQ'], ['barbecue', 'BBQ'], ['barbeque', 'BBQ'],
      ['smokehouse', 'BBQ'], ['brisket', 'BBQ'],
      ['fondue', 'Fondue'],
      ['burger', 'Burgers'],
      ['wing', 'Wings'], ['buffalo', 'Wings'],
      ['sandwich', 'Sandwiches'], ['submarine', 'Sandwiches'], ['deli', 'Deli'], ['sub ', 'Deli'],
      ['chicken', 'Chicken'], ['chick-fil', 'Chicken'], ['popeye', 'Chicken'],
      ['breakfast', 'Breakfast'], ['brunch', 'Breakfast'], ['pancake', 'Breakfast'],
      ['waffle', 'Breakfast'], ['ihop', 'Breakfast'], ['denny', 'Breakfast'],
      ['coffee', 'Cafe'], ['cafe', 'Cafe'], ['café', 'Cafe'], ['espresso', 'Cafe'],
      ['starbuck', 'Cafe'], ['tim horton', 'Cafe'], ['dunkin', 'Cafe'],
      ['bakery', 'Bakery'], ['donut', 'Bakery'], ['bagel', 'Bakery'],
      ['ice cream', 'Desserts'], ['frozen', 'Desserts'], ['yogurt', 'Desserts'],
      ['custard', 'Desserts'],
      ['buffet', 'Buffet'],
      ['salad', 'Healthy'], ['vegan', 'Vegan'], ['vegetarian', 'Vegetarian'],
      ['soup', 'Soups'],
      ['pub', 'Pub'], ['tavern', 'Pub'], ['brew', 'Brewery'],

      // Chain restaurants
      ['olive garden', 'Italian'], ['carrabba', 'Italian'],
      ['outback', 'Steakhouse'], ['longhorn', 'Steakhouse'], ['texas roadhouse', 'Steakhouse'],
      ['applebee', 'American'], ['chili', 'American'], ['cracker barrel', 'American'],
      ['cheesecake factory', 'American'], ['bob evans', 'American'], ['sonic', 'American'],
      ['red lobster', 'Seafood'],
      ['chipotle', 'Mexican'], ['qdoba', 'Mexican'], ['el pollo', 'Mexican'],
      ['el torito', 'Mexican'], ['taco bell', 'Mexican'],
      ['panera', 'Cafe'], ['subway', 'Sandwiches'],
      ['five guys', 'Burgers'], ['shake shack', 'Burgers'], ['wendy', 'Burgers'],
      ['mcdonald', 'Burgers'],
      ['domino', 'Pizza'], ['papa john', 'Pizza'], ['little caesar', 'Pizza'],
      ['golden corral', 'Buffet'], ['cici', 'Pizza'],
      ['melting pot', 'Fondue'], ['panda', 'Chinese'],
      ['kfc', 'Chicken'], ['raising cane', 'Chicken'], ['wingstop', 'Wings'],
      ['jersey mike', 'Sandwiches'], ['firehouse sub', 'Sandwiches'],
      ['krispy kreme', 'Bakery'], ['tim horton', 'Cafe'], ['dunkin', 'Cafe'],

      // Generic venue types (lowest priority)
      ['grille', 'Grill'], ['grill', 'Grill'],
    ];

    for (const [keyword, label] of nameHints) {
      if (lower.includes(keyword)) {
        if (!found.includes(label)) {
          found.push(label);
        }
        if (found.length >= 2) break;
      }
    }
  }

  return found;
}

// ============================================================
// Utilities
// ============================================================

/**
 * Calculate distance between two coordinates in miles (Haversine formula)
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 3959; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // 1 decimal place
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}
