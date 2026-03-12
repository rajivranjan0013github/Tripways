import React, { useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Image,
    Platform,
    Animated as RNAnimated,
    Easing,
    PermissionsAndroid,
    StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { MMKV } from 'react-native-mmkv';
import { useNavigation } from '@react-navigation/native';
import {
    requestPermission,
    registerDeviceForRemoteMessages,
    subscribeToTopic,
    getToken,
    getMessaging,
} from '@react-native-firebase/messaging';
import { getApp } from '@react-native-firebase/app';
import messaging from '@react-native-firebase/messaging';
import Config from 'react-native-config';

const { width, height } = Dimensions.get('window');
const storage = new MMKV();
const BACKEND_URL = Config.BACKEND_URL || 'http://localhost:3000';

// ──────────────────────────────────────────────────
// Font helpers
// ──────────────────────────────────────────────────
const FONT_DISPLAY = Platform.select({
    ios: 'Plus Jakarta Sans',
    android: 'PlusJakartaSans-Regular',
    default: 'System',
});
const FONT_DISPLAY_MEDIUM = Platform.select({
    ios: 'Plus Jakarta Sans',
    android: 'PlusJakartaSans-Medium',
    default: 'System',
});
const FONT_DISPLAY_SEMIBOLD = Platform.select({
    ios: 'Plus Jakarta Sans',
    android: 'PlusJakartaSans-SemiBold',
    default: 'System',
});
const FONT_SERIF = Platform.select({
    ios: 'Cormorant Garamond',
    android: 'CormorantGaramond-SemiBoldItalic',
    default: 'System',
});

export default function NotificationPermissionScreen() {
    const navigation = useNavigation();

    // Animation Values
    const fadeAnim = useRef(new RNAnimated.Value(0)).current;
    const slideUpAnim = useRef(new RNAnimated.Value(30)).current;
    const pulseAnim = useRef(new RNAnimated.Value(1)).current;

    useEffect(() => {
        // Entry animations
        RNAnimated.parallel([
            RNAnimated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            RNAnimated.timing(slideUpAnim, {
                toValue: 0,
                duration: 600,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();

        // Continuous pulse for the bell icon background
        RNAnimated.loop(
            RNAnimated.sequence([
                RNAnimated.timing(pulseAnim, { toValue: 1.15, duration: 1500, useNativeDriver: true }),
                RNAnimated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    // ── Notification logic (preserved from original) ──

    const requestUserPermission = useCallback(async () => {
        if (Platform.OS === 'ios') {
            const status = await requestPermission(getMessaging(getApp()));
            return (
                status === messaging.AuthorizationStatus.AUTHORIZED ||
                status === messaging.AuthorizationStatus.PROVISIONAL
            );
        }

        if (Platform.OS === 'android' && Platform.Version >= 33) {
            const res = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );
            return res === PermissionsAndroid.RESULTS.GRANTED;
        }

        // Android < 13 requires no runtime permission
        return true;
    }, []);

    const proceedToHome = useCallback(() => {
        storage.set('notifDecided', true);
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    }, [navigation]);

    const handleEnableNotifications = useCallback(async () => {
        storage.set('notifDecided', true);

        const granted = await requestUserPermission();
        storage.set('notifEnabled', granted);

        // Navigate immediately
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });

        // If granted, register device and get FCM token in background
        if (granted) {
            try {
                await registerDeviceForRemoteMessages(getMessaging(getApp()));
            } catch (e) {
                console.warn('Failed to register device for remote messages', e);
            }

            try {
                await subscribeToTopic(getMessaging(getApp()), 'all_users');
            } catch (e) {
                console.warn('Failed to subscribe to topic all_users', e);
            }

            try {
                const token = await getToken(getMessaging(getApp()));
                const userStr = storage.getString('user');
                if (userStr && token) {
                    const user = JSON.parse(userStr);
                    const userId = user?.id || user?._id;
                    if (userId) {
                        user.fcmToken = token;
                        storage.set('user', JSON.stringify(user));

                        fetch(`${BACKEND_URL}/api/users/${userId}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fcmToken: token, notificationsEnabled: true }),
                        }).catch(e => console.warn('Failed to update FCM token on server', e));
                    }
                }
            } catch (e) {
                console.warn('Failed to get FCM token', e);
            }
        }
    }, [navigation, requestUserPermission]);

    const handleSkip = useCallback(() => {
        storage.set('notifDecided', true);
        storage.set('notifEnabled', false);
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    }, [navigation]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Background Image / Elements */}
            <View style={styles.bgContainer}>
                <Image
                    source={require('../assets/onboarding1.png')}
                    style={styles.bgImage}
                    resizeMode="cover"
                    blurRadius={Platform.OS === 'ios' ? 10 : 8}
                />
                <View style={styles.bgOverlay} />
            </View>

            <RNAnimated.View
                style={[
                    styles.content,
                    { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] },
                ]}
            >
                {/* Visual Icon Header */}
                <View style={styles.iconWrapper}>
                    <RNAnimated.View
                        style={[
                            styles.iconPulseRing,
                            {
                                transform: [{ scale: pulseAnim }],
                                opacity: pulseAnim.interpolate({
                                    inputRange: [1, 1.15],
                                    outputRange: [0.6, 0],
                                }),
                            },
                        ]}
                    />
                    <View style={styles.iconCircle}>
                        <Svg
                            width="40"
                            height="40"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#FFFFFF"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                            <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </Svg>
                        {/* Notification Dot */}
                        <View style={styles.notificationDot} />
                    </View>
                </View>

                {/* Text Content */}
                <View style={styles.textContainer}>
                    <Text style={styles.headline}>Stay in the loop</Text>
                    <Text style={styles.subtitle}>
                        Enable notifications to know when friends join your trip, or when there are
                        updates to your shared itineraries.
                    </Text>
                </View>

                {/* Features List */}
                <View style={styles.featuresList}>
                    <View style={styles.featureItem}>
                        <Svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#3378c7"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <Path d="M20 6L9 17l-5-5" />
                        </Svg>
                        <Text style={styles.featureText}>Trip invitations from friends</Text>
                    </View>
                    <View style={styles.featureItem}>
                        <Svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#3378c7"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <Path d="M20 6L9 17l-5-5" />
                        </Svg>
                        <Text style={styles.featureText}>Updates on saved spots</Text>
                    </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        onPress={handleEnableNotifications}
                        activeOpacity={0.9}
                        style={styles.primaryButton}
                    >
                        <LinearGradient
                            colors={['#3378c7', '#5a9aeb']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.gradientBg}
                        />
                        <Text style={styles.primaryButtonText}>Enable Notifications</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleSkip}
                        activeOpacity={0.7}
                        style={styles.secondaryButton}
                    >
                        <Text style={styles.secondaryButtonText}>Maybe Later</Text>
                    </TouchableOpacity>
                </View>
            </RNAnimated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    bgContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: height * 0.45,
    },
    bgImage: {
        width: '100%',
        height: '100%',
        opacity: 0.8,
    },
    bgOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    content: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingHorizontal: 28,
        paddingBottom: Platform.OS === 'ios' ? 50 : 36,
    },
    iconWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    iconPulseRing: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#3378c7',
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#3378c7',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#3378c7',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 10,
    },
    notificationDot: {
        position: 'absolute',
        top: 22,
        right: 24,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#EF4444',
        borderWidth: 2,
        borderColor: '#3378c7',
    },
    textContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    headline: {
        fontSize: 34,
        fontFamily: FONT_SERIF,
        fontWeight: '600',
        fontStyle: 'italic',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 15,
        fontFamily: FONT_DISPLAY,
        fontWeight: '400',
        lineHeight: 23,
        color: '#475569',
        textAlign: 'center',
    },
    featuresList: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 20,
        marginBottom: 40,
        gap: 14,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    featureText: {
        fontSize: 14,
        fontFamily: FONT_DISPLAY_MEDIUM,
        color: '#334155',
    },
    buttonContainer: {
        gap: 16,
    },
    primaryButton: {
        width: '100%',
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        shadowColor: '#3378c7',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    gradientBg: {
        ...StyleSheet.absoluteFillObject,
    },
    primaryButtonText: {
        fontSize: 16,
        fontFamily: FONT_DISPLAY_SEMIBOLD,
        color: '#FFFFFF',
    },
    secondaryButton: {
        width: '100%',
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        fontSize: 15,
        fontFamily: FONT_DISPLAY_MEDIUM,
        color: '#94A3B8',
    },
});
