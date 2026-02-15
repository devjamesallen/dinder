import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Calculate the number of right-swipes needed for a match.
 *   - Groups of 2–3: unanimous (all must swipe right)
 *   - Groups of 4+:  majority  (more than half)
 */
function requiredSwipes(memberCount) {
  if (memberCount <= 3) return memberCount; // unanimous
  return Math.floor(memberCount / 2) + 1;   // majority
}

/**
 * Save a swipe to Firestore and check for a group match.
 *
 * Swipes are scoped per group — the same restaurant in two different
 * groups produces two independent swipe documents.
 *
 * @param {string} userId
 * @param {string|null} groupId  — the active group (null = solo swiping)
 * @param {string} placeId
 * @param {string} direction     — 'left' or 'right'
 * @param {Object} restaurantData
 * @returns {Object|null} match object if threshold met, null otherwise
 */
export async function saveSwipe(userId, groupId, placeId, direction, restaurantData) {
  // Swipe ID includes groupId so each group has independent swipes
  const groupKey = groupId || 'solo';
  const swipeId = `${userId}_${groupKey}_${placeId}`;

  await setDoc(doc(db, 'swipes', swipeId), {
    userId,
    placeId,
    groupId: groupId || null,
    direction, // 'left' or 'right'
    restaurantName: restaurantData.name,
    restaurantPhoto: restaurantData.photo,
    restaurantRating: restaurantData.rating,
    restaurantCuisines: restaurantData.cuisines,
    restaurantAddress: restaurantData.address,
    timestamp: serverTimestamp(),
  });

  // If swiped right and in a group, check for match
  if (direction === 'right' && groupId) {
    const groupSnap = await getDoc(doc(db, 'groups', groupId));
    if (!groupSnap.exists()) return null;

    const groupData = groupSnap.data();
    const members = groupData.members || [];
    if (members.length < 2) return null; // Need at least 2 people

    const threshold = requiredSwipes(members.length);

    // Count how many members (including this user) swiped right on this place in this group
    const otherMembers = members.filter(m => m !== userId);
    let rightCount = 1; // Current user just swiped right

    for (const memberId of otherMembers) {
      const memberSwipeSnap = await getDocs(
        query(
          collection(db, 'swipes'),
          where('userId', '==', memberId),
          where('placeId', '==', placeId),
          where('groupId', '==', groupId),
          where('direction', '==', 'right')
        )
      );
      if (!memberSwipeSnap.empty) {
        rightCount++;
      }
    }

    if (rightCount >= threshold) {
      // Check we haven't already created this match
      const existingMatch = await getDoc(doc(db, 'matches', `${groupId}_${placeId}`));
      if (!existingMatch.exists()) {
        const match = await createMatch(groupId, placeId, restaurantData, members, rightCount);
        return match;
      }
    }
  }

  return null;
}

/**
 * Create a match document for a group.
 */
async function createMatch(groupId, placeId, restaurantData, members, rightCount) {
  const matchId = `${groupId}_${placeId}`;
  const total = members.length;

  const matchData = {
    groupId,
    members: members.sort(),
    memberCount: total,
    rightCount,
    unanimous: rightCount === total,
    placeId,
    restaurantName: restaurantData.name,
    restaurantPhoto: restaurantData.photo,
    restaurantRating: restaurantData.rating,
    restaurantCuisines: restaurantData.cuisines,
    restaurantAddress: restaurantData.address,
    restaurantPriceLevel: restaurantData.priceLevel,
    matchedAt: serverTimestamp(),
    status: 'active', // active | visited | archived
  };

  await setDoc(doc(db, 'matches', matchId), matchData);
  return { id: matchId, ...matchData };
}

/**
 * Listen for matches in real-time for a group.
 * Returns an unsubscribe function.
 */
export function listenToMatches(groupId, callback) {
  if (!groupId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'matches'),
    where('groupId', '==', groupId),
    where('status', '==', 'active'),
    orderBy('matchedAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const matches = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }));
    callback(matches);
  });
}

/**
 * Get all matches for a group.
 */
export async function getMatches(groupId, maxResults = 50) {
  if (!groupId) return [];

  const q = query(
    collection(db, 'matches'),
    where('groupId', '==', groupId),
    orderBy('matchedAt', 'desc'),
    limit(maxResults)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Get all place IDs the user has already swiped on for a specific group.
 * Scoped by groupId so swipes don't bleed between groups.
 */
export async function getSwipedPlaceIds(userId, groupId) {
  const groupKey = groupId || 'solo';
  const q = query(
    collection(db, 'swipes'),
    where('userId', '==', userId),
    where('groupId', '==', groupKey === 'solo' ? null : groupId)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => d.data().placeId);
}

/**
 * Update match status (e.g., mark as visited).
 */
export async function updateMatchStatus(matchId, status) {
  await setDoc(doc(db, 'matches', matchId), { status }, { merge: true });
}

// ══════════════════════════════════════════════════════════════
// Recipe Swipes & Matching (Group Eat In — Shared Deck)
// ══════════════════════════════════════════════════════════════

/**
 * Save a recipe swipe to Firestore and check for a group match.
 * Works the same as restaurant swipes but uses recipeSwipes/recipeMatches.
 *
 * @param {string} userId
 * @param {string} groupId
 * @param {number} recipeId
 * @param {string} direction — 'left' or 'right'
 * @param {Object} recipeData — recipe object from the shared deck
 * @returns {Object|null} match object if threshold met
 */
export async function saveRecipeSwipe(userId, groupId, recipeId, direction, recipeData) {
  const swipeId = `${userId}_${groupId}_${recipeId}`;

  await setDoc(doc(db, 'recipeSwipes', swipeId), {
    userId,
    recipeId,
    groupId,
    direction,
    recipeTitle: recipeData.title,
    recipeImage: recipeData.image,
    timestamp: serverTimestamp(),
  });

  // If swiped right, check for group match
  if (direction === 'right' && groupId) {
    const groupSnap = await getDoc(doc(db, 'groups', groupId));
    if (!groupSnap.exists()) return null;

    const groupData = groupSnap.data();
    const members = groupData.members || [];
    if (members.length < 2) return null;

    const threshold = requiredSwipes(members.length);

    // Count right swipes on this recipe from group members
    const otherMembers = members.filter(m => m !== userId);
    let rightCount = 1; // Current user just swiped right

    for (const memberId of otherMembers) {
      const memberSwipeSnap = await getDocs(
        query(
          collection(db, 'recipeSwipes'),
          where('userId', '==', memberId),
          where('recipeId', '==', recipeId),
          where('groupId', '==', groupId),
          where('direction', '==', 'right')
        )
      );
      if (!memberSwipeSnap.empty) {
        rightCount++;
      }
    }

    if (rightCount >= threshold) {
      const matchId = `${groupId}_recipe_${recipeId}`;
      const existingMatch = await getDoc(doc(db, 'recipeMatches', matchId));
      if (!existingMatch.exists()) {
        const match = await createRecipeMatch(groupId, recipeId, recipeData, members, rightCount);
        return match;
      }
    }
  }

  return null;
}

/**
 * Create a recipe match document.
 */
async function createRecipeMatch(groupId, recipeId, recipeData, members, rightCount) {
  const matchId = `${groupId}_recipe_${recipeId}`;
  const total = members.length;

  const matchData = {
    groupId,
    members: members.sort(),
    memberCount: total,
    rightCount,
    unanimous: rightCount === total,
    recipeId,
    recipeTitle: recipeData.title,
    recipeImage: recipeData.image,
    recipeSummary: recipeData.summary || '',
    readyInMinutes: recipeData.readyInMinutes || 0,
    servings: recipeData.servings || 0,
    cuisines: recipeData.cuisines || [],
    diets: recipeData.diets || [],
    ingredients: recipeData.ingredients || [],
    sourceUrl: recipeData.sourceUrl || null,
    matchedAt: serverTimestamp(),
    status: 'active', // active | cooked | archived
  };

  await setDoc(doc(db, 'recipeMatches', matchId), matchData);
  return { id: matchId, ...matchData };
}

/**
 * Get all recipe IDs a user has already swiped on in a specific group.
 */
export async function getSwipedRecipeIds(userId, groupId) {
  const q = query(
    collection(db, 'recipeSwipes'),
    where('userId', '==', userId),
    where('groupId', '==', groupId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data().recipeId);
}

/**
 * Update recipe match status (e.g., mark as cooked).
 */
export async function updateRecipeMatchStatus(matchId, status) {
  await setDoc(doc(db, 'recipeMatches', matchId), { status }, { merge: true });
}
