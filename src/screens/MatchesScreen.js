import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { listenToMatches, updateMatchStatus } from '../services/matching';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32;
const CARD_IMAGE_HEIGHT = 180;

const PRICE_LABELS = ['', '$', '$$', '$$$', '$$$$'];

export default function MatchesScreen({ navigation }) {
  const { state } = useApp();
  const { colors, isDarkMode, dispatch: themeDispatch } = useTheme();
  const styles = createStyles(colors);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const userId = state.firebaseUser?.uid;
  const partnerId = state.userProfile?.partnerUID;

  useEffect(() => {
    if (!userId || !partnerId) {
      setLoading(false);
      return;
    }

    const unsubscribe = listenToMatches(userId, partnerId, (newMatches) => {
      setMatches(newMatches);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, partnerId]);

  const handleOpenMaps = (restaurant) => {
    const query = encodeURIComponent(restaurant.restaurantName + ' ' + (restaurant.restaurantAddress || ''));
    const url = `https://maps.google.com/?q=${query}`;
    Linking.openURL(url);
  };

  const handleMarkVisited = (matchId, name) => {
    Alert.alert(
      'Mark as Visited',
      `Did you go to ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes!',
          onPress: () => updateMatchStatus(matchId, 'visited'),
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!partnerId) {
    return (
      <View style={styles.centered}>
        <Ionicons name="people-outline" size={64} color={colors.textTertiary} />
        <Text style={styles.emptyTitle}>No partner yet</Text>
        <Text style={styles.emptySubtitle}>
          Pair up with your partner to start matching on restaurants!
        </Text>
        <TouchableOpacity
          style={styles.pairButton}
          onPress={() => navigation.navigate('Invite')}
        >
          <Text style={styles.pairButtonText}>Pair Up</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="heart-outline" size={64} color={colors.textTertiary} />
        <Text style={styles.emptyTitle}>No matches yet</Text>
        <Text style={styles.emptySubtitle}>
          Keep swiping! When you both like the same restaurant, it'll show up here.
        </Text>
        <TouchableOpacity
          style={styles.swipeButton}
          onPress={() => navigation.navigate('EatOut')}
        >
          <Text style={styles.swipeButtonText}>Start Swiping</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>
        {matches.length} match{matches.length !== 1 ? 'es' : ''}
      </Text>

      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.matchCard}>
            {/* Full-width image */}
            {item.restaurantPhoto ? (
              <Image
                source={{ uri: item.restaurantPhoto }}
                style={styles.matchImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.matchImage, styles.noPhoto]}>
                <Ionicons name="restaurant" size={48} color={colors.textTertiary} />
              </View>
            )}

            {/* Gradient fade overlay */}
            <LinearGradient
              colors={['transparent', colors.overlay, colors.background]}
              locations={[0, 0.35, 0.7]}
              style={styles.gradient}
            />

            {/* Info overlay at bottom of image */}
            <View style={styles.matchInfo}>
              <Text style={styles.matchName} numberOfLines={2}>
                {item.restaurantName}
              </Text>

              <View style={styles.matchMeta}>
                {item.restaurantRating > 0 && (
                  <View style={styles.metaItem}>
                    <Ionicons name="star" size={14} color={colors.gold} />
                    <Text style={styles.metaText}>{item.restaurantRating}</Text>
                  </View>
                )}
                {item.restaurantPriceLevel > 0 && (
                  <Text style={styles.priceText}>
                    {PRICE_LABELS[item.restaurantPriceLevel]}
                  </Text>
                )}
                {item.restaurantCuisines?.length > 0 && (
                  <View style={styles.cuisineTag}>
                    <Text style={styles.cuisineText}>
                      {item.restaurantCuisines[0]}
                    </Text>
                  </View>
                )}
              </View>

              {item.restaurantAddress && (
                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
                  <Text style={styles.addressText} numberOfLines={1}>
                    {item.restaurantAddress}
                  </Text>
                </View>
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.mapsButton}
                  onPress={() => handleOpenMaps(item)}
                >
                  <Ionicons name="navigate-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.mapsText}>Directions</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.visitedButton}
                  onPress={() => handleMarkVisited(item.id, item.restaurantName)}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                  <Text style={styles.visitedText}>Visited</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />
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
    emptyTitle: {
      color: colors.text, fontSize: 22, fontWeight: 'bold', marginTop: 16,
    },
    emptySubtitle: {
      color: colors.textSecondary, fontSize: 16, marginTop: 8, textAlign: 'center',
    },
    pairButton: {
      marginTop: 24, backgroundColor: colors.accent,
      paddingHorizontal: 28, paddingVertical: 14, borderRadius: 25,
    },
    pairButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    swipeButton: {
      marginTop: 24, backgroundColor: colors.accent,
      paddingHorizontal: 28, paddingVertical: 14, borderRadius: 25,
    },
    swipeButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },

    headerText: {
      color: colors.text, fontSize: 16, fontWeight: '600',
      padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    list: {
      padding: 16,
    },

    // Card with gradient image
    matchCard: {
      borderRadius: 20,
      backgroundColor: colors.background,
      overflow: 'hidden',
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 6,
    },
    matchImage: {
      width: '100%',
      height: CARD_IMAGE_HEIGHT,
    },
    noPhoto: {
      backgroundColor: colors.inputBg,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Gradient overlay
    gradient: {
      position: 'absolute',
      top: CARD_IMAGE_HEIGHT * 0.3,
      left: 0,
      right: 0,
      height: CARD_IMAGE_HEIGHT * 0.7,
    },

    // Info below image (overlapping via gradient)
    matchInfo: {
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 18,
      gap: 6,
    },
    matchName: {
      color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.3,
    },
    matchMeta: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
    },
    metaItem: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
    },
    metaText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
    priceText: { color: colors.success, fontSize: 15, fontWeight: '700' },
    cuisineTag: {
      backgroundColor: colors.accent,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 12,
    },
    cuisineText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
    addressRow: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
    },
    addressText: { color: colors.textSecondary, fontSize: 13, flex: 1 },

    actionRow: {
      flexDirection: 'row', gap: 12, marginTop: 6,
    },
    mapsButton: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 8, paddingHorizontal: 16,
      borderRadius: 20, backgroundColor: colors.accent,
    },
    mapsText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
    visitedButton: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 8, paddingHorizontal: 16,
      borderRadius: 20, backgroundColor: colors.success + '18',
      borderWidth: 1, borderColor: colors.success + '40',
    },
    visitedText: { color: colors.success, fontSize: 13, fontWeight: '600' },
  });
}
