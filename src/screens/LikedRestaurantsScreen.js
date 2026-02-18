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
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { listenToSoloLikes, removeSoloLike } from '../services/matching';

const CARD_IMAGE_HEIGHT = 240;

export default function LikedRestaurantsScreen({ navigation }) {
  const { state } = useApp();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [likes, setLikes] = useState([]);
  const [loading, setLoading] = useState(true);

  const userId = state.firebaseUser?.uid;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const unsubscribe = listenToSoloLikes(userId, (newLikes) => {
      setLikes(newLikes);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const handleOpenMaps = async (item) => {
    const query = encodeURIComponent(item.restaurantName + ' ' + (item.restaurantAddress || ''));

    if (Platform.OS === 'android') {
      Linking.openURL(`geo:0,0?q=${query}`);
      return;
    }

    const options = [];
    const urls = [];

    options.push('Apple Maps');
    urls.push(`maps://?q=${query}`);

    const gmapsUrl = `comgooglemaps://?q=${query}`;
    if (await Linking.canOpenURL(gmapsUrl)) {
      options.push('Google Maps');
      urls.push(gmapsUrl);
    }

    const wazeUrl = `waze://?q=${query}&navigate=yes`;
    if (await Linking.canOpenURL(wazeUrl)) {
      options.push('Waze');
      urls.push(wazeUrl);
    }

    if (options.length === 1) {
      Linking.openURL(urls[0]);
      return;
    }

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...options, 'Cancel'],
        cancelButtonIndex: options.length,
        title: 'Open with...',
      },
      (index) => {
        if (index < options.length) {
          Linking.openURL(urls[index]);
        }
      }
    );
  };

  const handleRemove = (item) => {
    Alert.alert(
      'Remove Restaurant',
      `Remove ${item.restaurantName} from your liked list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeSoloLike(item.id);
            } catch (e) {
              Alert.alert('Error', 'Could not remove restaurant.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (likes.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="heart-outline" size={64} color={colors.textTertiary} />
        <Text style={styles.emptyTitle}>No liked restaurants</Text>
        <Text style={styles.emptySubtitle}>
          Swipe right on restaurants you like and they'll show up here.
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
        {likes.length} liked restaurant{likes.length !== 1 ? 's' : ''}
      </Text>

      <FlatList
        data={likes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.restaurantPhoto ? (
              <Image
                source={{ uri: item.restaurantPhoto }}
                style={styles.cardImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.cardImage, styles.noPhoto]}>
                <Ionicons name="restaurant" size={48} color={colors.textTertiary} />
              </View>
            )}

            {/* Remove button */}
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemove(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={28} color="rgba(0,0,0,0.6)" />
            </TouchableOpacity>

            <LinearGradient
              colors={['transparent', colors.overlay, colors.background]}
              locations={[0, 0.5, 0.85]}
              style={styles.gradient}
            />

            <View style={styles.cardInfo}>
              <Text style={styles.cardName} numberOfLines={2}>
                {item.restaurantName}
              </Text>

              <View style={styles.cardMeta}>
                {item.restaurantRating > 0 && (
                  <View style={styles.metaItem}>
                    <Ionicons name="star" size={14} color={colors.gold} />
                    <Text style={styles.metaText}>{item.restaurantRating}</Text>
                  </View>
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

                {item.restaurantPhone && (
                  <TouchableOpacity
                    style={styles.outlineButton}
                    onPress={() => Linking.openURL(`tel:${item.restaurantPhone}`)}
                  >
                    <Ionicons name="call-outline" size={16} color={colors.accent} />
                    <Text style={styles.outlineText}>Call</Text>
                  </TouchableOpacity>
                )}

                {item.restaurantWebsite && (
                  <TouchableOpacity
                    style={styles.outlineButton}
                    onPress={() => Linking.openURL(item.restaurantWebsite)}
                  >
                    <Ionicons name="globe-outline" size={16} color={colors.accent} />
                    <Text style={styles.outlineText}>Website</Text>
                  </TouchableOpacity>
                )}
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
    loadingLogo: { width: 160, height: 160, marginBottom: 20, opacity: 0.85 },
    emptyTitle: {
      color: colors.text, fontSize: 22, fontWeight: 'bold', marginTop: 16,
    },
    emptySubtitle: {
      color: colors.textSecondary, fontSize: 16, marginTop: 8, textAlign: 'center',
    },
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

    card: {
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
    cardImage: {
      width: '100%',
      height: CARD_IMAGE_HEIGHT,
    },
    noPhoto: {
      backgroundColor: colors.inputBg,
      justifyContent: 'center',
      alignItems: 'center',
    },

    removeButton: {
      position: 'absolute',
      top: 10,
      right: 10,
      zIndex: 10,
      backgroundColor: 'rgba(255,255,255,0.7)',
      borderRadius: 14,
      width: 28,
      height: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    gradient: {
      position: 'absolute',
      top: CARD_IMAGE_HEIGHT * 0.5,
      left: 0,
      right: 0,
      height: CARD_IMAGE_HEIGHT * 0.5,
    },

    cardInfo: {
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 18,
      gap: 6,
    },
    cardName: {
      color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.3,
    },
    cardMeta: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
    },
    metaItem: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
    },
    metaText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
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
      flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap',
    },
    mapsButton: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 8, paddingHorizontal: 16,
      borderRadius: 20, backgroundColor: colors.accent,
    },
    mapsText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
    outlineButton: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 8, paddingHorizontal: 16,
      borderRadius: 20, backgroundColor: colors.accent + '18',
      borderWidth: 1, borderColor: colors.accent + '40',
    },
    outlineText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  });
}
