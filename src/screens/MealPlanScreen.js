import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { mergeIngredients } from '../utils/ingredientMerger';
import { fetchRecipeDetails } from '../services/spoonacular';
import { suggestRecipeToGroup } from '../services/groups';

const { width } = Dimensions.get('window');
const CARD_IMAGE_HEIGHT = 200;

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

export default function MealPlanScreen({ navigation }) {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [activeTab, setActiveTab] = useState('ingredients');
  const [instructions, setInstructions] = useState(null);
  const [loadingInstructions, setLoadingInstructions] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [recipeToSend, setRecipeToSend] = useState(null);

  const userId = state.firebaseUser?.uid;
  const displayName = state.userProfile?.displayName || 'Someone';
  const groups = state.groups || [];

  // Fetch instructions when a recipe is opened
  useEffect(() => {
    if (!selectedRecipe) {
      setInstructions(null);
      setActiveTab('ingredients');
      return;
    }
    let cancelled = false;
    setLoadingInstructions(true);
    fetchRecipeDetails(selectedRecipe.id)
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

  const handleRemove = (recipeId) => {
    Alert.alert(
      'Remove Recipe',
      'Remove this recipe from your meal plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => dispatch({ type: 'REMOVE_FROM_MEAL_PLAN', payload: recipeId }),
        },
      ]
    );
  };

  const handleGenerateGroceryList = () => {
    if (state.mealPlan.length === 0) {
      Alert.alert('No Recipes', 'Swipe right on some recipes first!');
      return;
    }
    const merged = mergeIngredients(state.mealPlan);
    dispatch({ type: 'SET_GROCERY_LIST', payload: merged });
    navigation.navigate('GroceryList');
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear Meal Plan',
      'Remove all recipes from your meal plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => dispatch({ type: 'CLEAR_MEAL_PLAN' }),
        },
      ]
    );
  };

  const handleSendToGroup = (recipe) => {
    if (groups.length === 0) {
      Alert.alert('No Groups', 'Create or join a group first to share recipes!');
      return;
    }
    if (groups.length === 1) {
      // Only one group — send directly
      sendRecipeToGroup(groups[0], recipe);
    } else {
      // Multiple groups — show picker
      setRecipeToSend(recipe);
      setShowGroupPicker(true);
    }
  };

  const sendRecipeToGroup = async (group, recipe) => {
    try {
      await suggestRecipeToGroup(group.id, recipe, userId, displayName);
      Alert.alert('Sent!', `"${recipe.title}" has been suggested to ${group.name}`);
    } catch (e) {
      Alert.alert('Error', 'Failed to send recipe to group');
    }
    setShowGroupPicker(false);
    setRecipeToSend(null);
  };

  const renderRecipeCard = ({ item }) => {
    const tags = getRecipeTags(item);
    return (
      <TouchableOpacity
        style={styles.recipeCard}
        onPress={() => setSelectedRecipe(item)}
        activeOpacity={0.8}
      >
        {/* Full-width image */}
        <Image source={{ uri: item.image }} style={styles.recipeImage} resizeMode="cover" />

        {/* Cook time badge */}
        <View style={styles.timeBadge}>
          <Ionicons name="time" size={12} color={colors.background} />
          <Text style={styles.badgeLabel}>{item.readyInMinutes} min</Text>
        </View>

        {/* Servings badge */}
        <View style={styles.servingsBadge}>
          <Ionicons name="people" size={12} color={colors.background} />
          <Text style={styles.badgeLabel}>Serves {item.servings}</Text>
        </View>

        {/* Remove button */}
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemove(item.id)}
        >
          <Ionicons name="close-circle" size={28} color="rgba(239,68,68,0.9)" />
        </TouchableOpacity>

        {/* Send to group button */}
        {groups.length > 0 && (
          <TouchableOpacity
            style={styles.sendToGroupButton}
            onPress={() => handleSendToGroup(item)}
          >
            <Ionicons name="paper-plane" size={16} color={colors.background} />
          </TouchableOpacity>
        )}

        {/* Gradient fade overlay */}
        <LinearGradient
          colors={['transparent', colors.overlay, colors.background]}
          locations={[0, 0.35, 0.7]}
          style={styles.gradient}
        />

        {/* Info below image */}
        <View style={styles.recipeInfo}>
          <Text style={styles.recipeName} numberOfLines={2}>{item.title}</Text>

          {/* Tags */}
          {tags.length > 0 && (
            <View style={styles.tagRow}>
              {tags.map((tag, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.recipeSummary} numberOfLines={2}>
            {item.summary}
          </Text>

          <View style={styles.recipeMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={colors.accent} />
              <Text style={styles.metaText}>{item.readyInMinutes} min</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={14} color={colors.accent} />
              <Text style={styles.metaText}>Serves {item.servings}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="basket-outline" size={14} color={colors.accent} />
              <Text style={styles.metaText}>{item.ingredients.length} ingredients</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {state.mealPlan.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="restaurant-outline" size={64} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No meals planned yet</Text>
          <Text style={styles.emptySubtitle}>
            Swipe right on recipes to add them here
          </Text>
          <TouchableOpacity
            style={styles.goSwipeButton}
            onPress={() => navigation.navigate('EatIn')}
          >
            <Text style={styles.goSwipeText}>Start Swiping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {state.mealPlan.length} recipe{state.mealPlan.length !== 1 ? 's' : ''} selected
            </Text>
            <TouchableOpacity onPress={handleClearAll}>
              <Text style={styles.clearText}>Clear All</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={state.mealPlan}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderRecipeCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

          <TouchableOpacity
            style={styles.generateButton}
            onPress={handleGenerateGroceryList}
          >
            <Ionicons name="cart-outline" size={22} color={colors.background} />
            <Text style={styles.generateText}>Generate Grocery List</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Group Picker Modal */}
      <Modal visible={showGroupPicker} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Send to Group</Text>
            <Text style={styles.pickerSubtitle}>
              {recipeToSend?.title}
            </Text>
            {groups.map(g => (
              <TouchableOpacity
                key={g.id}
                style={styles.pickerRow}
                onPress={() => sendRecipeToGroup(g, recipeToSend)}
              >
                <Ionicons name="people" size={18} color={colors.accent} />
                <Text style={styles.pickerGroupName}>{g.name}</Text>
                <Text style={styles.pickerMemberCount}>
                  {g.members?.length || 0} members
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.pickerCancel}
              onPress={() => { setShowGroupPicker(false); setRecipeToSend(null); }}
            >
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Recipe Detail Modal */}
      <Modal
        visible={!!selectedRecipe}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedRecipe(null)}
      >
        {selectedRecipe && (
          <View style={styles.modalContainer}>
            <ScrollView style={styles.modalScroll}>
              {/* Modal hero image with gradient */}
              <View style={styles.modalImageWrap}>
                <Image
                  source={{ uri: selectedRecipe.image }}
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
                <Text style={styles.modalTitle}>{selectedRecipe.title}</Text>

                {/* Tags in modal */}
                {(() => {
                  const modalTags = getRecipeTags(selectedRecipe);
                  return modalTags.length > 0 ? (
                    <View style={[styles.tagRow, { marginBottom: 12 }]}>
                      {modalTags.map((tag, i) => (
                        <View key={i} style={styles.tag}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null;
                })()}

                <Text style={styles.modalSummary}>{selectedRecipe.summary}</Text>

                <View style={styles.modalMeta}>
                  <View style={styles.modalMetaItem}>
                    <Ionicons name="time-outline" size={20} color={colors.accent} />
                    <Text style={styles.modalMetaText}>
                      {selectedRecipe.readyInMinutes} min
                    </Text>
                  </View>
                  <View style={styles.modalMetaItem}>
                    <Ionicons name="people-outline" size={20} color={colors.accent} />
                    <Text style={styles.modalMetaText}>
                      Serves {selectedRecipe.servings}
                    </Text>
                  </View>
                  <View style={styles.modalMetaItem}>
                    <Ionicons name="basket-outline" size={20} color={colors.accent} />
                    <Text style={styles.modalMetaText}>
                      {selectedRecipe.ingredients.length} ingredients
                    </Text>
                  </View>
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

                {/* Tab content */}
                {activeTab === 'ingredients' ? (
                  <View style={styles.tabContent}>
                    {selectedRecipe.ingredients.map((ing, idx) => (
                      <View key={idx} style={styles.ingredientRow}>
                        <View style={styles.bulletDot} />
                        <Text style={styles.ingredientText}>{ing.original}</Text>
                      </View>
                    ))}
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
                      <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                        <Ionicons name="document-text-outline" size={40} color={colors.textTertiary} />
                        <Text style={styles.noInstructionsText}>
                          No instructions available
                        </Text>
                        {selectedRecipe.sourceUrl && (
                          <Text style={styles.sourceHint}>
                            Check the original recipe source for directions
                          </Text>
                        )}
                      </View>
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
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 30,
    },
    emptyTitle: {
      color: colors.text, fontSize: 22, fontWeight: 'bold', marginTop: 16,
    },
    emptySubtitle: {
      color: colors.textTertiary, fontSize: 16, marginTop: 8, textAlign: 'center',
    },
    goSwipeButton: {
      marginTop: 24, backgroundColor: colors.accent,
      paddingHorizontal: 28, paddingVertical: 14, borderRadius: 25,
    },
    goSwipeText: { color: colors.background, fontSize: 16, fontWeight: 'bold' },

    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    headerTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
    clearText: { color: colors.error, fontSize: 14 },

    listContent: { padding: 16 },

    // Card with gradient image
    recipeCard: {
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
    recipeImage: {
      width: '100%',
      height: CARD_IMAGE_HEIGHT,
    },

    // Image badges
    timeBadge: {
      position: 'absolute',
      top: 12,
      left: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 16,
      zIndex: 10,
    },
    servingsBadge: {
      position: 'absolute',
      top: 12,
      left: 95,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 16,
      zIndex: 10,
    },
    badgeLabel: { color: colors.background, fontSize: 11, fontWeight: '700' },

    // Remove button
    removeButton: {
      position: 'absolute',
      top: 10,
      right: 10,
      zIndex: 10,
    },
    // Send to group button
    sendToGroupButton: {
      position: 'absolute',
      top: 12,
      right: 44,
      zIndex: 10,
      backgroundColor: colors.accent,
      width: 28,
      height: 28,
      borderRadius: 14,
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

    // Info below image
    recipeInfo: {
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 18,
      gap: 6,
    },
    recipeName: {
      color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.3,
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
    recipeSummary: {
      color: colors.textSecondary, fontSize: 14, lineHeight: 20,
    },
    recipeMeta: {
      flexDirection: 'row', gap: 16,
    },
    metaItem: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
    },
    metaText: { color: colors.text, fontSize: 13, fontWeight: '600' },

    generateButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.accent,
      marginHorizontal: 20, marginBottom: 20, paddingVertical: 16,
      borderRadius: 30, gap: 10,
    },
    generateText: { color: colors.background, fontSize: 18, fontWeight: 'bold' },

    // Group Picker
    pickerOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center', alignItems: 'center', padding: 30,
    },
    pickerSheet: {
      backgroundColor: colors.background, borderRadius: 20, padding: 24,
      width: '100%',
    },
    pickerTitle: {
      fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4,
    },
    pickerSubtitle: {
      fontSize: 14, color: colors.textSecondary, marginBottom: 16,
    },
    pickerRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    pickerGroupName: {
      flex: 1, fontSize: 16, fontWeight: '600', color: colors.text,
    },
    pickerMemberCount: {
      fontSize: 13, color: colors.textTertiary,
    },
    pickerCancel: {
      alignItems: 'center', paddingVertical: 14, marginTop: 8,
    },
    pickerCancelText: {
      fontSize: 15, color: colors.textSecondary,
    },

    // Modal styles
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalScroll: { flex: 1 },
    modalImageWrap: {
      width: '100%',
      height: 300,
    },
    modalImage: {
      width: '100%',
      height: 300,
    },
    modalGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 150,
    },
    modalClose: {
      position: 'absolute',
      top: 50,
      right: 16,
      zIndex: 10,
      backgroundColor: 'rgba(0,0,0,0.3)',
      borderRadius: 18,
      width: 36,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
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
    sectionTitle: {
      color: colors.accent, fontSize: 18, fontWeight: 'bold', marginBottom: 12,
    },
    ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    bulletDot: {
      width: 6, height: 6, borderRadius: 3,
      backgroundColor: colors.accent, marginTop: 7, marginRight: 10,
    },
    ingredientText: { color: colors.text, fontSize: 15, flex: 1, lineHeight: 20 },

    // Tab bar
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 16,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: colors.accent,
    },
    tabText: {
      fontSize: 15,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    tabTextActive: {
      color: colors.accent,
      fontWeight: '700',
    },
    tabContent: {
      minHeight: 100,
    },

    // Instruction steps
    stepRow: {
      flexDirection: 'row',
      marginBottom: 14,
      alignItems: 'flex-start',
    },
    stepNumber: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      marginTop: 1,
    },
    stepNumberText: {
      color: colors.background,
      fontSize: 13,
      fontWeight: '700',
    },
    stepText: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
    },
    noInstructionsText: {
      color: colors.textSecondary,
      fontSize: 16,
      marginTop: 12,
      textAlign: 'center',
    },
    sourceHint: {
      color: colors.textTertiary,
      fontSize: 13,
      marginTop: 8,
      textAlign: 'center',
    },
  });
}
