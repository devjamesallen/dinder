import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
  ScrollView,
  Linking,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { logOut, updateUserProfile } from '../services/firebase';
import { breakPairing } from '../services/pairing';
import {
  exchangeCodeForTokens,
  searchLocations,
  loadSavedTokens,
  clearTokens,
  getValidToken,
} from '../services/kroger';
import {
  KROGER_CLIENT_ID,
  KROGER_AUTH_URL,
  KROGER_REDIRECT_URI,
} from '../config';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: `${KROGER_AUTH_URL}/authorize`,
  tokenEndpoint: `${KROGER_AUTH_URL}/token`,
};

export default function SettingsScreen({ navigation }) {
  const { state, dispatch } = useApp();
  const { colors, isDarkMode, dispatch: themeDispatch } = useTheme();
  const styles = createStyles(colors);
  const [zipCode, setZipCode] = useState('');
  const [stores, setStores] = useState([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [radiusInput, setRadiusInput] = useState(
    String(state.userProfile?.searchRadiusMiles || 5)
  );

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: KROGER_CLIENT_ID,
      redirectUri: KROGER_REDIRECT_URI,
      scopes: ['product.compact', 'cart.basic:write', 'profile.compact'],
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    discovery
  );

  useEffect(() => {
    if (response?.type === 'success' && response.params.code) {
      handleAuthCode(response.params.code, request.codeVerifier);
    }
  }, [response]);

  useEffect(() => {
    (async () => {
      const saved = await loadSavedTokens();
      if (saved?.accessToken) {
        dispatch({
          type: 'SET_KROGER_AUTH',
          payload: { accessToken: saved.accessToken, refreshToken: saved.refreshToken },
        });
      }
    })();
  }, []);

  const handleAuthCode = async (code, codeVerifier) => {
    try {
      const tokens = await exchangeCodeForTokens(code, codeVerifier);
      dispatch({ type: 'SET_KROGER_AUTH', payload: tokens });
      Alert.alert('Connected!', 'Your Kroger account is now connected.');
    } catch (e) {
      Alert.alert('Connection Failed', e.message);
    }
  };

  const handleUpdateRadius = async () => {
    const miles = parseInt(radiusInput, 10);
    if (isNaN(miles) || miles < 1 || miles > 50) {
      Alert.alert('Invalid', 'Enter a number between 1 and 50.');
      return;
    }
    try {
      await updateUserProfile(state.firebaseUser.uid, { searchRadiusMiles: miles });
      dispatch({
        type: 'SET_USER_PROFILE',
        payload: { ...state.userProfile, searchRadiusMiles: miles },
      });
      Alert.alert('Updated', `Search radius set to ${miles} miles.`);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const handleUnpair = () => {
    Alert.alert('Unpair', 'Disconnect from your partner?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unpair',
        style: 'destructive',
        onPress: async () => {
          try {
            await breakPairing(state.firebaseUser.uid, state.userProfile.partnerUID);
            dispatch({
              type: 'SET_USER_PROFILE',
              payload: { ...state.userProfile, partnerUID: null },
            });
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logOut();
          dispatch({ type: 'SIGN_OUT' });
        },
      },
    ]);
  };

  const handleSearchStores = async () => {
    if (zipCode.length < 5) {
      Alert.alert('Enter ZIP', 'Please enter a valid ZIP code.');
      return;
    }
    setLoadingStores(true);
    try {
      const token = await getValidToken(state.krogerToken, state.krogerRefreshToken);
      const results = await searchLocations(token, zipCode);
      setStores(results);
      if (results.length === 0) Alert.alert('No Stores', 'No Kroger stores found near that ZIP.');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoadingStores(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Account Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="person-outline" size={22} color={colors.accent} />
          <Text style={styles.sectionTitle}>Account</Text>
        </View>
        <Text style={styles.infoText}>
          {state.userProfile?.displayName} ({state.firebaseUser?.email})
        </Text>
        {state.userProfile?.partnerUID ? (
          <TouchableOpacity style={styles.unpairButton} onPress={handleUnpair}>
            <Ionicons name="people-outline" size={16} color={colors.error} />
            <Text style={styles.unpairText}>Unpair from partner</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.pairButton}
            onPress={() => navigation.navigate('Invite')}
          >
            <Ionicons name="people-outline" size={16} color={colors.accent} />
            <Text style={styles.pairText}>Pair with partner</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Location Radius */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="location-outline" size={22} color={colors.accent} />
          <Text style={styles.sectionTitle}>Search Radius</Text>
        </View>
        <Text style={styles.description}>
          How far to search for restaurants (in miles)
        </Text>
        <View style={styles.radiusRow}>
          <TextInput
            style={styles.radiusInput}
            value={radiusInput}
            onChangeText={setRadiusInput}
            keyboardType="number-pad"
            maxLength={2}
          />
          <Text style={styles.radiusUnit}>miles</Text>
          <TouchableOpacity style={styles.radiusSave} onPress={handleUpdateRadius}>
            <Text style={styles.radiusSaveText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Kroger Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="storefront-outline" size={22} color={colors.accent} />
          <Text style={styles.sectionTitle}>Kroger Clicklist</Text>
        </View>
        {state.isKrogerConnected ? (
          <>
            <View style={styles.connectedRow}>
              <View style={styles.connectedDot} />
              <Text style={styles.connectedText}>Connected</Text>
            </View>
            {state.krogerStore && (
              <Text style={styles.infoText}>
                Store: {state.krogerStore.name}
              </Text>
            )}
            <TouchableOpacity
              onPress={async () => {
                await clearTokens();
                dispatch({ type: 'DISCONNECT_KROGER' });
              }}
            >
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.connectButton}
            onPress={() => promptAsync()}
            disabled={!request}
          >
            <Text style={styles.connectText}>Connect Kroger</Text>
          </TouchableOpacity>
        )}

        {/* Store picker */}
        {state.isKrogerConnected && !state.krogerStore && (
          <>
            <View style={styles.zipRow}>
              <TextInput
                style={styles.zipInput}
                placeholder="ZIP Code"
                placeholderTextColor="#666"
                value={zipCode}
                onChangeText={setZipCode}
                keyboardType="number-pad"
                maxLength={5}
              />
              <TouchableOpacity style={styles.searchButton} onPress={handleSearchStores}>
                {loadingStores ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.searchText}>Find</Text>
                )}
              </TouchableOpacity>
            </View>
            {stores.map((store) => (
              <TouchableOpacity
                key={store.locationId}
                style={styles.storeItem}
                onPress={() => {
                  dispatch({ type: 'SET_KROGER_STORE', payload: store });
                  Alert.alert('Selected', store.name);
                }}
              >
                <Text style={styles.storeName}>{store.name}</Text>
                <Text style={styles.storeAddress}>{store.address}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>

      {/* Appearance Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="moon-outline" size={22} color={colors.accent} />
          <Text style={styles.sectionTitle}>Appearance</Text>
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Dark Mode</Text>
          <TouchableOpacity
            style={[styles.toggleTrack, { backgroundColor: isDarkMode ? colors.accent : colors.border }]}
            onPress={() => themeDispatch({ type: 'TOGGLE_DARK_MODE' })}
            activeOpacity={0.7}
          >
            <View style={[styles.toggleThumb, { transform: [{ translateX: isDarkMode ? 22 : 2 }] }]} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Log Out */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 40 },
    section: {
      backgroundColor: colors.surface, borderRadius: 16, padding: 18, marginBottom: 14,
      borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10,
    },
    sectionTitle: { color: colors.text, fontSize: 17, fontWeight: 'bold' },
    description: { color: colors.textSecondary, fontSize: 14, marginBottom: 10 },
    infoText: { color: colors.textTertiary, fontSize: 14, marginBottom: 6 },

    // Pair/Unpair
    pairButton: {
      flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    },
    pairText: { color: colors.accent, fontSize: 14 },
    unpairButton: {
      flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    },
    unpairText: { color: colors.error, fontSize: 14 },

    // Radius
    radiusRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
    },
    radiusInput: {
      backgroundColor: colors.background, borderRadius: 10, padding: 12,
      color: colors.text, fontSize: 18, fontWeight: 'bold', width: 60,
      textAlign: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    radiusUnit: { color: colors.textSecondary, fontSize: 16 },
    radiusSave: {
      backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10,
      borderRadius: 10, marginLeft: 'auto',
    },
    radiusSaveText: { color: '#FFFFFF', fontWeight: 'bold' },

    // Kroger
    connectedRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6,
    },
    connectedDot: {
      width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success,
    },
    connectedText: { color: colors.success, fontSize: 14, fontWeight: '600' },
    disconnectText: { color: colors.error, fontSize: 14, marginTop: 8 },
    connectButton: {
      backgroundColor: colors.accent, paddingVertical: 12, borderRadius: 10,
      alignItems: 'center',
    },
    connectText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
    zipRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
    zipInput: {
      flex: 1, backgroundColor: colors.background, borderRadius: 10, padding: 12,
      color: colors.text, fontSize: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    searchButton: {
      backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 18,
      justifyContent: 'center',
    },
    searchText: { color: '#FFFFFF', fontWeight: 'bold' },
    storeItem: {
      backgroundColor: colors.background, borderRadius: 10, padding: 12, marginTop: 8,
      borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    storeName: { color: colors.text, fontSize: 14, fontWeight: '600' },
    storeAddress: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },

    // Toggle
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    toggleLabel: { fontSize: 15, color: colors.text },
    toggleTrack: { width: 50, height: 28, borderRadius: 14, justifyContent: 'center' },
    toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' },

    // Logout
    logoutButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, paddingVertical: 16, marginTop: 10,
    },
    logoutText: { color: colors.error, fontSize: 16, fontWeight: '600' },
  });
}
