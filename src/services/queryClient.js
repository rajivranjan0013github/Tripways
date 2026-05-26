import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

/**
 * Wire up React Native's AppState to TanStack Query's focusManager.
 * This makes `refetchOnWindowFocus: true` work on mobile — queries that
 * opt-in will automatically refetch when the app comes to the foreground.
 */
function onAppStateChange(status) {
    if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
    }
}
AppState.addEventListener('change', onAppStateChange);

/**
 * Shared QueryClient instance for the app.
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            retry: 2,
            refetchOnWindowFocus: false, // Opt-in per query (e.g. useSpots)
        },
    },
});
