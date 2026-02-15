// ============================================================
// Restaurant Busyness Estimator
// ============================================================
// Heuristic score (0–100) based on time of day, popularity,
// price level, cuisine type, and rating. No live data needed —
// uses patterns that correlate with real-world foot traffic.
// ============================================================

// ── Cuisine category sets ────────────────────────────────────
const FAST_CASUAL = new Set([
  'Burger', 'Pizza', 'Sandwich', 'Ramen', 'Fast Food',
  'Taco', 'Hot Dog', 'Chicken', 'Fried Chicken', 'Wings',
  'Noodles', 'Poke', 'Deli', 'Sub',
]);

const CASUAL_DINING = new Set([
  'Chinese', 'Thai', 'Mexican', 'Vietnamese', 'Indian',
  'Asian Fusion', 'Mediterranean', 'Korean', 'Japanese',
  'American', 'Latin American', 'Caribbean', 'Greek',
]);

const FINE_DINING = new Set([
  'French', 'Steakhouse', 'Fine Dining', 'Sushi',
  'Contemporary', 'European', 'Upscale',
]);

const BREAKFAST = new Set([
  'Breakfast', 'Brunch', 'Pancake', 'Diner', 'Bakery', 'Cafe',
]);

// ── Score components (each returns 0–100) ────────────────────

/**
 * Time-of-day + day-of-week score (0–100)
 * Peak: lunch 11:30–14:00, dinner 17:30–20:30
 * Weekend multiplier during rush hours
 */
function getTimeScore(hour, minute, dayOfWeek) {
  const time = hour + minute / 60;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;

  let score = 0;

  if (time >= 11.5 && time < 14) {
    // Lunch rush — peaks at 12:00–13:00
    score = time < 12 ? 55 : time < 13 ? 75 : 60;
  } else if (time >= 17.5 && time < 20.5) {
    // Dinner rush — peaks at 18:00–19:30
    score = time < 18 ? 60 : time < 19.5 ? 80 : 65;
  } else if (time >= 14 && time < 17.5) {
    // Afternoon lull
    score = 15;
  } else if (time >= 20.5 && time < 23) {
    // Late evening
    score = 30;
  } else if (time >= 7 && time < 11.5) {
    // Morning ramp-up
    score = 10 + (time - 7) * 6;
  } else {
    // Late night / early morning
    score = 5;
  }

  // Weekend boost during meal times
  if (isWeekend && ((time >= 11 && time < 15) || (time >= 17 && time < 21))) {
    score = Math.min(100, score * 1.1);
  }

  return Math.min(score, 100);
}

/**
 * Review count score (0–100)
 * Logarithmic — a place with 1000 reviews isn't 10x busier than 100
 */
function getReviewScore(totalRatings) {
  if (!totalRatings || totalRatings <= 0) return 5;
  // log10-squared curve — gives more spread between small and large
  // 10 reviews → ~12, 50 → ~35, 200 → ~64, 500 → ~88, 1000+ → 100
  return Math.min(100, Math.pow(Math.log10(totalRatings + 1), 2) * 12);
}

/**
 * Price level score (0–100)
 * Budget places peak at lunch, upscale at dinner
 */
function getPriceScore(priceLevel, hour) {
  const isLunch = hour >= 11.5 && hour < 14;
  const isDinner = hour >= 17.5 && hour < 21;

  switch (priceLevel) {
    case 1: return isLunch ? 85 : isDinner ? 50 : 30;   // Budget peaks at lunch
    case 2: return isLunch ? 60 : isDinner ? 70 : 30;   // Casual balanced
    case 3: return isLunch ? 30 : isDinner ? 80 : 20;   // Upscale peaks at dinner
    case 4: return isDinner ? 65 : 15;                    // Fine dining: dinner only
    default: return isLunch ? 55 : isDinner ? 55 : 25;   // Unknown
  }
}

/**
 * Cuisine type score (0–100)
 * Fast casual = higher turnover / lines; fine dining = reservations
 */
function getCuisineScore(cuisines, hour) {
  if (!cuisines || cuisines.length === 0) return 50;

  let score = 50; // neutral baseline
  for (const c of cuisines) {
    if (FAST_CASUAL.has(c)) { score = 80; break; }
    if (CASUAL_DINING.has(c)) { score = 60; break; }
    if (FINE_DINING.has(c)) { score = 30; break; }
  }

  // Breakfast boost during morning
  if (hour >= 7 && hour < 11) {
    if (cuisines.some(c => BREAKFAST.has(c))) {
      score = Math.min(100, score + 25);
    }
  }

  return Math.min(score, 100);
}

/**
 * Rating score (0–100)
 * Very high ratings = high demand = longer waits
 */
function getRatingScore(rating) {
  if (!rating || rating <= 0) return 40;
  if (rating >= 4.7) return 90;
  if (rating >= 4.2) return 70;
  if (rating >= 3.5) return 50;
  if (rating >= 3.0) return 35;
  return 20;
}

// ── Main export ──────────────────────────────────────────────

/**
 * Calculate a busyness estimate for a restaurant.
 *
 * Each factor returns 0–100. The weighted average produces a
 * final score of 0–100 that maps to three levels:
 *   0–39  → "quiet"
 *   40–69 → "moderate"
 *   70–100 → "busy"
 *
 * @param {Object} restaurant
 * @param {number} restaurant.totalRatings  — Google review count
 * @param {number} restaurant.rating        — 0–5 star rating
 * @param {number} restaurant.priceLevel    — 0–4
 * @param {string[]} restaurant.cuisines    — e.g. ['Chinese', 'Asian']
 * @returns {{ score: number, level: 'quiet'|'moderate'|'busy' }}
 */
export function calculateBusynessScore(restaurant) {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const dayOfWeek = now.getDay();

  const time    = getTimeScore(hour, minute, dayOfWeek);               // 0–100
  const reviews = getReviewScore(restaurant.totalRatings);              // 0–100
  const price   = getPriceScore(restaurant.priceLevel, hour + minute / 60); // 0–100
  const cuisine = getCuisineScore(restaurant.cuisines, hour);           // 0–100
  const rating  = getRatingScore(restaurant.rating);                    // 0–100

  // Weighted average (weights sum to 1.0)
  // Reviews get the most weight since they're the strongest
  // differentiator between restaurants at the same time of day.
  const raw =
    time    * 0.25 +
    reviews * 0.35 +
    price   * 0.20 +
    cuisine * 0.12 +
    rating  * 0.08;

  const score = Math.round(Math.max(0, Math.min(100, raw)));
  const level = score < 40 ? 'quiet' : score < 70 ? 'moderate' : 'busy';

  return { score, level };
}
