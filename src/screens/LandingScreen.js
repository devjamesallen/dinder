import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from '../context/AppContext';
import { useTheme } from "../context/ThemeContext";

const FEATURES = [
  {
    key: "EatOut",
    title: "Eat Out",
    subtitle: "Swipe on restaurants nearby",
    icon: "restaurant-outline",
    screen: "EatOut",
  },
  {
    key: "EatIn",
    title: "Eat In",
    subtitle: "Find recipes to cook at home",
    icon: "flame-outline",
    screen: "EatIn",
  },
  {
    key: "Groups",
    title: "Groups",
    subtitle: "Manage your groups & matches",
    icon: "people-outline",
    screen: "Groups",
  },
];

export default function LandingScreen({ navigation }) {
  const { state } = useApp();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const displayName = state.userProfile?.displayName || "";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={{ width: 36 }} />
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.settingsIcon}
          onPress={() => navigation.navigate("Settings")}
        >
          <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Logo + Greeting */}
      <View style={styles.header}>
        <Image
          source={require("../../assets/GrubSwipe_Logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        {displayName ? (
          <Text style={styles.greeting}>Hey, {displayName}</Text>
        ) : null}
      </View>

      {/* Feature List */}
      <View style={styles.featureList}>
        {FEATURES.map((feature, index) => (
          <TouchableOpacity
            key={feature.key}
            style={[
              styles.featureRow,
              index < FEATURES.length - 1 && styles.featureRowBorder,
            ]}
            activeOpacity={0.6}
            onPress={() => navigation.navigate(feature.screen)}
          >
            <View style={styles.featureIconWrap}>
              <Ionicons name={feature.icon} size={22} color={colors.accent} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureSubtitle}>{feature.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
      paddingBottom: Platform.OS === 'android' ? 24 : 0,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 4,
    },
    settingsIcon: {
      padding: 8,
    },

    // Header / Logo
    header: {
      alignItems: "center",
      paddingTop: 12,
      paddingBottom: 20,
    },
    logo: {
      width: 286,
      height: 286,
      marginBottom: 0,
    },
    greeting: {
      fontSize: 15,
      color: colors.textTertiary,
      marginTop: 6,
      fontWeight: "400",
    },

    // Feature list
    featureList: {
      marginHorizontal: 20,
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingHorizontal: 16,
    },
    featureRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 18,
    },
    featureRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    featureIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.paleAccent,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 14,
    },
    featureText: {
      flex: 1,
    },
    featureTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.text,
    },
    featureSubtitle: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 2,
    },

  });
}
