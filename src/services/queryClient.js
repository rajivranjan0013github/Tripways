import { QueryClient } from '@tanstack/react-query';

/**
 * Shared QueryClient instance for the app.
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            retry: 2,
            refetchOnWindowFocus: false, // Not applicable in React Native
        },
    },
});
