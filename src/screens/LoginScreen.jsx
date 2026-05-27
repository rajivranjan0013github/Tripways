import { signUpWithGoogle, signUpWithApple } from 'react-native-credentials-manager';

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Dimensions,
    Platform,
    ActivityIndicator,
    Linking,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {
    Path,
} from 'react-native-svg';
import { MMKV } from 'react-native-mmkv';
import Config from 'react-native-config';
import googleAuth from '../services/googleAuth';
import { setAppGroupData } from '../services/ShareIntent';
import {
    registerDeviceForRemoteMessages,
    getToken,
    getMessaging,
} from '@react-native-firebase/messaging';
import { getApp } from '@react-native-firebase/app';
import { useUpdateUserProfile } from '../hooks/useUserProfile';
const storage = new MMKV();
const { width, height } = Dimensions.get('window');
const IMAGE_WIDTH = width;
const IMAGE_HEIGHT = IMAGE_WIDTH * (686 / 578);
const VISUAL_TOP = Math.max(
    Math.min(height * 0.31, height - IMAGE_HEIGHT - 90),
    190
);

const FONT_DISPLAY = Platform.select({
    ios: 'Plus Jakarta Sans',
    android: 'PlusJakartaSans-Regular',
    default: 'System',
});

const FONT_DISPLAY_BOLD = Platform.select({
    ios: 'Plus Jakarta Sans',
    android: 'PlusJakartaSans-Bold',
    default: 'System',
});

const FONT_DISPLAY_SEMIBOLD = Platform.select({
    ios: 'Plus Jakarta Sans',
    android: 'PlusJakartaSans-SemiBold',
    default: 'System',
});

const FONT_SERIF = Platform.select({
    ios: 'Cormorant Garamond',
    android: 'CormorantGaramond-SemiBold',
    default: 'serif',
});

const BACKEND_URL = Config.BACKEND_URL || 'http://localhost:3000';
const GOOGLE_WEB_CLIENT_ID =
    '600831714498-b4h3pgaf049kjrue5snp21qhh5hqmecr.apps.googleusercontent.com';

// ──────────────────────────────────────────────────
// Auth helper functions (same pattern as gtdfront)
// ──────────────────────────────────────────────────

async function platformSpecificGoogleSignUp() {
    try {
        if (Platform.OS === 'android') {
            const googleCredential = await signUpWithGoogle({
                serverClientId: GOOGLE_WEB_CLIENT_ID,
                autoSelectEnabled: false,
            });
            const res = await fetch(`${BACKEND_URL}/api/login/google/loginSignUp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: googleCredential.idToken,
                    platform: 'android',
                }),
            });
            return await res.json();
        } else {
            // iOS: use native GoogleSignInModule
            const result = await googleAuth.signIn();
            if (!result?.idToken) throw new Error('No idToken from Google');
            const res = await fetch(`${BACKEND_URL}/api/login/google/loginSignUp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: result.idToken }),
            });
            return await res.json();
        }
    } catch (error) {
        console.error('Google sign-up failed:', error);
        throw error;
    }
}

async function appleSignUp() {
    try {
        const appleCredential = await signUpWithApple({
            requestedScopes: ['fullName', 'email'],
        });

        const res = await fetch(`${BACKEND_URL}/api/login/apple/loginSignUp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idToken: appleCredential.idToken,
                displayName: appleCredential.displayName,
                email: appleCredential.email,
            }),
        });
        return await res.json();
    } catch (error) {
        console.error('Apple sign-up failed:', error);
        throw error;
    }
}

// ──────────────────────────────────────────────────
// Google & Apple SVG Icons
// ──────────────────────────────────────────────────

const GoogleIcon = () => (
    <Svg width="20" height="20" viewBox="0 0 48 48">
        <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
);

const AppleIcon = () => (
    <Svg width="20" height="20" viewBox="0 0 24 24">
        <Path
            fill="#FFFFFF"
            d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
        />
    </Svg>
);

// ──────────────────────────────────────────────────
// Login Screen Component
// ──────────────────────────────────────────────────

const LoginScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isAppleLoading, setIsAppleLoading] = useState(false);

    const { mutateAsync: updateUserProfile } = useUpdateUserProfile();

    const handlePostLogin = async (data) => {
        if (data?.success && data?.user) {
            storage.set('user', JSON.stringify(data.user));
            if (data.isNewUser !== undefined) {
                storage.set('isNewUser', data.isNewUser);
            }

            // Share userId & backendUrl with the Share Extension via App Group UserDefaults
            const userId = data.user.id || data.user._id;
            if (userId) {
                setAppGroupData(userId, BACKEND_URL);
            }

            const isFirstTime = !storage.getBoolean('notifDecided');

            // Best-effort: register for remote messages and get FCM token
            // Only do this for returning users; first-time users handle this on the NotificationPermissionScreen
            if (!isFirstTime) {
                (async () => {
                    try {
                        await registerDeviceForRemoteMessages(getMessaging(getApp()));
                    } catch (e) {
                        console.warn('Failed to register device for remote messages (login flow)', e);
                    }
                    try {
                        const token = await getToken(getMessaging(getApp()));
                        if (token) {
                            // Save FCM token locally with user object
                            try {
                                const storedUserStr = storage.getString('user');
                                if (storedUserStr) {
                                    const storedUser = JSON.parse(storedUserStr);
                                    storedUser.fcmToken = token;
                                    storage.set('user', JSON.stringify(storedUser));
                                }
                            } catch (e) {
                                console.warn('Failed to update stored user with FCM token', e);
                            }
                            // Update server with FCM token (best-effort)
                            if (userId) {
                                updateUserProfile({ userId, data: { fcmToken: token } })
                                    .catch(e => console.warn('Failed to update server FCM token', e));
                            }
                        }
                    } catch (e) {
                        console.warn('Failed to get FCM token (login flow)', e);
                    }
                })();
            }

            // Navigate: NotificationPermission for first-time, Home for returning
            navigation.reset({
                index: 0,
                routes: [{ name: isFirstTime ? 'NotificationPermission' : 'Home' }],
            });
        } else {
            console.warn('Login failed:', data);
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            setIsGoogleLoading(true);
            const data = await platformSpecificGoogleSignUp();
            handlePostLogin(data);
        } catch (error) {
            console.error('Google Sign-in failed', error);
        } finally {
            setIsGoogleLoading(false);
        }
    };

    const handleAppleSignIn = async () => {
        try {
            setIsAppleLoading(true);
            const data = await appleSignUp();
            handlePostLogin(data);
        } catch (error) {
            console.error('Apple Sign-in failed', error);
        } finally {
            setIsAppleLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            <View style={styles.visualContainer} pointerEvents="none">
                <Image
                    source={require('../assets/onboardinglogin.png')}
                    style={styles.visual}
                    resizeMode="contain"
                />
                <LinearGradient
                    colors={['#FFFFFF', 'rgba(255, 255, 255, 0.92)', 'rgba(255, 255, 255, 0)']}
                    style={styles.topGradient}
                />
                <LinearGradient
                    colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.92)', '#FFFFFF']}
                    style={styles.bottomGradient}
                />
            </View>

            <View style={[styles.copyBlock, { paddingTop: Math.max(insets.top + 24, 60) }]}>
                <View style={styles.tagRow}>
                    <View style={styles.tagLine} />
                    <Text style={styles.tagText}>TRIPWAYS</Text>
                    <View style={styles.tagLine} />
                </View>

                <Text style={styles.headline}>Save places.{'\n'}Plan better trips.</Text>
                <Text style={styles.body}>
                    Sign in to turn the spots you love into{'\n'}beautiful routes and travel maps.
                </Text>
            </View>

            <View style={[styles.ctaContainer, { paddingBottom: Math.max(insets.bottom + 10, 26) }]}>
                {/* Apple Sign-In — iOS only */}
                {Platform.OS === 'ios' && (
                    isAppleLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#07152C" />
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[styles.signInButton, styles.appleButton]}
                            onPress={handleAppleSignIn}
                            activeOpacity={0.9}
                            disabled={isAppleLoading || isGoogleLoading}
                        >
                            <View style={styles.buttonContent}>
                                <View style={styles.buttonIcon}>
                                    <AppleIcon />
                                </View>
                                <Text style={styles.appleButtonText}>Continue with Apple</Text>
                            </View>
                        </TouchableOpacity>
                    )
                )}

                {/* Google Sign-In */}
                {isGoogleLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#117CE8" />
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[styles.signInButton, styles.googleButton]}
                        onPress={handleGoogleSignIn}
                        activeOpacity={0.9}
                        disabled={isGoogleLoading || isAppleLoading}
                    >
                        <View style={styles.buttonContent}>
                            <View style={styles.buttonIcon}>
                                <GoogleIcon />
                            </View>
                            <Text style={styles.googleButtonText}>Continue with Google</Text>
                        </View>
                    </TouchableOpacity>
                )}

                {/* Terms & Privacy */}
                <Text style={styles.termsText}>
                    By continuing, you agree to our{' '}
                    <Text
                        style={styles.termsLink}
                        onPress={() => Linking.openURL('https://rajivranjan0013github.github.io/tripways-privacy/terms-service.html')}
                    >
                        Terms of Service
                    </Text>{' '}
                    &{' '}
                    <Text
                        style={styles.termsLink}
                        onPress={() => Linking.openURL('https://rajivranjan0013github.github.io/tripways-privacy/privacy-policy.html')}
                    >
                        Privacy Policy
                    </Text>
                </Text>
            </View>
        </View>
    );
};

// ──────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
    },
    copyBlock: {
        width: '100%',
        paddingHorizontal: 24,
        alignItems: 'center',
        zIndex: 2,
    },
    tagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        marginBottom: 10,
    },
    tagLine: {
        width: 38,
        height: 2,
        borderRadius: 1,
        backgroundColor: '#0F7CE8',
    },
    tagText: {
        color: '#117CE8',
        fontFamily: FONT_DISPLAY_BOLD,
        fontSize: 13,
        ...Platform.select({ ios: { fontWeight: '700' }, android: {} }),
    },
    headline: {
        color: '#07152C',
        fontFamily: FONT_SERIF,
        fontSize: Math.min(width * 0.09, 38),
        lineHeight: Math.min(width * 0.105, 44),
        ...Platform.select({ ios: { fontWeight: '600' }, android: {} }),
        textAlign: 'center',
        marginBottom: 10,
    },
    body: {
        color: '#657286',
        fontFamily: FONT_DISPLAY,
        fontSize: Math.min(width * 0.038, 16),
        lineHeight: Math.min(width * 0.058, 24),
        ...Platform.select({ ios: { fontWeight: '400' }, android: {} }),
        textAlign: 'center',
    },
    visualContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: VISUAL_TOP,
        height: IMAGE_HEIGHT,
    },
    visual: {
        width: '100%',
        height: '100%',
    },
    topGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
    },
    bottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
    },

    // ── CTA area ──
    ctaContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    loadingContainer: {
        width: '100%',
        minHeight: 52,
        marginBottom: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    signInButton: {
        width: '100%',
        height: 52,
        borderRadius: 26,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
        marginBottom: 14,
    },
    appleButton: {
        backgroundColor: '#000000',
    },
    googleButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E7ECF2',
    },
    buttonContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonIcon: {
        height: 20,
        width: 20,
        marginRight: 10,
        justifyContent: 'center',
    },
    appleButtonText: {
        color: '#FFFFFF',
        fontFamily: FONT_DISPLAY_SEMIBOLD,
        fontSize: 16,
        ...Platform.select({ ios: { fontWeight: '600' }, android: {} }),
    },
    googleButtonText: {
        color: '#07152C',
        fontFamily: FONT_DISPLAY_SEMIBOLD,
        fontSize: 16,
        ...Platform.select({ ios: { fontWeight: '600' }, android: {} }),
    },
    termsText: {
        marginTop: 2,
        textAlign: 'center',
        color: '#657286',
        fontFamily: FONT_DISPLAY,
        fontSize: 12,
        lineHeight: 18,
        paddingHorizontal: 16,
    },
    termsLink: {
        color: '#117CE8',
        fontFamily: FONT_DISPLAY_BOLD,
        ...Platform.select({ ios: { fontWeight: '700' }, android: {} }),
    },
});

export default LoginScreen;
