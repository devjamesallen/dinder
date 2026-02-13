import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppProvider, useApp } from './src/context/AppContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { onAuthChange, getUserProfile } from './src/services/firebase';

// Screens
import AuthScreen from './src/screens/AuthScreen';
import LandingScreen from './src/screens/LandingScreen';
import InviteScreen from './src/screens/InviteScreen';
import EatOutScreen from './src/screens/EatOutScreen';
import MatchesScreen from './src/screens/MatchesScreen';
import SwipeScreen from './src/screens/SwipeScreen';
import MealPlanScreen from './src/screens/MealPlanScreen';
import GroceryListScreen from './src/screens/GroceryListScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();

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
    <NavigationContainer>
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
              name="Invite"
              component={InviteScreen}
              options={{ title: 'Pair Up' }}
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
              name="GroceryList"
              component={GroceryListScreen}
              options={{ title: 'Grocery List' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: 'Settings' }}
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
