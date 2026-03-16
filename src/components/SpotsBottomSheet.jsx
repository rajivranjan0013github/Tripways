import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Dimensions,
    ActivityIndicator,
    Image,
    ImageBackground,
    FlatList,
    Platform,
    Keyboard,
    Modal,
    Linking
} from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop, BottomSheetFlatList, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Animated, {
    useAnimatedStyle,
    interpolate,
    withTiming,
    Easing,
    useSharedValue
} from 'react-native-reanimated';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { ScrollView } from 'react-native-gesture-handler';
import Video from 'react-native-video';

// Zustand stores
import { useUIStore } from '../store/uiStore';
import { useTripStore } from '../store/tripStore';

// TanStack Query
import { useSavedSpots, useSaveSpot } from '../hooks/useSpots';
import { useSpotSearch } from '../hooks/useSpotSearch';
import { useSpotDetail, fetchSpotDetailFn } from '../hooks/useSpotDetail';
import { getUserId } from '../services/api';
import { detectPlatformFromUrl, getSharedUrl } from '../services/ShareIntent';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSavedTrips } from '../hooks/useTrips';
import { useTemplateTrips } from '../hooks/useTemplateTrips';
import { useImportedVideos, useImportedVideoDetail } from '../hooks/useImports';
import SpotsTripsContent from './SpotsTripsContent';
import SpotsExploreContent from './SpotsExploreContent';
import Config from 'react-native-config';
import { fetchStream } from '../services/fetchStream';

const BACKEND_URL = Config.BACKEND_URL || 'http://localhost:3000';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const FONT_SERIF = Platform.select({
    ios: 'Cormorant Garamond',
    android: 'CormorantGaramond-SemiBoldItalic',
    default: 'System',
});

// Fallback colors for guide cards without a cover image
const GUIDE_FALLBACK_COLORS = ['#C4B5A5', '#94A3A8', '#6366F1', '#D946EF', '#F59E0B'];

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
    tripOverviewSheetRef,
    setSheetIndex,
    sheetAnimatedPosition,
    tabBarTranslateY,
    tabBarHeight
}) => {
    // Stores
    const { socialMode, setSocialMode, setShowProfile, activeTab, setActiveTab, setTripOverviewOpen } = useUIStore();
    const { setTripData, setIsTemplateTripView } = useTripStore();

    // TanStack Query
    const userId = getUserId();
    const queryClient = useQueryClient();
    const { data: spotsQueryData, isLoading: spotsLoading } = useSavedSpots(userId);
    const { mutateAsync: saveSpot } = useSaveSpot(userId);
    const { data: importsQueryData } = useImportedVideos(userId);
    const savedSpots = useMemo(() => spotsQueryData?.grouped || {}, [spotsQueryData?.grouped]);
    const savedPlaceIds = spotsQueryData?.placeIds || new Set();
    const totalSpotsCount = spotsQueryData?.totalSpots || 0;
    const importedVideos = useMemo(() => importsQueryData?.imports || [], [importsQueryData?.imports]);
    const totalImportsCount = importsQueryData?.totalImports || 0;
    const mySpotsCountries = useMemo(() => (
        Object.entries(savedSpots).map(([country, cities]) => ({
            country,
            cities,
            cityCount: Object.keys(cities || {}).length,
            spotCount: Object.values(cities || {}).reduce((sum, c) => sum + (c?.spots?.length || 0), 0),
        }))
    ), [savedSpots]);

    const { data: savedTrips = [], isLoading: tripsLoading } = useSavedTrips(userId);
    const { data: templateTrips = [], isLoading: templatesLoading } = useTemplateTrips();

    // Local UI state
    const [searchText, setSearchText] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    const [videoProcessing, setVideoProcessing] = useState(false);
    const [savedViewMode, setSavedViewMode] = useState('spots');
    const [videoProgress, setVideoProgress] = useState('');
    const [selectedSpotPlaceId, setSelectedSpotPlaceId] = useState(null);
    const [selectedImportId, setSelectedImportId] = useState(null);
    const [videoPlaying, setVideoPlaying] = useState(false);
    const [showAddedBadge, setShowAddedBadge] = useState(false);
    const [savingSpotId, setSavingSpotId] = useState(null);
    const [keyboardHeight, setKeyboardHeight] = useState(0);


    // Refs
    const searchInputRef = useRef(null);
    const lastProcessedUrlRef = useRef(null);

    // Hooks
    const route = useRoute();
    const navigation = useNavigation();
    const { data: spotSearchResults = [], isLoading: spotSearchLoading } = useSpotSearch(searchText);
    const { data: selectedSpotDetail = null, isLoading: spotDetailLoading } = useSpotDetail(selectedSpotPlaceId);
    const { data: selectedImportDetail = null, isLoading: importDetailLoading } = useImportedVideoDetail(selectedImportId);

    // Bottom Sheet configs
    const snapPoints = useMemo(() => [165, '60%', '92%'], []);
    const sheetAnimationConfig = useMemo(() => ({
        duration: 400,
        easing: Easing.bezier(0.33, 1, 0.68, 1),
    }), []);

    const handleSheetChanges = useCallback((index) => {
        setSheetIndex(index);
        if (index !== 2) {
            Keyboard.dismiss();
        }
        // If sheet is CLOSED gesturally in trips mode, reset tab to home
        if (index === -1 && activeTab === 'trips') {
            setActiveTab('home');
        }
    }, [setSheetIndex, activeTab, setActiveTab]);

    const handleTripPress = async (tripId) => {
        if (!tripId) return;
        try {
            const res = await fetch(`${BACKEND_URL}/api/trips/${tripId}`);
            const data = await res.json();
            if (data?.success && data?.trip) {
                const fullTrip = data.trip;
                setTripData({
                    _id: fullTrip._id,
                    numDays: fullTrip.days,
                    locationName: fullTrip.destination,
                    itinerary: fullTrip.itinerary,
                    discoveredPlaces: fullTrip.discoveredPlaces || [],
                });
                setIsTemplateTripView(false);
                bottomSheetRef.current?.close();
                setTimeout(() => {
                    tabBarTranslateY.value = withTiming(tabBarHeight, {
                        duration: 400,
                        easing: Easing.bezier(0.33, 1, 0.68, 1),
                    });
                }, 150);
                setTimeout(() => {
                    setTripOverviewOpen(true);
                    tripOverviewSheetRef.current?.expand();
                }, 400);
            }
        } catch (err) {
            console.warn('Failed to fetch trip details:', err);
        }
    };

    const handleGuidePress = async (templateId) => {
        if (!templateId) return;
        try {
            const res = await fetch(`${BACKEND_URL}/api/template-trips/${templateId}`);
            const data = await res.json();
            if (data?.success && data?.trip) {
                const t = data.trip;
                setTripData({
                    _id: t._id,
                    numDays: t.days,
                    locationName: t.destination,
                    itinerary: t.itinerary,
                    discoveredPlaces: t.discoveredPlaces || [],
                });
                setIsTemplateTripView(true);
                bottomSheetRef.current?.close();
                setTimeout(() => {
                    tabBarTranslateY.value = withTiming(tabBarHeight, {
                        duration: 400,
                        easing: Easing.bezier(0.33, 1, 0.68, 1),
                    });
                }, 150);
                setTimeout(() => {
                    setTripOverviewOpen(true); 
                    tripOverviewSheetRef.current?.expand();
                }, 400);
            }
        } catch (err) {
            console.warn('Failed to fetch template trip:', err);
        }
    };

    // ── Handle shared URL from share intent (Instagram/TikTok share) ──
    useEffect(() => {
        const handleSharedUrl = (url) => {
            if (!url) return;
            console.log('SpotsBottomSheet: Processing shared URL', url);
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
            // Clear the param so we don't process it again on re-render
            navigation.setParams({ sharedUrl: null });
        }
    }, [bottomSheetRef, navigation, route.params?.sharedUrl, setSocialMode]);


    // Process video URL for places extraction
    useEffect(() => {
        if (!socialMode || !searchText || videoProcessing) return;
        const trimmed = searchText.trim();
        if (!trimmed.startsWith('http')) return;
        if (lastProcessedUrlRef.current === trimmed) return;

        const processVideoUrl = async () => {
            lastProcessedUrlRef.current = trimmed;
            setVideoProcessing(true);
            setVideoProgress('Starting...');
            try {
                let activeImportMeta = null;
                let placesData = null;
                const accumulatedPlaces = [];

                await new Promise((resolve, reject) => {
                    fetchStream(
                        `${BACKEND_URL}/api/extract-video-places`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                videoUrl: trimmed,
                                userId,
                                platform: socialMode,
                            })
                        },
                        (eventType, parsed) => {
                            if (eventType === 'progress') {
                                setVideoProgress(parsed.message || 'Processing...');
                            } else if (eventType === 'import') {
                                activeImportMeta = parsed;
                                queryClient.invalidateQueries({ queryKey: ['imports', userId] });
                            } else if (eventType === 'place_batch') {
                                if (parsed.places) {
                                    accumulatedPlaces.push(...parsed.places);
                                    setVideoProgress(`Found ${parsed.totalFound} of ~${parsed.totalExpected} places...`);
                                }
                            } else if (eventType === 'places') {
                                placesData = parsed;
                            } else if (eventType === 'error') {
                                reject(new Error(parsed.message || 'Unknown error'));
                            }
                        },
                        () => resolve(),
                        (error) => reject(error)
                    );
                });

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
                        queryClient.invalidateQueries({ queryKey: ['imports', userId] });
                        createTripSheetRef.current?.openWithVideoPlaces(
                            placesData.destination,
                            placesData.places,
                            {
                                importId: placesData.importId || activeImportMeta?.importId || null,
                                title: placesData.title || '',
                                caption: placesData.caption || '',
                                originalUrl: placesData.originalUrl || trimmed,
                                thumbnailUrl: placesData.thumbnailUrl || null,
                                cloudflareVideoUrl: placesData.cloudflareVideoUrl || null,
                            }
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
    }, [bottomSheetRef, createTripSheetRef, queryClient, searchText, setSocialMode, socialMode, tabBarHeight, tabBarTranslateY, userId, videoProcessing]);

    // Track keyboard height so floating badge can stay above it.
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = (event) => {
            setKeyboardHeight(event?.endCoordinates?.height || 0);
        };
        const onHide = () => {
            setKeyboardHeight(0);
        };

        const showSub = Keyboard.addListener(showEvent, onShow);
        const hideSub = Keyboard.addListener(hideEvent, onHide);

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

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

    // Helpers — instant save: no enrichment, fire-and-forget
    const saveSpotToBucketList = (spot) => {
        if (!spot || !spot.placeId) return;
        if (savingSpotId === spot.placeId || savedPlaceIds.has(spot.placeId)) return;

        // Instant feedback
        setShowAddedBadge(true);
        setTimeout(() => setShowAddedBadge(false), 2000);
        setSavingSpotId(spot.placeId);

        const spotCity = spot.city || spot.secondary?.split(', ')?.[0] || 'Unknown';
        const spotCountry = spot.country || spot.secondary?.split(', ')?.pop() || 'Unknown';

        // Synchronous save: backend fetches full details (city, country, capital, photo)
        // before responding. useSaveSpot's onSuccess handles the cache update.
        saveSpot({
            placeId: spot.placeId,
            name: spot.name,
            address: spot.address || spot.secondary || '',
            city: spotCity,
            country: spotCountry,
            rating: spot.rating ?? null,
            userRatingCount: spot.userRatingCount ?? 0,
            photoUrl: spot.photoUrl || spot.image || null,
            image: spot.image || spot.photoUrl || null,
            coordinates: spot.coordinates || { lat: null, lng: null },
        }).catch((err) => {
            console.warn('Save spot failed:', err?.message || err);
        }).finally(() => {
            setSavingSpotId(null);
        });
    };

    const renderBackdrop = useCallback(
        (props) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={2}
                disappearsOnIndex={1}
                opacity={0.4}
            />
        ),
        []
    );

    const selectedImportSummary = useMemo(
        () => importedVideos.find((item) => item._id === selectedImportId) || null,
        [importedVideos, selectedImportId]
    );
    const activeImport = selectedImportDetail || selectedImportSummary;

    return (
        <BottomSheet
            ref={bottomSheetRef}
            index={activeTab === 'trips' ? 2 : 1} 
            snapPoints={snapPoints}
            onChange={handleSheetChanges}
            enableDynamicSizing={false}
            backgroundStyle={styles.sheetBackground}
            handleIndicatorStyle={styles.handleIndicator}
            enablePanDownToClose={activeTab === 'trips'}
            backdropComponent={renderBackdrop}
            animationConfigs={sheetAnimationConfig}
            animatedPosition={sheetAnimatedPosition}
        >
            {activeTab === 'home' ? (
                <SpotsExploreContent
                    socialMode={socialMode}
                    setSocialMode={setSocialMode}
                    searchText={searchText}
                    setSearchText={setSearchText}
                    searchFocused={searchFocused}
                    setSearchFocused={setSearchFocused}
                    videoProcessing={videoProcessing}
                    videoProgress={videoProgress}
                    spotSearchLoading={spotSearchLoading}
                    spotSearchResults={spotSearchResults}
                    savedPlaceIds={savedPlaceIds}
                    savingSpotId={savingSpotId}
                    saveSpotToBucketList={saveSpotToBucketList}
                    setSelectedSpotPlaceId={setSelectedSpotPlaceId}
                    mySpotsCountries={mySpotsCountries}
                    totalSpotsCount={totalSpotsCount}
                    spotsLoading={spotsLoading}
                    savedViewMode={savedViewMode}
                    setSavedViewMode={setSavedViewMode}
                    importedVideos={importedVideos}
                    totalImportsCount={totalImportsCount}
                    onImportPress={(item) => setSelectedImportId(item._id)}
                    sheetAnimatedPosition={sheetAnimatedPosition}
                    thresholdY={thresholdY}
                    fadeRange={fadeRange}
                    avatarAnimatedStyle={avatarAnimatedStyle}
                    closeAnimatedStyle={closeAnimatedStyle}
                    searchInputRef={searchInputRef}
                    bottomSheetRef={bottomSheetRef}
                    createTripSheetRef={createTripSheetRef}
                    tabBarHeight={tabBarHeight}
                    tabBarTranslateY={tabBarTranslateY}
                    setShowProfile={setShowProfile}
                />
            ) : (
                    /* ── Trips Mode ── */
                    <SpotsTripsContent
                        templatesLoading={templatesLoading}
                        templateTrips={templateTrips}
                        handleGuidePress={handleGuidePress}
                        tripsLoading={tripsLoading}
                        savedTrips={savedTrips}
                        handleTripPress={handleTripPress}
                    />
                )}

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

                        {/* Badge inside Modal to ensure visibility */}
                        <SpotAddedBadge visible={showAddedBadge} inModal />
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal
                visible={!!selectedImportId}
                transparent
                animationType="slide"
                onRequestClose={() => { setSelectedImportId(null); setVideoPlaying(false); }}
            >
                <TouchableOpacity
                    style={styles.detailOverlay}
                    activeOpacity={1}
                    onPress={() => { setSelectedImportId(null); setVideoPlaying(false); }}
                >
                    <View style={styles.detailCard} onStartShouldSetResponder={() => true}>
                        <TouchableOpacity style={styles.detailCloseBtn} onPress={() => { setSelectedImportId(null); setVideoPlaying(false); }}>
                            <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <Path d="M18 6 6 18M6 6l12 12" />
                            </Svg>
                        </TouchableOpacity>

                        {importDetailLoading || !activeImport ? (
                            <View style={styles.detailLoading}>
                                <ActivityIndicator size="large" color="#3B82F6" />
                                <Text style={{ color: '#94A3B8', marginTop: 12, fontSize: 14, fontWeight: '500' }}>Loading import details…</Text>
                            </View>
                        ) : (
                            <ScrollView style={styles.importDetailScroll} contentContainerStyle={styles.importDetailContent}>
                                {activeImport.cloudflareVideoUrl ? (
                                    <TouchableOpacity
                                        activeOpacity={0.9}
                                        style={styles.videoPlayerContainer}
                                        onPress={() => setVideoPlaying(p => !p)}
                                    >
                                        <Video
                                            source={{ uri: activeImport.cloudflareVideoUrl }}
                                            style={styles.detailVideo}
                                            paused={!videoPlaying}
                                            resizeMode="cover"
                                            repeat
                                            controls={false}
                                            poster={activeImport.thumbnailUrl || undefined}
                                            posterResizeMode="cover"
                                        />
                                        {!videoPlaying && (
                                            <View style={styles.videoPlayOverlay}>
                                                <View style={styles.videoPlayButton}>
                                                    <Svg width="28" height="28" viewBox="0 0 24 24" fill="#fff">
                                                        <Path d="M8 5v14l11-7z" />
                                                    </Svg>
                                                </View>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                ) : activeImport.thumbnailUrl ? (
                                    <Image source={{ uri: activeImport.thumbnailUrl }} style={styles.detailImage} />
                                ) : (
                                    <View style={[styles.detailImage, styles.importHeroFallback]}>
                                        <Text style={styles.importHeroFallbackText}>{activeImport.platform === 'tiktok' ? 'TikTok' : 'Reel'}</Text>
                                    </View>
                                )}

                                <View style={styles.detailInfo}>
                                    <View style={styles.importDetailTopRow}>
                                        <Text style={styles.importPlatformPillLarge}>
                                            {activeImport.platform === 'tiktok' ? 'TikTok' : activeImport.platform === 'instagram' ? 'Instagram Reel' : 'Imported Video'}
                                        </Text>
                                        <Text style={styles.importStatusTextLarge}>{activeImport.status}</Text>
                                    </View>

                                    <Text style={styles.detailName}>{activeImport.title || activeImport.destination || 'Imported video'}</Text>
                                    {!!activeImport.caption && <Text style={styles.detailSummary}>{activeImport.caption}</Text>}

                                    <View style={styles.importMetricsRow}>
                                        <View style={styles.importMetricCard}>
                                            <Text style={styles.importMetricValue}>{activeImport.totalExtractedPlaces || 0}</Text>
                                            <Text style={styles.importMetricLabel}>Extracted</Text>
                                        </View>
                                       
                                    </View>

                                  

                                  
                                    {Array.isArray(activeImport.locations) && activeImport.locations.length > 0 && (
                                        <>
                                            <Text style={styles.importSectionTitle}>Extracted Locations</Text>
                                            {activeImport.locations.map((location, index) => (
                                                <View key={`${location.country}-${location.city}-${index}`} style={styles.importLocationCard}>
                                                    <Text style={styles.importLocationTitle}>{location.city || 'Unknown city'}, {location.country || 'Unknown country'}</Text>
                                                    <Text style={styles.importLocationSubtitle}>{(location.spots || []).join(', ')}</Text>
                                                </View>
                                            ))}
                                        </>
                                    )}

                                  
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>


            {/* "Spot Added" Badge */}
            <SpotAddedBadge visible={showAddedBadge} keyboardHeight={keyboardHeight} />
        </BottomSheet>
    );
};

/**
 * Portable "Spot Added" black badge with rounded corners.
 */
const SpotAddedBadge = ({ visible, inModal = false, keyboardHeight = 0 }) => {
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(20);

    useEffect(() => {
        if (visible) {
            opacity.value = withTiming(1, { duration: 250 });
            translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.back(1.5)) });
        } else {
            opacity.value = withTiming(0, { duration: 250 });
            translateY.value = withTiming(20, { duration: 250 });
        }
    }, [opacity, translateY, visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));

    if (!visible && opacity.value === 0) return null;

    const baseBottom = Platform.OS === 'ios' ? 160 : 140;
    const keyboardAwareBottom = keyboardHeight > 0 ? keyboardHeight + 80 : baseBottom;

    return (
        <Animated.View style={[
            styles.addedBadgeContainer,
            { bottom: inModal ? 40 : keyboardAwareBottom },
            animatedStyle
        ]}>
            <View style={styles.addedBadge}>
                <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M20 6 9 17l-5-5" />
                </Svg>
                <Text style={styles.addedBadgeText}>Spot added</Text>
            </View>
        </Animated.View>
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
    videoPlayerContainer: {
        width: 250,
        height: 250 * (16 / 9), // 444
        backgroundColor: '#000',
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        alignSelf: 'center',
        marginVertical: 10,
    },
    detailVideo: {
        ...StyleSheet.absoluteFillObject,
    },
    videoPlayOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoPlayButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    detailLoading: {
        padding: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailInfo: {
        padding: 20,
    },
    importDetailScroll: {
        maxHeight: SCREEN_HEIGHT * 0.78,
    },
    importDetailContent: {
        paddingBottom: 28,
    },
    importHeroFallback: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E2E8F0',
    },
    importHeroFallbackText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#334155',
    },
    importDetailTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        gap: 12,
    },
    importPlatformPillLarge: {
        fontSize: 12,
        fontWeight: '800',
        color: '#334155',
        backgroundColor: '#E2E8F0',
        overflow: 'hidden',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
    },
    importStatusTextLarge: {
        fontSize: 12,
        fontWeight: '800',
        color: '#64748B',
        textTransform: 'capitalize',
    },
    importMetricsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
        marginBottom: 8,
    },
    importMetricCard: {
        flex: 1,
        borderRadius: 16,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#EEF2F7',
        paddingVertical: 14,
        alignItems: 'center',
    },
    importMetricValue: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0F172A',
    },
    importMetricLabel: {
        marginTop: 4,
        fontSize: 12,
        color: '#64748B',
        fontWeight: '700',
    },
    importSectionTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#64748B',
        textTransform: 'uppercase',
        marginTop: 18,
        marginBottom: 8,
        letterSpacing: 0.4,
    },
    importBodyText: {
        fontSize: 14,
        lineHeight: 20,
        color: '#334155',
    },
    importLocationCard: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#EEF2F7',
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
    },
    importLocationTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 4,
    },
    importLocationSubtitle: {
        fontSize: 13,
        lineHeight: 18,
        color: '#64748B',
    },
    importActionRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 20,
        flexWrap: 'wrap',
    },
    importActionButton: {
        backgroundColor: '#0F172A',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 13,
    },
    importActionButtonSecondary: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    importActionButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    importActionButtonTextSecondary: {
        color: '#334155',
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
    // Added Badge
    addedBadgeContainer: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 100 : 80,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 9999,
        pointerEvents: 'none',
    },
    addedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#000000',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    addedBadgeText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
});


export default SpotsBottomSheet;
