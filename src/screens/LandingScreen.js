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
import { useApp } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";

const BASE_FEATURES = [
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
    key: "MealPlan",
    title: "Meal Plan",
    subtitle: "Your personal recipes & grocery list",
    icon: "cart-outline",
    screen: "MealPlan",
  },
];

export default function LandingScreen({ navigation }) {
  const { state } = useApp();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const activeGroupId = state.userProfile?.activeGroupId || null;
  const activeGroup = state.activeGroup || null;
  const hasGroup = !!activeGroupId;
  const displayName = state.userProfile?.displayName || "";

  // Build feature list — add Group Meal Plan when group is active
  const FEATURES = hasGroup
    ? [
        ...BASE_FEATURES,
        {
          key: "RecipeMatches",
          title: "Group Meal Plan",
          subtitle: "Matched recipes for your group",
          icon: "people-outline",
          screen: "RecipeMatches",
        },
      ]
    : BASE_FEATURES;

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
          source={require("../../assets/logo.png")}
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

      {/* Bottom section */}
      <View style={styles.bottom}>
        {hasGroup ? (
          <>
            <TouchableOpacity
              style={styles.groupRow}
              onPress={() => navigation.navigate("Groups")}
            >
              <Ionicons name="people" size={16} color={colors.accent} />
              <Text style={styles.groupRowText}>
                {activeGroup?.name || 'Active Group'} ({activeGroup?.members?.length || '?'})
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.matchesRow}
              onPress={() => navigation.navigate("Matches")}
            >
              <Ionicons name="heart" size={16} color={colors.accent} />
              <Text style={styles.matchesText}>View Matches</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.pairRow}
            onPress={() => navigation.navigate("Groups")}
          >
            <Ionicons name="people-outline" size={18} color={colors.accent} />
            <Text style={styles.pairText}>Create or Join a Group</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
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

    // Bottom
    bottom: {
      marginTop: 24,
      marginHorizontal: 20,
    },
    pairRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 16,
      gap: 10,
    },
    pairText: {
      flex: 1,
      fontSize: 15,
      fontWeight: "500",
      color: colors.accent,
    },
    groupRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 16,
      gap: 10,
      marginBottom: 10,
    },
    groupRowText: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
      color: colors.accent,
    },
    matchesRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.paleAccent,
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 16,
      gap: 10,
    },
    matchesText: {
      flex: 1,
      fontSize: 15,
      fontWeight: "500",
      color: colors.accent,
    },
  });
}
