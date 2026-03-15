/**
 * App Navigator
 * @format
 */

import React, { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RNBootSplash from 'react-native-bootsplash';
import { MMKV } from 'react-native-mmkv';

import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import DetailsScreen from '../screens/DetailsScreen';
import NotificationPermissionScreen from '../screens/NotificationPermissionScreen';
import { getSharedUrl, onShareIntent, detectPlatformFromUrl } from '../services/ShareIntent';

const Stack = createNativeStackNavigator();
const storage = new MMKV();

// Check if a user session exists in MMKV
const getInitialRoute = () => {
    try {
        const user = storage.getString('user');
        if (!user) return 'Onboarding';
        if (!storage.getBoolean('notifDecided')) return 'NotificationPermission';
        return 'Home';
    } catch {
        return 'Onboarding';
    }
};

// Deep linking config — tells React Navigation how to handle tripways:// URLs
// Deep linking config — tells React Navigation how to handle tripways:// URLs
const linking = {
    prefixes: ['tripways://'],
    config: {
        screens: {
            Home: {
                path: 'share',
                parse: {
                    sharedUrl: (url) => decodeURIComponent(url),
                },
            },
        },
    },
    // Custom getInitialURL to check for shared URLs from both platforms
    async getInitialURL() {
        // Check native share intent first (Android Intent / iOS App Group)
        const sharedUrl = await getSharedUrl();
        if (sharedUrl) {
            const deepLink = `tripways://share?sharedUrl=${encodeURIComponent(sharedUrl)}`;
            return deepLink;
        }
        // Then check normal deep link
        const url = await Linking.getInitialURL();
        return url;
    },
    // Subscribe to incoming URLs (iOS URL scheme + Android Linking)
    subscribe(listener) {
        // Listen for tripways:// links from iOS Share Extension
        const linkingSub = Linking.addEventListener('url', ({ url }) => {
            listener(url);
        });

        // Listen for share intents (Android foreground & App Group check on active)
        const shareUnsub = onShareIntent((sharedUrl) => {
            // Convert to a deep link URL so React Navigation can parse it
            const deepLink = `tripways://share?sharedUrl=${encodeURIComponent(sharedUrl)}`;
            listener(deepLink);
        });

        return () => {
            linkingSub.remove();
            shareUnsub();
        };
    },
};

const AppNavigator = () => {
    const [initialRoute, setInitialRoute] = useState('Onboarding');
    const [isReady, setIsReady] = useState(false);

    // Initial setup
    useEffect(() => {
        setInitialRoute(getInitialRoute());
        setIsReady(true);
    }, []);

    if (!isReady) return null;

    return (
        <NavigationContainer
            linking={linking}
            onReady={() => {
                // Hide native splash once navigation tree is ready
                try {
                    RNBootSplash.hide({ fade: true });
                } catch { }
            }}
        >
            <Stack.Navigator
                initialRouteName={initialRoute}
                screenOptions={{
                    headerShown: false,
                    animation: 'slide_from_right',
                }}>
                <Stack.Screen
                    name="Onboarding"
                    component={OnboardingScreen}
                    options={{
                        contentStyle: { backgroundColor: '#f6f7f8' },
                    }}
                />
                <Stack.Screen
                    name="Home"
                    component={HomeScreen}
                    options={{
                        contentStyle: { backgroundColor: '#1a1a2e' },
                    }}
                />
                <Stack.Screen
                    name="Login"
                    component={LoginScreen}
                    options={{
                        contentStyle: { backgroundColor: '#7DD3FC' },
                    }}
                />

                <Stack.Screen
                    name="NotificationPermission"
                    component={NotificationPermissionScreen}
                    options={{
                        contentStyle: { backgroundColor: '#F0F9FF' },
                    }}
                />

                <Stack.Screen
                    name="Details"
                    component={DetailsScreen}
                    options={{
                        contentStyle: { backgroundColor: '#1a1a2e' },
                    }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
