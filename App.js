import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';

import { AppProvider, useApp } from './src/context/AppContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { onAuthChange, getUserProfile } from './src/services/firebase';
import { listenToMyGroups } from './src/services/groups';

// Screens
import AuthScreen from './src/screens/AuthScreen';
import LandingScreen from './src/screens/LandingScreen';
import GroupsScreen from './src/screens/GroupsScreen';
import JoinGroupScreen from './src/screens/JoinGroupScreen';
import EatOutScreen from './src/screens/EatOutScreen';
import MatchesScreen from './src/screens/MatchesScreen';
import SwipeScreen from './src/screens/SwipeScreen';
import MealPlanScreen from './src/screens/MealPlanScreen';
import RecipeMatchesScreen from './src/screens/RecipeMatchesScreen';
import GroceryListScreen from './src/screens/GroceryListScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LikedRestaurantsScreen from './src/screens/LikedRestaurantsScreen';

const Stack = createNativeStackNavigator();

// Deep linking configuration
const linking = {
  prefixes: [Linking.createURL('/'), 'dinder://'],
  config: {
    screens: {
      JoinGroup: 'join/:inviteCode',
    },
  },
};

function AppNavigator() {
  const { state, dispatch } = useApp();
  const { colors, isDarkMode } = useTheme();

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (user) {
        dispatch({
          type: 'SET_FIREBASE_USER',
          payload: { uid: user.uid, email: user.email },
        });
        // Load user profile from Firestore
        try {
          const profile = await getUserProfile(user.uid);
          if (profile) {
            dispatch({ type: 'SET_USER_PROFILE', payload: profile });
          }
        } catch (e) {
          console.log('Error loading profile:', e);
        }
      } else {
        dispatch({ type: 'SET_FIREBASE_USER', payload: null });
        dispatch({ type: 'SET_USER_PROFILE', payload: null });
      }
    });

    return () => unsubscribe();
  }, []);

  // Load active group and listen for group changes
  useEffect(() => {
    const uid = state.firebaseUser?.uid;

    if (!uid) {
      dispatch({ type: 'SET_GROUPS', payload: [] });
      return;
    }

    // Listen for all groups the user belongs to
    const unsubGroups = listenToMyGroups(uid, (groups) => {
      dispatch({ type: 'SET_GROUPS', payload: groups });
    });

    // Active group syncing is handled by listenToGroup in AppContext

    return () => unsubGroups();
  }, [state.firebaseUser?.uid]);

  const screenOptions = {
    headerStyle: { backgroundColor: colors.background, shadowColor: 'transparent', elevation: 0 },
    headerTintColor: colors.text,
    headerTitleStyle: { fontWeight: '600', fontSize: 17, color: colors.text },
    contentStyle: { backgroundColor: colors.background },
    headerShadowVisible: false,
    headerBackTitleVisible: false,
  };

  // Show loading while determining auth state
  if (!state.isAuthReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const isLoggedIn = !!state.firebaseUser;

  return (
    <NavigationContainer linking={linking}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={screenOptions}>
        {!isLoggedIn ? (
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Landing"
              component={LandingScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Groups"
              component={GroupsScreen}
              options={{ title: 'My Groups' }}
            />
            <Stack.Screen
              name="JoinGroup"
              component={JoinGroupScreen}
              options={{ title: 'Join Group' }}
            />
            <Stack.Screen
              name="EatOut"
              component={EatOutScreen}
              options={{ title: 'Eat Out' }}
            />
            <Stack.Screen
              name="Matches"
              component={MatchesScreen}
              options={{ title: 'Matches' }}
            />
            <Stack.Screen
              name="EatIn"
              component={SwipeScreen}
              options={{ title: 'Eat In' }}
            />
            <Stack.Screen
              name="MealPlan"
              component={MealPlanScreen}
              options={{ title: 'Meal Plan' }}
            />
            <Stack.Screen
              name="RecipeMatches"
              component={RecipeMatchesScreen}
              options={{ title: 'Group Meal Plan' }}
            />
            <Stack.Screen
              name="GroceryList"
              component={GroceryListScreen}
              options={{ title: 'Grocery List' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: 'Settings' }}
            />
            <Stack.Screen
              name="LikedRestaurants"
              component={LikedRestaurantsScreen}
              options={{ title: 'Liked Restaurants' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
    </AppProvider>
  );
}
