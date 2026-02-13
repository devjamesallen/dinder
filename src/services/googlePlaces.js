import { GOOGLE_PLACES_API_KEY, GOOGLE_PLACES_BASE_URL } from '../config';

/**
 * Google types that mean "not a food place" — filter these out
 */
const NON_FOOD_TYPES = new Set([
  'gas_station', 'car_wash', 'car_repair', 'car_dealer',
  'convenience_store', 'drugstore', 'pharmacy',
  'lodging', 'hotel', 'motel',
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

/**
 * Check if a place is primarily a non-food business
 */
function isNonFoodPlace(types) {
  if (!types) return false;
  // If gas_station, lodging, etc. is present AND restaurant is NOT, skip it
  const hasFood = types.some(t => ['restaurant', 'food', 'bakery', 'cafe'].includes(t));
  const hasNonFood = types.some(t => NON_FOOD_TYPES.has(t));
  return hasNonFood && !hasFood;
}

/**
 * Fetch a single page of nearby places for a given type
 */
async function fetchNearbyPage(lat, lng, radiusMeters, type) {
  const url = `${GOOGLE_PLACES_BASE_URL}/nearbysearch/json?` +
    `location=${lat},${lng}` +
    `&radius=${radiusMeters}` +
    `&type=${type}` +
    `&key=${GOOGLE_PLACES_API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) return [];

  const data = await response.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return [];

  return (data.results || [])
    .filter(place => !isNonFoodPlace(place.types))
    .map(place => formatPlace(place, lat, lng));
}

/**
 * Search nearby with multiple food types in parallel.
 * All requests fire at once so total time ≈ 1 single request (~1s).
 */
export async function searchAllNearbyRestaurants(lat, lng, radiusMeters = 8000) {
  const types = ['restaurant', 'cafe', 'bar', 'meal_takeaway'];
  const pages = await Promise.all(
    types.map(type => fetchNearbyPage(lat, lng, radiusMeters, type))
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

/**
 * Build a photo URL from a Google Places photo reference
 */
function getPhotoUrl(photoReference, maxWidth = 400) {
  if (!photoReference) return null;
  return `${GOOGLE_PLACES_BASE_URL}/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
}

// ============================================================
// Helpers
// ============================================================

function formatPlace(place, userLat, userLng) {
  const photoRef = place.photos?.[0]?.photo_reference;

  return {
    placeId: place.place_id,
    name: place.name,
    rating: place.rating || 0,
    totalRatings: place.user_ratings_total || 0,
    priceLevel: place.price_level,
    address: place.vicinity || place.formatted_address || '',
    isOpenNow: place.opening_hours?.open_now,
    photo: photoRef ? getPhotoUrl(photoRef, 600) : null,
    cuisines: extractCuisines(place.types, place.name),
    location: {
      lat: place.geometry?.location?.lat,
      lng: place.geometry?.location?.lng,
    },
    distance: (userLat && userLng)
      ? calculateDistance(userLat, userLng, place.geometry?.location?.lat, place.geometry?.location?.lng)
      : null,
  };
}

/**
 * Extract human-readable cuisine types from Google Places types array + restaurant name
 */
function extractCuisines(types, name) {
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
    'cafe': 'Café',
    'bakery': 'Bakery',
    'bar': 'Bar',
    'meal_delivery': 'Delivery',
    'meal_takeaway': 'Takeout',
  };

  // Generic venue types that shouldn't block name-based detection
  const genericTypes = new Set(['Delivery', 'Takeout', 'Bar', 'Bakery', 'Café']);
  const found = [];

  // Check Google types first
  if (types) {
    types.forEach(t => {
      if (cuisineTypes[t] && !genericTypes.has(cuisineTypes[t])) {
        found.push(cuisineTypes[t]);
      }
    });
  }

  // Also try name-based detection — it often gives better, more specific results
  if (found.length < 2 && name) {
    const lower = name.toLowerCase();

    // Specific cuisine keywords — order matters: specific cuisines FIRST, generic words LAST
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

      // Generic venue types (lowest priority — only match if nothing else did)
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

  // Don't show generic "Restaurant" — return empty if nothing specific found
  return found;
}

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
