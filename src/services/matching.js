import {
  collection,
  doc,
  setDoc,
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
 * Save a swipe to Firestore and check for a match
 * Returns the match object if both users swiped right, null otherwise
 */
export async function saveSwipe(userId, partnerId, placeId, direction, restaurantData) {
  // Save the swipe
  const swipeId = `${userId}_${placeId}`;
  await setDoc(doc(db, 'swipes', swipeId), {
    userId,
    placeId,
    direction, // 'left' or 'right'
    restaurantName: restaurantData.name,
    restaurantPhoto: restaurantData.photo,
    restaurantRating: restaurantData.rating,
    restaurantCuisines: restaurantData.cuisines,
    restaurantAddress: restaurantData.address,
    timestamp: serverTimestamp(),
  });

  // If swiped right and has a partner, check for match
  if (direction === 'right' && partnerId) {
    const partnerSwipeId = `${partnerId}_${placeId}`;
    const partnerSwipeRef = doc(db, 'swipes', partnerSwipeId);
    const partnerSwipeSnap = await getDocs(
      query(
        collection(db, 'swipes'),
        where('userId', '==', partnerId),
        where('placeId', '==', placeId),
        where('direction', '==', 'right')
      )
    );

    if (!partnerSwipeSnap.empty) {
      // It's a match!
      const match = await createMatch(userId, partnerId, placeId, restaurantData);
      return match;
    }
  }

  return null;
}

/**
 * Create a match document in Firestore
 */
async function createMatch(user1Id, user2Id, placeId, restaurantData) {
  // Create a deterministic couple ID (sorted UIDs)
  const coupleId = [user1Id, user2Id].sort().join('_');
  const matchId = `${coupleId}_${placeId}`;

  const matchData = {
    coupleId,
    user1Id: [user1Id, user2Id].sort()[0],
    user2Id: [user1Id, user2Id].sort()[1],
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
 * Listen for matches in real-time
 * Returns an unsubscribe function
 */
export function listenToMatches(userId, partnerId, callback) {
  const coupleId = [userId, partnerId].sort().join('_');

  const q = query(
    collection(db, 'matches'),
    where('coupleId', '==', coupleId),
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
 * Get all matches for a couple
 */
export async function getMatches(userId, partnerId, maxResults = 50) {
  const coupleId = [userId, partnerId].sort().join('_');

  const q = query(
    collection(db, 'matches'),
    where('coupleId', '==', coupleId),
    orderBy('matchedAt', 'desc'),
    limit(maxResults)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Get all place IDs the user has already swiped on (to filter them out)
 */
export async function getSwipedPlaceIds(userId) {
  const q = query(
    collection(db, 'swipes'),
    where('userId', '==', userId)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => d.data().placeId);
}

/**
 * Update match status (e.g., mark as visited)
 */
export async function updateMatchStatus(matchId, status) {
  await setDoc(doc(db, 'matches', matchId), { status }, { merge: true });
}
