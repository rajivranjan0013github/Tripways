import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../services/api';

/**
 * Fetch template trips (curated travel guides).
 * These are public — no userId needed.
 */
export const useTemplateTrips = () => {
    return useQuery({
        queryKey: ['templateTrips'],
        queryFn: async () => {
            const data = await apiGet('/api/template-trips');
            return data?.success && data?.trips ? data.trips : [];
        },
        staleTime: 10 * 60 * 1000, // 10 minutes — template trips rarely change
    });
};
