import { create } from 'zustand';

export const useUserStore = create((set) => ({
    isPremium: false,
    customerInfo: null,
    
    setCustomerInfo: (info) => {
        const hasPremium = info?.entitlements?.active['premium'] !== undefined;
        set({ 
            customerInfo: info,
            isPremium: hasPremium 
        });
    },

    // Kept for manual overrides if ever needed
    setIsPremium: (status) => set({ isPremium: status }),
}));
