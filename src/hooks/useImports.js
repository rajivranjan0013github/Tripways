import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../services/api';

export const useImportedVideos = (userId) => {
    return useQuery({
        queryKey: ['imports', userId],
        queryFn: async () => {
            const data = await apiGet(`/api/imports/user/${userId}`);
            return {
                imports: data?.imports || [],
                totalImports: data?.totalImports || 0,
            };
        },
        enabled: !!userId,
        refetchOnWindowFocus: true,
    });
};

export const useImportedVideoDetail = (importId) => {
    return useQuery({
        queryKey: ['import', importId],
        queryFn: async () => {
            const data = await apiGet(`/api/imports/${importId}`);
            return data?.import || null;
        },
        enabled: !!importId,
    });
};
