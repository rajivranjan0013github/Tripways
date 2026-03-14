import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../services/api';

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

/**
 * Mutation to update user profile data (e.g. FCM token, settings, profile info).
 */
export const useUpdateUserProfile = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ userId, data }) => {
            const response = await apiPost(`/api/users/${userId}`, data);
            return response;
        },
        onSuccess: (data, variables) => {
            // Invalidate the profile query so any component using it gets the latest data
            if (variables.userId) {
                queryClient.invalidateQueries({ queryKey: ['userProfile', variables.userId] });
            }
        },
    });
};
