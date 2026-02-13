import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { findUserByInviteCode, createPairing } from '../services/pairing';
import { getUserProfile } from '../services/firebase';

export default function InviteScreen({ navigation }) {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [partnerCode, setPartnerCode] = useState('');
  const [loading, setLoading] = useState(false);

  const myCode = state.userProfile?.inviteCode || '------';

  const handleShareCode = async () => {
    try {
      await Share.share({
        message: `Join me on dinder! Use my invite code: ${myCode}`,
      });
    } catch (e) {
      // User cancelled
    }
  };

  const handlePair = async () => {
    const code = partnerCode.trim().toUpperCase();
    if (code.length !== 6) {
      Alert.alert('Invalid Code', 'Invite codes are 6 characters.');
      return;
    }
    if (code === myCode) {
      Alert.alert('Oops', "That's your own code!");
      return;
    }

    setLoading(true);
    try {
      const partner = await findUserByInviteCode(code);
      if (!partner) {
        Alert.alert('Not Found', 'No user found with that invite code.');
        return;
      }
      if (partner.partnerUID) {
        Alert.alert('Already Paired', 'That user is already paired with someone.');
        return;
      }

      // Create the pairing
      await createPairing(state.firebaseUser.uid, partner.uid);

      // Refresh user profile
      const updatedProfile = await getUserProfile(state.firebaseUser.uid);
      dispatch({ type: 'SET_USER_PROFILE', payload: updatedProfile });

      Alert.alert(
        "You're Paired!",
        `You and ${partner.displayName} are now connected. Start swiping!`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="people" size={48} color={colors.accent} />
        <Text style={styles.title}>Pair with your Partner</Text>
        <Text style={styles.subtitle}>
          Share your code or enter theirs to connect
        </Text>
      </View>

      {/* My Code Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Your Invite Code</Text>
        <View style={styles.codeDisplay}>
          {myCode.split('').map((char, i) => (
            <View key={i} style={styles.codeChar}>
              <Text style={styles.codeCharText}>{char}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.shareButton} onPress={handleShareCode}>
          <Ionicons name="share-outline" size={18} color={colors.background} />
          <Text style={styles.shareText}>Share Code</Text>
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Enter Partner's Code */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Enter Partner's Code</Text>
        <TextInput
          style={styles.codeInput}
          placeholder="XXXXXX"
          placeholderTextColor={colors.textSecondary}
          value={partnerCode}
          onChangeText={(text) => setPartnerCode(text.toUpperCase())}
          maxLength={6}
          autoCapitalize="characters"
          textAlign="center"
        />
        <TouchableOpacity
          style={[styles.pairButton, loading && styles.pairButtonDisabled]}
          onPress={handlePair}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <>
              <Ionicons name="heart" size={18} color={colors.background} />
              <Text style={styles.pairText}>Pair Up</Text>
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
      padding: 24,
    },
    header: {
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 30,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 16,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      marginTop: 6,
      textAlign: 'center',
    },
    section: {
      alignItems: 'center',
    },
    sectionLabel: {
      fontSize: 14,
      color: colors.textTertiary,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 14,
    },
    codeDisplay: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    codeChar: {
      width: 46,
      height: 56,
      backgroundColor: colors.inputBg,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.accent,
    },
    codeCharText: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.accent,
      fontFamily: Platform?.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    shareButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.accent,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 25,
    },
    shareText: {
      color: colors.background,
      fontSize: 15,
      fontWeight: 'bold',
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 28,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      color: colors.textTertiary,
      fontSize: 14,
      marginHorizontal: 16,
      fontWeight: 'bold',
    },
    codeInput: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 18,
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      letterSpacing: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: 16,
      fontFamily: Platform?.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    pairButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.success,
      paddingVertical: 14,
      paddingHorizontal: 32,
      borderRadius: 25,
      width: '100%',
    },
    pairButtonDisabled: {
      opacity: 0.6,
    },
    pairText: {
      color: colors.background,
      fontSize: 17,
      fontWeight: 'bold',
    },
  });
}
