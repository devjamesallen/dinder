import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { db, getUserProfile } from './firebase';

/**
 * Look up a user by their invite code
 * Returns the user profile if found, null otherwise
 */
export async function findUserByInviteCode(inviteCode) {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('inviteCode', '==', inviteCode.toUpperCase()));
  const snap = await getDocs(q);

  if (snap.empty) return null;

  const userDoc = snap.docs[0];
  return { uid: userDoc.id, ...userDoc.data() };
}

/**
 * Pair two users as a couple
 * Sets partnerUID on both user profiles
 */
export async function createPairing(myUid, partnerUid) {
  // Update both users to point to each other
  await Promise.all([
    updateDoc(doc(db, 'users', myUid), { partnerUID: partnerUid }),
    updateDoc(doc(db, 'users', partnerUid), { partnerUID: myUid }),
  ]);
}

/**
 * Unpair two users
 */
export async function breakPairing(myUid, partnerUid) {
  await Promise.all([
    updateDoc(doc(db, 'users', myUid), { partnerUID: null }),
    updateDoc(doc(db, 'users', partnerUid), { partnerUID: null }),
  ]);
}

/**
 * Get partner's profile
 */
export async function getPartnerProfile(partnerUid) {
  return getUserProfile(partnerUid);
}
