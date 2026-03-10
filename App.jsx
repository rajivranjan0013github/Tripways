/**
 * TripWays - Travel Planning App
 * @format
 */

import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './src/services/queryClient';
import AppNavigator from './src/navigation/AppNavigator';

function App() {
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
