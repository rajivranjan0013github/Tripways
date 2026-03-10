import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Dimensions,
    ActivityIndicator,
    Image,
    FlatList,
    Platform,
    Keyboard,
    Modal
} from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import Animated, {
    useAnimatedStyle,
    interpolate,
    withTiming,
    Easing,
    useSharedValue
} from 'react-native-reanimated';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { ScrollView } from 'react-native-gesture-handler';

// Zustand stores
import { useUIStore } from '../store/uiStore';
import { useTripStore } from '../store/tripStore';

// TanStack Query
import { useSavedSpots, useSaveSpot } from '../hooks/useSpots';
import { useSpotSearch } from '../hooks/useSpotSearch';
import { useSpotDetail } from '../hooks/useSpotDetail';
import { getUserId } from '../services/api';
import { detectPlatformFromUrl, getSharedUrl } from '../services/ShareIntent';
import { useRoute, useNavigation } from '@react-navigation/native';
import Config from 'react-native-config';

const BACKEND_URL = Config.BACKEND_URL || 'http://localhost:3000';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * @param {object} props
 * @param {import('react').RefObject} props.bottomSheetRef
 * @param {import('react').RefObject} props.createTripSheetRef
 * @param {Function} props.setSheetIndex
 * @param {import('react-native-reanimated').SharedValue} props.sheetAnimatedPosition
 * @param {import('react-native-reanimated').SharedValue} props.tabBarTranslateY
 * @param {number} props.tabBarHeight
 */
const SpotsBottomSheet = ({
    bottomSheetRef,
    createTripSheetRef,
    setSheetIndex,
    sheetAnimatedPosition,
    tabBarTranslateY,
    tabBarHeight
}) => {
    // Stores
    const { socialMode, setSocialMode, setShowProfile } = useUIStore();

    // TanStack Query
    const userId = getUserId();
    const { data: spotsQueryData } = useSavedSpots(userId);
    const { mutate: saveSpot } = useSaveSpot(userId);
    const savedSpots = spotsQueryData?.grouped || {};
    const savedPlaceIds = spotsQueryData?.placeIds || new Set();
    const totalSpotsCount = spotsQueryData?.totalCount || 0;

    // Local UI state
    const [searchText, setSearchText] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    const [savingSpotId, setSavingSpotId] = useState(null);
    const [videoProcessing, setVideoProcessing] = useState(false);
    const [videoProgress, setVideoProgress] = useState('');
    const [selectedSpotPlaceId, setSelectedSpotPlaceId] = useState(null);

    // Refs
    const searchInputRef = useRef(null);
    const sharedUrlProcessed = useRef(false);

    // Hooks
    const route = useRoute();
    const navigation = useNavigation();
    const { data: spotSearchResults = [], isLoading: spotSearchLoading } = useSpotSearch(searchText);
    const { data: selectedSpotDetail = null, isLoading: spotDetailLoading } = useSpotDetail(selectedSpotPlaceId);

    // Bottom Sheet configs
    const snapPoints = useMemo(() => ['12%', '60%', '90%'], []);
    const sheetAnimationConfig = useMemo(() => ({
        duration: 400,
        easing: Easing.bezier(0.33, 1, 0.68, 1),
    }), []);

    const handleSheetChanges = useCallback((index) => {
        setSheetIndex(index);
        if (index !== 2) {
            Keyboard.dismiss();
        }
    }, [setSheetIndex]);

    // ── Handle shared URL from share intent (Instagram/TikTok share) ──
    useEffect(() => {
        const handleSharedUrl = (url) => {
            if (!url || sharedUrlProcessed.current) return;
            sharedUrlProcessed.current = true;
            const platform = detectPlatformFromUrl(url) || 'instagram';
            setSocialMode(platform);
            setSearchText(url);
            setSearchFocused(true);
            setTimeout(() => {
                bottomSheetRef.current?.snapToIndex(2);
            }, 300);
        };

        if (route.params?.sharedUrl) {
            handleSharedUrl(route.params.sharedUrl);
            navigation.setParams({ sharedUrl: null });
            return;
        }

        if (!sharedUrlProcessed.current) {
            getSharedUrl().then(url => {
                if (url) handleSharedUrl(url);
            });
        }
    }, [route.params?.sharedUrl]);

    // Listen for new share intents when app comes back to foreground
    useEffect(() => {
        const listener = require('react-native').AppState.addEventListener('change', async (state) => {
            if (state === 'active') {
                const url = await getSharedUrl();
                if (url) {
                    sharedUrlProcessed.current = false;
                    const platform = detectPlatformFromUrl(url) || 'instagram';
                    setSocialMode(platform);
                    setSearchText(url);
                    setSearchFocused(true);
                    setTimeout(() => {
                        bottomSheetRef.current?.snapToIndex(2);
                    }, 300);
                }
            }
        });
        return () => listener.remove();
    }, []);

    // Process video URL for places extraction
    useEffect(() => {
        if (!socialMode || !searchText || videoProcessing) return;
        const trimmed = searchText.trim();
        if (!trimmed.startsWith('http')) return;

        const processVideoUrl = async () => {
            setVideoProcessing(true);
            setVideoProgress('Starting...');
            try {
                const response = await fetch(`${BACKEND_URL}/api/extract-video-places`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoUrl: trimmed }),
                });

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let placesData = null;
                const accumulatedPlaces = [];

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const parts = buffer.split('\n\n');
                    buffer = parts.pop();

                    for (const eventBlock of parts) {
                        if (!eventBlock.trim()) continue;
                        const lines = eventBlock.split('\n');
                        let eventType = '';
                        let eventData = '';
                        for (const line of lines) {
                            if (line.startsWith('event: ')) eventType = line.slice(7);
                            if (line.startsWith('data: ')) eventData = line.slice(6);
                        }
                        if (!eventType || !eventData) continue;
                        try {
                            const parsed = JSON.parse(eventData);
                            if (eventType === 'progress') {
                                setVideoProgress(parsed.message || 'Processing...');
                            } else if (eventType === 'place_batch') {
                                if (parsed.places) {
                                    accumulatedPlaces.push(...parsed.places);
                                    setVideoProgress(`Found ${parsed.totalFound} of ~${parsed.totalExpected} places...`);
                                }
                            } else if (eventType === 'places') {
                                placesData = parsed;
                            } else if (eventType === 'error') {
                                throw new Error(parsed.message || 'Unknown error');
                            }
                        } catch (e) {
                            if (e.message && !e.message.includes('JSON')) throw e;
                        }
                    }
                }

                if (placesData && placesData.places && placesData.places.length > 0) {
                    setSearchText('');
                    setSocialMode(null);
                    searchInputRef.current?.blur();
                    Keyboard.dismiss();
                    bottomSheetRef.current?.close();

                    setTimeout(() => {
                        tabBarTranslateY.value = withTiming(tabBarHeight, {
                            duration: 400,
                            easing: Easing.bezier(0.33, 1, 0.68, 1),
                        });
                    }, 150);
                    setTimeout(() => {
                        createTripSheetRef.current?.openWithVideoPlaces(
                            placesData.destination,
                            placesData.places
                        );
                    }, 400);
                } else {
                    setVideoProgress('No places found in this video');
                    setTimeout(() => setVideoProgress(''), 3000);
                }
            } catch (error) {
                console.error('Video processing failed:', error);
                setVideoProgress(`Error: ${error.message}`);
                setTimeout(() => setVideoProgress(''), 4000);
            } finally {
                setVideoProcessing(false);
            }
        };

        processVideoUrl();
    }, [searchText, socialMode]);

    // Animations (driven by parent's sheetAnimatedPosition)
    const thresholdY = SCREEN_HEIGHT * 0.4;
    const fadeRange = SCREEN_HEIGHT * 0.06;
    const avatarAnimatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            sheetAnimatedPosition.value,
            [thresholdY - fadeRange, thresholdY],
            [0, 1],
            'clamp'
        ),
    }));
    const closeAnimatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            sheetAnimatedPosition.value,
            [thresholdY - fadeRange, thresholdY],
            [1, 0],
            'clamp'
        ),
    }));

    // Helpers
    const saveSpotToBucketList = (spot) => {
        if (!spot || !spot.placeId) return;
        setSavingSpotId(spot.placeId);
        saveSpot(spot, {
            onSettled: () => setSavingSpotId(null),
        });
    };

    return (
        <BottomSheet
            ref={bottomSheetRef}
            index={1}
            snapPoints={snapPoints}
            onChange={handleSheetChanges}
            enableDynamicSizing={false}
            backgroundStyle={styles.sheetBackground}
            handleIndicatorStyle={styles.handleIndicator}
            enablePanDownToClose={true}
            animationConfigs={sheetAnimationConfig}
            animatedPosition={sheetAnimatedPosition}
        >
            <BottomSheetView style={styles.sheetContent}>
                {/* Search Row */}
                <View style={styles.sheetSearchRow}>
                    <View style={styles.sheetSearchBar}>
                        {socialMode === 'instagram' ? (
                            <Svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                                <Rect x="2" y="2" width="20" height="20" rx="5" stroke="#E1306C" strokeWidth="2" />
                                <Circle cx="12" cy="12" r="5" stroke="#E1306C" strokeWidth="2" />
                                <Circle cx="17.5" cy="6.5" r="1.5" fill="#E1306C" />
                            </Svg>
                        ) : socialMode === 'tiktok' ? (
                            <Svg width="17" height="19" viewBox="0 0 22 24" fill="none">
                                <Path d="M16 0H12v16.5a3.5 3.5 0 1 1-3-3.46V9a7.5 7.5 0 1 0 7 7.5V8a8.22 8.22 0 0 0 4 1V5a4 4 0 0 1-4-4" fill="#000" />
                            </Svg>
                        ) : (
                            <Svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <Circle cx="11" cy="11" r="8" />
                                <Path d="m21 21-4.3-4.3" />
                            </Svg>
                        )}
                        <TextInput
                            ref={searchInputRef}
                            style={styles.sheetSearchInput}
                            placeholder={socialMode === 'instagram' ? 'Paste reels URL...' : socialMode === 'tiktok' ? 'Paste video URL...' : 'Search spots...'}
                            placeholderTextColor={socialMode === 'instagram' ? '#E1306C' : socialMode === 'tiktok' ? '#000' : '#94A3B8'}
                            value={searchText}
                            onChangeText={setSearchText}
                            onFocus={() => {
                                setSearchFocused(true);
                                bottomSheetRef.current?.snapToIndex(2);
                            }}
                            onBlur={() => setSearchFocused(false)}
                            returnKeyType="search"
                        />
                    </View>
                    <View style={styles.searchButtonWrap}>
                        <Animated.View style={[styles.searchButtonLayer, avatarAnimatedStyle]}>
                            <TouchableOpacity style={styles.sheetSearchAvatar} onPress={() => setShowProfile(true)}>
                                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <Circle cx="12" cy="7" r="4" />
                                </Svg>
                            </TouchableOpacity>
                        </Animated.View>
                        <Animated.View style={[styles.searchButtonLayer, closeAnimatedStyle]}>
                            <TouchableOpacity
                                style={styles.sheetSearchClose}
                                onPress={() => {
                                    setSearchText('');
                                    setSocialMode(null);
                                    searchInputRef.current?.blur();
                                    Keyboard.dismiss();
                                    bottomSheetRef.current?.snapToIndex(1);
                                }}
                            >
                                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <Path d="M18 6 6 18M6 6l12 12" />
                                </Svg>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                </View>

                {/* Conditional content based on search focus & text */}
                {searchFocused && searchText.length === 0 && !socialMode ? (
                    /* ── Social Search ── */
                    <View style={styles.socialSearchContainer}>
                        <Text style={styles.sheetSectionLabel}>Search on</Text>
                        <View style={styles.socialCardsRow}>
                            <TouchableOpacity style={styles.socialCard} activeOpacity={0.8} onPress={() => setSocialMode('instagram')}>
                                <View style={[styles.socialIconWrap, { backgroundColor: '#FFEEF4' }]}>
                                    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                        <Rect x="2" y="2" width="20" height="20" rx="5" stroke="#E1306C" strokeWidth="2" />
                                        <Circle cx="12" cy="12" r="5" stroke="#E1306C" strokeWidth="2" />
                                        <Circle cx="17.5" cy="6.5" r="1.5" fill="#E1306C" />
                                    </Svg>
                                </View>
                                <Text style={styles.socialCardTitle}>Instagram</Text>
                                <Text style={styles.socialCardSub}>Paste reels link</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.socialCard} activeOpacity={0.8} onPress={() => setSocialMode('tiktok')}>
                                <View style={[styles.socialIconWrap, { backgroundColor: '#F0F0F0' }]}>
                                    <Svg width="22" height="24" viewBox="0 0 22 24" fill="none">
                                        <Path d="M16 0H12v16.5a3.5 3.5 0 1 1-3-3.46V9a7.5 7.5 0 1 0 7 7.5V8a8.22 8.22 0 0 0 4 1V5a4 4 0 0 1-4-4" fill="#000" />
                                    </Svg>
                                </View>
                                <Text style={styles.socialCardTitle}>TikTok</Text>
                                <Text style={styles.socialCardSub}>Paste video link</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.sheetSectionLabel, { marginTop: 20 }]}>Trending Searches</Text>
                        <View style={styles.chipRow}>
                            {['Cafés in Paris', 'Bali hidden gems', 'Tokyo street food', 'NYC rooftops'].map((chip, i) => (
                                <TouchableOpacity
                                    key={i}
                                    style={styles.trendChip}
                                    activeOpacity={0.7}
                                    onPress={() => setSearchText(chip)}
                                >
                                    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <Path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                                    </Svg>
                                    <Text style={styles.trendChipText}>{chip}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ) : searchFocused && (searchText.length > 0 || socialMode) ? (
                    /* ── Search results / URL input ── */
                    <View style={styles.searchResultsContainer}>
                        {socialMode ? (
                            <>
                                <Text style={styles.sheetSectionLabel}>
                                    {socialMode === 'instagram' ? 'Instagram Reels' : 'TikTok Video'}
                                </Text>
                                <View style={styles.emptySpots}>
                                    {videoProcessing ? (
                                        <ActivityIndicator size="large" color={socialMode === 'instagram' ? '#E1306C' : '#000'} />
                                    ) : socialMode === 'instagram' ? (
                                        <Svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                                            <Rect x="2" y="2" width="20" height="20" rx="5" stroke="#E1306C" strokeWidth="1.5" />
                                            <Circle cx="12" cy="12" r="5" stroke="#E1306C" strokeWidth="1.5" />
                                            <Circle cx="17.5" cy="6.5" r="1.5" fill="#E1306C" />
                                        </Svg>
                                    ) : (
                                        <Svg width="36" height="40" viewBox="0 0 22 24" fill="none">
                                            <Path d="M16 0H12v16.5a3.5 3.5 0 1 1-3-3.46V9a7.5 7.5 0 1 0 7 7.5V8a8.22 8.22 0 0 0 4 1V5a4 4 0 0 1-4-4" fill="#CBD5E1" />
                                        </Svg>
                                    )}
                                    <Text style={[styles.emptySpotsText, { marginTop: 12 }]}>
                                        {videoProcessing
                                            ? (videoProgress || 'Processing video...')
                                            : searchText.length === 0
                                                ? `Paste a ${socialMode === 'instagram' ? 'reels' : 'TikTok'} URL above`
                                                : 'Processing link…'}
                                    </Text>
                                    <Text style={styles.emptySpotsHint}>
                                        {videoProcessing ? 'This may take a minute' : "We'll extract places from the video"}
                                    </Text>
                                </View>
                            </>
                        ) : (
                            <>
                                <Text style={styles.sheetSectionLabel}>Results for "{searchText}"</Text>
                                {spotSearchLoading && spotSearchResults.length === 0 ? (
                                    <View style={styles.emptySpots}>
                                        <ActivityIndicator size="small" color="#94A3B8" />
                                        <Text style={[styles.emptySpotsText, { marginTop: 12 }]}>Searching places…</Text>
                                    </View>
                                ) : spotSearchResults.length > 0 ? (
                                    <FlatList
                                        data={spotSearchResults}
                                        keyExtractor={(item) => item.placeId}
                                        keyboardShouldPersistTaps="handled"
                                        showsVerticalScrollIndicator={false}
                                        style={{ maxHeight: SCREEN_HEIGHT * 0.55 }}
                                        renderItem={({ item }) => {
                                            const isSaved = savedPlaceIds.has(item.placeId);
                                            const isSaving = savingSpotId === item.placeId;
                                            return (
                                                <TouchableOpacity
                                                    style={styles.spotSearchRow}
                                                    activeOpacity={0.7}
                                                    onPress={() => setSelectedSpotPlaceId(item.placeId)}
                                                >
                                                    <View style={styles.spotSearchIcon}>
                                                        <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                            <Circle cx="12" cy="10" r="3" />
                                                        </Svg>
                                                    </View>
                                                    <View style={styles.spotSearchTextWrap}>
                                                        <Text style={styles.spotSearchName} numberOfLines={1}>{item.name}</Text>
                                                        <Text style={styles.spotSearchSub} numberOfLines={1}>{item.secondary}</Text>
                                                    </View>
                                                    <TouchableOpacity
                                                        style={styles.spotBookmarkBtn}
                                                        onPress={(e) => {
                                                            e.stopPropagation?.();
                                                            if (isSaved || isSaving) return;
                                                            saveSpotToBucketList({
                                                                placeId: item.placeId,
                                                                name: item.name,
                                                                address: item.secondary,
                                                                city: item.secondary?.split(', ')?.[0] || 'Unknown',
                                                                country: item.secondary?.split(', ')?.pop() || 'Unknown',
                                                            });
                                                        }}
                                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                    >
                                                        {isSaving ? (
                                                            <ActivityIndicator size="small" color="#3B82F6" />
                                                        ) : (
                                                            <Svg width="20" height="20" viewBox="0 0 24 24" fill={isSaved ? '#3B82F6' : 'none'} stroke={isSaved ? '#3B82F6' : '#94A3B8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                                            </Svg>
                                                        )}
                                                    </TouchableOpacity>
                                                </TouchableOpacity>
                                            );
                                        }}
                                    />
                                ) : (
                                    <View style={styles.emptySpots}>
                                        <Svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <Circle cx="11" cy="11" r="8" />
                                            <Path d="m21 21-4.3-4.3" />
                                        </Svg>
                                        <Text style={[styles.emptySpotsText, { marginTop: 12 }]}>No results found</Text>
                                        <Text style={styles.emptySpotsHint}>Try a different search term</Text>
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                ) : (
                    /* ── My Spots: default view ── */
                    <View style={{ marginLeft: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <View>
                                <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', letterSpacing: -0.5 }}>My Spots</Text>
                                {totalSpotsCount > 0 && (
                                    <Text style={{ fontSize: 13, color: '#94A3B8', marginTop: 1 }}>{totalSpotsCount} Spots Saved</Text>
                                )}
                            </View>
                        </View>

                        {Object.keys(savedSpots).length > 0 ? (
                            Object.entries(savedSpots).map(([country, cities]) => {
                                const cityCount = Object.keys(cities).length;
                                const spotCount = Object.values(cities).reduce((sum, c) => sum + c.spots.length, 0);
                                return (
                                    <View key={country} style={{ marginTop: 10 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 5, marginBottom: 12 }}>
                                            <Text style={{ fontSize: 20, fontWeight: '600', color: '#1E293B' }}>{country}</Text>
                                            <Text style={{ fontSize: 12, color: '#94A3B8' }}>{cityCount} {cityCount === 1 ? 'City' : 'Cities'} • {spotCount} {spotCount === 1 ? 'Spot' : 'Spots'}</Text>
                                        </View>

                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 5, paddingRight: 0 }}>
                                            {Object.entries(cities).map(([city, cityData]) => {
                                                const cityKey = `${country}::${city}`;
                                                return (
                                                    <TouchableOpacity
                                                        key={cityKey}
                                                        activeOpacity={0.85}
                                                        onPress={() => {
                                                            bottomSheetRef.current?.close();
                                                            tabBarTranslateY.value = withTiming(tabBarHeight, {
                                                                duration: 400,
                                                                easing: Easing.bezier(0.33, 1, 0.68, 1),
                                                            });
                                                            setTimeout(() => {
                                                                createTripSheetRef.current?.openWithSavedSpots(country, city, cities);
                                                            }, 350);
                                                        }}
                                                        style={{
                                                            width: 150,
                                                            marginRight: 12,
                                                            borderRadius: 14,
                                                            overflow: 'hidden',
                                                            backgroundColor: '#F1F5F9',
                                                        }}
                                                    >
                                                        {cityData.cityPhoto ? (
                                                            <Image source={{ uri: cityData.cityPhoto }} style={{ width: 150, height: 110, borderTopLeftRadius: 14, borderTopRightRadius: 14 }} />
                                                        ) : (
                                                            <View style={{ width: 150, height: 110, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }}>
                                                                <Text style={{ fontSize: 32 }}>🏙️</Text>
                                                            </View>
                                                        )}
                                                        <View style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
                                                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B' }} numberOfLines={1}>{city}</Text>
                                                            <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{cityData.spots.length} {cityData.spots.length === 1 ? 'Spot' : 'Spots'}</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>
                                );
                            })
                        ) : (
                            <View style={styles.emptySpots}>
                                <Text style={styles.emptySpotsIcon}>🔖</Text>
                                <Text style={styles.emptySpotsText}>No saved spots yet</Text>
                                <Text style={styles.emptySpotsHint}>Save spots from your trips to see them here</Text>
                            </View>
                        )}
                    </View>
                )}
            </BottomSheetView>

            {/* Spot Detail Modal */}
            <Modal
                visible={!!selectedSpotDetail || spotDetailLoading}
                transparent
                animationType="slide"
                onRequestClose={() => { setSelectedSpotPlaceId(null); }}
            >
                <TouchableOpacity
                    style={styles.detailOverlay}
                    activeOpacity={1}
                    onPress={() => { setSelectedSpotPlaceId(null); }}
                >
                    <View style={styles.detailCard} onStartShouldSetResponder={() => true}>
                        {spotDetailLoading ? (
                            <View style={styles.detailLoading}>
                                <ActivityIndicator size="large" color="#3B82F6" />
                                <Text style={{ color: '#94A3B8', marginTop: 12, fontSize: 14, fontWeight: '500' }}>Loading place details…</Text>
                            </View>
                        ) : selectedSpotDetail ? (
                            <>
                                <TouchableOpacity style={styles.detailCloseBtn} onPress={() => setSelectedSpotPlaceId(null)}>
                                    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <Path d="M18 6 6 18M6 6l12 12" />
                                    </Svg>
                                </TouchableOpacity>

                                {selectedSpotDetail.photoUrl ? (
                                    <Image source={{ uri: selectedSpotDetail.photoUrl }} style={styles.detailImage} />
                                ) : (
                                    <View style={[styles.detailImage, { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }]}>
                                        <Svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
                                            <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                            <Circle cx="12" cy="10" r="3" />
                                        </Svg>
                                    </View>
                                )}

                                <View style={styles.detailInfo}>
                                    <Text style={styles.detailName}>{selectedSpotDetail.name}</Text>
                                    <Text style={styles.detailAddress} numberOfLines={2}>{selectedSpotDetail.address}</Text>

                                    {(selectedSpotDetail.types?.length > 0 || selectedSpotDetail.openNow !== null) && (
                                        <View style={styles.detailTagsRow}>
                                            {selectedSpotDetail.openNow !== null && (
                                                <View style={[styles.detailOpenBadge, { backgroundColor: selectedSpotDetail.openNow ? '#ECFDF5' : '#FEF2F2' }]}>
                                                    <View style={[styles.detailOpenDot, { backgroundColor: selectedSpotDetail.openNow ? '#10B981' : '#EF4444' }]} />
                                                    <Text style={[styles.detailOpenText, { color: selectedSpotDetail.openNow ? '#059669' : '#DC2626' }]}>
                                                        {selectedSpotDetail.openNow ? 'Open Now' : 'Closed'}
                                                    </Text>
                                                </View>
                                            )}
                                            {selectedSpotDetail.types?.map((type, i) => (
                                                <View key={i} style={styles.detailTypeTag}>
                                                    <Text style={styles.detailTypeText}>{type}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    {selectedSpotDetail.rating && (
                                        <View style={styles.detailRatingRow}>
                                            <Svg width="16" height="16" viewBox="0 0 24 24" fill="#FBBF24" stroke="#FBBF24" strokeWidth="1">
                                                <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                            </Svg>
                                            <Text style={styles.detailRating}>{selectedSpotDetail.rating}</Text>
                                            {selectedSpotDetail.userRatingCount > 0 && (
                                                <Text style={styles.detailReviews}>({selectedSpotDetail.userRatingCount.toLocaleString()} reviews)</Text>
                                            )}
                                        </View>
                                    )}

                                    {selectedSpotDetail.summary && (
                                        <Text style={styles.detailSummary} numberOfLines={3}>{selectedSpotDetail.summary}</Text>
                                    )}

                                    {(() => {
                                        const isSaved = savedPlaceIds.has(selectedSpotDetail.placeId);
                                        const isSaving = savingSpotId === selectedSpotDetail.placeId;
                                        return (
                                            <TouchableOpacity
                                                style={[styles.detailAddBtn, isSaved && styles.detailAddBtnSaved]}
                                                onPress={() => {
                                                    if (isSaved || isSaving) return;
                                                    saveSpotToBucketList(selectedSpotDetail);
                                                }}
                                                activeOpacity={0.8}
                                            >
                                                {isSaving ? (
                                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                                ) : (
                                                    <>
                                                        <Svg width="18" height="18" viewBox="0 0 24 24" fill={isSaved ? '#FFFFFF' : 'none'} stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                                        </Svg>
                                                        <Text style={styles.detailAddBtnText}>
                                                            {isSaved ? 'Saved to Bucket List' : 'Add to Bucket List'}
                                                        </Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })()}
                                </View>
                            </>
                        ) : null}
                    </View>
                </TouchableOpacity>
            </Modal>
        </BottomSheet>
    );
};

const styles = StyleSheet.create({
    sheetBackground: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
    },
    handleIndicator: {
        backgroundColor: '#E5E7EB',
        width: 48,
        height: 6,
    },
    sheetContent: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 0,
        marginTop: -10,
    },
    sheetSearchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 8,
        marginBottom: 16,
    },
    sheetSearchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 24,
        paddingHorizontal: 14,
        height: 48,
    },
    sheetSearchInput: {
        flex: 1,
        fontSize: 15,
        fontWeight: '500',
        color: '#1E293B',
        marginLeft: 10,
        paddingVertical: 0,
    },
    searchButtonWrap: {
        width: 44,
        height: 44,
    },
    searchButtonLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 44,
        height: 44,
    },
    sheetSearchClose: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetSearchAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetSectionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#94A3B8',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    socialSearchContainer: {
        paddingTop: 4,
    },
    socialCardsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    socialCard: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    socialIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    socialCardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 2,
    },
    socialCardSub: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '500',
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
    },
    trendChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    trendChipText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#64748B',
    },
    searchResultsContainer: {
        paddingTop: 4,
    },
    spotSearchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    spotSearchIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    spotSearchTextWrap: {
        flex: 1,
    },
    spotSearchName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 2,
    },
    spotSearchSub: {
        fontSize: 13,
        color: '#64748B',
    },
    spotBookmarkBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    emptySpots: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    emptySpotsIcon: {
        fontSize: 28,
        marginBottom: 8,
    },
    emptySpotsText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94A3B8',
    },
    emptySpotsHint: {
        fontSize: 12,
        color: '#CBD5E1',
        marginTop: 4,
    },
    // Detail card modal
    detailOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    detailCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        minHeight: 300,
        maxHeight: SCREEN_HEIGHT * 0.7,
        overflow: 'hidden',
    },
    detailCloseBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    detailImage: {
        width: '100%',
        height: 200,
    },
    detailLoading: {
        padding: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailInfo: {
        padding: 20,
    },
    detailName: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.5,
    },
    detailAddress: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 4,
        lineHeight: 18,
    },
    detailRatingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 10,
    },
    detailRating: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E293B',
    },
    detailReviews: {
        fontSize: 13,
        color: '#94A3B8',
        marginLeft: 2,
    },
    detailSummary: {
        fontSize: 14,
        color: '#475569',
        lineHeight: 20,
        marginTop: 12,
    },
    detailAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#3B82F6',
        paddingVertical: 14,
        borderRadius: 16,
        marginTop: 20,
    },
    detailAddBtnSaved: {
        backgroundColor: '#10B981',
    },
    detailTagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 10,
    },
    detailTypeTag: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    detailTypeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
    detailOpenBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    detailOpenDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    detailOpenText: {
        fontSize: 12,
        fontWeight: '700',
    },
    detailAddBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default SpotsBottomSheet;
