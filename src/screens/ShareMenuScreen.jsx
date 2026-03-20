import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Image,
    Platform,
    Dimensions,
    NativeModules,
    StatusBar,
    DeviceEventEmitter,
    Linking,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../services/queryClient';
import Config from 'react-native-config';
import { MMKV } from 'react-native-mmkv';
import { extractUrl, detectPlatformFromUrl } from '../services/ShareIntent';
import { fetchStream } from '../services/fetchStream';

const { ShareIntentModule } = NativeModules;
const storage = new MMKV();
const BACKEND_URL = Config.BACKEND_URL || 'http://localhost:3000';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ShareMenuContent = ({ sharedUrl: initialUrl }) => {
    const insets = useSafeAreaInsets();
    const [status, setStatus] = useState('Analyzing link...');
    const [isProcessing, setIsProcessing] = useState(true);
    const [places, setPlaces] = useState([]);
    
    // UI states for Parity
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [checkedSpots, setCheckedSpots] = useState(new Set());
    
    const [destination, setDestination] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [error, setError] = useState(null);
    const lastProcessedUrlRef = useRef(null);

    const [currentUrl, setCurrentUrl] = useState(initialUrl);
    const cleanUrl = useMemo(() => extractUrl(currentUrl) || currentUrl, [currentUrl]);
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

    const [limitReached, setLimitReached] = useState(false);

    useEffect(() => {
        const processUrl = async () => {
            if (!cleanUrl) {
                setError('No valid URL found');
                setIsProcessing(false);
                return;
            }
            if (lastProcessedUrlRef.current === cleanUrl) return;
            
            try {
                lastProcessedUrlRef.current = cleanUrl;
                const finalData = await new Promise((resolve, reject) => {
                    let lastData = null;

                    fetchStream(
                        `${BACKEND_URL}/api/extract-video-places`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                videoUrl: cleanUrl,
                                userId,
                                platform,
                                isPremium,
                            }),
                        },
                        (eventType, parsed) => {
                            if (eventType === 'progress') {
                                setStatus(parsed.message || 'Processing...');
                            } else if (eventType === 'place_batch') {
                                setPlaces(prev => {
                                    const newPlaces = parsed.places || [];
                                    const existingNames = new Set(prev.map(p => p.name));
                                    const uniqueNew = newPlaces.filter(p => !existingNames.has(p.name));
                                    return [...prev, ...uniqueNew];
                                });
                                setStatus(`Found ${parsed.totalFound} of ~${parsed.totalExpected} places...`);
                            } else if (eventType === 'places') {
                                lastData = parsed;
                            } else if (eventType === 'error') {
                                if (parsed.code === 'IMPORT_LIMIT_REACHED') {
                                    setLimitReached(true);
                                    setIsProcessing(false);
                                    resolve(null); // Don't reject — we handle this gracefully
                                    return;
                                }
                                reject(new Error(parsed.message || 'Processing failed'));
                            }
                        },
                        () => resolve(lastData),
                        (error) => reject(error)
                    );
                });

                if (finalData && finalData.places?.length > 0) {
                    const spotsWithSelection = finalData.places.map(p => ({ ...p, isSelected: true }));
                    setPlaces(spotsWithSelection);
                    setCheckedSpots(new Set(spotsWithSelection.map(p => p.address || p.name)));
                    setDestination(finalData.destination);
                    setStatus(`Found ${finalData.places.length} spots!`);
                } else {
                    setStatus('No places found in this link');
                }
            } catch (err) {
                setError(prev => prev ? prev : err.message);
            } finally {
                setIsProcessing(false);
            }
        };

        processUrl();

        // Listen for new share intents while overlay is open
        const sub = DeviceEventEmitter.addListener('onShareIntentReceived', (newText) => {
            if (newText) {
                setCurrentUrl(newText);
                setIsProcessing(true);
                setPlaces([]);
                setDestination('');
                setError(null);
            }
        });

        return () => sub.remove();
    }, [cleanUrl, userId, platform]);

    const handleSave = async () => {
        if (!userId) {
            setError('Please sign in to save spots');
            return;
        }

        const spotsToSave = places.filter(p => checkedSpots.has(p.address || p.name));
        if (spotsToSave.length === 0) return;

        setIsSaving(true);
        try {
            const body = {
                userId,
                spots: spotsToSave.map(p => ({
                    ...p,
                    source: 'share_extension',
                    sourceUrl: cleanUrl,
                    platform: platform
                }))
            };

            const res = await fetch(`${BACKEND_URL}/api/spots`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                setIsSaved(true);
                setTimeout(() => {
                    ShareIntentModule.finishActivity();
                }, 1500);
            } else {
                throw new Error('Failed to save to cloud');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        ShareIntentModule.finishActivity();
    };

    // Parity Computation
    const categories = useMemo(() => {
        const cats = new Set(places.map(p => p.category || 'Other'));
        return ['All', ...Array.from(cats)].sort();
    }, [places]);

    const filteredPlaces = useMemo(() => {
        if (selectedCategory === 'All') return places;
        return places.filter(p => (p.category || 'Other') === selectedCategory);
    }, [places, selectedCategory]);

    const groupedSections = useMemo(() => {
        const groups = {};
        filteredPlaces.forEach(p => {
            const country = p.country || 'Unknown Country';
            const city = p.city || 'Unknown City';
            const key = `${city}, ${country}`;
            if (!groups[key]) groups[key] = { city, country, spots: [] };
            groups[key].spots.push(p);
        });
        return Object.values(groups).sort((a, b) => a.city.localeCompare(b.city));
    }, [filteredPlaces]);

    const toggleCheck = (spotId) => {
        setCheckedSpots(prev => {
            const next = new Set(prev);
            if (next.has(spotId)) next.delete(spotId);
            else next.add(spotId);
            return next;
        });
    };

    return (
        <View style={styles.overlay}>
            <TouchableOpacity 
                activeOpacity={1} 
                style={styles.backdrop} 
                onPress={handleClose} 
            />
            <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Discover spots</Text>
                    <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                        <Text style={styles.closeIcon}>✕</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.urlText} numberOfLines={1}>{cleanUrl}</Text>

                <View style={styles.content}>
                    {error ? (
                        <View style={styles.center}>
                            <Text style={styles.errorText}>{error}</Text>
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
                                    // Deep link into the main app with a premium flag
                                    Linking.openURL('tripways://premium').catch(() => {
                                        // If deep link fails, just close the overlay
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
                    ) : (
                        <>
                            <View style={styles.statusRow}>
                                {isProcessing && <ActivityIndicator color="#3BB9E3" size="small" style={{ marginRight: 8 }} />}
                                <Text style={[styles.statusText, isSaved && styles.successText]}>
                                    {isSaved ? 'Saved to bucket list! ✓' : status}
                                </Text>
                            </View>

                            {places.length > 0 && !error && (
                                <View style={styles.categoryScrollWrapper}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                                        {categories.map(cat => (
                                            <TouchableOpacity 
                                                key={cat} 
                                                style={[styles.catChip, selectedCategory === cat && styles.catChipActive]}
                                                onPress={() => setSelectedCategory(cat)}
                                            >
                                                <Text style={[styles.catText, selectedCategory === cat && styles.catTextActive]}>{cat}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            <ScrollView style={styles.placeList} showsVerticalScrollIndicator={false}>
                                {groupedSections.map((group, gIdx) => (
                                    <View key={gIdx} style={styles.groupContainer}>
                                        <Text style={styles.groupHeader}>{group.city}, {group.country}</Text>
                                        
                                        {group.spots.map((place, idx) => {
                                            const spotId = place.address || place.name;
                                            const isChecked = checkedSpots.has(spotId);
                                            
                                            return (
                                                <TouchableOpacity 
                                                    key={idx} 
                                                    style={styles.placeItem} 
                                                    activeOpacity={0.7}
                                                    onPress={() => toggleCheck(spotId)}
                                                >
                                                    <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                                                        {isChecked && <Text style={styles.checkmark}>✓</Text>}
                                                    </View>
                                                    
                                                    <View style={styles.placeInfo}>
                                                        <Text style={styles.placeName}>{place.name}</Text>
                                                        <Text style={styles.placeLoc}>{place.address || (place.category || 'Spot')}</Text>
                                                    </View>
                                                    {place.photoUrl && (
                                                        <Image source={{ uri: place.photoUrl }} style={styles.placeImage} />
                                                    )}
                                                </TouchableOpacity>
                                            )
                                        })}
                                    </View>
                                ))}
                                
                                {places.length === 0 && !isProcessing && !error && (
                                    <View style={styles.emptyContainer}>
                                        <Text style={styles.emptyText}>No spots detected in this link.</Text>
                                    </View>
                                )}
                            </ScrollView>

                            {!isSaved && (
                                <TouchableOpacity 
                                    style={[styles.saveButton, (isProcessing || places.length === 0 || isSaving || checkedSpots.size === 0) && styles.disabledButton]}
                                    onPress={handleSave}
                                    disabled={isProcessing || places.length === 0 || isSaving || checkedSpots.size === 0}
                                >
                                    {isSaving ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text style={styles.saveButtonText}>
                                            {checkedSpots.size > 0 ? `Save ${checkedSpots.size} spots` : 'Save spots'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>
            </View>
        </View>
    );
};

const ShareMenuScreen = (props) => {
    return (
        <GestureHandlerRootView style={{ flex: 1, minHeight: SCREEN_HEIGHT }}>
            <QueryClientProvider client={queryClient}>
                <SafeAreaProvider>
                    <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.5)" translucent />
                    <ShareMenuContent {...props} />
                </SafeAreaProvider>
            </QueryClientProvider>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        minHeight: SCREEN_HEIGHT,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    card: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: SCREEN_HEIGHT * 0.92,
        height: SCREEN_HEIGHT * 0.85, 
        minHeight: SCREEN_HEIGHT * 0.60,
        width: SCREEN_WIDTH,
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
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
        marginBottom: 20,
    },
    content: {
        flex: 1,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    statusText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#475569',
    },
    successText: {
        color: '#10B981',
    },
    categoryScrollWrapper: {
        marginHorizontal: -20,
        paddingHorizontal: 20,
        marginBottom: 12,
        height: 40,
    },
    categoryScroll: {
        alignItems: 'center',
        paddingRight: 40,
    },
    catChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        marginRight: 8,
    },
    catChipActive: {
        backgroundColor: '#0F172A',
    },
    catText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    catTextActive: {
        color: 'white',
    },
    groupContainer: {
        marginBottom: 24,
    },
    groupHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0F172A',
        marginBottom: 12,
        marginTop: 8,
    },
    placeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    checkboxChecked: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
    },
    checkmark: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    placeNumberBox: {
        width: 24,
    },
    placeNumber: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94A3B8',
    },
    placeInfo: {
        flex: 1,
        paddingRight: 10,
    },
    placeName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0F172A',
        marginBottom: 2,
    },
    placeLoc: {
        fontSize: 13,
        color: '#64748B',
    },
    placeImage: {
        width: 50,
        height: 50,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
    },
    saveButton: {
        backgroundColor: '#10B981',
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    disabledButton: {
        backgroundColor: '#D1FAE5',
        opacity: 0.8,
    },
    saveButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: '#EF4444',
        textAlign: 'center',
        marginHorizontal: 40,
    },
    emptyContainer: {
        marginTop: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#94A3B8',
        fontSize: 14,
    },
    // Import limit reached styles
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
