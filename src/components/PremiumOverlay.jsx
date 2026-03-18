import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    ActivityIndicator,
    Alert,
    Platform,
    Image,
    Linking
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Polyline, Circle } from 'react-native-svg';
import Purchases from 'react-native-purchases';
import { useUserStore } from '../store/userStore';
import { MMKV } from 'react-native-mmkv';
import LinearGradient from 'react-native-linear-gradient';

const storage = new MMKV();
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const PremiumOverlay = ({ visible, onClose }) => {
    const insets = useSafeAreaInsets();
    const [showContent, setShowContent] = useState(false);
    const [packages, setPackages] = useState([]);
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [loading, setLoading] = useState(false);

    const opacity = useSharedValue(0);
    const translateY = useSharedValue(SCREEN_HEIGHT);

    // Get premium status natively from RevenueCat store
    const isPremium = useUserStore(state => state.isPremium);
    const setCustomerInfo = useUserStore(state => state.setCustomerInfo);

    useEffect(() => {
        if (visible) {
            setShowContent(true);
            requestAnimationFrame(() => {
                opacity.value = withTiming(1, { duration: 300 });
                translateY.value = withTiming(0, { duration: 400 });
            });
            fetchOfferings();
        } else {
            opacity.value = withTiming(0, { duration: 250 });
            translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
            const timer = setTimeout(() => setShowContent(false), 300);
            return () => clearTimeout(timer);
        }
    }, [visible]);

    const fetchOfferings = async () => {
        try {
            setLoading(true);
            const offer = await Purchases.getOfferings();
            if (offer.current !== null && offer.current.availablePackages.length !== 0) {
                setPackages(offer.current.availablePackages);

                // Select default package
                if (offer.current.annual) {
                    setSelectedPackage(offer.current.annual);
                } else if (offer.current.monthly) {
                    setSelectedPackage(offer.current.monthly);
                } else {
                    setSelectedPackage(offer.current.availablePackages[0]);
                }
            }
        } catch (e) {
            console.warn("Error fetching offerings", e);
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async () => {
        if (!selectedPackage) return;

        try {
            setLoading(true);
            const { customerInfo } = await Purchases.purchasePackage(selectedPackage);

            // Natively grant premium so the UI unlocks without relying on hooks
            setCustomerInfo(customerInfo);

            Alert.alert("Success", "Welcome to Where Premium!");
            onClose();
        } catch (e) {
            if (!e.userCancelled) {
                Alert.alert("Purchase failed", e.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async () => {
        try {
            setLoading(true);
            const customerInfo = await Purchases.restorePurchases();

            if (Object.keys(customerInfo.entitlements.active).length > 0) {
                Alert.alert("Success", "Purchases restored successfully!");
                setCustomerInfo(customerInfo);
                onClose();
            } else {
                Alert.alert("No active subscriptons", "We couldn't find any active subscriptions for your account.");
            }
        } catch (e) {
            Alert.alert("Error", e.message);
        } finally {
            setLoading(false);
        }
    };

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));

    if (!showContent) return null;

    const CheckboxIcon = ({ checked }) => (
        <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
            {checked && (
                <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <Polyline points="20 6 9 17 4 12" />
                </Svg>
            )}
        </View>
    );

    return (
        <Animated.View
            style={[styles.overlay, animatedStyle]}
            pointerEvents={visible ? 'auto' : 'none'}
        >
            <Image
                source={{ uri: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=1000&auto=format&fit=crop' }}
                style={styles.bgImage}
                resizeMode="cover"
            />
            {/* Smooth linear gradient covering from middle to bottom */}
            <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0.95)', '#ffffff', '#ffffff']}
                locations={[0, 0.45, 0.65, 0.8, 1]}
                style={StyleSheet.absoluteFillObject}
            />

            <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 20) + 20 }]}>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M18 6 6 18M6 6l12 12" />
                    </Svg>
                </TouchableOpacity>
            </View>

            <View
                style={[styles.mainContent, { paddingTop: Math.max(insets.top, 20) }]}
            >
                {/* Flexible spacer to push content down into the white area */}
                <View style={styles.flexSpacer} />

                <View style={styles.bottomContent}>
                    <Text style={styles.mainTitle}>Unlimited Access</Text>
                    <Text style={styles.subTitle}>Access the most advanced AI trip planner assistant</Text>

                    {/* Features List */}
                    <View style={styles.featuresList}>
                        {[
                            'Unlimited Spots Import',
                            'Optimize Your Itinerary Routes',
                            'Unlimited AI Trip Generations',
                        ].map((feature, i) => (
                            <View key={i} style={styles.featureItem}>
                                <CheckboxIcon checked={true} />
                                <Text style={styles.featureText}>{feature}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Package Cards */}
                    {isPremium ? (
                        <View style={styles.premiumActiveContainer}>
                            <Text style={styles.premiumActiveText}>You are a Premium member!</Text>
                            <Text style={styles.premiumActiveSub}>Enjoy your unlocked features.</Text>
                        </View>
                    ) : (
                        <>
                            {loading && !packages.length ? (
                                <ActivityIndicator size="large" color="#00C3F9" style={{ marginVertical: 40 }} />
                            ) : (
                                <View style={styles.cardsRow}>
                                    {[...packages].sort((a, b) => {
                                        if (a.packageType === 'ANNUAL') return 1;
                                        if (b.packageType === 'ANNUAL') return -1;
                                        return 0;
                                    }).map((pkg, index) => {
                                        const isSelected = selectedPackage?.identifier === pkg.identifier;
                                        const title = pkg.product.title.split(' (')[0];

                                        const isAnnual = pkg.packageType === 'ANNUAL';

                                        return (
                                            <TouchableOpacity
                                                key={pkg.identifier}
                                                style={[styles.packageCard, isSelected && styles.packageCardSelected]}
                                                activeOpacity={0.9}
                                                onPress={() => setSelectedPackage(pkg)}
                                            >
                                                {isAnnual && (
                                                    <View style={styles.bestValueBadge}>
                                                        <Text style={styles.bestValueText}>BEST VALUE</Text>
                                                    </View>
                                                )}

                                                <View style={styles.packageCardInnerHorizontal}>
                                                    <View style={[styles.radioOutline, isSelected && styles.radioOutlineSelected]}>
                                                        {isSelected && <View style={styles.radioInner} />}
                                                    </View>

                                                    <View style={styles.packageCardTextMain}>
                                                        <Text style={styles.packageCardTitle}>{title}</Text>
                                                        <Text style={styles.packageCardDesc} numberOfLines={2}>
                                                            {pkg.product.description}
                                                        </Text>
                                                        {isAnnual && (
                                                            <Text style={styles.monthlyBreakdown}>
                                                                Only {pkg.product.currencyCode}{(pkg.product.price / 12).toFixed(2)} / month
                                                            </Text>
                                                        )}
                                                    </View>

                                                    <View style={styles.packageCardPriceContainer}>
                                                        <Text style={styles.packageCardPrice}>{pkg.product.priceString}</Text>
                                                        <Text style={styles.packageCardPeriod}>
                                                            Per {isAnnual ? 'year' : pkg.packageType === 'MONTHLY' ? 'month' : 'week'}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}

                            <TouchableOpacity
                                style={[styles.unlockBtn, (!selectedPackage || loading) && styles.disabledBtn]}
                                onPress={handlePurchase}
                                disabled={!selectedPackage || loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#000000" />
                                ) : (
                                    <View style={styles.unlockBtnInner}>
                                        <Text style={styles.unlockBtnText}>Unlock Access</Text>
                                        <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 6, marginTop: 1 }}>
                                            <Polyline points="9 18 15 12 9 6" />
                                        </Svg>
                                    </View>
                                )}
                            </TouchableOpacity>
                            <Text style={styles.cancelAnytimeText}>Cancel anytime</Text>
                        </>
                    )}

                    {/* Footer Links */}
                    <View style={styles.footerLinks}>
                        <TouchableOpacity onPress={() => Linking.openURL('https://rajivranjan0013github.github.io/tripways-privacy/terms-service.html')}>
                            <Text style={styles.footerLink}>Terms of use</Text>
                        </TouchableOpacity>
                        <Text style={styles.footerDivider}>|</Text>
                        <TouchableOpacity onPress={() => Linking.openURL('https://rajivranjan0013github.github.io/tripways-privacy/privacy-policy.html')}>
                            <Text style={styles.footerLink}>Privacy Policy</Text>
                        </TouchableOpacity>
                        <Text style={styles.footerDivider}>|</Text>
                        <TouchableOpacity onPress={handleRestore}>
                            <Text style={styles.footerLink}>Restore</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#FFFFFF',
        zIndex: 1000,
    },
    bgImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: SCREEN_HEIGHT * 0.65,
    },
    topBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 20,
        zIndex: 10,
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    topRestoreBtn: {
        backgroundColor: '#00C3F9',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        justifyContent: 'center',
    },
    topRestoreText: {
        color: '#000000',
        fontSize: 13,
        fontWeight: '600',
    },
    mainContent: {
        flex: 1,
        paddingBottom: 40,
    },
    mainTitle: {
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        fontSize: 32,
        fontWeight: '900',
        color: '#000000',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: -0.5,
        textShadowColor: 'rgba(255, 255, 255, 0.8)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    subTitle: {
        fontSize: 15,
        color: '#111111',
        textAlign: 'center',
        paddingHorizontal: 40,
        fontWeight: '500',
        lineHeight: 22,
        marginBottom: 24,
        textShadowColor: 'rgba(255, 255, 255, 0.9)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
    },
    flexSpacer: {
        flex: 1,
    },
    bottomContent: {
        paddingHorizontal: 24,
    },
    featuresList: {
        marginBottom: 24,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    checkboxBox: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: '#00C3F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        backgroundColor: 'transparent',
    },
    checkboxBoxChecked: {
        backgroundColor: '#00C3F9',
        borderColor: '#00C3F9',
    },
    featureText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
    },
    cardsRow: {
        flexDirection: 'column',
        gap: 12,
        marginBottom: 24,
    },
    packageCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 2,
        borderColor: '#EDEDED',
    },
    packageCardSelected: {
        backgroundColor: '#FFFFFF',
        borderColor: '#00C3F9',
    },
    packageCardInnerHorizontal: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    radioOutline: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#B0B7BF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    radioOutlineSelected: {
        borderColor: '#00C3F9',
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#00C3F9',
    },
    packageCardTextMain: {
        flex: 1,
        paddingRight: 10,
    },
    packageCardTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1E1E1E',
    },
    packageCardDesc: {
        fontSize: 11,
        fontWeight: '600',
        color: '#65727E',
        marginTop: 2,
    },
    monthlyBreakdown: {
        fontSize: 11,
        fontWeight: '700',
        color: '#10B981',
        marginTop: 4,
    },
    packageCardPriceContainer: {
        alignItems: 'flex-end',
    },
    packageCardPrice: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1E1E1E',
    },
    packageCardPeriod: {
        fontSize: 11,
        fontWeight: '600',
        color: '#9AA3AB',
        marginTop: 2,
    },
    bestValueBadge: {
        position: 'absolute',
        top: -10,
        right: 14,
        backgroundColor: '#10B981',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
        zIndex: 1,
    },
    bestValueText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 10,
    },
    unlockBtn: {
        backgroundColor: '#00C3F9',
        borderRadius: 30,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#00C3F9',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
        marginBottom: 8,
    },
    cancelAnytimeText: {
        fontSize: 13,
        color: '#6B7280',
        textAlign: 'center',
        fontWeight: '500',
        marginBottom: 20,
    },
    disabledBtn: {
        opacity: 0.7,
        shadowOpacity: 0,
        elevation: 0,
    },
    unlockBtnInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    unlockBtnText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    footerLinks: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    footerLink: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4B5563',
    },
    footerDivider: {
        fontSize: 12,
        color: '#9CA3AF',
        marginHorizontal: 16,
    },
    premiumActiveContainer: {
        backgroundColor: '#ECFDF5',
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#10B981',
        marginBottom: 24,
    },
    premiumActiveText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#065F46',
        marginBottom: 6,
    },
    premiumActiveSub: {
        fontSize: 14,
        color: '#047857',
    }
});

export default PremiumOverlay;
