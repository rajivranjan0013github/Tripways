import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../services/api';

/**
 * Fetch saved spots for a user (grouped by country → city).
 * Replaces the manual fetchSpots useCallback + useEffect in HomeScreen.
 */
export const useSavedSpots = (userId) => {
    return useQuery({
        queryKey: ['spots', userId],
        queryFn: async () => {
            const data = await apiGet(`/api/spots/user/${userId}`);
            if (data?.success && data?.grouped) {
                // Extract placeIds into a Set for quick lookups
                const placeIds = new Set();
                Object.values(data.grouped).forEach(cities => {
                    Object.values(cities).forEach(cityData => {
                        (cityData.spots || []).forEach(spot => {
                            if (spot.placeId) placeIds.add(spot.placeId);
                        });
                    });
                });

                return {
                    grouped: data.grouped,
                    totalSpots: data.totalSpots || 0,
                    placeIds,
                };
            }
            return { grouped: {}, totalSpots: 0, placeIds: new Set() };
        },
        enabled: !!userId,
    });
};

/**
 * Mutation to save a spot to the bucket list.
 * Replaces the saveSpotToBucketList useCallback in HomeScreen.
 * On success, it invalidates the spots query to trigger a refetch.
 */
export const useSaveSpot = (userId) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (spot) => {
            const data = await apiPost('/api/spots', {
                userId,
                spots: [{
                    country: spot.country || 'Unknown',
                    city: spot.city || 'Unknown',
                    name: spot.name,
                    placeId: spot.placeId,
                    address: spot.address || '',
                    rating: spot.rating || null,
                    userRatingCount: spot.userRatingCount || 0,
                    photoUrl: spot.photoUrl || null,
                    coordinates: spot.coordinates || { lat: null, lng: null },
                    source: 'manual',
                }],
            });
            return data;
        },
        onMutate: async (newSpot) => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: ['spots', userId] });

            // Snapshot the previous value
            const previousData = queryClient.getQueryData(['spots', userId]);

            // Optimistically update to the new value
            if (previousData) {
                const country = newSpot.country || 'Unknown';
                const city = newSpot.city || 'Unknown';

                // Deep clone grouped data
                const newGrouped = JSON.parse(JSON.stringify(previousData.grouped || {}));
                if (!newGrouped[country]) newGrouped[country] = {};
                if (!newGrouped[country][city]) newGrouped[country][city] = { spots: [], cityPhoto: null };

                // Add the new spot to the list
                newGrouped[country][city].spots.push({
                    ...newSpot,
                    _id: `temp-${Date.now()}`, // Temporary ID
                    userId,
                    country,
                    city,
                });

                // Update placeIds set
                const newPlaceIds = new Set(previousData.placeIds);
                if (newSpot.placeId) newPlaceIds.add(newSpot.placeId);

                queryClient.setQueryData(['spots', userId], {
                    ...previousData,
                    grouped: newGrouped,
                    totalSpots: (previousData.totalSpots || 0) + 1,
                    placeIds: newPlaceIds,
                });
            }

            return { previousData };
        },
        onError: (err, newSpot, context) => {
            // Roll back to the previous value if mutation fails
            if (context?.previousData) {
                queryClient.setQueryData(['spots', userId], context.previousData);
            }
        },
        onSettled: () => {
            // Always refetch after error or success to sync with server
            queryClient.invalidateQueries({ queryKey: ['spots', userId] });
        },
    });
};

