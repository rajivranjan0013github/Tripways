import { create } from 'zustand';

/**
 * UI Store — manages ephemeral UI state that is shared across components.
 * None of this state persists across app restarts.
 */
export const useUIStore = create((set) => ({
    // Tab navigation
    activeTab: 'home', // 'home' | 'trips'
    setActiveTab: (tab) => set({ activeTab: tab }),

    // Profile overlay
    showProfile: false,
    setShowProfile: (val) => set({ showProfile: val }),
    toggleProfile: () => set((s) => ({ showProfile: !s.showProfile })),

    // Create options menu
    showCreateOptions: false,
    setShowCreateOptions: (val) => set({ showCreateOptions: val }),
    toggleCreateOptions: () => set((s) => ({ showCreateOptions: !s.showCreateOptions })),

    // Edit mode for itinerary
    isEditMode: false,
    setEditMode: (val) => set({ isEditMode: val }),

    // Trip overview sheet tracking
    isTripOverviewOpen: false,
    setTripOverviewOpen: (val) => set({ isTripOverviewOpen: val }),

    // Currently selected itinerary spot (for SpotDetailSheet)
    selectedItinerarySpot: null,
    setSelectedSpot: (spot) => set({ selectedItinerarySpot: spot }),

    // Social mode for video import
    socialMode: null, // null | 'instagram' | 'tiktok'
    setSocialMode: (mode) => set({ socialMode: mode }),

    // Reset store
    resetUI: () => set({
        activeTab: 'home',
        showProfile: false,
        showCreateOptions: false,
        isEditMode: false,
        isTripOverviewOpen: false,
        selectedItinerarySpot: null,
        socialMode: null,
    }),
}));
