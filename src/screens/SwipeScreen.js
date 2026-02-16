import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Swiper from 'react-native-deck-swiper';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { fetchRandomRecipes, fetchFilteredRecipes } from '../services/spoonacular';
import {
  getSharedDeck,
  saveSharedDeck,
  updateGroupRecipeFilters,
} from '../services/groups';
import {
  saveRecipeSwipe,
  getSwipedRecipeIds,
} from '../services/matching';

const { width, height } = Dimensions.get('window');
const CARD_HEIGHT = height * 0.72;

// Filter options
const CUISINE_OPTIONS = [
  'Any', 'Italian', 'Mexican', 'Chinese', 'Indian', 'Thai',
  'Japanese', 'Mediterranean', 'American', 'French', 'Korean',
];
const DIET_OPTIONS = [
  'Any', 'Vegetarian', 'Vegan', 'Gluten Free', 'Ketogenic',
  'Paleo', 'Pescetarian', 'Whole30',
];
const TIME_OPTIONS = [
  { label: 'Any', value: null },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
];

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
  return [...new Set(tags)].slice(0, 3);
}

export default function SwipeScreen({ navigation }) {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardIndex, setCardIndex] = useState(0);
  const [error, setError] = useState(null);
  const [matchAlert, setMatchAlert] = useState(null);
  const swiperRef = useRef(null);

  // Group mode state
  const activeGroupId = state.userProfile?.activeGroupId || null;
  const activeGroup = state.activeGroup || null;
  const hasGroup = !!activeGroupId;
  const [soloOverride, setSoloOverride] = useState(false);
  const isGroupMode = hasGroup && !soloOverride;
  const userId = state.firebaseUser?.uid;

  // Filter modal state
  const [showFilters, setShowFilters] = useState(false);
  const [filterCuisine, setFilterCuisine] = useState('Any');
  const [filterDiet, setFilterDiet] = useState('Any');
  const [filterMaxTime, setFilterMaxTime] = useState(null);
  const [needsNewDeck, setNeedsNewDeck] = useState(false);

  // ── Set header right filter button (group mode) ───────────
  useLayoutEffect(() => {
    if (isGroupMode) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            style={{ padding: 8, marginRight: 4 }}
          >
            <Ionicons name="options-outline" size={22} color={colors.accent} />
          </TouchableOpacity>
        ),
      });
    } else {
      navigation.setOptions({ headerRight: undefined });
    }
  }, [navigation, isGroupMode, colors]);

  // ── Solo mode: random recipes ─────────────────────────────
  const loadSoloRecipes = useCallback(async () => {
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

  // ── Group mode: shared deck ───────────────────────────────
  const loadGroupDeck = useCallback(async () => {
    if (!activeGroupId || !userId) return;
    try {
      setLoading(true);
      setError(null);

      // Load group's recipe filter preferences
      if (activeGroup) {
        setFilterCuisine(activeGroup.recipeCuisine || 'Any');
        setFilterDiet(activeGroup.recipeDiet || 'Any');
        setFilterMaxTime(activeGroup.recipeMaxTime || null);
      }

      // Try to load existing shared deck
      const deck = await getSharedDeck(activeGroupId);

      if (deck && deck.recipes?.length > 0 && !needsNewDeck) {
        // Filter out already-swiped recipes
        const swipedIds = await getSwipedRecipeIds(userId, activeGroupId);
        const remaining = deck.recipes.filter(r => !swipedIds.includes(r.id));

        if (remaining.length > 0) {
          setRecipes(remaining);
          setCardIndex(0);
          setLoading(false);
          return;
        }
        // All swiped — need a new deck
      }

      // Generate a new shared deck with group filters
      await generateNewDeck();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeGroupId, userId, activeGroup, needsNewDeck]);

  const generateNewDeck = async () => {
    const filters = {};
    const cuisine = activeGroup?.recipeCuisine || filterCuisine;
    const diet = activeGroup?.recipeDiet || filterDiet;
    const maxTime = activeGroup?.recipeMaxTime || filterMaxTime;

    if (cuisine && cuisine !== 'Any') filters.cuisine = cuisine;
    if (diet && diet !== 'Any') filters.diet = diet;
    if (maxTime) filters.maxTime = maxTime;

    let fetched;
    if (Object.keys(filters).length > 0) {
      fetched = await fetchFilteredRecipes(filters, 20);
    } else {
      fetched = await fetchRandomRecipes(20);
    }

    if (fetched.length === 0) {
      // Fallback to random if filters return nothing
      fetched = await fetchRandomRecipes(20);
    }

    // Save as the group's shared deck
    await saveSharedDeck(activeGroupId, fetched);

    // Filter out already-swiped
    const swipedIds = await getSwipedRecipeIds(userId, activeGroupId);
    const remaining = fetched.filter(r => !swipedIds.includes(r.id));

    setRecipes(remaining.length > 0 ? remaining : fetched);
    setCardIndex(0);
    setNeedsNewDeck(false);
  };

  // ── Load recipes on mount / mode change ───────────────────
  useEffect(() => {
    if (isGroupMode) {
      loadGroupDeck();
    } else {
      loadSoloRecipes();
    }
  }, [isGroupMode, activeGroupId]);

  // ── Swipe handlers ────────────────────────────────────────
  const onSwipedRight = async (index) => {
    const recipe = recipes[index];
    if (!recipe) return;

    if (isGroupMode && activeGroupId) {
      // Group mode: save swipe to Firestore, check for match
      const match = await saveRecipeSwipe(userId, activeGroupId, recipe.id, 'right', recipe);
      if (match) {
        setMatchAlert(match);
      }
    } else {
      // Solo mode: add to personal meal plan
      dispatch({ type: 'ADD_TO_MEAL_PLAN', payload: recipe });
    }
  };

  const onSwipedLeft = async (index) => {
    const recipe = recipes[index];
    if (!recipe) return;

    if (isGroupMode && activeGroupId) {
      await saveRecipeSwipe(userId, activeGroupId, recipe.id, 'left', recipe);
    } else {
      dispatch({ type: 'SKIP_RECIPE', payload: recipe.id });
    }
  };

  const onSwipedAll = () => {
    if (isGroupMode) {
      setNeedsNewDeck(true);
      loadGroupDeck();
    } else {
      loadSoloRecipes();
    }
  };

  // ── Save filters & refresh deck ───────────────────────────
  const handleSaveFilters = async () => {
    if (isGroupMode && activeGroupId) {
      await updateGroupRecipeFilters(activeGroupId, {
        cuisine: filterCuisine === 'Any' ? null : filterCuisine,
        diet: filterDiet === 'Any' ? null : filterDiet,
        maxTime: filterMaxTime,
      });
      setNeedsNewDeck(true);
      setShowFilters(false);
      // Force reload
      setLoading(true);
      try {
        await generateNewDeck();
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    } else {
      setShowFilters(false);
    }
  };

  // ── Renders ───────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>
          {isGroupMode ? 'Loading shared deck...' : 'Finding delicious dinners...'}
        </Text>
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
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => isGroupMode ? loadGroupDeck() : loadSoloRecipes()}
        >
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (recipes.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No recipes to show!</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => isGroupMode ? loadGroupDeck() : loadSoloRecipes()}
        >
          <Text style={styles.retryText}>Load More</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Swiper
        ref={swiperRef}
        cards={recipes}
        cardIndex={cardIndex}
        renderCard={(recipe) => {
          if (!recipe) return null;
          const tags = getRecipeTags(recipe);
          return (
            <View style={styles.card}>
              <Image
                source={{ uri: recipe.image }}
                style={styles.cardImage}
                resizeMode="cover"
              />
              <View style={styles.timeBadge}>
                <Ionicons name="time" size={12} color={colors.background} />
                <Text style={styles.badgeLabel}>{recipe.readyInMinutes} min</Text>
              </View>
              {recipe.healthScore > 0 && (
                <View style={styles.healthBadge}>
                  <Ionicons name="leaf" size={12} color={colors.background} />
                  <Text style={styles.badgeLabel}>{recipe.healthScore}</Text>
                </View>
              )}
              <LinearGradient
                colors={['transparent', colors.overlay, colors.background]}
                locations={[0, 0.45, 0.8]}
                style={styles.gradient}
              />
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={2}>
                  {recipe.title}
                </Text>
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
                    <Text style={styles.metaValue}>{recipe.ingredients?.length || 0} ingredients</Text>
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
            title: isGroupMode ? 'YES!' : 'COOK IT!',
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
              if (goSolo) { loadSoloRecipes(); } else { loadGroupDeck(); }
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
            onPress={() => isGroupMode ? loadGroupDeck() : loadSoloRecipes()}
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

      {/* Match Alert Modal */}
      <Modal visible={!!matchAlert} transparent animationType="fade">
        <View style={styles.matchOverlay}>
          <View style={styles.matchCard}>
            <Ionicons name="heart-circle" size={64} color={colors.accent} />
            <Text style={styles.matchTitle}>It's a Match!</Text>
            <Text style={styles.matchSubtitle}>
              Everyone wants to cook{'\n'}
              <Text style={{ fontWeight: '700' }}>{matchAlert?.recipeTitle}</Text>
            </Text>
            {matchAlert?.recipeImage && (
              <Image
                source={{ uri: matchAlert.recipeImage }}
                style={styles.matchImage}
                resizeMode="cover"
              />
            )}
            <TouchableOpacity
              style={styles.matchButton}
              onPress={() => {
                setMatchAlert(null);
                navigation.navigate('RecipeMatches');
              }}
            >
              <Text style={styles.matchButtonText}>View Group Meal Plan</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMatchAlert(null)}>
              <Text style={styles.matchDismiss}>Keep Swiping</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Filter Modal (Group Mode) */}
      <Modal visible={showFilters} animationType="slide" transparent>
        <View style={styles.filterOverlay}>
          <View style={styles.filterSheet}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Recipe Filters</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterScroll}>
              {/* Cuisine */}
              <Text style={styles.filterLabel}>Cuisine</Text>
              <View style={styles.chipRow}>
                {CUISINE_OPTIONS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, filterCuisine === c && styles.chipActive]}
                    onPress={() => setFilterCuisine(c)}
                  >
                    <Text style={[styles.chipText, filterCuisine === c && styles.chipTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Diet */}
              <Text style={styles.filterLabel}>Dietary</Text>
              <View style={styles.chipRow}>
                {DIET_OPTIONS.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.chip, filterDiet === d && styles.chipActive]}
                    onPress={() => setFilterDiet(d)}
                  >
                    <Text style={[styles.chipText, filterDiet === d && styles.chipTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Max Cook Time */}
              <Text style={styles.filterLabel}>Max Cook Time</Text>
              <View style={styles.chipRow}>
                {TIME_OPTIONS.map(t => (
                  <TouchableOpacity
                    key={t.label}
                    style={[styles.chip, filterMaxTime === t.value && styles.chipActive]}
                    onPress={() => setFilterMaxTime(t.value)}
                  >
                    <Text style={[styles.chipText, filterMaxTime === t.value && styles.chipTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.filterSaveButton} onPress={handleSaveFilters}>
              <Text style={styles.filterSaveText}>Apply & Generate New Deck</Text>
            </TouchableOpacity>
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
    hintText: { color: colors.textTertiary, fontSize: 14, marginTop: 8, textAlign: 'center' },
    emptyText: { color: colors.textSecondary, fontSize: 18 },
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
    timeBadge: {
      position: 'absolute', top: 16, right: 16,
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, zIndex: 10,
    },
    healthBadge: {
      position: 'absolute', top: 16, left: 16,
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: colors.success,
      paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, zIndex: 10,
    },
    badgeLabel: { color: colors.background, fontSize: 12, fontWeight: '700' },
    gradient: {
      position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%',
    },
    cardInfo: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingHorizontal: 20, paddingBottom: 20, gap: 6,
    },
    cardName: {
      fontSize: 26, fontWeight: '700', color: colors.text, letterSpacing: -0.3,
    },
    tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    tag: {
      backgroundColor: colors.accent,
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    },
    tagText: { color: colors.background, fontSize: 12, fontWeight: '600' },
    cardSummary: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 2 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaValue: { color: colors.text, fontSize: 14, fontWeight: '600' },

    // Buttons
    buttonRow: {
      flexDirection: 'row', justifyContent: 'center',
      alignItems: 'center', paddingBottom: 16, gap: 24,
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

    // Match Alert Modal
    matchOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center', alignItems: 'center', padding: 30,
    },
    matchCard: {
      backgroundColor: colors.background, borderRadius: 24, padding: 30,
      alignItems: 'center', width: '100%',
    },
    matchTitle: {
      fontSize: 28, fontWeight: '800', color: colors.accent, marginTop: 12,
    },
    matchSubtitle: {
      fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginTop: 8,
    },
    matchImage: {
      width: '100%', height: 150, borderRadius: 16, marginTop: 16,
    },
    matchButton: {
      backgroundColor: colors.accent, paddingHorizontal: 28, paddingVertical: 14,
      borderRadius: 25, marginTop: 20,
    },
    matchButtonText: { color: colors.background, fontSize: 16, fontWeight: 'bold' },
    matchDismiss: {
      color: colors.textTertiary, fontSize: 14, marginTop: 16,
    },

    // Filter Modal
    filterOverlay: {
      flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)',
    },
    filterSheet: {
      backgroundColor: colors.background, borderTopLeftRadius: 24,
      borderTopRightRadius: 24, paddingBottom: 40, maxHeight: height * 0.75,
    },
    filterHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    filterTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    filterScroll: { paddingHorizontal: 20, paddingTop: 16 },
    filterLabel: {
      fontSize: 15, fontWeight: '600', color: colors.text,
      marginTop: 16, marginBottom: 10,
    },
    chipRow: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    },
    chip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.accent, borderColor: colors.accent,
    },
    chipText: { fontSize: 13, color: colors.text, fontWeight: '500' },
    chipTextActive: { color: colors.background },
    filterSaveButton: {
      backgroundColor: colors.accent, marginHorizontal: 20,
      paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginTop: 20,
    },
    filterSaveText: { color: colors.background, fontSize: 16, fontWeight: 'bold' },
  });
}
