/**
 * App Navigator
 * @format
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MMKV } from 'react-native-mmkv';

import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import DetailsScreen from '../screens/DetailsScreen';

const Stack = createNativeStackNavigator();
const storage = new MMKV();

// Check if a user session exists in MMKV
const getInitialRoute = () => {
    try {
        const user = storage.getString('user');
        return user ? 'Home' : 'Onboarding';
    } catch {
        return 'Onboarding';
    }
};

const AppNavigator = () => {
    const initialRoute = getInitialRoute();

    return (
        <NavigationContainer>
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
