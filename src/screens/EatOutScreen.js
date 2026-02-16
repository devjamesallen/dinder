import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Modal,
} from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import Swiper from 'react-native-deck-swiper';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { searchAllNearbyRestaurants } from '../services/googlePlaces';
import { saveSwipe, getSwipedPlaceIds } from '../services/matching';
const { width, height } = Dimensions.get('window');
const CARD_HEIGHT = height * 0.72;

const PRICE_LABELS = ['', '$', '$$', '$$$', '$$$$'];

function StarRating({ rating, colors }) {
  const stars = [];
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  for (let i = 0; i < 5; i++) {
    if (i < full) stars.push('star');
    else if (i === full && half) stars.push('star-half');
    else stars.push('star-outline');
  }
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {stars.map((name, i) => (
        <Ionicons key={i} name={name} size={14} color={colors.gold} />
      ))}
    </View>
  );
}

export default function EatOutScreen({ navigation }) {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [matchPopup, setMatchPopup] = useState(null);
  const swiperRef = useRef(null);

  const userId = state.firebaseUser?.uid;
  const activeGroupId = state.userProfile?.activeGroupId || null;
  const activeGroup = state.activeGroup || null;
  const hasGroup = !!activeGroupId;
  const [soloOverride, setSoloOverride] = useState(false);
  const isGroupMode = hasGroup && !soloOverride;
  // Use group's radius if set (and in group mode), otherwise fall back to user's setting
  const radiusMiles = (isGroupMode && activeGroup?.searchRadiusMiles) || state.userProfile?.searchRadiusMiles || 5;
  // Use group's pinned location if set (and in group mode)
  const groupLat = isGroupMode ? (activeGroup?.locationLat || null) : null;
  const groupLng = isGroupMode ? (activeGroup?.locationLng || null) : null;

  const loadRestaurants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let latitude, longitude;

      // Use group's pinned location if available, otherwise use device GPS
      if (groupLat && groupLng) {
        latitude = groupLat;
        longitude = groupLng;
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Location permission is needed to find restaurants near you.');
          setLoading(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        latitude = location.coords.latitude;
        longitude = location.coords.longitude;
      }

      dispatch({
        type: 'SET_USER_LOCATION',
        payload: { lat: latitude, lng: longitude },
      });

      const radiusMeters = Math.round(radiusMiles * 1609.34);

      // Fetch swiped IDs scoped to this group (with timeout to avoid hanging)
      let alreadySwiped = [];
      if (userId) {
        try {
          const swipePromise = getSwipedPlaceIds(userId, isGroupMode ? activeGroupId : null);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 5000)
          );
          alreadySwiped = await Promise.race([swipePromise, timeoutPromise]);
        } catch (e) {
          console.log('Could not fetch swiped IDs:', e);
          alreadySwiped = [];
        }
      }

      // Fetch ALL pages upfront (up to 60 results)
      const allResults = await searchAllNearbyRestaurants(latitude, longitude, radiusMeters);

      // Filter out already-swiped places
      const fresh = allResults.filter(r => !alreadySwiped.includes(r.placeId));

      // Deduplicate chains — only 1 of each restaurant name
      const seen = new Set();
      const deduped = (fresh.length > 0 ? fresh : allResults).filter(r => {
        // Aggressively normalize: strip store numbers, locations, suffixes
        const key = r.name.toLowerCase()
          .replace(/\s*#\d+.*$/, '')        // "Subway #12345"
          .replace(/\s*-\s*\d+.*$/, '')     // "Starbucks - 1234"
          .replace(/\s*-\s*[a-z].*$/i, '')  // "Starbucks - Downtown"
          .replace(/\s*\(.*\)$/, '')        // "McDonald's (Inside Walmart)"
          .replace(/[''\u2019]s?\s*$/, '')  // trailing 's / possessives
          .trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setRestaurants(deduped);
      setCardIndex(0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [radiusMiles, userId, activeGroupId, groupLat, groupLng, isGroupMode]);

  useEffect(() => {
    loadRestaurants();
  }, []);

  const handleSwipe = async (index, direction) => {
    const restaurant = restaurants[index];
    if (!restaurant || !userId) return;

    try {
      const match = await saveSwipe(userId, isGroupMode ? activeGroupId : null, restaurant.placeId, direction, {
        name: restaurant.name,
        photo: restaurant.photo,
        rating: restaurant.rating,
        cuisines: restaurant.cuisines,
        address: restaurant.address,
        priceLevel: restaurant.priceLevel,
      });

      if (match) {
        setMatchPopup(restaurant);
      }
    } catch (e) {
      console.log('Swipe save error:', e);
    }
  };

  const onSwipedRight = (index) => handleSwipe(index, 'right');
  const onSwipedLeft = (index) => handleSwipe(index, 'left');
  const onSwipedAll = () => loadRestaurants();

  if (loading) {
    return (
      <View style={styles.centered}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading all restaurants near you...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="location-outline" size={48} color={colors.accent} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadRestaurants}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (restaurants.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="sad-outline" size={48} color={colors.textTertiary} />
        <Text style={styles.emptyText}>No restaurants found nearby</Text>
        <Text style={styles.emptyHint}>Try increasing your search radius in Settings</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadRestaurants}>
          <Text style={styles.retryText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Swiper
        ref={swiperRef}
        cards={restaurants}
        cardIndex={cardIndex}
        renderCard={(restaurant) => {
          if (!restaurant) return null;
          return (
            <View style={styles.card}>
              {/* Full-bleed image */}
              {restaurant.photo ? (
                <Image
                  source={{ uri: restaurant.photo }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.cardImage, styles.noPhoto]}>
                  <Ionicons name="restaurant" size={64} color={colors.textTertiary} />
                </View>
              )}

              {/* Open/Closed badge */}
              {restaurant.isOpenNow !== undefined && (
                <View style={[
                  styles.openBadge,
                  { backgroundColor: restaurant.isOpenNow ? colors.success : colors.error }
                ]}>
                  <Text style={styles.openText}>
                    {restaurant.isOpenNow ? 'Open Now' : 'Closed'}
                  </Text>
                </View>
              )}

              {/* Gradient fade overlay */}
              <LinearGradient
                colors={['transparent', colors.overlay, colors.background]}
                locations={[0, 0.45, 0.8]}
                style={styles.gradient}
              />

              {/* Info overlay at bottom */}
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={2}>
                  {restaurant.name}
                </Text>

                {/* Cuisine tags — only show if we have specific ones */}
                {restaurant.cuisines.length > 0 && (
                  <View style={styles.cuisineRow}>
                    {restaurant.cuisines.slice(0, 3).map((c, i) => (
                      <View key={i} style={styles.cuisineTag}>
                        <Text style={styles.cuisineText}>{c}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Ratings row */}
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <StarRating rating={restaurant.rating} colors={colors} />
                    <Text style={styles.metaValue}>
                      {restaurant.rating}
                    </Text>
                    <Text style={styles.metaLabel}>
                      ({restaurant.totalRatings} reviews)
                    </Text>
                  </View>
                </View>

                {/* Price & distance row */}
                <View style={styles.metaRow}>
                  {restaurant.priceLevel > 0 && (
                    <View style={styles.metaItem}>
                      <Ionicons name="cash-outline" size={14} color={colors.success} />
                      <Text style={styles.priceText}>
                        {PRICE_LABELS[restaurant.priceLevel]}
                      </Text>
                    </View>
                  )}

                  {restaurant.distance && (
                    <View style={styles.metaItem}>
                      <Ionicons name="navigate-outline" size={14} color={colors.accent} />
                      <Text style={styles.metaValue}>
                        {restaurant.distance} mi away
                      </Text>
                    </View>
                  )}

                  {restaurant.isOpenNow !== undefined && (
                    <View style={styles.metaItem}>
                      <View style={[styles.openDot, { backgroundColor: restaurant.isOpenNow ? colors.success : colors.error }]} />
                      <Text style={[styles.metaValue, { color: restaurant.isOpenNow ? colors.success : colors.error }]}>
                        {restaurant.isOpenNow ? 'Open Now' : 'Closed'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Address */}
                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
                  <Text style={styles.addressText} numberOfLines={2}>
                    {restaurant.address}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
        onSwipedRight={onSwipedRight}
        onSwipedLeft={onSwipedLeft}
        onSwipedAll={onSwipedAll}
        backgroundColor="transparent"
        cardVerticalMargin={30}
        cardHorizontalMargin={18}
        stackSize={3}
        stackSeparation={12}
        animateCardOpacity
        overlayLabels={{
          left: {
            title: 'NOPE',
            style: {
              label: {
                color: colors.error, fontSize: 28, fontWeight: 'bold',
                borderWidth: 3, borderColor: colors.error, borderRadius: 12, padding: 10,
              },
              wrapper: {
                flexDirection: 'column', alignItems: 'flex-end',
                justifyContent: 'flex-start', marginTop: 40, marginLeft: -30,
              },
            },
          },
          right: {
            title: "LET'S GO!",
            style: {
              label: {
                color: colors.success, fontSize: 28, fontWeight: 'bold',
                borderWidth: 3, borderColor: colors.success, borderRadius: 12, padding: 10,
              },
              wrapper: {
                flexDirection: 'column', alignItems: 'flex-start',
                justifyContent: 'flex-start', marginTop: 40, marginLeft: 30,
              },
            },
          },
        }}
      />

      {/* Mode toggle pill + Action buttons */}
      <View style={styles.bottomArea}>
        {hasGroup && (
          <TouchableOpacity
            style={styles.modePill}
            onPress={() => {
              const goSolo = !soloOverride;
              setSoloOverride(goSolo);
              loadRestaurants();
            }}
          >
            <Ionicons
              name={isGroupMode ? 'people' : 'person'}
              size={13}
              color={colors.accent}
            />
            <Text style={styles.modePillText}>
              {isGroupMode ? activeGroup?.name || 'Group' : 'Solo'}
            </Text>
            <Ionicons name="swap-horizontal" size={12} color={colors.textTertiary} />
          </TouchableOpacity>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.skipButton]}
            onPress={() => swiperRef.current?.swipeLeft()}
          >
            <Ionicons name="close" size={30} color={colors.error} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.refreshButton]}
            onPress={loadRestaurants}
          >
            <Ionicons name="refresh" size={22} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.likeButton]}
            onPress={() => swiperRef.current?.swipeRight()}
          >
            <Ionicons name="heart" size={30} color={colors.success} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Match Popup */}
      <Modal
        visible={!!matchPopup}
        transparent
        animationType="fade"
        onRequestClose={() => setMatchPopup(null)}
      >
        <View style={styles.matchOverlay}>
          <View style={styles.matchCard}>
            <Text style={styles.matchEmoji}>🎉</Text>
            <Text style={styles.matchTitle}>It's a Match!</Text>
            <Text style={styles.matchSubtitle}>
              You both want to eat at
            </Text>
            <Text style={styles.matchRestaurant}>{matchPopup?.name}</Text>
            {matchPopup?.photo && (
              <Image
                source={{ uri: matchPopup.photo }}
                style={styles.matchImage}
                resizeMode="cover"
              />
            )}
            <View style={styles.matchButtons}>
              <TouchableOpacity
                style={styles.matchViewButton}
                onPress={() => {
                  setMatchPopup(null);
                  navigation.navigate('Matches');
                }}
              >
                <Text style={styles.matchViewText}>View Matches</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.matchContinueButton}
                onPress={() => setMatchPopup(null)}
              >
                <Text style={styles.matchContinueText}>Keep Swiping</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      padding: 30,
    },
    loadingLogo: { width: 160, height: 160, marginBottom: 20, opacity: 0.85 },
    loadingText: { color: colors.textSecondary, fontSize: 16, marginTop: 16 },
    errorText: { color: colors.error, fontSize: 16, marginTop: 16, textAlign: 'center' },
    emptyText: { color: colors.text, fontSize: 18, marginTop: 16 },
    emptyHint: { color: colors.textTertiary, fontSize: 14, marginTop: 8 },
    retryButton: {
      marginTop: 20, backgroundColor: colors.accent,
      paddingHorizontal: 24, paddingVertical: 12, borderRadius: 25,
    },
    retryText: { color: colors.background, fontSize: 16, fontWeight: '600' },

    // Bottom area with mode pill + buttons
    bottomArea: {
      alignItems: 'center',
      paddingBottom: 8,
    },
    modePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      marginBottom: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    modePillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent,
    },

    // Card — image fills entire card, info overlaid at bottom
    card: {
      height: CARD_HEIGHT,
      borderRadius: 20,
      backgroundColor: colors.background,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 6,
    },
    cardImage: {
      width: '100%',
      height: '100%',
      position: 'absolute',
      top: 0,
      left: 0,
    },
    noPhoto: {
      backgroundColor: colors.inputBg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    openBadge: {
      position: 'absolute',
      top: 16,
      right: 16,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
      zIndex: 10,
    },
    openText: { color: colors.background, fontSize: 12, fontWeight: '700' },

    // Gradient fade from image to info
    gradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '65%',
    },

    // Info area overlaid at bottom
    cardInfo: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 20,
      paddingBottom: 20,
      gap: 6,
    },
    cardName: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    cuisineRow: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'wrap',
    },
    cuisineTag: {
      backgroundColor: colors.accent,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    cuisineText: {
      color: colors.background,
      fontSize: 12,
      fontWeight: '600',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
    metaLabel: { color: colors.textSecondary, fontSize: 13 },
    priceText: { color: colors.success, fontSize: 15, fontWeight: '700' },
    openDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 4,
    },
    addressText: { color: colors.textSecondary, fontSize: 13, flex: 1, lineHeight: 18 },

    // Buttons
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 16,
      gap: 24,
    },
    actionButton: {
      width: 56, height: 56, borderRadius: 28,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: colors.background,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1, shadowRadius: 6, elevation: 4,
    },
    skipButton: { borderWidth: 2, borderColor: colors.border },
    likeButton: { borderWidth: 2, borderColor: colors.border },
    refreshButton: {
      borderWidth: 1, borderColor: colors.border,
      width: 42, height: 42, borderRadius: 21,
    },

    // Match popup
    matchOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 30,
    },
    matchCard: {
      backgroundColor: colors.background,
      borderRadius: 24,
      padding: 30,
      alignItems: 'center',
      width: '100%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    matchEmoji: { fontSize: 48, marginBottom: 12 },
    matchTitle: { fontSize: 32, fontWeight: 'bold', color: colors.accent },
    matchSubtitle: { fontSize: 16, color: colors.textSecondary, marginTop: 8 },
    matchRestaurant: {
      fontSize: 22, fontWeight: 'bold', color: colors.text,
      marginTop: 4, textAlign: 'center',
    },
    matchImage: {
      width: '100%', height: 120, borderRadius: 14, marginTop: 16,
    },
    matchButtons: { width: '100%', gap: 10, marginTop: 20 },
    matchViewButton: {
      backgroundColor: colors.accent, paddingVertical: 14,
      borderRadius: 14, alignItems: 'center',
    },
    matchViewText: { color: colors.background, fontSize: 16, fontWeight: 'bold' },
    matchContinueButton: {
      paddingVertical: 12, alignItems: 'center',
    },
    matchContinueText: { color: colors.textSecondary, fontSize: 15 },
  });
}
