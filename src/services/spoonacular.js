import {
  SPOONACULAR_API_KEY,
  SPOONACULAR_BASE_URL,
  RECIPES_PER_BATCH,
  DEFAULT_RECIPE_TAGS,
} from '../config';

/**
 * Fetch a batch of random dinner recipes from Spoonacular
 * Returns recipes with images, descriptions, and ingredient lists
 */
export async function fetchRandomRecipes(count = RECIPES_PER_BATCH) {
  const url = `${SPOONACULAR_BASE_URL}/recipes/random?apiKey=${SPOONACULAR_API_KEY}&number=${count}&tags=${DEFAULT_RECIPE_TAGS}&instructionsRequired=true`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Spoonacular API error: ${response.status}`);
  }

  const data = await response.json();

  return data.recipes.map(recipe => ({
    id: recipe.id,
    title: recipe.title,
    image: recipe.image,
    summary: stripHtml(recipe.summary).slice(0, 350) + '...',
    readyInMinutes: recipe.readyInMinutes,
    servings: recipe.servings,
    healthScore: recipe.healthScore,
    cuisines: recipe.cuisines || [],
    dishTypes: recipe.dishTypes || [],
    diets: recipe.diets || [],
    ingredients: recipe.extendedIngredients.map(ing => ({
      id: ing.id,
      name: ing.name,
      nameClean: ing.nameClean || ing.name,
      amount: ing.amount,
      unit: ing.unit,
      original: ing.original,
      aisle: ing.aisle,
    })),
    sourceUrl: recipe.sourceUrl,
  }));
}

/**
 * Fetch full details for a specific recipe
 */
export async function fetchRecipeDetails(recipeId) {
  const url = `${SPOONACULAR_BASE_URL}/recipes/${recipeId}/information?apiKey=${SPOONACULAR_API_KEY}&includeNutrition=false`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Spoonacular API error: ${response.status}`);
  }

  const recipe = await response.json();

  return {
    id: recipe.id,
    title: recipe.title,
    image: recipe.image,
    summary: stripHtml(recipe.summary),
    readyInMinutes: recipe.readyInMinutes,
    servings: recipe.servings,
    instructions: stripHtml(recipe.instructions || ''),
    ingredients: recipe.extendedIngredients.map(ing => ({
      id: ing.id,
      name: ing.name,
      nameClean: ing.nameClean || ing.name,
      amount: ing.amount,
      unit: ing.unit,
      original: ing.original,
      aisle: ing.aisle,
    })),
    sourceUrl: recipe.sourceUrl,
  };
}

/**
 * Search recipes by query
 */
export async function searchRecipes(query, count = RECIPES_PER_BATCH) {
  const url = `${SPOONACULAR_BASE_URL}/recipes/complexSearch?apiKey=${SPOONACULAR_API_KEY}&query=${encodeURIComponent(query)}&number=${count}&addRecipeInformation=true&fillIngredients=true&type=main course`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Spoonacular API error: ${response.status}`);
  }

  const data = await response.json();

  return data.results.map(recipe => ({
    id: recipe.id,
    title: recipe.title,
    image: recipe.image,
    summary: stripHtml(recipe.summary || '').slice(0, 350) + '...',
    readyInMinutes: recipe.readyInMinutes,
    servings: recipe.servings,
    ingredients: (recipe.extendedIngredients || []).map(ing => ({
      id: ing.id,
      name: ing.name,
      nameClean: ing.nameClean || ing.name,
      amount: ing.amount,
      unit: ing.unit,
      original: ing.original,
      aisle: ing.aisle,
    })),
  }));
}

/** Strip HTML tags from a string */
function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
}
