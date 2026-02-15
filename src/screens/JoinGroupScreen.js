import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import {
  findGroupByInviteCode,
  joinGroup,
  setActiveGroup,
} from '../services/groups';
import { getUserProfile } from '../services/firebase';

export default function JoinGroupScreen({ route, navigation }) {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const uid = state.firebaseUser?.uid;
  const displayName = state.userProfile?.displayName || '';

  // Invite code comes from deep link param
  const inviteCode = route?.params?.inviteCode || '';

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);

  // Look up the group on mount
  useEffect(() => {
    if (!inviteCode) {
      setError('No invite code provided.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const found = await findGroupByInviteCode(inviteCode);
        if (!found) {
          setError('No group found with that invite code.');
        } else {
          setGroup(found);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [inviteCode]);

  const handleJoin = async () => {
    if (!group) return;

    if (group.members.includes(uid)) {
      // Already a member — just set active and go back
      await setActiveGroup(uid, group.id);
      const updatedProfile = await getUserProfile(uid);
      dispatch({ type: 'SET_USER_PROFILE', payload: updatedProfile });
      Alert.alert('Already a member', `You're already in "${group.name}".`, [
        { text: 'OK', onPress: () => navigation.navigate('Landing') },
      ]);
      return;
    }

    setJoining(true);
    try {
      await joinGroup(uid, displayName, group.id);
      await setActiveGroup(uid, group.id);
      const updatedProfile = await getUserProfile(uid);
      dispatch({ type: 'SET_USER_PROFILE', payload: updatedProfile });

      Alert.alert('Joined!', `You joined "${group.name}". Start swiping!`, [
        { text: 'OK', onPress: () => navigation.navigate('Landing') },
      ]);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Finding group...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
        <Text style={styles.errorTitle}>Couldn't find group</Text>
        <Text style={styles.errorSubtitle}>{error}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const memberCount = group?.members?.length || 0;
  const names = group?.memberNames || {};
  const creatorName = names[group?.createdBy] || 'Someone';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="people" size={36} color={colors.accent} />
        </View>

        <Text style={styles.title}>You're invited!</Text>
        <Text style={styles.groupName}>{group.name}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.metaText}>Created by {creatorName}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.metaText}>
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.joinButton, joining && { opacity: 0.6 }]}
          onPress={handleJoin}
          disabled={joining}
        >
          {joining ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="enter-outline" size={20} color="#FFFFFF" />
              <Text style={styles.joinButtonText}>
                {group.members.includes(uid) ? 'Open Group' : 'Join Group'}
              </Text>
            </>
          )}
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
      justifyContent: 'center',
      padding: 24,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      padding: 30,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: 16,
      marginTop: 16,
    },
    errorTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 16,
    },
    errorSubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    backButton: {
      marginTop: 24,
      backgroundColor: colors.accent,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: 25,
    },
    backButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
    },

    // ── Card ──
    card: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 32,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.paleAccent || colors.inputBg,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 15,
      color: colors.textSecondary,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    groupName: {
      fontSize: 26,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 6,
      marginBottom: 20,
      textAlign: 'center',
    },
    metaRow: {
      gap: 10,
      marginBottom: 24,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    metaText: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    joinButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: colors.accent,
      paddingVertical: 16,
      paddingHorizontal: 40,
      borderRadius: 28,
      width: '100%',
    },
    joinButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: 'bold',
    },
  });
}
