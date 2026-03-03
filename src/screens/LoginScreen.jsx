import { signUpWithGoogle, signUpWithApple } from 'react-native-credentials-manager';

import React, { useState, useMemo } from 'react';
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
} from 'react-native';
import Svg, {
    Path,
    Defs,
    LinearGradient,
    Stop,
    G,
    Rect,
} from 'react-native-svg';
import { MMKV } from 'react-native-mmkv';
import Config from 'react-native-config';
import googleAuth from '../services/googleAuth';

const storage = new MMKV();
const { width, height } = Dimensions.get('window');

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
// SVG Background (preserved from original)
// ──────────────────────────────────────────────────

const RealisticPalmTree = ({ x, y, scale, rotation = 0 }) => {
    const paths = useMemo(() => {
        const frondElements = [];
        const frondAngles = [
            -70, -45, -20, 0, 25, 45, 65, 85, 110, 135, 160, 190, 215, 235, 250
        ];

        frondAngles.forEach((angle, idx) => {
            const len = 140 + Math.random() * 40 - Math.abs(angle - 90) * 0.4;
            const rad = (angle * Math.PI) / 180;
            const droop = 0.5 + Math.random() * 0.5;
            const leafletCount = 35;

            for (let i = 0; i < leafletCount; i++) {
                const t = i / leafletCount;
                if (t < 0.1) continue;

                const stemX = len * t * Math.cos(rad);
                const stemY = len * t * Math.sin(rad) + len * droop * t * t;
                const leafLen = (50 * (1 - t) + 10) * (0.8 + Math.random() * 0.4);

                const l1Angle = rad + 0.4 + (Math.random() * 0.2);
                const l1dx = leafLen * Math.cos(l1Angle);
                const l1dy = leafLen * Math.sin(l1Angle) + (leafLen * 0.8);

                const l2Angle = rad - 0.4 - (Math.random() * 0.2);
                const l2dx = leafLen * Math.cos(l2Angle);
                const l2dy = leafLen * Math.sin(l2Angle) + (leafLen * 0.8);

                const pathData = `M ${Math.round(stemX)} ${Math.round(stemY)} Q ${Math.round(stemX + l1dx * 0.5)} ${Math.round(stemY + l1dy * 0.5)} ${Math.round(stemX + l1dx)} ${Math.round(stemY + l1dy)} M ${Math.round(stemX)} ${Math.round(stemY)} Q ${Math.round(stemX + l2dx * 0.5)} ${Math.round(stemY + l2dy * 0.5)} ${Math.round(stemX + l2dx)} ${Math.round(stemY + l2dy)}`;

                frondElements.push(
                    <Path
                        key={`${angle}-${i}`}
                        d={pathData}
                        stroke="#3F4A5E"
                        strokeWidth={1.5 - t * 0.8}
                        fill="none"
                        strokeLinecap="round"
                    />
                );
            }

            frondElements.push(
                <Path
                    key={`stem-${angle}`}
                    d={`M 0 0 Q ${Math.round(len * 0.5 * Math.cos(rad))} ${Math.round(len * 0.5 * Math.sin(rad))} ${Math.round(len * Math.cos(rad))} ${Math.round(len * Math.sin(rad) + len * droop)}`}
                    stroke="#3F4A5E"
                    strokeWidth={4 * (1 - (idx * 0.01))}
                    fill="none"
                />
            );
        });

        return frondElements;
    }, []);

    return (
        <G transform={`translate(${x}, ${y}) scale(${scale}) rotate(${rotation})`}>
            <Path
                d="M 12 0 C 18 -60 12 -180 -18 -320 C -2 -180 12 -60 22 0 Z"
                fill="#3F4A5E"
            />
            <G transform="translate(-16, -310)">
                {paths}
            </G>
        </G>
    );
};

const ExactBackground = () => (
    <View style={StyleSheet.absoluteFill}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <Defs>
                <LinearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#35B5FE" />
                    <Stop offset="0.6" stopColor="#A2DCF6" />
                    <Stop offset="1" stopColor="#D5EDF6" />
                </LinearGradient>
            </Defs>

            <Rect x="0" y="0" width={width} height={height} fill="url(#skyGrad)" />

            <Path
                d={`M -10 ${height * 0.58} C ${width * 0.25} ${height * 0.5}, ${width * 0.35} ${height * 0.38}, ${width * 0.6} ${height * 0.35} C ${width * 0.75} ${height * 0.33}, ${width * 0.85} ${height * 0.25}, ${width + 10} ${height * 0.24}`}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={1.5}
            />

            <Path
                d={`M 0 ${height * 0.59} C ${width * 0.2} ${height * 0.6}, ${width * 0.2} ${height * 0.7}, ${width * 0.2} ${height * 0.75} C ${width * 0.2} ${height * 0.85}, ${width * 0.65} ${height * 0.8}, ${width * 0.75} ${height * 0.82} L ${width * 0.8} ${height} L 0 ${height} Z`}
                fill="#F3F8FA"
            />

            <Path
                d={`M 0 ${height * 0.845} Q ${width * 0.25} ${height * 0.845} ${width * 0.45} ${height * 0.89} L ${width * 0.45} ${height} L 0 ${height} Z`}
                fill="#2BB3FE"
            />

            <Path
                d={`M -20 ${height * 0.91} C ${width * 0.25} ${height * 0.9}, ${width * 0.55} ${height * 0.85}, ${width + 10} ${height * 0.78} L ${width + 10} ${height} L -20 ${height} Z`}
                fill="#3F4A5E"
            />

            <RealisticPalmTree x={width * 0.9} y={height * 0.65} scale={0.8} rotation={-8} />
            <RealisticPalmTree x={width * 0.82} y={height * 0.88} scale={1.1} rotation={-5} />
            <RealisticPalmTree x={width * 0.94} y={height * 1.05} scale={0.7} rotation={-12} />
        </Svg>
    </View>
);

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
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isAppleLoading, setIsAppleLoading] = useState(false);

    const handlePostLogin = (data) => {
        if (data?.success && data?.user) {
            storage.set('user', JSON.stringify(data.user));
            if (data.isNewUser !== undefined) {
                storage.set('isNewUser', data.isNewUser);
            }
            navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
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
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            <ExactBackground />

            <View style={styles.overlay}>
                {/* ── Top: Hello Travelers ── */}
                <View style={styles.textContainer}>
                    <Text style={styles.helloText}>Hello</Text>
                    <View style={styles.travelersRow}>
                        <Text style={styles.travelersText}>Travelers</Text>
                        <View style={styles.dot} />
                    </View>
                    <Text style={styles.subtitleText}>Let's take a trip with us</Text>
                </View>

                {/* ── Bottom: Sign-in buttons ── */}
                <View style={styles.ctaContainer}>
                    {/* Apple Sign-In — iOS only */}
                    {Platform.OS === 'ios' && (
                        isAppleLoading ? (
                            <ActivityIndicator size="large" color="#000000" style={{ marginBottom: 14 }} />
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
                        <ActivityIndicator size="large" color="#00BEE0" />
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
                            onPress={() => Linking.openURL('https://tripways.app/terms')}
                        >
                            Terms of Service
                        </Text>{' '}
                        &{' '}
                        <Text
                            style={styles.termsLink}
                            onPress={() => Linking.openURL('https://tripways.app/privacy')}
                        >
                            Privacy Policy
                        </Text>
                    </Text>
                </View>
            </View>
        </View>
    );
};

// ──────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#35B5FE' },
    overlay: {
        flex: 1,
        justifyContent: 'space-between',
        paddingTop: height * 0.13,
        paddingBottom: height * 0.06,
    },
    textContainer: { paddingHorizontal: 40 },
    helloText: {
        fontSize: 48,
        color: '#FFFFFF',
        fontWeight: '400',
        marginBottom: -6,
        letterSpacing: 0.5,
    },
    travelersRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    travelersText: {
        fontSize: 68,
        fontWeight: '800',
        color: '#3F4A5E',
        letterSpacing: -1,
    },
    dot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#FFFFFF',
        marginLeft: 4,
        alignSelf: 'flex-end',
        marginBottom: 16,
    },
    subtitleText: {
        fontSize: 18,
        fontWeight: '500',
        color: '#3F4A5E',
        marginTop: 6,
        letterSpacing: 0.3,
        paddingLeft: 4,
    },

    // ── CTA area ──
    ctaContainer: {
        paddingHorizontal: 32,
        alignItems: 'center',
    },
    signInButton: {
        width: '90%',
        paddingVertical: 16,
        minHeight: 56,
        borderRadius: 999,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 5,
        marginBottom: 14,
    },
    appleButton: {
        backgroundColor: '#000000',
    },
    googleButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    buttonContent: {
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
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    googleButtonText: {
        color: '#1f1f1f',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    termsText: {
        marginTop: 8,
        textAlign: 'center',
        color: '#6B7280',
        fontSize: 12,
        paddingHorizontal: 16,
    },
    termsLink: {
        color: '#00BEE0',
        fontWeight: '800',
    },
});

export default LoginScreen;
