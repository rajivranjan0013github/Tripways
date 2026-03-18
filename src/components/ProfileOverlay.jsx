/**
 * ProfileOverlay - Full screen profile overlay
 * @format
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Image,
    Platform,
    Linking,
    Alert,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { MMKV } from 'react-native-mmkv';
import Config from 'react-native-config';

import { useUserProfile } from '../hooks/useUserProfile';
import { queryClient } from '../services/queryClient';
import { useTripStore } from '../store/tripStore';
import { useUIStore } from '../store/uiStore';
import { setAppGroupData } from '../services/ShareIntent';
import { useSavedTrips } from '../hooks/useTrips';
import { useSavedSpots } from '../hooks/useSpots';
import { useUserStore } from '../store/userStore';
import PremiumOverlay from './PremiumOverlay';

const storage = new MMKV();
const BACKEND_URL = Config.BACKEND_URL || 'http://localhost:3000';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MENU_ITEMS = [
    {
        icon: 'bookmark',
        label: 'Saved Spots',
        subtitle: '12 spots saved',
        color: '#3B82F6',
        bg: '#EFF6FF',
    },
    {
        icon: 'map',
        label: 'My Trips',
        subtitle: '4 trips planned',
        color: '#10B981',
        bg: '#ECFDF5',
    },
    {
        icon: 'help',
        label: 'Help & Support',
        subtitle: 'FAQs, contact us',
        color: '#8B5CF6',
        bg: '#F5F3FF',
    },
];

const renderIcon = (icon, color) => {
    switch (icon) {
        case 'bookmark':
            return (
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                </Svg>
            );
        case 'map':
            return (
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" />
                    <Path d="M15 5.764v15" />
                    <Path d="M9 3.236v15" />
                </Svg>
            );
        case 'star':
            return (
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a.53.53 0 0 0 .4.29l5.16.756a.53.53 0 0 1 .294.904l-3.733 3.638a.53.53 0 0 0-.152.469l.882 5.14a.53.53 0 0 1-.77.56l-4.614-2.426a.53.53 0 0 0-.494 0L6.14 18.73a.53.53 0 0 1-.77-.56l.882-5.14a.53.53 0 0 0-.152-.469L2.367 8.924a.53.53 0 0 1 .294-.904l5.16-.756a.53.53 0 0 0 .4-.29z" />
                </Svg>
            );
        case 'settings':
            return (
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <Circle cx="12" cy="12" r="3" />
                </Svg>
            );
        case 'help':
            return (
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <Circle cx="12" cy="12" r="10" />
                    <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <Path d="M12 17h.01" />
                </Svg>
            );
        case 'crown':
            return (
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
                </Svg>
            );
        default:
            return null;
    }
};

const ProfileOverlay = ({ visible, onClose, navigation, bottomSheetRef }) => {
    const insets = useSafeAreaInsets();
    const [showContent, setShowContent] = React.useState(false);
    const [userData, setUserData] = React.useState(null);
    const [premiumVisible, setPremiumVisible] = React.useState(false);
    const isPremium = useUserStore(state => state.isPremium);
    const customerInfo = useUserStore(state => state.customerInfo);
    const setActiveTab = useUIStore(state => state.setActiveTab);
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(30);

    // Format premium details
    const activeEntitlements = customerInfo?.entitlements?.active || {};
    const premiumEntitlement = activeEntitlements[Object.keys(activeEntitlements)[0]];
    const expiryDate = premiumEntitlement?.expirationDate;
    const formattedDate = expiryDate ? new Date(expiryDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }) : null;
    const isWillRenew = premiumEntitlement?.willRenew;

    // Load user data from MMKV
    React.useEffect(() => {
        if (visible) {
            try {
                const userStr = storage.getString('user');
                if (userStr) {
                    setUserData(JSON.parse(userStr));
                }
            } catch (e) {
                console.warn('Failed to load user data:', e);
            }
        }
    }, [visible]);

    // Fetch user profile from backend via TanStack Query
    const userId = userData?.id || userData?._id;
    const { data: userProfileData } = useUserProfile(userId);
    
    // Fetch actual counts for spots and trips
    const { data: spotsData } = useSavedSpots(userId);
    const { data: tripsData } = useSavedTrips(userId);

    const spotsCount = spotsData?.totalSpots || 0;
    const tripsCount = tripsData?.length || 0;

    React.useEffect(() => {
        if (visible) {
            setShowContent(true);
            // Small delay to let the mount happen before animating
            requestAnimationFrame(() => {
                opacity.value = withTiming(1, { duration: 250 });
                translateY.value = withTiming(0, { duration: 250 });
            });
        } else {
            opacity.value = withTiming(0, { duration: 200 });
            translateY.value = withTiming(30, { duration: 200 });
            // Unmount content after animation finishes
            const timer = setTimeout(() => setShowContent(false), 220);
            return () => clearTimeout(timer);
        }
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));

    const handleLogout = () => {
        Alert.alert(
            'Log Out',
            'Are you sure you want to log out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: () => {
                        try {
                            // 1. Clear local session storage
                            storage.delete('user');
                            storage.delete('isNewUser');

                            // 2. Clear React Query cache (Saved Places, Trips, Profile)
                            queryClient.clear();

                            // 3. Reset Zustand stores
                            useTripStore.getState().clearTrip();
                            useUIStore.getState().resetUI();

                            // 4. Clear App Group context for Share Extension
                            if (Platform.OS === 'ios') {
                                setAppGroupData('', '');
                            }
                        } catch (e) {
                            console.warn('Failed to clear state on logout:', e);
                        }

                        onClose();
                        if (navigation) {
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Login' }],
                            });
                        }
                    },
                },
            ]
        );
    };

    const handleDeleteAccount = async () => {
        Alert.alert(
            'Delete Account',
            'This action is permanent and will delete all your data. Are you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const userId = userData?.id || userData?._id;
                        if (!userId) return;

                        try {
                            await fetch(`${BACKEND_URL}/api/users/${userId}`, {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                            });
                        } catch (e) {
                            console.warn('Failed to delete account on server:', e);
                        }
                        
                        // Perform local logout logic after deletion
                        try {
                            storage.delete('user');
                            storage.delete('isNewUser');
                            queryClient.clear();
                            useTripStore.getState().clearTrip();
                            useUIStore.getState().resetUI();
                            if (Platform.OS === 'ios') setAppGroupData('', '');
                        } catch (e) {}

                        onClose();
                        if (navigation) {
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Login' }],
                            });
                        }
                    },
                },
            ]
        );
    };

    // Get user initials for avatar
    const getInitials = (name) => {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const userName = userData?.name || 'User';
    const userEmail = userData?.email || '';
    const userInitials = getInitials(userName);

    if (!showContent) return null;

    return (
        <Animated.View
            style={[styles.overlay, { paddingTop: insets.top }, animatedStyle]}
            pointerEvents={visible ? 'auto' : 'none'}
        >
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Profile Card */}
                <View style={styles.profileCard}>
                    {/* Close button */}
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M18 6 6 18M6 6l12 12" />
                        </Svg>
                    </TouchableOpacity>

                    {userData?.picture ? (
                        <Image source={{ uri: userData.picture }} style={styles.avatarImage} />
                    ) : (
                        <View style={styles.avatarLarge}>
                            <Text style={styles.avatarLargeText}>{userInitials}</Text>
                        </View>
                    )}
                    <View style={styles.nameRow}>
                        <Text style={styles.profileName}>{userName}</Text>
                        {isPremium && (
                            <View style={styles.proBadge}>
                                <Text style={styles.proBadgeText}>PRO</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.profileEmail}>{userEmail}</Text>
                </View>

                {/* Premium Card Entry */}
                <TouchableOpacity 
                    activeOpacity={0.9} 
                    style={styles.premiumCardContainer}
                    onPress={() => setPremiumVisible(true)}
                >
                    <View style={[
                        styles.premiumCard, 
                        isPremium ? styles.premiumCardActive : styles.premiumCardUpgrade
                    ]}>
                        <View style={styles.premiumCardContent}>
                            <View style={styles.premiumIconBadge}>
                                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <Path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
                                </Svg>
                            </View>
                            <View style={styles.premiumTextContainer}>
                                <Text style={styles.premiumTitle}>
                                    {isPremium ? 'Where Premium Active' : 'Upgrade to Premium'}
                                </Text>
                                <Text style={styles.premiumSubtitle}>
                                    {isPremium 
                                        ? (formattedDate 
                                            ? `${isWillRenew ? 'Renews' : 'Expires'} on ${formattedDate}`
                                            : 'Enjoy all exclusive features')
                                        : 'Unlock unlimited trips & smart features'}
                                </Text>
                            </View>
                            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <Path d="m9 18 6-6-6-6" />
                            </Svg>
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Menu Items */}
                <View style={styles.menuSection}>
                    {MENU_ITEMS.map((item, index) => {
                        // Dynamically update subtitles for Spots and Trips
                        let displaySubtitle = item.subtitle;
                        if (item.label === 'Saved Spots') {
                            displaySubtitle = `${spotsCount} spots saved`;
                        } else if (item.label === 'My Trips') {
                            displaySubtitle = `${tripsCount} trips planned`;
                        }

                        return (
                            <TouchableOpacity
                                key={index}
                                style={styles.menuItem}
                                activeOpacity={0.7}
                                onPress={() => {
                                    if (item.action === 'OPEN_PREMIUM') {
                                        setPremiumVisible(true);
                                    } else if (item.label === 'Saved Spots') {
                                        setActiveTab('home');
                                        onClose();
                                        setTimeout(() => {
                                            bottomSheetRef?.current?.snapToIndex(2);
                                        }, 300);
                                    } else if (item.label === 'My Trips') {
                                        setActiveTab('trips');
                                        onClose();
                                        setTimeout(() => {
                                            bottomSheetRef?.current?.snapToIndex(2);
                                        }, 300);
                                    }
                                }}
                            >
                                <View style={[styles.menuIcon, { backgroundColor: item.bg }]}>
                                    {renderIcon(item.icon, item.color)}
                                </View>
                                <View style={styles.menuContent}>
                                    <Text style={styles.menuLabel}>{item.label}</Text>
                                    <Text style={styles.menuSubtitle}>{displaySubtitle}</Text>
                                </View>
                                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <Path d="m9 18 6-6-6-6" />
                                </Svg>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Logout Button */}
                <TouchableOpacity style={styles.logoutButton} activeOpacity={0.7} onPress={handleLogout}>
                    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <Path d="m16 17 5-5-5-5" />
                        <Path d="M21 12H9" />
                    </Svg>
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>

                {/* Privacy & Terms */}
                <View style={styles.legalRow}>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => Linking.openURL('https://rajivranjan0013github.github.io/tripways-privacy/privacy-policy.html')}>
                        <Text style={styles.legalText}>Privacy Policy</Text>
                    </TouchableOpacity>
                    <View style={styles.legalDot} />
                    <TouchableOpacity activeOpacity={0.7} onPress={() => Linking.openURL('https://rajivranjan0013github.github.io/tripways-privacy/terms-service.html')}>
                        <Text style={styles.legalText}>Terms of Service</Text>
                    </TouchableOpacity>
                </View>

                {/* Delete Account */}
                <TouchableOpacity style={styles.deleteAccountButton} activeOpacity={0.7} onPress={handleDeleteAccount}>
                    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M3 6h18" />
                        <Path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <Path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </Svg>
                    <Text style={styles.deleteAccountText}>Delete Account</Text>
                </TouchableOpacity>

                {/* App version */}
                <Text style={styles.versionText}>Where v1.0.0</Text>
            </ScrollView>

            <PremiumOverlay visible={premiumVisible} onClose={() => setPremiumVisible(false)} />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#F8FAFC',
        zIndex: 100,
    },
    scrollContent: {
        paddingBottom: 100,
    },

    // Close button (inside profile card)
    closeButton: {
        position: 'absolute',
        top: 14,
        right: 14,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },

    // Profile Card
    profileCard: {
        alignItems: 'center',
        marginHorizontal: 20,
        paddingVertical: 20,
        paddingHorizontal: 24,
        marginTop: 8,
    },
    avatarLarge: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    avatarImage: {
        width: 72,
        height: 72,
        borderRadius: 36,
        marginBottom: 12,
    },
    avatarLargeText: {
        fontSize: 28,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    profileName: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 2,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    proBadge: {
        backgroundColor: '#F59E0B', // Amber/Gold color
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    proBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '900',
    },
    profileEmail: {
        fontSize: 13,
        color: '#94A3B8',
        fontWeight: '500',
        marginBottom: 14,
    },
    editProfileText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#3B82F6',
    },

    // Premium Card
    premiumCardContainer: {
        marginHorizontal: 20,
        marginTop: 4,
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
    },
    premiumCard: {
        paddingVertical: 18,
        paddingHorizontal: 20,
    },
    premiumCardUpgrade: {
        backgroundColor: '#00C3F9',
    },
    premiumCardActive: {
        backgroundColor: '#0F172A',
    },
    premiumCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    premiumIconBadge: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    premiumTextContainer: {
        flex: 1,
        marginLeft: 14,
    },
    premiumTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    premiumSubtitle: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.8)',
    },

    // Menu
    menuSection: {
        marginHorizontal: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        marginTop: 14,
        padding: 6,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    menuIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuContent: {
        flex: 1,
        marginLeft: 14,
    },
    menuLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 1,
    },
    menuSubtitle: {
        fontSize: 12,
        fontWeight: '500',
        color: '#94A3B8',
    },

    // Logout
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginHorizontal: 20,
        marginTop: 20,
        backgroundColor: '#FEF2F2',
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    logoutText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#EF4444',
    },

    // Version
    versionText: {
        textAlign: 'center',
        fontSize: 12,
        color: '#CBD5E1',
        marginTop: 16,
        fontWeight: '500',
    },

    // Legal links
    legalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 18,
        gap: 8,
    },
    legalText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
        textDecorationLine: 'underline',
    },
    legalDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#CBD5E1',
    },

    // Delete Account
    deleteAccountButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginHorizontal: 20,
        marginTop: 14,
        paddingVertical: 12,
    },
    deleteAccountText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#94A3B8',
    },
});

export default ProfileOverlay;
