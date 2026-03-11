import { create } from 'zustand';

/**
 * Trip Store — manages the currently active trip data and its mutations.
 * This is NOT for the list of saved trips (that's handled by TanStack Query).
 * This is for the trip that is currently open/being viewed in the TripOverviewSheet.
 */
export const useTripStore = create((set, get) => ({
    // Current trip being viewed
    tripData: null,
    setTripData: (data) => set({ tripData: data }),

    // Whether the currently viewed trip is a template trip (not saved to user's trips)
    isTemplateTripView: false,
    setIsTemplateTripView: (val) => set({ isTemplateTripView: val }),

    // Loading states
    isTripLoading: false,
    setTripLoading: (val) => set({ isTripLoading: val }),

    isSavingTrip: false,
    setIsSavingTrip: (val) => set({ isSavingTrip: val }),

    // --- Itinerary Mutation Actions ---

    /**
     * Reorder spots within a specific day.
     * @param {number} dayNum - The day number to reorder.
     * @param {Array} reorderedSpots - Spots in new order (UI objects with .originalPlace).
     */
    reorderSpots: (dayNum, reorderedSpots) => {
        set((state) => {
            if (!state.tripData?.itinerary) return state;
            const newItinerary = state.tripData.itinerary.map((d) => {
                if (d.day !== dayNum) return d;
                const restoredPlaces = reorderedSpots.map((s) => s.originalPlace);
                return { ...d, places: restoredPlaces };
            });
            return { tripData: { ...state.tripData, itinerary: newItinerary } };
        });
    },

    /**
     * Remove spots from the itinerary.
     * @param {Array} selectedPlaces - Array of original place objects to remove.
     */
    removeSpots: (selectedPlaces) => {
        const placesToRemove = new Set(selectedPlaces);
        set((state) => {
            if (!state.tripData?.itinerary) return state;
            const newItinerary = state.tripData.itinerary.map((dayData) => {
                const filteredPlaces = dayData.places.filter(
                    (place) => !placesToRemove.has(place)
                );
                if (filteredPlaces.length === dayData.places.length) return dayData;
                return { ...dayData, places: filteredPlaces };
            });
            return { tripData: { ...state.tripData, itinerary: newItinerary } };
        });
    },

    /**
     * Move spots from their current day to a target day.
     * @param {Array} selectedPlaces - Array of original place objects to move.
     * @param {number} targetDay - Day number to move the spots to.
     */
    moveSpots: (selectedPlaces, targetDay) => {
        const placesToMove = new Set(selectedPlaces);
        set((state) => {
            if (!state.tripData?.itinerary) return state;
            const movedPlaces = [];
            // First pass: collect places to move and remove from source days
            const newItinerary = state.tripData.itinerary.map((dayData) => {
                const kept = [];
                dayData.places.forEach((place) => {
                    if (placesToMove.has(place)) {
                        movedPlaces.push(place);
                    } else {
                        kept.push(place);
                    }
                });
                return { ...dayData, places: kept };
            });
            // Second pass: append to target day
            const finalItinerary = newItinerary.map((dayData) => {
                if (dayData.day === targetDay) {
                    return { ...dayData, places: [...dayData.places, ...movedPlaces] };
                }
                return dayData;
            });
            return { tripData: { ...state.tripData, itinerary: finalItinerary } };
        });
    },

    /**
     * Clear the current trip (e.g. when closing the overview sheet).
     */
    clearTrip: () => set({ tripData: null, isTripLoading: false, isSavingTrip: false, isTemplateTripView: false }),
}));
