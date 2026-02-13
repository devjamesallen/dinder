import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Swiper from 'react-native-deck-swiper';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { fetchRandomRecipes } from '../services/spoonacular';

const { width, height } = Dimensions.get('window');
const CARD_HEIGHT = height * 0.72;

/** Build a list of tag labels from recipe metadata */
function getRecipeTags(recipe) {
  const tags = [];
  if (recipe.cuisines?.length) {
    recipe.cuisines.slice(0, 2).forEach(c => tags.push(c));
  }
  if (recipe.dishTypes?.length) {
    recipe.dishTypes
      .filter(d => !['lunch', 'dinner', 'main course', 'main dish'].includes(d.toLowerCase()))
      .slice(0, 2)
      .forEach(d => tags.push(d.charAt(0).toUpperCase() + d.slice(1)));
  }
  if (recipe.diets?.length) {
    recipe.diets.slice(0, 2).forEach(d => tags.push(d.charAt(0).toUpperCase() + d.slice(1)));
  }
  // Deduplicate & cap at 3
  return [...new Set(tags)].slice(0, 3);
}

export default function SwipeScreen() {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardIndex, setCardIndex] = useState(0);
  const [error, setError] = useState(null);
  const swiperRef = useRef(null);

  const loadRecipes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetched = await fetchRandomRecipes(10);
      const seenIds = [
        ...state.mealPlan.map(r => r.id),
        ...state.skippedIds,
      ];
      const fresh = fetched.filter(r => !seenIds.includes(r.id));
      setRecipes(fresh.length > 0 ? fresh : fetched);
      setCardIndex(0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [state.mealPlan, state.skippedIds]);

  useEffect(() => {
    loadRecipes();
  }, []);

  const onSwipedRight = (index) => {
    const recipe = recipes[index];
    if (recipe) dispatch({ type: 'ADD_TO_MEAL_PLAN', payload: recipe });
  };

  const onSwipedLeft = (index) => {
    const recipe = recipes[index];
    if (recipe) dispatch({ type: 'SKIP_RECIPE', payload: recipe.id });
  };

  const onSwipedAll = () => loadRecipes();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Finding delicious dinners...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="warning-outline" size={48} color={colors.accent} />
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.hintText}>
          Make sure your Spoonacular API key is set in src/config.js
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadRecipes}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (recipes.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No recipes to show!</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadRecipes}>
          <Text style={styles.retryText}>Load More</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Meal plan counter badge */}
      <View style={styles.badge}>
        <Ionicons name="restaurant" size={14} color={colors.accent} />
        <Text style={styles.badgeText}>{state.mealPlan.length} meals planned</Text>
      </View>

      <Swiper
        ref={swiperRef}
        cards={recipes}
        cardIndex={cardIndex}
        renderCard={(recipe) => {
          if (!recipe) return null;
          const tags = getRecipeTags(recipe);
          return (
            <View style={styles.card}>
              {/* Full-bleed image */}
              <Image
                source={{ uri: recipe.image }}
                style={styles.cardImage}
                resizeMode="cover"
              />

              {/* Cook time badge */}
              <View style={styles.timeBadge}>
                <Ionicons name="time" size={12} color={colors.background} />
                <Text style={styles.badgeLabel}>{recipe.readyInMinutes} min</Text>
              </View>

              {/* Health score badge */}
              {recipe.healthScore > 0 && (
                <View style={styles.healthBadge}>
                  <Ionicons name="leaf" size={12} color={colors.background} />
                  <Text style={styles.badgeLabel}>{recipe.healthScore}</Text>
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
                  {recipe.title}
                </Text>

                {/* Cuisine / dish / diet tags */}
                {tags.length > 0 && (
                  <View style={styles.tagRow}>
                    {tags.map((tag, i) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={styles.cardSummary} numberOfLines={6}>
                  {recipe.summary}
                </Text>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={14} color={colors.accent} />
                    <Text style={styles.metaValue}>{recipe.readyInMinutes} min</Text>
                  </View>

                  <View style={styles.metaItem}>
                    <Ionicons name="people-outline" size={14} color={colors.accent} />
                    <Text style={styles.metaValue}>Serves {recipe.servings}</Text>
                  </View>

                  <View style={styles.metaItem}>
                    <Ionicons name="basket-outline" size={14} color={colors.accent} />
                    <Text style={styles.metaValue}>{recipe.ingredients.length} ingredients</Text>
                  </View>
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
            title: 'SKIP',
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
            title: 'COOK IT!',
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

      {/* Action buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.skipButton]}
          onPress={() => swiperRef.current?.swipeLeft()}
        >
          <Ionicons name="close" size={30} color={colors.error} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.refreshButton]}
          onPress={loadRecipes}
        >
          <Ionicons name="refresh" size={22} color={colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.cookButton]}
          onPress={() => swiperRef.current?.swipeRight()}
        >
          <Ionicons name="heart" size={30} color={colors.success} />
        </TouchableOpacity>
      </View>
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
    loadingText: { color: colors.textSecondary, fontSize: 16, marginTop: 16 },
    errorText: { color: colors.error, fontSize: 16, marginTop: 16, textAlign: 'center' },
    hintText: { color: colors.textTertiary, fontSize: 14, marginTop: 8, textAlign: 'center' },
    emptyText: { color: colors.textSecondary, fontSize: 18 },
    retryButton: {
      marginTop: 20, backgroundColor: colors.accent,
      paddingHorizontal: 24, paddingVertical: 12, borderRadius: 25,
    },
    retryText: { color: colors.background, fontSize: 16, fontWeight: '600' },

    // Meal plan badge
    badge: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 8, backgroundColor: colors.paleAccent,
    },
    badgeText: { color: colors.accent, fontSize: 13, fontWeight: '600' },

    // Card
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

    // Image badges
    timeBadge: {
      position: 'absolute',
      top: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
      zIndex: 10,
    },
    healthBadge: {
      position: 'absolute',
      top: 16,
      left: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.success,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
      zIndex: 10,
    },
    badgeLabel: { color: colors.background, fontSize: 12, fontWeight: '700' },

    // Gradient
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
    tagRow: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'wrap',
    },
    tag: {
      backgroundColor: colors.accent,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    tagText: {
      color: colors.background,
      fontSize: 12,
      fontWeight: '600',
    },
    cardSummary: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginTop: 2,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaValue: { color: colors.text, fontSize: 14, fontWeight: '600' },

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
    cookButton: { borderWidth: 2, borderColor: colors.border },
    refreshButton: {
      borderWidth: 1, borderColor: colors.border,
      width: 42, height: 42, borderRadius: 21,
    },
  });
}
