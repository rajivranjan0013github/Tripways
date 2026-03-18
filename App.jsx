/**
 * TripWays - Travel Planning App
 * @format
 */

import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './src/services/queryClient';
import AppNavigator from './src/navigation/AppNavigator';
import { MMKV } from 'react-native-mmkv';
import Config from 'react-native-config';
import {
    registerDeviceForRemoteMessages,
    getToken,
    subscribeToTopic,
    onTokenRefresh,
    onMessage,
    onNotificationOpenedApp,
    getInitialNotification,
    getMessaging,
} from '@react-native-firebase/messaging';
import { getApp } from '@react-native-firebase/app';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';
import { useUserStore } from './src/store/userStore';

const storage = new MMKV();
const BACKEND_URL = Config.BACKEND_URL || 'http://localhost:3000';

/**
 * Sync FCM token between local storage and backend.
 * Called on app startup and when the token refreshes.
 */
export const handleFCMTokenUpdate = async () => {
    try {
        // Ensure device is registered
        try {
            await registerDeviceForRemoteMessages(getMessaging(getApp()));
        } catch (e) {
            console.warn('Failed to register device for remote messages', e);
        }

        // Get current FCM token
        const currentFCMToken = await getToken(getMessaging(getApp()));
        if (!currentFCMToken) return;

        // Get locally stored user data
        const localUserDataString = storage.getString('user');
        if (!localUserDataString) return;

        let localUserData;
        try {
            localUserData = JSON.parse(localUserDataString);
        } catch (e) {
            console.warn('Failed to parse local user data', e);
            return;
        }

        const localFCMToken = localUserData?.fcmToken;
        const userId = localUserData?.id || localUserData?._id;

        // Update local storage if token changed
        if (localFCMToken !== currentFCMToken) {
            localUserData.fcmToken = currentFCMToken;
            storage.set('user', JSON.stringify(localUserData));
        }

        // Update server if token changed
        if (userId && localFCMToken !== currentFCMToken) {
            fetch(`${BACKEND_URL}/api/users/${userId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fcmToken: currentFCMToken }),
            }).catch(e => console.warn('Failed to sync FCM token to server', e));
        }

        // Subscribe to topic if notifications enabled
        try {
            const notifEnabled = storage.getBoolean('notifEnabled');
            if (notifEnabled) {
                await subscribeToTopic(getMessaging(getApp()), 'all_users');
            }
        } catch (e) {
            // silent
        }
    } catch (error) {
        console.warn('handleFCMTokenUpdate error:', error);
    }
};

function App() {
    // Configure RevenueCat on startup
    console.log("fufiugi")
    useEffect(() => {
        const initPurchases = async () => {
            try {
                Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
                if (Platform.OS === 'ios') {
                    Purchases.configure({ apiKey: Config.RC_IOS_KEY });
                } else if (Platform.OS === 'android') {
                    Purchases.configure({ apiKey: Config.RC_ANDROID_KEY });
                }
            } catch (e) {
                console.warn("Failed to configure Purchases:", e);
            }
        };
        initPurchases();
    }, []);

    // RevenueCat Identity Management & Subscription Sync
    useEffect(() => {
        const identifyPurchasesUser = async () => {
            try {
                const userStr = storage.getString('user');
                if (userStr) {
                    const parsed = JSON.parse(userStr);
                    const uid = parsed?.email || parsed?.id || parsed?._id;

                    if (uid) {
                        try {
                            const { customerInfo } = await Purchases.logIn(String(uid));
                            console.log(customerInfo);
                            
                            
                            // Update the global store directly from RevenueCat customer object
                            useUserStore.getState().setCustomerInfo(customerInfo);
                            
                            // Also update local storage so it persists between reloads
                            const isPremiumRC = typeof customerInfo.entitlements.active['premium'] !== 'undefined';
                            if (parsed.isPremium !== isPremiumRC) {
                                parsed.isPremium = isPremiumRC;
                                storage.set('user', JSON.stringify(parsed));
                            }
                        } catch (e) {
                             console.warn("Purchases login failed:", e);
                        }
                    }
                } else {
                    const isAnonymous = await Purchases.isAnonymous();
                    if (!isAnonymous) {
                        await Purchases.logOut();
                    }
                    useUserStore.getState().setCustomerInfo(null);
                }
            } catch (e) {
                console.warn("Failed to check RevenueCat identity:", e);
            }
        };

        identifyPurchasesUser();

        // Listen for login/logout changes in MMKV
        const listener = storage.addOnValueChangedListener((key) => {
            if (key === 'user') {
                identifyPurchasesUser();
            }
        });
        return () => {
            listener?.remove();
        };
    }, []);

    // FCM Token management - sync on startup
    useEffect(() => {
        const userStr = storage.getString('user');
        if (userStr) {
            handleFCMTokenUpdate();
        }
    }, []);

    // Handle token refresh
    useEffect(() => {
        const userStr = storage.getString('user');
        if (!userStr) return;

        const unsubscribe = onTokenRefresh(getMessaging(getApp()), async (refreshedToken) => {
            try {
                const localUserDataString = storage.getString('user');
                if (localUserDataString) {
                    const localUserData = JSON.parse(localUserDataString);
                    if (localUserData?.fcmToken !== refreshedToken) {
                        localUserData.fcmToken = refreshedToken;
                        storage.set('user', JSON.stringify(localUserData));
                    }
                    const userId = localUserData?.id || localUserData?._id;
                    if (userId) {
                        fetch(`${BACKEND_URL}/api/users/${userId}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fcmToken: refreshedToken }),
                        }).catch(e => console.warn('Error syncing refreshed FCM token', e));
                    }
                }
            } catch (e) {
                console.warn('Error handling token refresh', e);
            }
        });
        return unsubscribe;
    }, []);

    // Notification listeners
    useEffect(() => {
        // Foreground messages
        const unsubscribeMessage = onMessage(getMessaging(getApp()), async remoteMessage => {
            // Messages received while app is open — could show in-app toast
        });

        // Background tap (app was in background)
        const unsubscribeOpenedApp = onNotificationOpenedApp(getMessaging(getApp()), remoteMessage => {
            // Could navigate to specific screen based on remoteMessage.data
        });

        // Quit-state tap (app was closed)
        getInitialNotification(getMessaging(getApp())).then(remoteMessage => {
            if (remoteMessage) {
            }
        });

        return () => {
            unsubscribeMessage();
            unsubscribeOpenedApp();
        };
    }, []);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <QueryClientProvider client={queryClient}>
                <SafeAreaProvider>
                    <AppNavigator />
                </SafeAreaProvider>
            </QueryClientProvider>
        </GestureHandlerRootView>
    );
}

export default App;

