import { NativeModules, Platform, AppState, Linking } from 'react-native';

const { ShareIntentModule } = NativeModules;

/**
 * Check for a shared URL string that was sent via Android Intent or iOS Share Extension.
 */
export async function getSharedUrl() {
    if (!ShareIntentModule) return null;

    try {
        const url = await ShareIntentModule.getSharedUrl();
        if (url) {
            // Once we read it, tell the native module to clear it so we don't process it twice
            await ShareIntentModule.clearSharedUrl();
            return url;
        }
        return null;
    } catch (e) {
        console.warn('Failed to get shared URL:', e);
        return null;
    }
}

/**
 * Save user session data to the App Group for the Share Extension.
 */
export async function setAppGroupData(userId, backendUrl) {
    if (!ShareIntentModule) {
        console.error('ShareIntentModule is undefined. Native module not linked.');
        return false;
    }

    if (!ShareIntentModule.setAppGroupData) {
        console.error('ShareIntentModule.setAppGroupData is not a function. Check native module exports.');
        return false;
    }

    try {
        console.log(`ShareIntent: Saving App Group Data -> userId: ${userId}, backendUrl: ${backendUrl}`);
        const success = await ShareIntentModule.setAppGroupData(userId, backendUrl);
        console.log('ShareIntent: setAppGroupData returned:', success);
        return success;
    } catch (e) {
        console.error('ShareIntent: Failed to set app group data:', e);
        return false;
    }
}

/**
 * Listen for share intents when app comes to foreground.
 */
export function onShareIntent(callback) {
    const unsubscribers = [];

    // On both platforms, check for shared URL when app becomes active
    const appStateListener = AppState.addEventListener('change', async (state) => {
        console.log(`ShareIntent: AppState changed to ${state}`);
        if (state === 'active') {
            console.log('ShareIntent: App is active, checking for shared URL...');
            const url = await getSharedUrl();
            console.log('ShareIntent: getSharedUrl returned', url);
            if (url) {
                console.log('ShareIntent: Firing callback with', url);
                callback(url);
            }
        }
    });
    unsubscribers.push(() => appStateListener.remove());

    // Also listen for URL scheme events just in case
    const linkingListener = Linking.addEventListener('url', (event) => {
        console.log('ShareIntent: Linking event received', event.url);
        const sharedUrl = parseShareSchemeUrl(event.url);
        if (sharedUrl) {
            callback(sharedUrl);
        }
    });
    unsubscribers.push(() => linkingListener.remove());

    return () => unsubscribers.forEach(fn => fn());
}

/**
 * Extracts the 'sharedUrl' or 'url' query param from a tripways:// deep link
 */
export function parseShareSchemeUrl(deepLinkUrl) {
    if (!deepLinkUrl) return null;
    try {
        // e.g., tripways://share?sharedUrl=https... or tripways://share?url=https...
        const urlObj = new URL(deepLinkUrl);
        return urlObj.searchParams.get('sharedUrl') || urlObj.searchParams.get('url');
    } catch {
        return null;
    }
}

/**
 * Identify exactly what platform / content type a URL is from to route it properly
 */
export function detectPlatformFromUrl(url) {
    if (!url) return null;

    const lower = url.toLowerCase();

    if (lower.includes('instagram.com') || lower.includes('instagr.am')) {
        return 'instagram';
    }

    if (lower.includes('tiktok.com') || lower.includes('vm.tiktok.com')) {
        return 'tiktok';
    }

    return null;
}
