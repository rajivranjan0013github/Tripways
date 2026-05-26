import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Dimensions,
    NativeModules,
    StatusBar,
    Linking,
    Animated,
    FlatList,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Config from 'react-native-config';
import { MMKV } from 'react-native-mmkv';
import { extractUrl, detectPlatformFromUrl } from '../services/ShareIntent';

const { ShareIntentModule } = NativeModules;
const storage = new MMKV();
const BACKEND_URL = Config.BACKEND_URL || 'http://localhost:3000';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = SCREEN_HEIGHT * 0.6;

// Timeline step data
const TIMELINE_STEPS = [
    { label: 'Reel received', emoji: '🔗' },
    { label: 'Extracting places...', emoji: '🔍' },
    { label: 'Saving to your bucket list', emoji: '✨' },
];

/**
 * Animated timeline step component
 */
const TimelineStep = ({ step, index, status, isLast }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        if (status !== 'pending') {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 6,
                    tension: 120,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [status]);

    const isActive = status === 'active';
    const isDone = status === 'done';
    const isPending = status === 'pending';

    return (
        <View style={styles.timelineStep}>
            <View style={styles.timelineIconColumn}>
                <Animated.View
                    style={[
                        styles.timelineCircle,
                        isDone && styles.timelineCircleDone,
                        isActive && styles.timelineCircleActive,
                        isPending && styles.timelineCirclePending,
                        { opacity: isPending ? 0.4 : fadeAnim, transform: [{ scale: scaleAnim }] },
                    ]}
                >
                    {isDone ? (
                        <Text style={styles.timelineCheckmark}>✓</Text>
                    ) : isActive ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <Text style={styles.timelineEmoji}>{step.emoji}</Text>
                    )}
                </Animated.View>
                {!isLast && (
                    <View
                        style={[
                            styles.timelineLine,
                            isDone && styles.timelineLineDone,
                            isPending && styles.timelineLinePending,
                        ]}
                    />
                )}
            </View>
            <Animated.View
                style={[
                    styles.timelineContent,
                    { opacity: isPending ? 0.4 : fadeAnim },
                ]}
            >
                <Text
                    style={[
                        styles.timelineLabel,
                        isDone && styles.timelineLabelDone,
                        isActive && styles.timelineLabelActive,
                    ]}
                >
                    {isDone && index === 2
                        ? 'Saved to your bucket list'
                        : step.label}
                </Text>
            </Animated.View>
        </View>
    );
};

/**
 * Place card component for showing extracted places
 */
const PlaceCard = ({ place, index }) => (
    <View style={styles.placeCard}>
        <Text style={styles.placeNumber}>{index + 1}</Text>
        {place.photoUrl ? (
            <FastImage source={{ uri: place.photoUrl, priority: FastImage.priority.normal }} style={styles.placeImage} resizeMode={FastImage.resizeMode.cover} />
        ) : (
            <View style={[styles.placeImage, styles.placeImagePlaceholder]}>
                <Text style={{ fontSize: 18 }}>📍</Text>
            </View>
        )}
        <View style={styles.placeInfo}>
            <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
            <Text style={styles.placeLocation} numberOfLines={1}>
                {[place.city, place.country].filter(Boolean).join(', ')}
            </Text>
        </View>
        <View style={styles.placeSavedBadge}>
            <Text style={styles.placeSavedIcon}>✓</Text>
        </View>
    </View>
);

const ShareMenuContent = ({ sharedUrl: initialUrl, onClose }) => {
    const insets = useSafeAreaInsets();
    const [currentStep, setCurrentStep] = useState(0);
    const [error, setError] = useState(null);
    const [limitReached, setLimitReached] = useState(false);
    const [importId, setImportId] = useState(null);
    const [extractedPlaces, setExtractedPlaces] = useState([]);
    const [importStatus, setImportStatus] = useState(null); // 'processing' | 'completed' | 'failed'
    const hintOpacity = useRef(new Animated.Value(0)).current;
    const placesOpacity = useRef(new Animated.Value(0)).current;
    const pollingRef = useRef(null);

    const cleanUrl = useMemo(() => extractUrl(initialUrl) || initialUrl, [initialUrl]);
    const platform = useMemo(() => detectPlatformFromUrl(cleanUrl) || 'other', [cleanUrl]);

    const userId = useMemo(() => {
        const userStr = storage.getString('user');
        if (userStr) {
            try {
                const parsed = JSON.parse(userStr);
                return parsed.id || parsed._id;
            } catch (e) {
                return null;
            }
        }
        return null;
    }, []);

    const isPremium = useMemo(() => {
        try {
            const customerInfoStr = storage.getString('customerInfo');
            if (customerInfoStr) {
                const info = JSON.parse(customerInfoStr);
                const hasActiveSubscription = info?.activeSubscriptions?.length > 0;
                const hasActiveEntitlement = Object.keys(info?.entitlements?.active || {}).length > 0;
                return hasActiveSubscription || hasActiveEntitlement;
            }
        } catch (_) {}
        return false;
    }, []);

    // Poll for import status + extracted places
    const pollImportStatus = useCallback(async (id) => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/imports/${id}`);
            const data = await res.json();
            if (data?.success && data?.import) {
                const imp = data.import;
                setImportStatus(imp.status);

                if (imp.status === 'completed' && imp.resolvedPlaces?.length > 0) {
                    setExtractedPlaces(imp.resolvedPlaces);
                    // Animate steps to done
                    setCurrentStep(3);
                    // Show places with animation
                    Animated.timing(placesOpacity, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true,
                    }).start();
                    // Stop polling
                    if (pollingRef.current) {
                        clearInterval(pollingRef.current);
                        pollingRef.current = null;
                    }
                } else if (imp.status === 'failed') {
                    setError(imp.failureReason || 'Processing failed');
                    if (pollingRef.current) {
                        clearInterval(pollingRef.current);
                        pollingRef.current = null;
                    }
                }
            }
        } catch (_) {
            // Silently ignore poll errors — user can close anytime
        }
    }, [placesOpacity]);

    // Fire-and-forget: send URL to backend immediately
    useEffect(() => {
        if (!cleanUrl) {
            setError('No valid URL found');
            return;
        }

        if (!userId) {
            setError('Please open the app first to sign in');
            return;
        }

        // Fire the request FIRST — only start timeline animation once accepted
        const fireAndForget = async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/api/extract-and-save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        videoUrl: cleanUrl,
                        userId,
                        platform,
                        isPremium,
                    }),
                });

                const data = await res.json();

                if (!res.ok) {
                    if (data?.code === 'IMPORT_LIMIT_REACHED') {
                        setLimitReached(true);
                        return;
                    }
                    setError(data?.error || 'Something went wrong');
                    return;
                }

                // Backend accepted — NOW start the timeline animation
                setCurrentStep(1); // Reel received → done, Extracting → active

                const id = data.importId;
                setImportId(id);

                // Animate timeline: step 1 done → step 2 active
                setTimeout(() => setCurrentStep(2), 1500);

                // Start polling for results (every 5 seconds)
                if (id) {
                    pollingRef.current = setInterval(() => pollImportStatus(id), 5000);
                }

            } catch (err) {
                setError(err.message || 'Network error');
            }
        };

        fireAndForget();

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }
        };
    }, [cleanUrl, userId, platform, isPremium, pollImportStatus]);

    // Animate hint text in after step 1
    useEffect(() => {
        if (currentStep >= 1 && !error && !limitReached) {
            Animated.timing(hintOpacity, {
                toValue: 1,
                duration: 600,
                delay: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [currentStep, error, limitReached]);

    const handleClose = useCallback(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
        }
        onClose();
    }, [onClose]);

    // Get step status for each timeline step
    const getStepStatus = (index) => {
        if (index < currentStep) return 'done';
        if (index === currentStep) return 'active';
        return 'pending';
    };

    const renderPlaceItem = useCallback(({ item, index }) => (
        <PlaceCard place={item} index={index} />
    ), []);

    const placesCount = extractedPlaces.length;

    return (
        <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            {/* Handle bar */}
            <View style={styles.handleBar} />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>
                    {placesCount > 0 ? `${placesCount} spots found` : 'Importing spots'}
                </Text>
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                    <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.urlText} numberOfLines={1}>{cleanUrl}</Text>

            <View style={styles.content}>
                {error ? (
                    <View style={styles.center}>
                        <Text style={styles.errorEmoji}>😕</Text>
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={handleClose}>
                            <Text style={styles.retryButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                ) : limitReached ? (
                    <View style={styles.limitContainer}>
                        <Text style={styles.limitEmoji}>🔒</Text>
                        <Text style={styles.limitTitle}>Free Import Limit Reached</Text>
                        <Text style={styles.limitSubtitle}>
                            You've used all 5 free reel imports. Upgrade to Premium for unlimited imports!
                        </Text>
                        <TouchableOpacity
                            style={styles.limitUpgradeBtn}
                            activeOpacity={0.8}
                            onPress={() => {
                                Linking.openURL('tripways://premium').catch(() => {
                                    ShareIntentModule.finishActivity();
                                });
                            }}
                        >
                            <Text style={styles.limitUpgradeBtnText}>Upgrade to Premium</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleClose} style={{ marginTop: 12 }}>
                            <Text style={styles.limitDismissText}>Not now</Text>
                        </TouchableOpacity>
                    </View>
                ) : currentStep === 0 ? (
                    /* Initial checking phase — waiting for server response */
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color="#3B82F6" />
                        <Text style={styles.checkingText}>Checking...</Text>
                    </View>
                ) : (
                    <View style={styles.timelineContainer}>
                        {/* Timeline Steps */}
                        <View style={styles.timeline}>
                            {TIMELINE_STEPS.map((step, index) => (
                                <TimelineStep
                                    key={index}
                                    step={step}
                                    index={index}
                                    status={getStepStatus(index)}
                                    isLast={index === TIMELINE_STEPS.length - 1}
                                />
                            ))}
                        </View>

                        {/* Extracted places list — shown when backend finishes */}
                        {placesCount > 0 && (
                            <Animated.View style={[styles.placesContainer, { opacity: placesOpacity }]}>
                                <View style={styles.placesDivider} />
                                <Text style={styles.placesTitle}>
                                    Saved {placesCount} spots ✨
                                </Text>
                                <FlatList
                                    data={extractedPlaces}
                                    keyExtractor={(item, idx) => item.placeId || item.id || `${idx}`}
                                    renderItem={renderPlaceItem}
                                    showsVerticalScrollIndicator={false}
                                    contentContainerStyle={{ paddingBottom: 8 }}
                                />
                            </Animated.View>
                        )}

                        {/* Hint text — always show when processing */}
                        {placesCount === 0 && (
                            <Animated.View style={[styles.hintContainer, { opacity: hintOpacity }]}>
                                <Text style={styles.hintText}>
                                    You can close this screen — spots will be saved automatically ✨
                                </Text>
                            </Animated.View>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
};

const ShareMenuScreen = (props) => {
    const slideAnim = useRef(new Animated.Value(CARD_HEIGHT)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;

    // Entrance animation — slide card up + fade backdrop in
    useEffect(() => {
        Animated.parallel([
            Animated.spring(slideAnim, {
                toValue: 0,
                damping: 20,
                stiffness: 200,
                useNativeDriver: true,
            }),
            Animated.timing(backdropAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    // Exit animation — slide card down + fade backdrop out, then finish activity
    const handleClose = useCallback(() => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: CARD_HEIGHT,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(backdropAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start(() => {
            ShareIntentModule.finishActivity();
        });
    }, []);

    return (
        <GestureHandlerRootView style={styles.gestureRoot}>
            <SafeAreaProvider>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
                <View style={styles.overlay}>
                    {/* Animated semi-transparent backdrop */}
                    <Animated.View
                        style={[
                            StyleSheet.absoluteFill,
                            { backgroundColor: 'rgba(0,0,0,0.5)', opacity: backdropAnim },
                        ]}
                        pointerEvents="none"
                    />
                    {/* Touch dismiss area — covers full screen behind the card */}
                    <TouchableOpacity
                        activeOpacity={1}
                        style={StyleSheet.absoluteFill}
                        onPress={handleClose}
                    />
                    {/* Animated card — slides up from bottom */}
                    <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
                        <ShareMenuContent {...props} onClose={handleClose} />
                    </Animated.View>
                </View>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    gestureRoot: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    card: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: CARD_HEIGHT,
        width: SCREEN_WIDTH,
        paddingHorizontal: 24,
    },
    handleBar: {
        width: 40,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#D9DDE3',
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 6,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0F172A',
    },
    closeButton: {
        padding: 5,
    },
    closeIcon: {
        fontSize: 18,
        color: '#94A3B8',
        fontWeight: 'bold',
    },
    urlText: {
        fontSize: 12,
        color: '#94A3B8',
        marginBottom: 24,
    },
    content: {
        flex: 1,
    },
    // Timeline
    timelineContainer: {
        flex: 1,
    },
    timeline: {
        paddingLeft: 4,
    },
    timelineStep: {
        flexDirection: 'row',
        minHeight: 48,
    },
    timelineIconColumn: {
        width: 40,
        alignItems: 'center',
    },
    timelineCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    timelineCircleDone: {
        backgroundColor: '#10B981',
    },
    timelineCircleActive: {
        backgroundColor: '#3B82F6',
    },
    timelineCirclePending: {
        backgroundColor: '#F1F5F9',
    },
    timelineCheckmark: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    timelineEmoji: {
        fontSize: 12,
    },
    timelineLine: {
        width: 2,
        flex: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 3,
        minHeight: 10,
    },
    timelineLineDone: {
        backgroundColor: '#10B981',
    },
    timelineLinePending: {
        backgroundColor: '#F1F5F9',
    },
    timelineContent: {
        flex: 1,
        paddingLeft: 12,
        paddingTop: 5,
        paddingBottom: 12,
    },
    timelineLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#64748B',
    },
    timelineLabelDone: {
        color: '#0F172A',
    },
    timelineLabelActive: {
        color: '#3B82F6',
    },
    // Places list
    placesContainer: {
        flex: 1,
        marginTop: 4,
    },
    placesDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginBottom: 12,
    },
    placesTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#10B981',
        marginBottom: 12,
    },
    placeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    placeNumber: {
        fontSize: 13,
        fontWeight: '600',
        color: '#94A3B8',
        width: 24,
    },
    placeImage: {
        width: 44,
        height: 44,
        borderRadius: 10,
    },
    placeImagePlaceholder: {
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeInfo: {
        flex: 1,
        marginLeft: 10,
    },
    placeName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    placeLocation: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 2,
    },
    placeSavedBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeSavedIcon: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    // Hint
    hintContainer: {
        alignItems: 'center',
        marginTop: 20,
        paddingHorizontal: 16,
    },
    hintText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 20,
    },
    // Error
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkingText: {
        marginTop: 12,
        fontSize: 15,
        fontWeight: '500',
        color: '#94A3B8',
    },
    errorEmoji: {
        fontSize: 40,
        marginBottom: 12,
    },
    errorText: {
        color: '#EF4444',
        textAlign: 'center',
        marginHorizontal: 40,
        fontSize: 15,
        fontWeight: '500',
    },
    retryButton: {
        marginTop: 20,
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 24,
    },
    retryButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#64748B',
    },
    // Import limit  
    limitContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    limitEmoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    limitTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0F172A',
        textAlign: 'center',
        marginBottom: 8,
    },
    limitSubtitle: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    limitUpgradeBtn: {
        backgroundColor: '#00C3F9',
        paddingVertical: 14,
        paddingHorizontal: 40,
        borderRadius: 26,
        shadowColor: '#00C3F9',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    limitUpgradeBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    limitDismissText: {
        fontSize: 14,
        color: '#94A3B8',
        fontWeight: '500',
    },
});

export default ShareMenuScreen;
