import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import {
  listenToRecipeMatches,
  listenToRecipeSuggestions,
  acceptRecipeSuggestion,
  dismissRecipeSuggestion,
} from '../services/groups';
import { updateRecipeMatchStatus } from '../services/matching';
import { fetchRecipeDetails } from '../services/spoonacular';
import { mergeIngredients } from '../utils/ingredientMerger';

const CARD_IMAGE_HEIGHT = 200;

function getRecipeTags(recipe) {
  const tags = [];
  if (recipe.cuisines?.length) {
    recipe.cuisines.slice(0, 2).forEach(c => tags.push(c));
  }
  if (recipe.diets?.length) {
    recipe.diets.slice(0, 2).forEach(d => tags.push(d.charAt(0).toUpperCase() + d.slice(1)));
  }
  return [...new Set(tags)].slice(0, 3);
}

export default function RecipeMatchesScreen({ navigation }) {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [matches, setMatches] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [activeTab, setActiveTab] = useState('ingredients');
  const [instructions, setInstructions] = useState(null);
  const [loadingInstructions, setLoadingInstructions] = useState(false);

  const activeGroupId = state.userProfile?.activeGroupId || null;
  const activeGroup = state.activeGroup || null;

  // Listen for recipe matches
  useEffect(() => {
    if (!activeGroupId) {
      setLoading(false);
      return;
    }
    const unsub = listenToRecipeMatches(activeGroupId, (m) => {
      setMatches(m);
      setLoading(false);
    });
    return () => unsub();
  }, [activeGroupId]);

  // Listen for recipe suggestions
  useEffect(() => {
    if (!activeGroupId) return;
    const unsub = listenToRecipeSuggestions(activeGroupId, (s) => {
      setSuggestions(s);
    });
    return () => unsub();
  }, [activeGroupId]);

  // Fetch instructions when a recipe is opened
  useEffect(() => {
    if (!selectedRecipe) {
      setInstructions(null);
      setActiveTab('ingredients');
      return;
    }
    let cancelled = false;
    setLoadingInstructions(true);
    fetchRecipeDetails(selectedRecipe.recipeId || selectedRecipe.id)
      .then(details => {
        if (!cancelled) setInstructions(details.instructions || '');
      })
      .catch(() => {
        if (!cancelled) setInstructions('');
      })
      .finally(() => {
        if (!cancelled) setLoadingInstructions(false);
      });
    return () => { cancelled = true; };
  }, [selectedRecipe]);

  const handleMarkCooked = (matchId, name) => {
    Alert.alert(
      'Mark as Cooked',
      `Did you cook ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes!',
          onPress: () => updateRecipeMatchStatus(matchId, 'cooked'),
        },
      ]
    );
  };

  const handleAcceptSuggestion = async (suggestion) => {
    try {
      await acceptRecipeSuggestion(suggestion.id);
      Alert.alert('Added!', `"${suggestion.recipeTitle}" added to group meal plan`);
    } catch (e) {
      Alert.alert('Error', 'Failed to accept suggestion');
    }
  };

  const handleDismissSuggestion = async (suggestion) => {
    try {
      await dismissRecipeSuggestion(suggestion.id);
    } catch (e) {
      Alert.alert('Error', 'Failed to dismiss suggestion');
    }
  };

  const handleGenerateGroceryList = () => {
    if (matches.length === 0) {
      Alert.alert('No Recipes', 'Get some recipe matches first!');
      return;
    }
    // Convert match objects to recipe-like objects for ingredient merger
    const recipeLikeObjects = matches
      .filter(m => m.ingredients?.length > 0)
      .map(m => ({ title: m.recipeTitle, ingredients: m.ingredients }));

    if (recipeLikeObjects.length === 0) {
      Alert.alert('No Ingredients', 'No ingredient data available for these matches');
      return;
    }
    const merged = mergeIngredients(recipeLikeObjects);
    dispatch({ type: 'SET_GROCERY_LIST', payload: merged });
    navigation.navigate('GroceryList');
  };

  // ── Empty states ──────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <Image
          source={require('../../assets/GrubSwipe_Logo.png')}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!activeGroupId) {
    return (
      <View style={styles.centered}>
        <Ionicons name="people-outline" size={64} color={colors.textTertiary} />
        <Text style={styles.emptyTitle}>No active group</Text>
        <Text style={styles.emptySubtitle}>
          Create or join a group to see group recipe matches!
        </Text>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('Groups')}
        >
          <Text style={styles.actionBtnText}>My Groups</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasContent = matches.length > 0 || suggestions.length > 0;

  if (!hasContent) {
    return (
      <View style={styles.centered}>
        <Ionicons name="flame-outline" size={64} color={colors.textTertiary} />
        <Text style={styles.emptyTitle}>No recipe matches yet</Text>
        <Text style={styles.emptySubtitle}>
          When your group agrees on recipes, they'll show up here!
        </Text>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('EatIn')}
        >
          <Text style={styles.actionBtnText}>Start Swiping</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Suggestions Section */}
        {suggestions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="paper-plane-outline" size={16} color={colors.accent} />
              {'  '}Suggested by Members
            </Text>
            {suggestions.map(s => (
              <View key={s.id} style={styles.suggestionCard}>
                <Image
                  source={{ uri: s.recipeImage }}
                  style={styles.suggestionImage}
                  resizeMode="cover"
                />
                <View style={styles.suggestionInfo}>
                  <Text style={styles.suggestionName} numberOfLines={2}>{s.recipeTitle}</Text>
                  <Text style={styles.suggestionBy}>
                    From {s.suggestedByName}
                  </Text>
                  {s.readyInMinutes > 0 && (
                    <View style={styles.metaRow}>
                      <Ionicons name="time-outline" size={12} color={colors.textTertiary} />
                      <Text style={styles.metaSmall}>{s.readyInMinutes} min</Text>
                    </View>
                  )}
                </View>
                <View style={styles.suggestionActions}>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => handleAcceptSuggestion(s)}
                  >
                    <Ionicons name="checkmark" size={20} color={colors.background} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dismissBtn}
                    onPress={() => handleDismissSuggestion(s)}
                  >
                    <Ionicons name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Matches Section */}
        {matches.length > 0 && (
          <View style={styles.section}>
            <View style={styles.matchesHeader}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="heart" size={16} color={colors.accent} />
                {'  '}{matches.length} Recipe Match{matches.length !== 1 ? 'es' : ''}
              </Text>
            </View>

            {matches.map(item => {
              const tags = getRecipeTags(item);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.matchCard}
                  activeOpacity={0.8}
                  onPress={() => setSelectedRecipe(item)}
                >
                  <Image
                    source={{ uri: item.recipeImage }}
                    style={styles.matchImage}
                    resizeMode="cover"
                  />
                  <View style={styles.timeBadge}>
                    <Ionicons name="time" size={12} color={colors.background} />
                    <Text style={styles.badgeLabel}>{item.readyInMinutes} min</Text>
                  </View>
                  <LinearGradient
                    colors={['transparent', colors.overlay, colors.background]}
                    locations={[0, 0.35, 0.7]}
                    style={styles.gradient}
                  />
                  <View style={styles.matchInfo}>
                    <Text style={styles.matchName} numberOfLines={2}>{item.recipeTitle}</Text>
                    {tags.length > 0 && (
                      <View style={styles.tagRow}>
                        {tags.map((tag, i) => (
                          <View key={i} style={styles.tag}>
                            <Text style={styles.tagText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    <View style={styles.matchMeta}>
                      {item.servings > 0 && (
                        <View style={styles.metaItem}>
                          <Ionicons name="people-outline" size={14} color={colors.accent} />
                          <Text style={styles.metaText}>Serves {item.servings}</Text>
                        </View>
                      )}
                      {item.unanimous && (
                        <View style={styles.unanimousBadge}>
                          <Text style={styles.unanimousText}>Unanimous</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.cookedButton}
                        onPress={() => handleMarkCooked(item.id, item.recipeTitle)}
                      >
                        <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                        <Text style={styles.cookedText}>Cooked</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Generate Grocery List Button — fixed at bottom */}
      {matches.length > 0 && (
        <TouchableOpacity
          style={styles.groceryButton}
          onPress={handleGenerateGroceryList}
        >
          <Ionicons name="cart-outline" size={22} color={colors.background} />
          <Text style={styles.groceryButtonText}>Generate Grocery List</Text>
        </TouchableOpacity>
      )}

      {/* Recipe Detail Modal */}
      <Modal
        visible={!!selectedRecipe}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedRecipe(null)}
      >
        {selectedRecipe && (
          <View style={styles.modalContainer}>
            <ScrollView style={{ flex: 1 }}>
              <View style={styles.modalImageWrap}>
                <Image
                  source={{ uri: selectedRecipe.recipeImage || selectedRecipe.image }}
                  style={styles.modalImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['transparent', colors.background]}
                  locations={[0.5, 1]}
                  style={styles.modalGradient}
                />
              </View>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setSelectedRecipe(null)}
              >
                <Ionicons name="close-circle" size={36} color={colors.overlay} />
              </TouchableOpacity>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  {selectedRecipe.recipeTitle || selectedRecipe.title}
                </Text>
                {selectedRecipe.recipeSummary && (
                  <Text style={styles.modalSummary}>{selectedRecipe.recipeSummary}</Text>
                )}
                <View style={styles.modalMeta}>
                  {selectedRecipe.readyInMinutes > 0 && (
                    <View style={styles.modalMetaItem}>
                      <Ionicons name="time-outline" size={20} color={colors.accent} />
                      <Text style={styles.modalMetaText}>{selectedRecipe.readyInMinutes} min</Text>
                    </View>
                  )}
                  {selectedRecipe.servings > 0 && (
                    <View style={styles.modalMetaItem}>
                      <Ionicons name="people-outline" size={20} color={colors.accent} />
                      <Text style={styles.modalMetaText}>Serves {selectedRecipe.servings}</Text>
                    </View>
                  )}
                </View>

                {/* Tab bar */}
                <View style={styles.tabBar}>
                  <TouchableOpacity
                    style={[styles.tab, activeTab === 'ingredients' && styles.tabActive]}
                    onPress={() => setActiveTab('ingredients')}
                  >
                    <Text style={[styles.tabText, activeTab === 'ingredients' && styles.tabTextActive]}>
                      Ingredients
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tab, activeTab === 'instructions' && styles.tabActive]}
                    onPress={() => setActiveTab('instructions')}
                  >
                    <Text style={[styles.tabText, activeTab === 'instructions' && styles.tabTextActive]}>
                      Instructions
                    </Text>
                  </TouchableOpacity>
                </View>

                {activeTab === 'ingredients' ? (
                  <View style={styles.tabContent}>
                    {(selectedRecipe.ingredients || []).map((ing, idx) => (
                      <View key={idx} style={styles.ingredientRow}>
                        <View style={styles.bulletDot} />
                        <Text style={styles.ingredientText}>{ing.original || ing.name}</Text>
                      </View>
                    ))}
                    {(!selectedRecipe.ingredients || selectedRecipe.ingredients.length === 0) && (
                      <Text style={styles.noDataText}>No ingredient data available</Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.tabContent}>
                    {loadingInstructions ? (
                      <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 20 }} />
                    ) : instructions ? (
                      instructions
                        .split(/(?<=\.)\s+/)
                        .filter(s => s.trim().length > 0)
                        .map((step, idx) => (
                          <View key={idx} style={styles.stepRow}>
                            <View style={styles.stepNumber}>
                              <Text style={styles.stepNumberText}>{idx + 1}</Text>
                            </View>
                            <Text style={styles.stepText}>{step.trim()}</Text>
                          </View>
                        ))
                    ) : (
                      <Text style={styles.noDataText}>No instructions available</Text>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: {
      flex: 1, justifyContent: 'center', alignItems: 'center',
      backgroundColor: colors.background, padding: 30,
    },
    loadingLogo: { width: 160, height: 160, marginBottom: 20, opacity: 0.85 },
    emptyTitle: { color: colors.text, fontSize: 22, fontWeight: 'bold', marginTop: 16 },
    emptySubtitle: { color: colors.textSecondary, fontSize: 16, marginTop: 8, textAlign: 'center' },
    actionBtn: {
      marginTop: 24, backgroundColor: colors.accent,
      paddingHorizontal: 28, paddingVertical: 14, borderRadius: 25,
    },
    actionBtnText: { color: colors.background, fontSize: 16, fontWeight: 'bold' },

    section: { paddingHorizontal: 16, paddingTop: 16 },
    sectionTitle: {
      fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12,
    },

    // Suggestions
    suggestionCard: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
      borderRadius: 16, overflow: 'hidden', marginBottom: 10,
    },
    suggestionImage: { width: 80, height: 80 },
    suggestionInfo: { flex: 1, padding: 12, gap: 2 },
    suggestionName: { fontSize: 15, fontWeight: '600', color: colors.text },
    suggestionBy: { fontSize: 12, color: colors.textTertiary },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    metaSmall: { fontSize: 12, color: colors.textTertiary },
    suggestionActions: { flexDirection: 'column', gap: 8, paddingRight: 12 },
    acceptBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center',
    },
    dismissBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.error + '18', borderWidth: 1, borderColor: colors.error + '40',
      justifyContent: 'center', alignItems: 'center',
    },

    // Matches
    matchesHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    matchCard: {
      borderRadius: 20, backgroundColor: colors.background, overflow: 'hidden',
      marginBottom: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
    },
    matchImage: { width: '100%', height: CARD_IMAGE_HEIGHT },
    timeBadge: {
      position: 'absolute', top: 12, left: 12,
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, zIndex: 10,
    },
    badgeLabel: { color: colors.background, fontSize: 11, fontWeight: '700' },
    gradient: {
      position: 'absolute', top: CARD_IMAGE_HEIGHT * 0.3,
      left: 0, right: 0, height: CARD_IMAGE_HEIGHT * 0.7,
    },
    matchInfo: {
      paddingHorizontal: 20, paddingTop: 4, paddingBottom: 18, gap: 6,
    },
    matchName: { color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
    tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    tag: {
      backgroundColor: colors.accent,
      paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12,
    },
    tagText: { color: colors.background, fontSize: 12, fontWeight: '600' },
    matchMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
    unanimousBadge: {
      backgroundColor: colors.success + '20', paddingHorizontal: 10,
      paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: colors.success + '40',
    },
    unanimousText: { color: colors.success, fontSize: 12, fontWeight: '600' },
    actionRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
    cookedButton: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20,
      backgroundColor: colors.success + '18', borderWidth: 1, borderColor: colors.success + '40',
    },
    cookedText: { color: colors.success, fontSize: 13, fontWeight: '600' },

    groceryButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.accent, marginHorizontal: 16, marginBottom: 20,
      paddingVertical: 16, borderRadius: 30, gap: 10,
    },
    groceryButtonText: { color: colors.background, fontSize: 18, fontWeight: 'bold' },

    // Modal
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalImageWrap: { width: '100%', height: 300 },
    modalImage: { width: '100%', height: 300 },
    modalGradient: {
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 150,
    },
    modalClose: {
      position: 'absolute', top: 50, right: 16, zIndex: 10,
      backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 18,
      width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
    },
    modalContent: { padding: 20 },
    modalTitle: {
      color: colors.text, fontSize: 26, fontWeight: 'bold', marginBottom: 8, letterSpacing: -0.3,
    },
    modalSummary: {
      color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 16,
    },
    modalMeta: { flexDirection: 'row', gap: 20, marginBottom: 24 },
    modalMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    modalMetaText: { color: colors.text, fontSize: 15 },

    tabBar: {
      flexDirection: 'row', borderBottomWidth: 1,
      borderBottomColor: colors.border, marginBottom: 16,
    },
    tab: {
      flex: 1, paddingVertical: 12, alignItems: 'center',
      borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: colors.accent },
    tabText: { fontSize: 15, color: colors.textSecondary, fontWeight: '500' },
    tabTextActive: { color: colors.accent, fontWeight: '700' },
    tabContent: { minHeight: 100 },

    ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    bulletDot: {
      width: 6, height: 6, borderRadius: 3,
      backgroundColor: colors.accent, marginTop: 7, marginRight: 10,
    },
    ingredientText: { color: colors.text, fontSize: 15, flex: 1, lineHeight: 20 },
    noDataText: { color: colors.textTertiary, fontSize: 15, textAlign: 'center', marginTop: 20 },

    stepRow: { flexDirection: 'row', marginBottom: 14, alignItems: 'flex-start' },
    stepNumber: {
      width: 26, height: 26, borderRadius: 13,
      backgroundColor: colors.accent, justifyContent: 'center',
      alignItems: 'center', marginRight: 12, marginTop: 1,
    },
    stepNumberText: { color: colors.background, fontSize: 13, fontWeight: '700' },
    stepText: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 22 },
  });
}
