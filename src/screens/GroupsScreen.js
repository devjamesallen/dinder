import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Share,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import * as Location from 'expo-location';
import {
  createGroup,
  listenToMyGroups,
  setActiveGroup,
  leaveGroup,
  findGroupByInviteCode,
  joinGroup,
  updateGroupLocation,
} from '../services/groups';
import { getUserProfile } from '../services/firebase';

export default function GroupsScreen({ navigation }) {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const uid = state.firebaseUser?.uid;
  const displayName = state.userProfile?.displayName || '';
  const activeGroupId = state.userProfile?.activeGroupId || null;
  const hasGroup = !!activeGroupId;

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create group modal
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  // Location settings modal
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [locRadius, setLocRadius] = useState('5');
  const [locName, setLocName] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);

  // Join group section
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  // Listen for group changes in real time
  useEffect(() => {
    if (!uid) return;
    const unsubscribe = listenToMyGroups(uid, (myGroups) => {
      setGroups(myGroups);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [uid]);

  // ── Create Group ──────────────────────────────────────────
  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      Alert.alert('Name Required', 'Give your group a name.');
      return;
    }

    setCreating(true);
    try {
      const group = await createGroup(uid, displayName, name);

      // Set as active group
      await setActiveGroup(uid, group.id);
      const updatedProfile = await getUserProfile(uid);
      dispatch({ type: 'SET_USER_PROFILE', payload: updatedProfile });

      setShowCreate(false);
      setNewGroupName('');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setCreating(false);
    }
  };

  // ── Join Group ────────────────────────────────────────────
  const handleJoinGroup = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      Alert.alert('Invalid Code', 'Group codes are 6 characters.');
      return;
    }

    setJoining(true);
    try {
      const group = await findGroupByInviteCode(code);
      if (!group) {
        Alert.alert('Not Found', 'No group found with that code.');
        return;
      }
      if (group.members.includes(uid)) {
        Alert.alert('Already Joined', "You're already in this group.");
        return;
      }

      await joinGroup(uid, displayName, group.id);

      // Set as active group
      await setActiveGroup(uid, group.id);
      const updatedProfile = await getUserProfile(uid);
      dispatch({ type: 'SET_USER_PROFILE', payload: updatedProfile });

      setJoinCode('');
      Alert.alert('Joined!', `You joined "${group.name}".`);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setJoining(false);
    }
  };

  // ── Set Active ────────────────────────────────────────────
  const handleSetActive = async (groupId) => {
    try {
      await setActiveGroup(uid, groupId);
      const updatedProfile = await getUserProfile(uid);
      dispatch({ type: 'SET_USER_PROFILE', payload: updatedProfile });
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  // ── Share Invite ──────────────────────────────────────────
  const handleShare = async (group) => {
    try {
      await Share.share({
        message: `Let's swipe together and eat together on Dinder! Join my group "${group.name}" — open the app and enter this code:\n\n${group.inviteCode}`,
      });
    } catch (e) {
      // User cancelled
    }
  };

  // ── Leave Group ───────────────────────────────────────────
  const handleLeave = (group) => {
    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave "${group.name}"?${group.members.length === 1 ? ' This will delete the group.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear active group BEFORE leaving/deleting so there's no stale reference
              if (activeGroupId === group.id) {
                await setActiveGroup(uid, null);
                const updatedProfile = await getUserProfile(uid);
                dispatch({ type: 'SET_USER_PROFILE', payload: updatedProfile });
              }
              await leaveGroup(uid, group.id);
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  // ── Location Settings ──────────────────────────────────────
  const handleOpenLocation = (group) => {
    setEditingGroup(group);
    setLocRadius(String(group.searchRadiusMiles || 5));
    setLocName(group.locationName || '');
    setShowLocationModal(true);
  };

  const handleSearchLocation = async () => {
    const query = locName.trim();
    if (!query) {
      Alert.alert('Enter a Location', 'Type a city, address, or place name to search.');
      return;
    }
    setSavingLocation(true);
    try {
      const results = await Location.geocodeAsync(query);
      if (!results || results.length === 0) {
        Alert.alert('Not Found', `Could not find "${query}". Try a more specific address or city name.`);
        return;
      }
      const { latitude, longitude } = results[0];
      const miles = parseInt(locRadius, 10) || 5;
      await updateGroupLocation(editingGroup.id, {
        lat: latitude,
        lng: longitude,
        name: query,
        radius: miles,
      });
      setShowLocationModal(false);
      Alert.alert('Updated', `Location set to "${query}" (${miles} mi radius).`);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingLocation(false);
    }
  };

  const handleUseMyLocation = async () => {
    setSavingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is needed.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const miles = parseInt(locRadius, 10) || 5;
      await updateGroupLocation(editingGroup.id, {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        name: locName.trim() || 'My Location',
        radius: miles,
      });
      setShowLocationModal(false);
      Alert.alert('Updated', `Location set to ${locName.trim() || 'your current location'} (${miles} mi radius).`);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingLocation(false);
    }
  };

  const handleClearLocation = async () => {
    setSavingLocation(true);
    try {
      const miles = parseInt(locRadius, 10) || 5;
      await updateGroupLocation(editingGroup.id, {
        lat: null,
        lng: null,
        name: null,
        radius: miles,
      });
      setShowLocationModal(false);
      Alert.alert('Updated', `Group will use each member's device location (${miles} mi radius).`);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingLocation(false);
    }
  };

  const handleSaveRadius = async () => {
    setSavingLocation(true);
    try {
      const miles = parseInt(locRadius, 10) || 5;
      await updateGroupLocation(editingGroup.id, {
        lat: editingGroup.locationLat,
        lng: editingGroup.locationLng,
        name: editingGroup.locationName,
        radius: miles,
      });
      setShowLocationModal(false);
      Alert.alert('Updated', `Search radius set to ${miles} miles.`);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingLocation(false);
    }
  };

  // ── Render Group Card ─────────────────────────────────────
  const renderGroup = ({ item }) => {
    const isActive = item.id === activeGroupId;
    const memberCount = item.members?.length || 0;
    const names = item.memberNames || {};
    const memberList = item.members
      ?.map(m => m === uid ? 'You' : (names[m] || 'Unknown'))
      .join(', ');

    return (
      <TouchableOpacity
        style={[styles.groupCard, isActive && styles.groupCardActive]}
        onPress={() => handleSetActive(item.id)}
        onLongPress={() => handleLeave(item)}
        activeOpacity={0.7}
      >
        <View style={styles.groupCardHeader}>
          <View style={styles.groupCardLeft}>
            <View style={[styles.groupIcon, isActive && styles.groupIconActive]}>
              <Ionicons
                name="people"
                size={20}
                color={isActive ? '#FFFFFF' : colors.accent}
              />
            </View>
            <View style={styles.groupCardText}>
              <View style={styles.groupNameRow}>
                <Text style={styles.groupName} numberOfLines={1}>
                  {item.name}
                </Text>
                {isActive && (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Active</Text>
                  </View>
                )}
              </View>
              <Text style={styles.groupMembers} numberOfLines={1}>
                {memberCount} {memberCount === 1 ? 'member' : 'members'} · {memberList}
              </Text>
            </View>
          </View>
        </View>

        {/* Location info */}
        <TouchableOpacity
          style={styles.locationRow}
          onPress={() => handleOpenLocation(item)}
        >
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.locationName
              ? `${item.locationName} · ${item.searchRadiusMiles || 5} mi`
              : `Device location · ${item.searchRadiusMiles || 5} mi`}
          </Text>
          <Ionicons name="settings-outline" size={14} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* Group feature links */}
        {isActive && (
          <View style={styles.groupLinks}>
            <TouchableOpacity
              style={styles.groupLink}
              onPress={() => navigation.navigate('Matches')}
            >
              <Ionicons name="heart-outline" size={16} color={colors.accent} />
              <Text style={styles.groupLinkText}>Restaurant Matches</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.groupLink}
              onPress={() => navigation.navigate('RecipeMatches')}
            >
              <Ionicons name="restaurant-outline" size={16} color={colors.accent} />
              <Text style={styles.groupLinkText}>Group Meal Plan</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.groupCardActions}>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => handleShare(item)}
          >
            <Ionicons name="share-outline" size={16} color={colors.accent} />
            <Text style={styles.shareBtnText}>Invite</Text>
          </TouchableOpacity>

          <View style={styles.codeChip}>
            <Text style={styles.codeChipText}>{item.inviteCode}</Text>
          </View>
        </View>
      </TouchableOpacity>
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Group list */}
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroup}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {/* Solo card — always visible, tappable to go solo */}
            <TouchableOpacity
              style={[styles.groupCard, !hasGroup && styles.groupCardActive]}
              onPress={() => {
                if (hasGroup) handleSetActive(null);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.groupCardHeader}>
                <View style={styles.groupCardLeft}>
                  <View style={[styles.groupIcon, !hasGroup && styles.groupIconActive]}>
                    <Ionicons
                      name="person"
                      size={20}
                      color={!hasGroup ? '#FFFFFF' : colors.accent}
                    />
                  </View>
                  <View style={styles.groupCardText}>
                    <View style={styles.groupNameRow}>
                      <Text style={styles.groupName}>Solo</Text>
                      {!hasGroup && (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>Active</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.groupMembers}>Your personal swipes & meals</Text>
                  </View>
                </View>
              </View>

              <View style={styles.groupLinks}>
                <TouchableOpacity
                  style={styles.groupLink}
                  onPress={() => navigation.navigate('LikedRestaurants')}
                >
                  <Ionicons name="heart-outline" size={16} color={colors.accent} />
                  <Text style={styles.groupLinkText}>Liked Restaurants</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.groupLink}
                  onPress={() => navigation.navigate('MealPlan')}
                >
                  <Ionicons name="cart-outline" size={16} color={colors.accent} />
                  <Text style={styles.groupLinkText}>Meal Plan & Grocery List</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>

            {groups.length > 0 && (
              <Text style={styles.hint}>
                Tap a group to make it active. Long-press to leave.
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyInline}>
            <Text style={styles.emptySubtitle}>
              Create a group or join one with an invite code to start swiping together!
            </Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 120 }} />}
      />

      {/* Join with code section */}
      <View style={styles.joinSection}>
        <Text style={styles.joinLabel}>Have an invite code?</Text>
        <View style={styles.joinRow}>
          <TextInput
            style={styles.joinInput}
            placeholder="XXXXXX"
            placeholderTextColor={colors.textTertiary}
            value={joinCode}
            onChangeText={(text) => setJoinCode(text.toUpperCase())}
            maxLength={6}
            autoCapitalize="characters"
            textAlign="center"
          />
          <TouchableOpacity
            style={[styles.joinButton, joining && { opacity: 0.6 }]}
            onPress={handleJoinGroup}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.joinButtonText}>Join</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Floating Create button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCreate(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Create Group Modal */}
      <Modal
        visible={showCreate}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreate(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create a Group</Text>
            <Text style={styles.modalSubtitle}>
              Give your group a name like "Date Night" or "Disney Trip"
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Group name"
              placeholderTextColor={colors.textTertiary}
              value={newGroupName}
              onChangeText={setNewGroupName}
              maxLength={30}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowCreate(false); setNewGroupName(''); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, creating && { opacity: 0.6 }]}
                onPress={handleCreateGroup}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.createBtnText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Location Settings Modal */}
      <Modal
        visible={showLocationModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowLocationModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Location Settings</Text>
                <Text style={styles.modalSubtitle}>
                  Set where this group searches for restaurants
                </Text>

                {editingGroup?.locationName ? (
                  <View style={styles.currentLocationRow}>
                    <Ionicons name="location" size={16} color={colors.accent} />
                    <Text style={styles.currentLocationText}>
                      {editingGroup.locationName}
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.inputLabel}>Search for a location</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Fairborn OH, WPAFB, Downtown NYC"
                  placeholderTextColor={colors.textTertiary}
                  value={locName}
                  onChangeText={setLocName}
                  maxLength={60}
                  returnKeyType="search"
                  onSubmitEditing={handleSearchLocation}
                />

                <Text style={styles.inputLabel}>Search radius (miles)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="5"
                  placeholderTextColor={colors.textTertiary}
                  value={locRadius}
                  onChangeText={setLocRadius}
                  keyboardType="number-pad"
                  maxLength={3}
                />

                {/* Primary action: search & set typed location */}
                <TouchableOpacity
                  style={[styles.locBtnFull, { backgroundColor: colors.accent }]}
                  onPress={handleSearchLocation}
                  disabled={savingLocation}
                >
                  {savingLocation ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="search-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.locBtnText}>Search & Set Location</Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.locationDivider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <View style={styles.locationButtons}>
                  <TouchableOpacity
                    style={[styles.locBtn, { backgroundColor: colors.success }]}
                    onPress={handleUseMyLocation}
                    disabled={savingLocation}
                  >
                    <Ionicons name="navigate-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.locBtnText}>Use GPS</Text>
                  </TouchableOpacity>

                  {editingGroup?.locationLat ? (
                    <TouchableOpacity
                      style={[styles.locBtn, { backgroundColor: colors.textTertiary }]}
                      onPress={handleClearLocation}
                      disabled={savingLocation}
                    >
                      <Ionicons name="close-circle-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.locBtnText}>Clear</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.locBtn, { backgroundColor: colors.textTertiary }]}
                      onPress={handleSaveRadius}
                      disabled={savingLocation}
                    >
                      <Ionicons name="checkmark-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.locBtnText}>Save Radius</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowLocationModal(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
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
    },
    loadingLogo: { width: 160, height: 160, marginBottom: 20, opacity: 0.85 },
    list: {
      padding: 16,
    },
    hint: {
      color: colors.textTertiary,
      fontSize: 13,
      textAlign: 'center',
      marginBottom: 12,
    },

    // ── Empty state ──
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 16,
    },
    emptySubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 22,
    },
    emptyInline: {
      padding: 20,
      alignItems: 'center',
    },

    // ── Group card ──
    groupCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    groupCardActive: {
      borderColor: colors.accent,
      backgroundColor: colors.paleAccent || colors.surface,
    },
    groupCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    groupCardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    groupIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.paleAccent || colors.inputBg,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    groupIconActive: {
      backgroundColor: colors.accent,
    },
    groupCardText: {
      flex: 1,
    },
    groupNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    groupName: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      flexShrink: 1,
    },
    activeBadge: {
      backgroundColor: colors.accent,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    activeBadgeText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
    },
    groupMembers: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 3,
    },

    // ── Group feature links ──
    groupLinks: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: 2,
    },
    groupLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    groupLinkText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },

    // ── Group card actions ──
    groupCardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 20,
      backgroundColor: colors.paleAccent || colors.inputBg,
    },
    shareBtnText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: '600',
    },
    codeChip: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: colors.inputBg,
    },
    codeChipText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 2,
      fontFamily: Platform?.OS === 'ios' ? 'Menlo' : 'monospace',
    },

    // ── Location row on card ──
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    locationText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
    },

    // ── Location modal extras ──
    currentLocationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.paleAccent || colors.inputBg,
      padding: 12,
      borderRadius: 12,
      marginBottom: 16,
    },
    currentLocationText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.accent,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    locBtnFull: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      marginBottom: 4,
    },
    locationDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 12,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    dividerText: {
      color: colors.textTertiary,
      fontSize: 12,
      fontWeight: '600',
      marginHorizontal: 12,
    },
    locationButtons: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    locBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
    },
    locBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },

    // ── Join section ──
    joinSection: {
      padding: 16,
      paddingBottom: Platform.OS === 'ios' ? 36 : 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    joinLabel: {
      fontSize: 13,
      color: colors.textTertiary,
      fontWeight: '600',
      marginBottom: 8,
    },
    joinRow: {
      flexDirection: 'row',
      gap: 10,
    },
    joinInput: {
      flex: 1,
      backgroundColor: colors.inputBg,
      borderRadius: 12,
      padding: 14,
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      letterSpacing: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      fontFamily: Platform?.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    joinButton: {
      backgroundColor: colors.success,
      paddingHorizontal: 24,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    joinButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
    },

    // ── FAB ──
    fab: {
      position: 'absolute',
      right: 20,
      bottom: Platform.OS === 'ios' ? 120 : 90,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },

    // ── Modal ──
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: Platform.OS === 'ios' ? 48 : 24,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 6,
    },
    modalSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 20,
    },
    modalInput: {
      backgroundColor: colors.inputBg,
      borderRadius: 14,
      padding: 16,
      fontSize: 18,
      color: colors.text,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: 20,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.inputBg,
      alignItems: 'center',
    },
    cancelBtnText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    createBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.accent,
      alignItems: 'center',
    },
    createBtnText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
  });
}
