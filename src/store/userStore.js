import { create } from 'zustand';

export const useUserStore = create((set) => ({
    isPremium: false,
    customerInfo: null,
    
    setCustomerInfo: (info) => {
        const hasActiveSubscription = info?.activeSubscriptions?.length > 0;
        const hasActiveEntitlement = Object.keys(info?.entitlements?.active || {}).length > 0;
        const hasPremium = hasActiveSubscription || hasActiveEntitlement;
        
        set({ 
            customerInfo: info,
            isPremium: hasPremium 
        });
    },

    // Kept for manual overrides if ever needed
    setIsPremium: (status) => set({ isPremium: status }),
}));
