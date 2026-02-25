/**
 * App Navigator
 * @format
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import DetailsScreen from '../screens/DetailsScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
    return (
        <NavigationContainer>
            <Stack.Navigator
                initialRouteName="Home"
                screenOptions={{
                    headerShown: false,
                    animation: 'slide_from_right',
                }}>
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
