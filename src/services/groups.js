import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';

// Same safe alphabet as user invite codes
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateGroupCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return code;
}

// ── Create ──────────────────────────────────────────────────

/**
 * Create a new group and add the creator as the first member.
 * Returns the group object with id.
 */
export async function createGroup(uid, displayName, groupName, locationData = null) {
  const inviteCode = generateGroupCode();
  const groupRef = doc(collection(db, 'groups'));

  const groupData = {
    name: groupName,
    inviteCode,
    createdBy: uid,
    members: [uid],
    memberNames: { [uid]: displayName || 'Unknown' },
    // Location & radius — null means "use device location"
    locationLat: locationData?.lat || null,
    locationLng: locationData?.lng || null,
    locationName: locationData?.name || null,  // e.g. "Disney World"
    searchRadiusMiles: locationData?.radius || 5,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(groupRef, groupData);
  return { id: groupRef.id, ...groupData };
}

// ── Update Location ─────────────────────────────────────────

/**
 * Update a group's location and search radius.
 */
export async function updateGroupLocation(groupId, locationData) {
  await updateDoc(doc(db, 'groups', groupId), {
    locationLat: locationData.lat || null,
    locationLng: locationData.lng || null,
    locationName: locationData.name || null,
    searchRadiusMiles: locationData.radius || 5,
    updatedAt: serverTimestamp(),
  });
}

// ── Join ────────────────────────────────────────────────────

/**
 * Find a group by its invite code (case-insensitive).
 */
export async function findGroupByInviteCode(inviteCode) {
  const q = query(
    collection(db, 'groups'),
    where('inviteCode', '==', inviteCode.toUpperCase())
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

/**
 * Add a user to an existing group.
 */
export async function joinGroup(uid, displayName, groupId) {
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    members: arrayUnion(uid),
    [`memberNames.${uid}`]: displayName || 'Unknown',
    updatedAt: serverTimestamp(),
  });
}

// ── Leave / Delete ──────────────────────────────────────────

/**
 * Remove a user from a group.
 * Deletes the group if it becomes empty.
 */
export async function leaveGroup(uid, groupId) {
  const groupRef = doc(db, 'groups', groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const remaining = data.members.filter(m => m !== uid);

  if (remaining.length === 0) {
    // Last member — delete the group entirely
    await deleteDoc(groupRef);
  } else {
    // Remove member and clean up their name
    const updatedNames = { ...data.memberNames };
    delete updatedNames[uid];

    await updateDoc(groupRef, {
      members: arrayRemove(uid),
      memberNames: updatedNames,
      updatedAt: serverTimestamp(),
    });
  }
}

// ── Query ───────────────────────────────────────────────────

/**
 * Get all groups the user belongs to.
 */
export async function getMyGroups(uid) {
  const q = query(
    collection(db, 'groups'),
    where('members', 'array-contains', uid)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Get a single group by ID.
 */
export async function getGroupById(groupId) {
  const snap = await getDoc(doc(db, 'groups', groupId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// ── Active group ────────────────────────────────────────────

/**
 * Set the user's active group (the one they're currently swiping with).
 */
export async function setActiveGroup(uid, groupId) {
  await updateDoc(doc(db, 'users', uid), {
    activeGroupId: groupId,
    updatedAt: serverTimestamp(),
  });
}

// ── Recipe Filters ──────────────────────────────────────────

/**
 * Update a group's recipe filter preferences.
 * These filters determine which recipes appear in the shared deck.
 */
export async function updateGroupRecipeFilters(groupId, filters) {
  await updateDoc(doc(db, 'groups', groupId), {
    recipeCuisine: filters.cuisine || null,        // e.g. "Italian", "Mexican"
    recipeMaxTime: filters.maxTime || null,         // max cook time in minutes
    recipeDiet: filters.diet || null,               // e.g. "vegetarian", "gluten free"
    updatedAt: serverTimestamp(),
  });
}

// ── Shared Recipe Deck ──────────────────────────────────────

/**
 * Save a shared recipe deck for a group.
 * All group members will swipe through the same recipes.
 *
 * @param {string} groupId
 * @param {Array} recipes — array of recipe objects from Spoonacular
 */
export async function saveSharedDeck(groupId, recipes) {
  const deckRef = doc(db, 'sharedDecks', groupId);
  await setDoc(deckRef, {
    groupId,
    recipes: recipes.map(r => ({
      id: r.id,
      title: r.title,
      image: r.image,
      summary: r.summary,
      readyInMinutes: r.readyInMinutes,
      servings: r.servings,
      healthScore: r.healthScore || 0,
      cuisines: r.cuisines || [],
      dishTypes: r.dishTypes || [],
      diets: r.diets || [],
      ingredients: r.ingredients || [],
      sourceUrl: r.sourceUrl || null,
    })),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get the current shared deck for a group.
 * Returns null if no deck exists.
 */
export async function getSharedDeck(groupId) {
  const snap = await getDoc(doc(db, 'sharedDecks', groupId));
  if (!snap.exists()) return null;
  return snap.data();
}

/**
 * Listen to changes in a group's shared deck.
 */
export function listenToSharedDeck(groupId, callback) {
  return onSnapshot(doc(db, 'sharedDecks', groupId), (snap) => {
    if (snap.exists()) {
      callback(snap.data());
    } else {
      callback(null);
    }
  });
}

// ── Group Meal Plan (Matched Recipes) ───────────────────────

/**
 * Listen to recipe matches for a group (from recipeMatches collection).
 */
export function listenToRecipeMatches(groupId, callback) {
  if (!groupId) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, 'recipeMatches'),
    where('groupId', '==', groupId),
    where('status', '==', 'active'),
    orderBy('matchedAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/**
 * Send a recipe suggestion to a group (from solo swiping).
 * Creates a document in the 'recipeSuggestions' collection.
 */
export async function suggestRecipeToGroup(groupId, recipe, suggestedBy, suggestedByName) {
  const suggestionRef = doc(collection(db, 'recipeSuggestions'));
  await setDoc(suggestionRef, {
    groupId,
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    recipeImage: recipe.image,
    recipeSummary: recipe.summary,
    readyInMinutes: recipe.readyInMinutes,
    servings: recipe.servings,
    ingredients: recipe.ingredients || [],
    cuisines: recipe.cuisines || [],
    diets: recipe.diets || [],
    sourceUrl: recipe.sourceUrl || null,
    suggestedBy,
    suggestedByName,
    status: 'pending', // pending | accepted | dismissed
    createdAt: serverTimestamp(),
  });
}

/**
 * Listen to recipe suggestions for a group.
 */
export function listenToRecipeSuggestions(groupId, callback) {
  if (!groupId) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, 'recipeSuggestions'),
    where('groupId', '==', groupId),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/**
 * Accept a recipe suggestion — moves it to the group meal plan.
 */
export async function acceptRecipeSuggestion(suggestionId) {
  await updateDoc(doc(db, 'recipeSuggestions', suggestionId), {
    status: 'accepted',
  });
}

/**
 * Dismiss a recipe suggestion.
 */
export async function dismissRecipeSuggestion(suggestionId) {
  await updateDoc(doc(db, 'recipeSuggestions', suggestionId), {
    status: 'dismissed',
  });
}

// ── Real-time ───────────────────────────────────────────────

/**
 * Listen for changes to a group (member joins/leaves).
 * Returns an unsubscribe function.
 */
export function listenToGroup(groupId, callback) {
  return onSnapshot(doc(db, 'groups', groupId), (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() });
    } else {
      callback(null);
    }
  });
}

/**
 * Listen for all groups the user belongs to.
 * Returns an unsubscribe function.
 */
export function listenToMyGroups(uid, callback) {
  const q = query(
    collection(db, 'groups'),
    where('members', 'array-contains', uid)
  );
  return onSnapshot(q, (snap) => {
    const groups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(groups);
  });
}
