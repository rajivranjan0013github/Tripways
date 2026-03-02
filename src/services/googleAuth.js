import { Platform, NativeModules } from 'react-native';

const { GoogleSignInModule } = NativeModules;

async function signIn() {
    if (Platform.OS !== 'ios') return null;
    if (!GoogleSignInModule) {
        throw new Error('GoogleSignInModule not loaded – check iOS target membership and rebuild');
    }
    return GoogleSignInModule.signIn();
}

async function restorePreviousSignIn() {
    if (Platform.OS !== 'ios' || !GoogleSignInModule) return null;
    return GoogleSignInModule.restorePreviousSignIn();
}

async function signOut() {
    if (Platform.OS !== 'ios' || !GoogleSignInModule) return true;
    return GoogleSignInModule.signOut();
}

export default { signIn, restorePreviousSignIn, signOut };
