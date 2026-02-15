import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { signUp, logIn } from "../services/firebase";
import { useTheme } from "../context/ThemeContext";

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing Info", "Please enter your email and password.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await logIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, displayName.trim());
      }
    } catch (e) {
      let msg = e.message;
      if (msg.includes("auth/email-already-in-use"))
        msg = "An account with this email already exists.";
      else if (msg.includes("auth/invalid-email"))
        msg = "Please enter a valid email address.";
      else if (msg.includes("auth/user-not-found"))
        msg = "No account found with this email.";
      else if (msg.includes("auth/wrong-password")) msg = "Incorrect password.";
      else if (msg.includes("auth/invalid-credential"))
        msg = "Invalid email or password.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.logoSection}>
              <Image
                source={require("../../assets/logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.tagline}>Swipe together, eat together</Text>
            </View>

            <View style={styles.form}>
              {!isLogin && (
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={colors.textTertiary}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                />
              )}

              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>
                    {isLogin ? "Log In" : "Create Account"}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => setIsLogin(!isLogin)}
              >
                <Text style={styles.toggleText}>
                  {isLogin
                    ? "Don't have an account? "
                    : "Already have an account? "}
                  <Text style={styles.toggleHighlight}>
                    {isLogin ? "Sign Up" : "Log In"}
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    logoSection: {
      alignItems: "center",
      marginBottom: 48,
    },
    logo: {
      width: 300,
      height: 300,
      marginBottom: 2,
    },
    tagline: {
      fontSize: 15,
      color: colors.textTertiary,
      marginTop: 6,
    },
    form: {
      gap: 14,
    },
    input: {
      backgroundColor: colors.inputBg,
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 18,
      fontSize: 16,
      color: colors.text,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    submitButton: {
      backgroundColor: colors.accent,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 4,
    },
    submitText: {
      color: "#fff",
      fontSize: 17,
      fontWeight: "600",
    },
    toggleButton: {
      alignItems: "center",
      paddingVertical: 14,
    },
    toggleText: {
      color: colors.textTertiary,
      fontSize: 15,
    },
    toggleHighlight: {
      color: colors.accent,
      fontWeight: "600",
    },
  });
}
