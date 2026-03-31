/**
 * In-App Review Manager for TripWays
 * 
 * Handles smart timing of review prompts using native iOS/Android review APIs.
 * Uses MMKV for fast, synchronous persistence of review state.
 * 
 * Trigger points (in priority order):
 * 1. After a trip is created/saved
 * 2. After importing reels/TikToks successfully (share extension save)
 * 3. After the cinematic trip animation completes
 * 
 * Rules:
 * - Never ask before 5 sessions
 * - Never ask before completing at least 1 meaningful action (trip or import)
 * - Never ask more than once every 120 days
 * - Apple limits the native prompt to 3x/year regardless
 */

import InAppReview from 'react-native-in-app-review';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();
const REVIEW_KEY = '@tripways_review_state';

// Minimum thresholds before asking
const MIN_SESSIONS = 5;
const MIN_ACTIONS = 1; // At least 1 trip created OR 1 successful import
const COOLDOWN_DAYS = 120; // Don't re-ask within 120 days

/**
 * Read review state from MMKV (synchronous).
 */
const getReviewState = () => {
    try {
        const raw = storage.getString(REVIEW_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {
        // corrupted state — reset
    }
    return {
        sessionCount: 0,
        actionCount: 0,     // trips created + imports saved
        lastAskedAt: null,   // timestamp
        hasBeenAsked: false,
    };
};

/**
 * Persist review state to MMKV (synchronous).
 */
const saveReviewState = (state) => {
    try {
        storage.set(REVIEW_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn('[ReviewManager] Failed to save state:', e);
    }
};

/**
 * Call on every app open to track session count.
 */
export const trackSession = () => {
    const state = getReviewState();
    state.sessionCount += 1;
    saveReviewState(state);
};

/**
 * Call after a meaningful user action (trip created, import saved).
 * This increments the action counter and then checks if we should ask.
 */
export const trackActionAndMaybeAskReview = () => {
    const state = getReviewState();
    state.actionCount += 1;
    saveReviewState(state);

    // Check after a small delay so the UI can settle first
    setTimeout(() => {
        maybeRequestReview();
    }, 2500);
};

/**
 * Core logic — check all conditions and trigger native review prompt if appropriate.
 */
export const maybeRequestReview = () => {
    try {
        const state = getReviewState();

        // 1. Enough sessions?
        if (state.sessionCount < MIN_SESSIONS) {
            return;
        }

        // 2. Enough meaningful actions?
        if (state.actionCount < MIN_ACTIONS) {
            return;
        }

        // 3. Cooldown check — don't re-ask within COOLDOWN_DAYS
        if (state.lastAskedAt) {
            const daysSince = (Date.now() - state.lastAskedAt) / (1000 * 60 * 60 * 24);
            if (daysSince < COOLDOWN_DAYS) {
                return;
            }
        }

        // 4. Check native API availability
        const isAvailable = InAppReview.isAvailable();
        if (!isAvailable) {
            return;
        }

        // All conditions met — request the review
        InAppReview.RequestInAppReview()
            .then((hasFlowFinishedSuccessfully) => {
                // Note: on iOS, we can never know if the user actually submitted a review.
                // The system controls whether the dialog actually appears.
                state.lastAskedAt = Date.now();
                state.hasBeenAsked = true;
                saveReviewState(state);
            })
            .catch((error) => {
                console.warn('[ReviewManager] Review request failed:', error);
            });
    } catch (error) {
        console.warn('[ReviewManager] Error in maybeRequestReview:', error);
    }
};
