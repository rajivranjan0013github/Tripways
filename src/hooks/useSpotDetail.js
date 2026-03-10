import { useQuery } from '@tanstack/react-query';
import Config from 'react-native-config';

const HIDDEN_TYPES = ['point_of_interest', 'establishment', 'political', 'geocode'];

/**
 * Fetch full Google Place details (v1) for a given placeId.
 * Replaces fetchSpotDetail useCallback in HomeScreen (L239-306).
 *
 * Results are cached indefinitely per placeId since place data rarely changes.
 */
export const useSpotDetail = (placeId) => {
    return useQuery({
        queryKey: ['spotDetail', placeId],
        queryFn: async () => {
            const apiKey = Config.GOOGLE_MAPS_API_KEY;
            if (!apiKey) return null;

            const fieldMask = [
                'displayName', 'formattedAddress', 'rating', 'userRatingCount',
                'photos', 'location', 'editorialSummary', 'generativeSummary',
                'types', 'primaryType', 'primaryTypeDisplayName',
                'currentOpeningHours', 'regularOpeningHours',
            ].join(',');

            const url = `https://places.googleapis.com/v1/places/${placeId}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': fieldMask,
                },
            });
            const r = await response.json();

            if (!r.displayName) return null;

            let photoUrl = null;
            if (r.photos && r.photos.length > 0) {
                photoUrl = `https://places.googleapis.com/v1/${r.photos[0].name}/media?maxWidthPx=600&key=${apiKey}`;
            }

            const addressParts = (r.formattedAddress || '').split(', ');
            const country = addressParts.length > 1 ? addressParts[addressParts.length - 1] : 'Unknown';
            const city = addressParts.length > 2 ? addressParts[addressParts.length - 3] || addressParts[0] : addressParts[0] || 'Unknown';

            const readableTypes = (r.types || [])
                .filter((t) => !HIDDEN_TYPES.includes(t))
                .slice(0, 3)
                .map((t) => t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

            const summary = r.generativeSummary?.overview?.text
                || r.editorialSummary?.text
                || null;

            return {
                placeId,
                name: r.displayName?.text || '',
                address: r.formattedAddress || '',
                rating: r.rating || null,
                userRatingCount: r.userRatingCount || 0,
                photoUrl,
                coordinates: {
                    lat: r.location?.latitude || null,
                    lng: r.location?.longitude || null,
                },
                summary,
                types: readableTypes,
                primaryType: r.primaryTypeDisplayName?.text || null,
                openNow: r.currentOpeningHours?.openNow ?? null,
                country,
                city,
            };
        },
        enabled: !!placeId,
        staleTime: Infinity, // Place details rarely change, cache forever
    });
};
