// ============================================================
// Smart Ingredient Parser & Merger
// ============================================================
// Takes ingredients from multiple recipes and merges similar
// items, combining quantities intelligently.
// ============================================================

/**
 * Unit normalization map — converts various forms to a standard unit
 */
const UNIT_ALIASES = {
  // Volume
  'tsp': 'tsp', 'teaspoon': 'tsp', 'teaspoons': 'tsp', 't': 'tsp',
  'tbsp': 'tbsp', 'tablespoon': 'tbsp', 'tablespoons': 'tbsp', 'tbs': 'tbsp', 'tb': 'tbsp',
  'cup': 'cup', 'cups': 'cup', 'c': 'cup',
  'fl oz': 'fl oz', 'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz',
  'pint': 'pint', 'pints': 'pint', 'pt': 'pint',
  'quart': 'quart', 'quarts': 'quart', 'qt': 'quart',
  'gallon': 'gallon', 'gallons': 'gallon', 'gal': 'gallon',
  'ml': 'ml', 'milliliter': 'ml', 'milliliters': 'ml', 'millilitre': 'ml',
  'l': 'liter', 'liter': 'liter', 'liters': 'liter', 'litre': 'liter',

  // Weight
  'oz': 'oz', 'ounce': 'oz', 'ounces': 'oz',
  'lb': 'lb', 'lbs': 'lb', 'pound': 'lb', 'pounds': 'lb',
  'g': 'g', 'gram': 'g', 'grams': 'g',
  'kg': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',

  // Count
  'piece': 'piece', 'pieces': 'piece',
  'clove': 'clove', 'cloves': 'clove',
  'slice': 'slice', 'slices': 'slice',
  'can': 'can', 'cans': 'can',
  'bunch': 'bunch', 'bunches': 'bunch',
  'head': 'head', 'heads': 'head',
  'stalk': 'stalk', 'stalks': 'stalk',
  'sprig': 'sprig', 'sprigs': 'sprig',
  'pinch': 'pinch', 'pinches': 'pinch',
  'dash': 'dash', 'dashes': 'dash',
  'small': 'small', 'medium': 'medium', 'large': 'large',
  '': '',
};

/**
 * Volume conversion to teaspoons (for smart combining)
 */
const TO_TSP = {
  'tsp': 1,
  'tbsp': 3,
  'cup': 48,
  'fl oz': 6,
  'pint': 96,
  'quart': 192,
  'gallon': 768,
  'ml': 0.2029,
  'liter': 202.884,
};

/**
 * Weight conversion to ounces (for smart combining)
 */
const TO_OZ = {
  'oz': 1,
  'lb': 16,
  'g': 0.03527,
  'kg': 35.274,
};

/**
 * Normalize an ingredient name for matching purposes
 */
function normalizeIngredientName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    // Remove common modifiers that don't affect what you buy
    .replace(/\b(fresh|dried|ground|minced|chopped|diced|sliced|shredded|grated|crushed|whole|organic|frozen|canned|raw|cooked|boneless|skinless|extra-virgin|virgin|unsalted|salted|low-sodium|reduced-fat|light)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize a unit string
 */
function normalizeUnit(unit) {
  const lower = (unit || '').toLowerCase().trim();
  return UNIT_ALIASES[lower] !== undefined ? UNIT_ALIASES[lower] : lower;
}

/**
 * Check if two units are compatible (can be added together)
 */
function areUnitsCompatible(unit1, unit2) {
  if (unit1 === unit2) return true;
  if (TO_TSP[unit1] && TO_TSP[unit2]) return true;
  if (TO_OZ[unit1] && TO_OZ[unit2]) return true;
  return false;
}

/**
 * Add two quantities with potentially different but compatible units.
 * Returns { amount, unit } in the more common/larger unit.
 */
function addQuantities(amount1, unit1, amount2, unit2) {
  if (unit1 === unit2) {
    return { amount: amount1 + amount2, unit: unit1 };
  }

  // Volume units: convert to tsp then back to best unit
  if (TO_TSP[unit1] && TO_TSP[unit2]) {
    const totalTsp = amount1 * TO_TSP[unit1] + amount2 * TO_TSP[unit2];
    return convertFromTsp(totalTsp);
  }

  // Weight units: convert to oz then back to best unit
  if (TO_OZ[unit1] && TO_OZ[unit2]) {
    const totalOz = amount1 * TO_OZ[unit1] + amount2 * TO_OZ[unit2];
    return convertFromOz(totalOz);
  }

  // Incompatible — just keep both as a string
  return {
    amount: amount1 + amount2,
    unit: unit1 || unit2,
  };
}

/**
 * Convert teaspoons to the most readable unit
 */
function convertFromTsp(tsp) {
  if (tsp >= 192) return { amount: round(tsp / 192), unit: 'quart' };
  if (tsp >= 48) return { amount: round(tsp / 48), unit: 'cup' };
  if (tsp >= 3) return { amount: round(tsp / 3), unit: 'tbsp' };
  return { amount: round(tsp), unit: 'tsp' };
}

/**
 * Convert ounces to the most readable unit
 */
function convertFromOz(oz) {
  if (oz >= 16) return { amount: round(oz / 16), unit: 'lb' };
  return { amount: round(oz), unit: 'oz' };
}

function round(num) {
  return Math.round(num * 100) / 100;
}

/**
 * Main merge function: takes an array of recipes (each with .ingredients)
 * and returns a merged, deduplicated grocery list.
 *
 * Each output item:
 * {
 *   id: string,
 *   name: string,
 *   displayName: string,
 *   amount: number,
 *   unit: string,
 *   displayText: string,
 *   aisle: string,
 *   recipes: string[],   // which recipes need this ingredient
 *   checked: boolean,
 * }
 */
export function mergeIngredients(recipes) {
  const merged = new Map(); // key: normalized name -> merged ingredient

  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      const normName = normalizeIngredientName(ing.nameClean || ing.name);
      const normUnit = normalizeUnit(ing.unit);

      if (merged.has(normName)) {
        const existing = merged.get(normName);
        // Try to combine quantities
        if (areUnitsCompatible(existing.unit, normUnit)) {
          const combined = addQuantities(
            existing.amount,
            existing.unit,
            ing.amount,
            normUnit
          );
          existing.amount = combined.amount;
          existing.unit = combined.unit;
        } else {
          // Incompatible units — just note it
          existing.extraNotes = existing.extraNotes || [];
          existing.extraNotes.push(`+ ${ing.amount} ${ing.unit}`);
        }
        if (!existing.recipes.includes(recipe.title)) {
          existing.recipes.push(recipe.title);
        }
      } else {
        merged.set(normName, {
          id: `${normName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: normName,
          displayName: capitalize(ing.nameClean || ing.name),
          amount: ing.amount,
          unit: normUnit,
          aisle: ing.aisle || 'Other',
          recipes: [recipe.title],
          checked: false,
          extraNotes: [],
        });
      }
    }
  }

  // Build display text and sort by aisle
  const result = Array.from(merged.values()).map(item => ({
    ...item,
    displayText: formatDisplayText(item),
  }));

  // Sort by aisle for logical shopping order
  result.sort((a, b) => a.aisle.localeCompare(b.aisle));

  return result;
}

function formatDisplayText(item) {
  let text = '';
  if (item.amount && item.amount > 0) {
    text += formatAmount(item.amount);
    if (item.unit) text += ` ${item.unit}`;
    text += ' ';
  }
  text += item.displayName;
  if (item.extraNotes && item.extraNotes.length > 0) {
    text += ` (${item.extraNotes.join(', ')})`;
  }
  return text;
}

function formatAmount(num) {
  if (num === Math.floor(num)) return num.toString();
  // Handle common fractions
  const frac = num - Math.floor(num);
  const whole = Math.floor(num);
  const fractionMap = {
    0.25: '\u00BC', 0.33: '\u2153', 0.5: '\u00BD',
    0.67: '\u2154', 0.75: '\u00BE',
  };
  const closest = Object.keys(fractionMap).reduce((prev, curr) =>
    Math.abs(curr - frac) < Math.abs(prev - frac) ? curr : prev
  );
  if (Math.abs(closest - frac) < 0.1) {
    return whole > 0
      ? `${whole}${fractionMap[closest]}`
      : fractionMap[closest];
  }
  return num.toFixed(1);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
