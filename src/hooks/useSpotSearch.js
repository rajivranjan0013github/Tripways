import { useQuery } from '@tanstack/react-query';
import Config from 'react-native-config';

/**
 * Google Places Autocomplete (v1) hook for spot search on the Home screen.
 * Replaces the manual useEffect with debounce in HomeScreen (L195-236).
 *
 * We set a short staleTime so repeated identical searches hit cache.
 */
export const useSpotSearch = (searchText, socialMode) => {
    const trimmed = (searchText || '').trim();

    return useQuery({
        queryKey: ['spotSearch', trimmed],
        queryFn: async () => {
            const apiKey = Config.GOOGLE_MAPS_API_KEY;
            if (!apiKey) return [];

            const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                },
                body: JSON.stringify({ input: trimmed }),
            });
            const data = await response.json();

            if (data.suggestions && data.suggestions.length > 0) {
                return data.suggestions
                    .filter((s) => s.placePrediction)
                    .map((s) => ({
                        placeId: s.placePrediction.placeId,
                        name: s.placePrediction.structuredFormat?.mainText?.text || s.placePrediction.text?.text || '',
                        secondary: s.placePrediction.structuredFormat?.secondaryText?.text || '',
                    }));
            }
            return [];
        },
        enabled: trimmed.length >= 2 && !socialMode,
        staleTime: 30 * 1000, // Cache search results for 30s
    });
};
