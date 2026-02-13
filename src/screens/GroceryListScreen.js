import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { searchProducts, addToCart, getValidToken } from '../services/kroger';

export default function GroceryListScreen({ navigation }) {
  const { state, dispatch } = useApp();
  const { colors, isDarkMode, dispatch: themeDispatch } = useTheme();
  const styles = createStyles(colors);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState('');

  const groceryList = state.groceryList || [];

  // Group items by aisle for section list
  const sections = React.useMemo(() => {
    const aisleMap = {};
    groceryList.forEach(item => {
      const aisle = item.aisle || 'Other';
      if (!aisleMap[aisle]) aisleMap[aisle] = [];
      aisleMap[aisle].push(item);
    });
    return Object.entries(aisleMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({ title, data }));
  }, [groceryList]);

  const toggleItem = (itemId) => {
    dispatch({ type: 'TOGGLE_GROCERY_ITEM', payload: itemId });
  };

  const removeItem = (itemId) => {
    dispatch({ type: 'REMOVE_GROCERY_ITEM', payload: itemId });
  };

  const uncheckedCount = groceryList.filter(i => !i.checked).length;
  const totalCount = groceryList.length;

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

    const itemsToSend = groceryList.filter(i => !i.checked);
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
      let failed = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setSendProgress(`Searching: ${item.displayName} (${i + 1}/${items.length})`);

        try {
          const products = await searchProducts(
            token,
            item.displayName,
            locationId
          );

          if (products.length > 0) {
            // Take the first (best) match
            cartItems.push({
              upc: products[0].upc,
              quantity: 1,
            });
            matched++;
          } else {
            failed++;
          }
        } catch (e) {
          console.log(`Failed to find product for: ${item.displayName}`, e);
          failed++;
        }
      }

      if (cartItems.length > 0) {
        setSendProgress('Adding items to your Kroger cart...');
        await addToCart(token, cartItems);
      }

      Alert.alert(
        'Done!',
        `Added ${matched} item${matched !== 1 ? 's' : ''} to your Kroger cart.${
          failed > 0 ? `\n${failed} item${failed !== 1 ? 's' : ''} couldn't be found.` : ''
        }`
      );
    } catch (e) {
      Alert.alert('Error', `Failed to send to Kroger: ${e.message}`);
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
