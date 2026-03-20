import { create } from 'zustand';
import { NativeModules, Platform } from 'react-native';

const { ShareIntentModule } = NativeModules;

export const useUserStore = create((set) => ({
    isPremium: false,
    customerInfo: null,
    
    setCustomerInfo: (info) => {
        const hasActiveSubscription = info?.activeSubscriptions?.length > 0;
        const hasActiveEntitlement = Object.keys(info?.entitlements?.active || {}).length > 0;
        const hasPremium = hasActiveSubscription || hasActiveEntitlement;
        
        // Sync premium status to iOS App Group for the Share Extension
        if (Platform.OS === 'ios' && ShareIntentModule?.setPremiumStatus) {
            ShareIntentModule.setPremiumStatus(hasPremium).catch(() => {});
        }

        set({ 
            customerInfo: info,
            isPremium: hasPremium 
        });
    },

    // Kept for manual overrides if ever needed
    setIsPremium: (status) => {
        // Also sync to iOS App Group
        if (Platform.OS === 'ios' && ShareIntentModule?.setPremiumStatus) {
            ShareIntentModule.setPremiumStatus(status).catch(() => {});
        }
        set({ isPremium: status });
    },
}));
