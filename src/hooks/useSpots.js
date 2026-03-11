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
                // Normalize spot image fields so UI can always read `photoUrl`.
                const normalizedGrouped = {};

                Object.entries(data.grouped).forEach(([country, cities]) => {
                    normalizedGrouped[country] = {};

                    Object.entries(cities || {}).forEach(([city, cityData]) => {
                        const normalizedSpots = (cityData?.spots || []).map((spot) => {
                            const resolvedPhotoUrl = spot?.photoUrl || spot?.image || null;
                            return {
                                ...spot,
                                photoUrl: resolvedPhotoUrl,
                                image: resolvedPhotoUrl,
                            };
                        });

                        normalizedGrouped[country][city] = {
                            ...cityData,
                            spots: normalizedSpots,
                        };
                    });
                });

                // Extract placeIds into a Set for quick lookups
                const placeIds = new Set();
                Object.values(normalizedGrouped).forEach(cities => {
                    Object.values(cities).forEach(cityData => {
                        (cityData.spots || []).forEach(spot => {
                            if (spot.placeId) placeIds.add(spot.placeId);
                        });
                    });
                });

                return {
                    grouped: normalizedGrouped,
                    totalSpots: data.totalSpots || 0,
                    placeIds,
                };
            }
            return { grouped: {}, totalSpots: 0, placeIds: new Set() };
        },
        enabled: !!userId,
        refetchOnWindowFocus: true,
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
                    image: spot.photoUrl || spot.image || null,
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
                    image: newSpot.photoUrl || newSpot.image || null,
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
            // Delay refetch to avoid overwriting the frontend photo cache patch.
            // The frontend fetches the photo (~2s) and patches the cache directly.
            // The backend enriches + uploads to R2 (~10s) in the background.
            // After 15s, refetch picks up the permanent R2 URL from the server.
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['spots', userId] });
            }, 15000);
        },
    });
};
