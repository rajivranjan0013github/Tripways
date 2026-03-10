import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../services/api';

/**
 * Fetch user profile data from the backend.
 * Replaces the manual fetch inside ProfileOverlay (L124-131).
 */
export const useUserProfile = (userId) => {
    return useQuery({
        queryKey: ['userProfile', userId],
        queryFn: async () => {
            const data = await apiGet(`/api/users/${userId}`);
            if (data && !data.error) {
                return data;
            }
            return null;
        },
        enabled: !!userId,
    });
};
