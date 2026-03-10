import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../services/api';

/**
 * Fetch saved trips for a user.
 * Replaces the manual fetchTrips useCallback + useEffect in HomeScreen.
 */
export const useSavedTrips = (userId) => {
    return useQuery({
        queryKey: ['trips', userId],
        queryFn: async () => {
            const data = await apiGet(`/api/trips/user/${userId}`);
            return data?.success && data?.trips ? data.trips : [];
        },
        enabled: !!userId,
    });
};
