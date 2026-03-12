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
                    if (!country || typeof cities !== 'object') return;
                    normalizedGrouped[country] = {};

                    Object.entries(cities || {}).forEach(([city, cityData]) => {
                        if (!city || !cityData) return;
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
                            cityPhoto: cityData.cityPhoto || null,
                        };
                    });
                });

                // Extract placeIds into a Set for quick lookups
                const placeIds = new Set();
                Object.values(normalizedGrouped).forEach(cities => {
                    Object.values(cities || {}).forEach(cityData => {
                        (cityData?.spots || []).forEach(spot => {
                            if (spot?.placeId) placeIds.add(spot.placeId);
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
        onSettled: () => {
            // Immediate invalidation is more reliable than manual cache patching.
            // Since manual save is now synchronous on the backend, this refetch
            // will immediately bring in the 100% accurate enriched data.
            queryClient.invalidateQueries({ queryKey: ['spots', userId] });
        },
    });
};
