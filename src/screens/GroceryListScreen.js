import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SectionList,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { searchProducts, addToCart, getValidToken } from '../services/kroger';
import { toSearchTerm } from '../utils/ingredientMerger';

// ── Kroger product scoring ──────────────────────────────────────────
// Because every item on a recipe grocery list is a raw ingredient, we
// aggressively penalize any product that looks like a prepared food.
// The penalty only fires when the word is in the PRODUCT name but NOT
// in our search term, so searching "pasta" still matches actual pasta.
const STOP_WORDS = new Set(['and', 'the', 'for', 'with', 'into', 'from']);

const PREPARED = new Set([
  // Prepared meals & dishes
  'soup', 'stew', 'chowder', 'bisque', 'chili',
  'pasta', 'ravioli', 'lasagna', 'macaroni', 'noodle', 'noodles',
  'pizza', 'flatbread', 'calzone',
  'sandwich', 'wrap', 'burrito', 'taco', 'enchilada', 'quesadilla',
  'casserole', 'potpie', 'dinner', 'meal', 'entree', 'bowl',
  // Condiments & derivatives
  'vinegar', 'sauce', 'dressing', 'seasoning', 'marinade',
  'gravy', 'broth', 'stock', 'bouillon',
  // Snacks & sweets
  'chips', 'crackers', 'cracker', 'pretzels',
  'candy', 'chocolate', 'cookie', 'cookies', 'cake', 'pie', 'muffin',
  'cereal', 'granola', 'bar', 'snack',
  // Processed forms
  'powder', 'paste', 'extract', 'concentrate',
  'syrup', 'jam', 'jelly', 'preserves',
  'spread', 'dip', 'hummus',
  'nuggets', 'tender', 'tenders', 'strip', 'strips',
  'panko', 'breading', 'croutons', 'stuffing', 'breadcrumbs',
  'mix', 'blend', 'kit', 'supplement',
  // Preparation styles in product names
  'glazed', 'marinated', 'crusted', 'stuffed', 'infused',
  // Proteins — penalize when NOT in search (product is a different food)
  'pork', 'chicken', 'beef', 'turkey', 'steak', 'filet',
  'fillet', 'loin', 'salmon', 'shrimp', 'lamb', 'veal',
  'roast', 'chop', 'chops', 'wing', 'wings', 'thigh',
  'thighs', 'breast', 'ribs', 'sausage', 'patty', 'patties',
]);

/** Score a single Kroger product against our search term. */
function scoreProduct(product, words) {
  const descWords = (product.name || '').toLowerCase().split(/\s+/);
  const hits = words.filter(w =>
    descWords.some(dw => dw.includes(w) || w.includes(dw))
  ).length;
  if (hits === 0) return 0;

  const recall = words.length > 0 ? hits / words.length : 0;
  const precision = descWords.length > 0 ? hits / descWords.length : 0;
  let score = (recall * 2 + precision) / 3;

  // Penalize prepared/derivative products
  const penalties = descWords.filter(dw =>
    PREPARED.has(dw) && !words.some(w => dw.includes(w) || w.includes(dw))
  ).length;
  if (penalties > 0) score *= Math.pow(0.25, penalties);

  return score;
}

/** Pick the best product from an array, returns { match, score } */
function pickBest(products, searchTerm) {
  const words = searchTerm.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  let bestMatch = null;
  let bestScore = -1;
  for (const product of products) {
    const s = scoreProduct(product, words);
    if (s > bestScore) { bestScore = s; bestMatch = product; }
  }
  return { match: bestMatch, score: bestScore };
}

export default function GroceryListScreen({ navigation }) {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState('All');

  const groceryList = state.groceryList || [];

  // Extract unique recipe names for filter chips
  const recipeNames = useMemo(() => {
    const names = new Set();
    groceryList.forEach(item => {
      (item.recipes || []).forEach(r => names.add(r));
    });
    return ['All', ...Array.from(names).sort()];
  }, [groceryList]);

  // Filter grocery list by selected recipe
  const filteredList = useMemo(() => {
    if (selectedRecipe === 'All') return groceryList;
    return groceryList.filter(item =>
      (item.recipes || []).includes(selectedRecipe)
    );
  }, [groceryList, selectedRecipe]);

  // Group items by aisle for section list
  const sections = useMemo(() => {
    const aisleMap = {};
    filteredList.forEach(item => {
      const aisle = item.aisle || 'Other';
      if (!aisleMap[aisle]) aisleMap[aisle] = [];
      aisleMap[aisle].push(item);
    });
    return Object.entries(aisleMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({ title, data }));
  }, [filteredList]);

  const toggleItem = (itemId) => {
    dispatch({ type: 'TOGGLE_GROCERY_ITEM', payload: itemId });
  };

  const removeItem = (itemId) => {
    dispatch({ type: 'REMOVE_GROCERY_ITEM', payload: itemId });
  };

  const uncheckedCount = filteredList.filter(i => !i.checked).length;
  const totalCount = filteredList.length;

  const handleSendToKroger = async () => {
    if (!state.isKrogerConnected) {
      Alert.alert(
        'Connect to Kroger',
        'You need to connect your Kroger account first.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Settings',
            onPress: () => navigation.navigate('Settings'),
          },
        ]
      );
      return;
    }

    const itemsToSend = filteredList.filter(i => !i.checked);
    if (itemsToSend.length === 0) {
      Alert.alert('All Done!', 'All items are checked off already.');
      return;
    }

    Alert.alert(
      'Send to Kroger Clicklist',
      `Add ${itemsToSend.length} item${itemsToSend.length !== 1 ? 's' : ''} to your Kroger cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: () => sendItemsToKroger(itemsToSend) },
      ]
    );
  };

  const sendItemsToKroger = async (items) => {
    setSending(true);
    try {
      const token = await getValidToken(
        state.krogerToken,
        state.krogerRefreshToken
      );
      const locationId = state.krogerStore?.locationId;

      const cartItems = [];
      let matched = 0;
      const notFound = [];   // items where Kroger returned no results or no good match
      const apiErrors = [];  // items where the API call itself failed

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setSendProgress(`Searching: ${item.displayName} (${i + 1}/${items.length})`);

        try {
          // Clean the name so Kroger gets a useful search term
          let searchTerm;
          try {
            searchTerm = toSearchTerm(item.displayName);
          } catch (_) {
            searchTerm = '';
          }
          if (!searchTerm) searchTerm = item.displayName;

          const products = await searchProducts(
            token,
            searchTerm,
            locationId
          );

          if (products.length > 0) {
            let { match: bestMatch, score: bestScore } = pickBest(products, searchTerm);

            // If all results were prepared products, retry with an
            // aisle-appropriate modifier to bias Kroger toward raw ingredients
            if (bestScore < 0.25) {
              const aisle = (item.aisle || '').toLowerCase();
              const retryTerms = [];
              if (aisle.includes('meat') || aisle.includes('poultry')) {
                retryTerms.push(`${searchTerm} meat`);
              } else if (aisle.includes('seafood')) {
                retryTerms.push(`fresh ${searchTerm} seafood`);
              }
              // Always try "fresh" as a fallback modifier
              retryTerms.push(`fresh ${searchTerm}`);

              for (const retryTerm of retryTerms) {
                if (bestScore >= 0.25) break; // found a good match, stop retrying
                setSendProgress(`Retrying: ${retryTerm} (${i + 1}/${items.length})`);
                const retryProducts = await searchProducts(token, retryTerm, locationId);
                if (retryProducts.length > 0) {
                  const retry = pickBest(retryProducts, searchTerm);
                  if (retry.score > bestScore) {
                    bestMatch = retry.match;
                    bestScore = retry.score;
                  }
                }
              }
            }

            if (bestMatch && bestScore >= 0.25) {
              cartItems.push({ upc: bestMatch.upc, quantity: 1 });
              matched++;
            } else {
              notFound.push(item.displayName);
            }
          } else {
            notFound.push(item.displayName);
          }
        } catch (e) {
          apiErrors.push(`${item.displayName} (${e.message})`);
        }
      }

      if (cartItems.length > 0) {
        setSendProgress('Adding items to your Kroger cart...');
        await addToCart(token, cartItems);
      }

      let message = `Added ${matched} item${matched !== 1 ? 's' : ''} to your Kroger cart.`;
      if (notFound.length > 0) {
        message += `\n\nNo match for ${notFound.length} item${notFound.length !== 1 ? 's' : ''}:\n• ${notFound.join('\n• ')}`;
      }
      if (apiErrors.length > 0) {
        message += `\n\nAPI errors for ${apiErrors.length} item${apiErrors.length !== 1 ? 's' : ''}:\n• ${apiErrors.join('\n• ')}`;
      }
      Alert.alert('Done!', message);
    } catch (e) {
      if (e.message === 'SESSION_EXPIRED') {
        dispatch({ type: 'DISCONNECT_KROGER' });
        Alert.alert(
          'Kroger Session Expired',
          'Your Kroger login has expired. Please reconnect in Settings.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Go to Settings', onPress: () => navigation.navigate('Settings') },
          ]
        );
      } else {
        Alert.alert('Error', `Failed to send to Kroger: ${e.message}`);
      }
    } finally {
      setSending(false);
      setSendProgress('');
    }
  };

  if (groceryList.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="cart-outline" size={64} color={colors.textSecondary} />
        <Text style={styles.emptyTitle}>No grocery list yet</Text>
        <Text style={styles.emptySubtitle}>
          Add recipes to your meal plan, then generate a grocery list
        </Text>
        <TouchableOpacity
          style={styles.goButton}
          onPress={() => navigation.navigate('Meal Plan')}
        >
          <Text style={styles.goButtonText}>Go to Meal Plan</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${totalCount > 0 ? ((totalCount - uncheckedCount) / totalCount) * 100 : 0}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {totalCount - uncheckedCount} of {totalCount} items checked
        </Text>
      </View>

      {/* Recipe filter chips */}
      {recipeNames.length > 2 && (
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {recipeNames.map(name => {
              const isActive = selectedRecipe === name;
              return (
                <TouchableOpacity
                  key={name}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setSelectedRecipe(name)}
                >
                  {name === 'All' && (
                    <Ionicons
                      name="list-outline"
                      size={14}
                      color={isActive ? '#fff' : colors.textSecondary}
                      style={{ marginRight: 4 }}
                    />
                  )}
                  <Text
                    style={[styles.filterChipText, isActive && styles.filterChipTextActive]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={16} color={colors.accent} />
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.itemRow, item.checked && styles.itemRowChecked]}
            onPress={() => toggleItem(item.id)}
            onLongPress={() =>
              Alert.alert('Remove Item', `Remove ${item.displayName}?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () => removeItem(item.id),
                },
              ])
            }
          >
            <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
              {item.checked && (
                <Ionicons name="checkmark" size={16} color="#fff" />
              )}
            </View>
            <View style={styles.itemInfo}>
              <Text
                style={[styles.itemName, item.checked && styles.itemNameChecked]}
              >
                {item.displayText}
              </Text>
              {item.recipes.length > 0 && (
                <Text style={styles.itemRecipes} numberOfLines={1}>
                  For: {item.recipes.join(', ')}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Send to Kroger button */}
      {sending ? (
        <View style={styles.sendingContainer}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.sendingText}>{sendProgress}</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.krogerButton,
            !state.isKrogerConnected && styles.krogerButtonDisconnected,
          ]}
          onPress={handleSendToKroger}
        >
          <Ionicons name="storefront-outline" size={22} color="#fff" />
          <Text style={styles.krogerButtonText}>
            {state.isKrogerConnected
              ? `Send ${uncheckedCount} Items to Kroger Clicklist`
              : 'Connect Kroger to Send'}
          </Text>
        </TouchableOpacity>
      )}
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
      backgroundColor: colors.background,
      padding: 30,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: 'bold',
      marginTop: 16,
    },
    emptySubtitle: {
      color: colors.textTertiary,
      fontSize: 16,
      marginTop: 8,
      textAlign: 'center',
    },
    goButton: {
      marginTop: 24,
      backgroundColor: colors.accent,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: 25,
    },
    goButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    progressContainer: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    progressBar: {
      height: 6,
      backgroundColor: colors.inputBg,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.success,
      borderRadius: 3,
    },
    progressText: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 6,
    },
    filterContainer: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    filterScroll: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      maxWidth: 150,
    },
    filterChipTextActive: {
      color: '#fff',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 4,
      gap: 6,
    },
    sectionTitle: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    listContent: {
      padding: 16,
      paddingBottom: 100,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      padding: 14,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    itemRowChecked: {
      backgroundColor: colors.surface,
    },
    checkbox: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    checkboxChecked: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    itemInfo: {
      flex: 1,
    },
    itemName: {
      color: colors.text,
      fontSize: 15,
    },
    itemNameChecked: {
      textDecorationLine: 'line-through',
      color: colors.textTertiary,
    },
    itemRecipes: {
      color: colors.textTertiary,
      fontSize: 12,
      marginTop: 3,
    },
    krogerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      marginHorizontal: 20,
      marginBottom: 20,
      paddingVertical: 16,
      borderRadius: 30,
      gap: 10,
    },
    krogerButtonDisconnected: {
      backgroundColor: colors.textTertiary,
    },
    krogerButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    sendingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      marginHorizontal: 20,
      marginBottom: 20,
      paddingVertical: 16,
      borderRadius: 30,
      gap: 10,
    },
    sendingText: {
      color: '#fff',
      fontSize: 14,
    },
  });
}
