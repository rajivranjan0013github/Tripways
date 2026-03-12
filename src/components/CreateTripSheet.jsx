import React, { forwardRef, useMemo, useState, useRef, useEffect, useCallback, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, FlatList, Platform, Image, ScrollView, ActivityIndicator, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop, BottomSheetFlatList, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    FadeIn,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
    interpolate,
} from 'react-native-reanimated';
import WheelPicker from '@quidone/react-native-wheel-picker';
import { Calendar } from 'react-native-calendars';
import Config from 'react-native-config';
import { MMKV } from 'react-native-mmkv';

import { useTripStore } from '../store/tripStore';
import { useSavedSpots } from '../hooks/useSpots';
import { fetchSpotDetailFn } from '../hooks/useSpotDetail';

const storage = new MMKV();
const BACKEND_URL = Config.BACKEND_URL || 'http://localhost:3000';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FULL_SHEET_HEIGHT = SCREEN_HEIGHT * 0.92;

const FONT_SERIF = Platform.select({
    ios: 'Cormorant Garamond',
    android: 'CormorantGaramond-SemiBoldItalic',
    default: 'System',
});

const CreateTripSheet = forwardRef(({ onChange, animationConfigs, onTripCreated, onPlanningStarted }, ref) => {
    const insets = useSafeAreaInsets();

    // Read saved spots from TanStack Query instead of prop
    const storedUser = useMemo(() => {
        try {
            const userStr = storage.getString('user');
            return userStr ? JSON.parse(userStr) : null;
        } catch (e) {
            return null;
        }
    }, []);
    const csUserId = storedUser?.id || storedUser?._id;
    const { data: spotsQueryData } = useSavedSpots(csUserId);
    const savedSpotsData = spotsQueryData?.grouped || {};
    const [step, setStep] = useState('home'); // 'home', 'preferences', 'howManyDays', 'discoverSpots'
    const [searchActive, setSearchActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [numDays, setNumDays] = useState(4);
    const [selectionMode, setSelectionMode] = useState('days'); // 'days' or 'calendar'
    const [selectedDates, setSelectedDates] = useState({});
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [daysSelected, setDaysSelected] = useState(false);
    const [selectedPrefs, setSelectedPrefs] = useState([]);
    const [spotCategory, setSpotCategory] = useState('All');
    const [selectedSpots, setSelectedSpots] = useState([]);
    const [discoveredPlaces, setDiscoveredPlaces] = useState([]);
    const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
    const [isPlanning, setIsPlanning] = useState(false);
    const [isFromVideo, setIsFromVideo] = useState(false);
    const [isFromSavedSpots, setIsFromSavedSpots] = useState(false);
    const [isSavingSpots, setIsSavingSpots] = useState(false);
    const [matchedSavedSpots, setMatchedSavedSpots] = useState([]);
    const inputRef = useRef(null);
    const bottomSheetInternalRef = useRef(null);

    // Expose BottomSheet methods + custom openDiscoverSpots
    useImperativeHandle(ref, () => ({
        snapToIndex: (...args) => bottomSheetInternalRef.current?.snapToIndex(...args),
        snapToPosition: (...args) => bottomSheetInternalRef.current?.snapToPosition(...args),
        expand: (...args) => bottomSheetInternalRef.current?.expand(...args),
        collapse: (...args) => bottomSheetInternalRef.current?.collapse(...args),
        close: (...args) => bottomSheetInternalRef.current?.close(...args),
        forceClose: (...args) => bottomSheetInternalRef.current?.forceClose(...args),
        // DEV: Open directly to discover spots with trip data
        openDiscoverSpots: (trip) => {
            setSelectedLocation({ name: trip.destination });
            setNumDays(trip.days || 4);
            setSelectedPrefs((trip.interests || []).map(i => i.charAt(0).toUpperCase() + i.slice(1)));
            setStep('discoverSpots');
            bottomSheetInternalRef.current?.expand();
            // Trigger fetch after state is set
            setTimeout(() => {
                fetchDiscoverPlacesWithArgs(trip.destination, trip.interests || ['popular'], trip.days || 4);
            }, 100);
        },
        // Open with places already extracted from a video URL
        openWithVideoPlaces: (destination, places) => {
            setSelectedLocation({ name: destination });
            setNumDays(4);
            setDiscoveredPlaces(places);
            setSelectedSpots(places.map(p => p.id));
            setIsLoadingPlaces(false);
            setIsFromVideo(true);
            setIsFromSavedSpots(false);
            setStep('discoverSpots');
            bottomSheetInternalRef.current?.expand();
        },
        // Open Discover Spots with saved spots from a country, pre-selecting a specific city
        openWithSavedSpots: (country, selectedCity, cities) => {
            // Flatten all spots, placing the tapped city's spots FIRST
            const selectedCitySpots = [];
            const otherCitySpots = [];
            Object.entries(cities).forEach(([city, cityData]) => {
                (cityData.spots || []).forEach(spot => {
                    const mapped = {
                        ...spot,
                        id: spot._id || spot.id,
                        city: city,
                        country: country,
                        interest: spot.category || 'sightseeing',
                    };
                    if (city === selectedCity) {
                        selectedCitySpots.push(mapped);
                    } else {
                        otherCitySpots.push(mapped);
                    }
                });
            });
            const allSpots = [...selectedCitySpots, ...otherCitySpots];
            // Pre-select only the tapped city's spots
            const preSelected = selectedCitySpots.map(s => s.id);

            setSelectedLocation({ name: country });
            setNumDays(4);
            setDiscoveredPlaces(allSpots);
            setSelectedSpots(preSelected);
            setIsLoadingPlaces(false);
            setIsFromVideo(true);
            setIsFromSavedSpots(true);
            setStep('discoverSpots');
            bottomSheetInternalRef.current?.expand();

            // Fetch photos for spots missing them (background, non-blocking)
            allSpots.forEach((spot) => {
                if (spot.photoUrl || !spot.placeId) return;
                fetchSpotDetailFn(spot.placeId).then((detail) => {
                    if (!detail?.photoUrl) return;
                    setDiscoveredPlaces((prev) =>
                        prev.map((s) =>
                            s.placeId === spot.placeId
                                ? {
                                    ...s, photoUrl: detail.photoUrl, image: detail.photoUrl,
                                    rating: s.rating ?? detail.rating ?? null,
                                    address: s.address || detail.address || ''
                                }
                                : s
                        )
                    );
                }).catch(() => { });
            });
        },
        // Open Discover Spots directly for a location (City or Country)
        openWithLocation: (locationName) => {
            setSelectedLocation({ name: locationName });
            setNumDays(4);
            setStep('discoverSpots');
            bottomSheetInternalRef.current?.expand();
            // Trigger discovery flow
            setTimeout(() => {
                fetchDiscoverPlacesWithArgs(locationName, ['popular'], 4);
            }, 100);
        },
    }));

    // Skeleton pulse animation
    const pulseAnim = useSharedValue(0);
    useEffect(() => {
        if (isLoadingPlaces) {
            pulseAnim.value = withRepeat(
                withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
                -1,
                true
            );
        } else {
            pulseAnim.value = 0;
        }
    }, [isLoadingPlaces]);

    const skeletonStyle = useAnimatedStyle(() => ({
        opacity: interpolate(pulseAnim.value, [0, 1], [0.3, 0.7]),
    }));

    const renderSkeletonSpot = useCallback((index) => (
        <View key={`skeleton-${index}`} style={styles.spotRow}>
            <Animated.View style={[styles.skeletonNumber, skeletonStyle]} />
            <Animated.View style={[styles.spotImage, styles.skeletonImage, skeletonStyle]} />
            <View style={styles.spotInfo}>
                <Animated.View style={[styles.skeletonTextLong, skeletonStyle]} />
                <Animated.View style={[styles.skeletonTextMedium, skeletonStyle]} />
                <Animated.View style={[styles.skeletonTextShort, skeletonStyle]} />
            </View>
            <Animated.View style={[styles.spotCheck, styles.skeletonCheck, skeletonStyle]} />
        </View>
    ), [skeletonStyle]);

    const snapPoints = useMemo(() => ['92%'], []);


    const [searchResults, setSearchResults] = useState([]);

    // Fetch Google Places Autocomplete (v1) when searchQuery changes
    React.useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        const fetchPlaces = async () => {
            try {
                const apiKey = Config.GOOGLE_MAPS_API_KEY;
                if (!apiKey) {
                    console.warn("Google Maps API Key missing in react-native-config");
                    return;
                }
                const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': apiKey,
                    },
                    body: JSON.stringify({
                        input: searchQuery,
                        includedPrimaryTypes: [
                            'locality',
                            'administrative_area_level_1',
                            'administrative_area_level_2',
                            'country',
                            'sublocality',
                        ],
                    }),
                });
                const data = await response.json();

                if (data.suggestions && data.suggestions.length > 0) {
                    const mappedResults = data.suggestions
                        .filter(s => s.placePrediction)
                        .map(s => ({
                            id: s.placePrediction.placeId,
                            name: s.placePrediction.structuredFormat?.mainText?.text || s.placePrediction.text?.text || '',
                            country: s.placePrediction.structuredFormat?.secondaryText?.text || '',
                            flag: '📍'
                        }));
                    setSearchResults(mappedResults);
                } else {
                    setSearchResults([]);
                }
            } catch (error) {
                console.error("Failed to fetch places", error);
            }
        };

        const timeoutId = setTimeout(fetchPlaces, 300); // 300ms debounce
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    const renderBackdrop = React.useCallback(
        (props) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.5}
            />
        ),
        []
    );

    // Shared value for search animation (0 = default, 1 = search active)
    const searchProgress = useSharedValue(0);

    useEffect(() => {
        searchProgress.value = withTiming(searchActive ? 1 : 0, {
            duration: 500,
            easing: Easing.bezier(0.33, 1, 0.68, 1),
        });
    }, [searchActive]);

    // Slide the entire footer (title + search bar) up/down
    const footerPaddingBottom = Platform.OS === 'android' ? Math.max(80, 20 + insets.bottom) : 80;
    const SEARCH_TOP = 10; // Fixed distance from top of sheet for active search
    const SEARCH_BAR_HEIGHT = 52;
    const SLIDE_DISTANCE = FULL_SHEET_HEIGHT - footerPaddingBottom - SEARCH_BAR_HEIGHT - SEARCH_TOP;
    const footerSlideStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: interpolate(searchProgress.value, [0, 1], [0, -SLIDE_DISTANCE], 'clamp') }],
    }));

    // Staggered fade for each title word
    const word1Style = useAnimatedStyle(() => ({
        opacity: interpolate(searchProgress.value, [0, 0.25], [1, 0], 'clamp'),
    }));
    const word2Style = useAnimatedStyle(() => ({
        opacity: interpolate(searchProgress.value, [0.05, 0.35], [1, 0], 'clamp'),
    }));
    const word3Style = useAnimatedStyle(() => ({
        opacity: interpolate(searchProgress.value, [0.1, 0.45], [1, 0], 'clamp'),
    }));
    const word4Style = useAnimatedStyle(() => ({
        opacity: interpolate(searchProgress.value, [0.15, 0.55], [1, 0], 'clamp'),
    }));
    const subtitleFadeStyle = useAnimatedStyle(() => ({
        opacity: interpolate(searchProgress.value, [0.2, 0.6], [1, 0], 'clamp'),
    }));

    // Fade in search results after slide
    const resultsStyle = useAnimatedStyle(() => ({
        opacity: interpolate(searchProgress.value, [0.6, 1], [0, 1], 'clamp'),
    }));

    // Shake animation for trip duration card
    const durationShake = useSharedValue(0);
    const durationShakeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: durationShake.value }],
    }));

    const dynamicContentStyle = {
        paddingBottom: Platform.OS === 'android' ? Math.max(80, 20 + insets.bottom) : 80,
    };

    const renderHome = () => (
        <View style={[styles.content, dynamicContentStyle]}>
            {/* Everything slides together as one unit */}
            <Animated.View style={[{ flex: 1, justifyContent: 'flex-end' }, footerSlideStyle]}>
                {/* Title — each word fades out in a stagger */}
                <View style={styles.footer}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
                        <Animated.Text style={[styles.footerTitle, { marginBottom: 0 }, word1Style]}>Where</Animated.Text>
                        <Animated.Text style={[styles.footerTitle, { marginBottom: 0 }, word2Style]}>are</Animated.Text>
                        <Animated.Text style={[styles.footerTitle, { marginBottom: 0 }, word3Style]}>you</Animated.Text>
                        <Animated.Text style={[styles.footerTitle, { marginBottom: 0 }, word4Style]}>going?</Animated.Text>
                    </View>
                    <Animated.Text style={[styles.footerSubtitle, subtitleFadeStyle]}>Search for your destination</Animated.Text>
                </View>

                {/* Search bar — whole bar is a button when inactive */}
                <View style={{ paddingHorizontal: 22 }}>
                    {searchActive ? (
                        <View style={[styles.searchBar, { justifyContent: 'flex-start', paddingHorizontal: 16 }]}>

                            <View style={styles.searchIconContainer}>
                                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <Path d="M21 21l-6-6" />
                                    <Circle cx="11" cy="11" r="8" />
                                </Svg>
                            </View>
                            <TextInput
                                ref={inputRef}
                                style={{ flex: 1, fontSize: 16, fontWeight: '600', color: '#0F172A', paddingVertical: 0 }}
                                placeholder="Search destination"
                                placeholderTextColor="#94A3B8"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCorrect={false}
                                autoFocus={true}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')} style={{ marginLeft: 8 }}>
                                    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <Circle cx="12" cy="12" r="10" fill="#94A3B8" opacity={0.6} />
                                        <Path d="m15 9-6 6M9 9l6 6" stroke="#FFF" strokeWidth="2" strokeLinecap="round" />
                                    </Svg>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.searchBar}
                            activeOpacity={0.8}
                            onPress={() => setSearchActive(true)}
                        >
                            <View style={styles.searchIconContainer}>
                                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <Path d="M21 21l-6-6" />
                                    <Circle cx="11" cy="11" r="8" />
                                </Svg>
                            </View>
                            <Text style={styles.searchText}>Search</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </Animated.View>

            {/* Search results — positioned below search bar, fades in after slide */}
            {searchActive && (
                <Animated.View style={[{ position: 'absolute', top: 20 + 52 + 10, left: 22, right: 22, bottom: 80 }, resultsStyle]}>
                    <BottomSheetFlatList
                        data={searchResults}
                        keyExtractor={(item) => item.id}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.resultsList}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.resultItem}
                                onPress={() => {
                                    inputRef.current?.blur();
                                    Keyboard.dismiss();
                                    // Fire viewport bounds lookup in parallel (non-blocking)
                                    if (savedSpotsData && Object.keys(savedSpotsData).length > 0) {
                                        findSpotsInViewport(item.id, savedSpotsData);
                                    } else {
                                        setMatchedSavedSpots([]);
                                    }
                                    // Delay the state update to ensure the keyboard dismissing animation 
                                    // has time to start on Android before the TextInput unmounts
                                    setTimeout(() => {
                                        setSelectedLocation(item);
                                        setSearchActive(false);
                                        setSearchQuery('');
                                        setStep('preferences');
                                    }, 100);
                                }}
                            >
                                <Text style={styles.resultName}>{item.name}</Text>
                                <Text style={styles.resultCountry}>{item.country}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </Animated.View>
            )}
        </View>
    );

    const renderPreferences = () => (
        <Animated.View entering={FadeIn} style={[styles.content, dynamicContentStyle, { justifyContent: 'flex-end' }]}>
            {selectedLocation && (
                <View style={styles.selectedLocationBar}>
                    <View style={styles.selectedLocationInfo}>
                        <Text style={styles.selectedBarFlag}>{selectedLocation.flag}</Text>
                        <Text style={styles.selectedBarName}>{selectedLocation.name}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setStep('home')} style={styles.editButton}>
                        <View style={styles.editIconCircle}>
                            <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5">
                                <Path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </Svg>
                        </View>
                    </TouchableOpacity>
                </View>
            )}
            <View style={styles.footer}>
                {/* Trip Preferences Section */}
                <View style={styles.prefSection}>
                    <View style={styles.prefSectionHeader}>
                        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
                            <Path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z" />
                            <Path d="M5 17l.6 1.4L7 19l-1.4.6L5 21l-.6-1.4L3 19l1.4-.6L5 17z" />
                        </Svg>
                        <Text style={styles.prefSectionTitle}>Trip Preferences</Text>
                    </View>
                    <View style={styles.tagGrid}>
                        {[
                            { name: 'Popular', icon: '📌' },
                            { name: 'Museum', icon: '🎨' },
                            { name: 'Nature', icon: '⛰️' },
                            { name: 'Foodie', icon: '🍕' },
                            { name: 'History', icon: '🏛️' },
                            { name: 'Shopping', icon: '🛍️' },
                        ].map((tag, idx) => {
                            const isSelected = selectedPrefs.includes(tag.name);
                            return (
                                <TouchableOpacity
                                    key={idx}
                                    style={[styles.tagChip, isSelected && styles.tagChipSelected]}
                                    onPress={() => {
                                        setSelectedPrefs(prev =>
                                            prev.includes(tag.name)
                                                ? prev.filter(p => p !== tag.name)
                                                : [...prev, tag.name]
                                        );
                                    }}
                                >
                                    <Text style={styles.tagIcon}>{tag.icon}</Text>
                                    <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>{tag.name}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Trip Duration Section */}
                <Animated.View style={durationShakeStyle}>
                    <TouchableOpacity style={styles.durationRow} onPress={() => setStep('howManyDays')}>
                        <View style={styles.durationRowLeft}>
                            <View style={styles.durationRowIcon}>
                                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <Path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18" />
                                </Svg>
                            </View>
                            <View>
                                <Text style={styles.durationRowTitle}>Trip Duration</Text>
                                <Text style={styles.durationRowValue}>{daysSelected ? `${numDays} days` : 'Choose trip duration'}</Text>
                            </View>
                        </View>
                        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M9 18l6-6-6-6" />
                        </Svg>
                    </TouchableOpacity>
                </Animated.View>

                {/* Continue Button */}
                <TouchableOpacity
                    style={[styles.blackContinueButton, { marginTop: 24 }]}
                    onPress={() => {
                        if (!daysSelected) {
                            // Shake the duration card to draw attention
                            durationShake.value = withSequence(
                                withTiming(-10, { duration: 50 }),
                                withTiming(10, { duration: 50 }),
                                withTiming(-10, { duration: 50 }),
                                withTiming(10, { duration: 50 }),
                                withTiming(-5, { duration: 50 }),
                                withTiming(5, { duration: 50 }),
                                withTiming(0, { duration: 50 }),
                            );
                            return;
                        }
                        setStep('discoverSpots');
                        fetchDiscoverPlaces();
                    }}
                >
                    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M5 12h14M12 5l7 7-7 7" />
                    </Svg>
                    <Text style={styles.blackContinueText}>Continue</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

    const renderHowManyDays = () => (
        <Animated.View entering={FadeIn} style={[styles.content, dynamicContentStyle, { justifyContent: 'space-between' }]}>


            <View style={styles.howManyHeader}>
                <View style={styles.howManyTopRow}>
                    <TouchableOpacity onPress={() => setStep('preferences')} style={styles.backButtonLarge}>
                        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M15 18l-6-6 6-6" />
                        </Svg>
                    </TouchableOpacity>

                    <View style={styles.segmentContainer}>
                        <TouchableOpacity
                            style={selectionMode === 'calendar' ? styles.segmentItemActive : styles.segmentItem}
                            onPress={() => setSelectionMode('calendar')}
                        >
                            <Text style={selectionMode === 'calendar' ? styles.segmentTextActive : styles.segmentTextInactive}>Calender</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={selectionMode === 'days' ? styles.segmentItemActive : styles.segmentItem}
                            onPress={() => setSelectionMode('days')}
                        >
                            <Text style={selectionMode === 'days' ? styles.segmentTextActive : styles.segmentTextInactive}>Days</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={styles.howManyTitle}>
                    {selectionMode === 'calendar' && startDate && endDate
                        ? `${numDays} days`
                        : 'How many days?'}
                </Text>
            </View>

            {selectionMode === 'days' ? (
                <View style={styles.pickerContainer}>
                    {Platform.OS === 'android' ? (
                        <GestureHandlerRootView style={{ flex: 1 }}>
                            <WheelPicker
                                data={Array.from({ length: 30 }, (_, i) => ({ value: i + 1, label: (i + 1).toString() }))}
                                value={numDays}
                                onValueChanged={({ item }) => setNumDays(item.value)}
                                width={SCREEN_WIDTH}
                                height={320}
                                itemHeight={80}
                                itemTextStyle={[styles.pickerText, styles.pickerTextInactive]}
                                selectedItemTextStyle={[styles.pickerText, styles.pickerTextActive]}
                            />
                        </GestureHandlerRootView>
                    ) : (
                        <WheelPicker
                            data={Array.from({ length: 30 }, (_, i) => ({ value: i + 1, label: (i + 1).toString() }))}
                            value={numDays}
                            onValueChanged={({ item }) => setNumDays(item.value)}
                            width={SCREEN_WIDTH}
                            height={320}
                            itemHeight={80}
                            itemTextStyle={[styles.pickerText, styles.pickerTextInactive]}
                            selectedItemTextStyle={[styles.pickerText, styles.pickerTextActive]}
                        />
                    )}
                </View>
            ) : (
                <View style={styles.calendarContainer}>
                    <Calendar
                        theme={{
                            backgroundColor: 'transparent',
                            calendarBackground: 'transparent',
                            textSectionTitleColor: '#94A3B8',
                            selectedDayBackgroundColor: '#0F172A',
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: '#2DD4BF',
                            dayTextColor: '#0F172A',
                            textDisabledColor: '#CBD5E1',
                            dotColor: '#2DD4BF',
                            selectedDotColor: '#ffffff',
                            arrowColor: '#0F172A',
                            monthTextColor: '#0F172A',
                            indicatorColor: '#0F172A',
                            textDayFontWeight: '600',
                            textMonthFontWeight: '700',
                            textDayHeaderFontWeight: '600',
                            textDayFontSize: 14,
                            textMonthFontSize: 16,
                            textDayHeaderFontSize: 12
                        }}
                        markingType={'period'}
                        markedDates={selectedDates}
                        onDayPress={(day) => {
                            const dateString = day.dateString;

                            if (!startDate || (startDate && endDate)) {
                                // Start new selection
                                setStartDate(dateString);
                                setEndDate(null);
                                setSelectedDates({
                                    [dateString]: { startingDay: true, color: '#0F172A', textColor: '#ffffff' }
                                });
                            } else {
                                // Complete range selection
                                if (dateString < startDate) {
                                    // New date is before start, make it the new start
                                    setStartDate(dateString);
                                    setSelectedDates({
                                        [dateString]: { startingDay: true, color: '#0F172A', textColor: '#ffffff' }
                                    });
                                } else if (dateString > startDate) {
                                    setEndDate(dateString);

                                    // Calculate range and fill dates
                                    let range = {};
                                    let start = new Date(startDate);
                                    let end = new Date(dateString);

                                    // Calculate difference in days
                                    const diffTime = Math.abs(end - start);
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                                    setNumDays(diffDays);

                                    let current = start;
                                    while (current <= end) {
                                        const curStr = current.toISOString().split('T')[0];
                                        if (curStr === startDate) {
                                            range[curStr] = { startingDay: true, color: '#0F172A', textColor: '#ffffff' };
                                        } else if (curStr === dateString) {
                                            range[curStr] = { endingDay: true, color: '#0F172A', textColor: '#ffffff' };
                                        } else {
                                            range[curStr] = { color: 'rgba(15, 23, 42, 0.1)', textColor: '#0F172A' };
                                        }
                                        current.setDate(current.getDate() + 1);
                                    }
                                    setSelectedDates(range);
                                }
                            }
                        }}
                    />
                </View>
            )}

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.blackConfirmButton, { marginTop: 24 }]}
                    onPress={() => { setDaysSelected(true); setStep('preferences'); }}
                >
                    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M5 12h14M12 5l7 7-7 7" />
                    </Svg>
                    <Text style={styles.blackConfirmText}>Confirm</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

    // Preference name -> backend interest name mapping
    const PREF_TO_INTEREST = {
        'Popular': 'popular',
        'Museum': 'museum',
        'Nature': 'nature',
        'Foodie': 'food',
        'History': 'history',
        'Shopping': 'shopping',
    };

    /**
     * Given a place_id from autocomplete, fetch its viewport bounds via Geocoding API,
     * then filter saved spots whose coordinates fall inside those bounds.
     */
    const findSpotsInViewport = async (placeId, spotsData) => {
        try {
            const apiKey = Config.GOOGLE_MAPS_API_KEY;
            if (!apiKey || !placeId) return;
            const url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${placeId}&key=${apiKey}`;
            const res = await fetch(url);
            const data = await res.json();
            const viewport = data.results?.[0]?.geometry?.viewport;
            if (!viewport) {
                setMatchedSavedSpots([]);
                return;
            }
            const { northeast: ne, southwest: sw } = viewport;
            const matches = [];
            for (const [country, cities] of Object.entries(spotsData)) {
                for (const [city, cityData] of Object.entries(cities)) {
                    const cityMatches = (cityData.spots || []).filter(spot => {
                        const lat = spot.coordinates?.lat;
                        const lng = spot.coordinates?.lng;
                        return lat != null && lng != null &&
                            lat >= sw.lat && lat <= ne.lat &&
                            lng >= sw.lng && lng <= ne.lng;
                    });
                    if (cityMatches.length > 0) {
                        matches.push(...cityMatches.map(spot => ({
                            ...spot,
                            id: spot._id || spot.id || spot.placeId,
                            city,
                            country,
                            interest: 'saved',
                            _isSavedSpot: true,
                        })));
                    }
                }
            }
            console.log(`📌 Found ${matches.length} saved spot(s) within viewport bounds`);
            setMatchedSavedSpots(matches);
        } catch (err) {
            console.warn('Viewport bounds lookup failed:', err.message);
            setMatchedSavedSpots([]);
        }
    };

    const fetchDiscoverPlaces = async () => {
        if (!selectedLocation) return;
        setIsLoadingPlaces(true);
        setDiscoveredPlaces([]);
        setSelectedSpots([]);
        try {
            const backendUrl = Config.BACKEND_URL || 'http://localhost:3000';
            const interests = selectedPrefs.length > 0
                ? selectedPrefs.map(p => PREF_TO_INTEREST[p] || p.toLowerCase())
                : ['popular'];
            const response = await fetch(`${backendUrl}/api/discover-places`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    place: selectedLocation.name,
                    interests,
                    days: numDays,
                }),
            });
            const data = await response.json();
            if (data.success && data.places) {
                // Merge: saved spots first, then API-discovered places (deduped)
                const savedIds = new Set(matchedSavedSpots.map(s => s.placeId || s.id));
                const apiPlaces = data.places.filter(p => !savedIds.has(p.id));
                const merged = [...matchedSavedSpots, ...apiPlaces];
                setDiscoveredPlaces(merged);
                // Auto-select all places
                setSelectedSpots(merged.map(p => p.id));
            }
        } catch (error) {
            console.error('Failed to discover places:', error);
        } finally {
            setIsLoadingPlaces(false);
        }
    };

    // DEV: Fetch discover places with explicit args (used by openDiscoverSpots)
    const fetchDiscoverPlacesWithArgs = async (placeName, interests, days) => {
        setIsLoadingPlaces(true);
        setDiscoveredPlaces([]);
        setSelectedSpots([]);
        setIsFromSavedSpots(false);
        setIsFromVideo(true);
        try {
            const backendUrl = Config.BACKEND_URL || 'http://localhost:3000';
            const response = await fetch(`${backendUrl}/api/discover-places`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ place: placeName, interests, days }),
            });
            const data = await response.json();
            if (data.success && data.places) {
                setDiscoveredPlaces(data.places);
                setSelectedSpots(data.places.map(p => p.id));
            }
        } catch (error) {
            console.error('Failed to discover places:', error);
        } finally {
            setIsLoadingPlaces(false);
        }
    };

    const handlePlanTrip = async () => {
        setIsPlanning(true);
        onPlanningStarted?.();
        try {
            const backendUrl = Config.BACKEND_URL || 'http://localhost:3000';
            const interests = selectedPrefs.length > 0
                ? selectedPrefs.map(p => PREF_TO_INTEREST[p] || p.toLowerCase())
                : ['popular'];
            // Get selected place objects
            const selectedPlaceObjects = discoveredPlaces.filter(p => selectedSpots.includes(p.id));

            const response = await fetch(`${backendUrl}/api/plan-stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    place: selectedLocation?.name || 'Unknown',
                    days: numDays,
                    interests,
                    discoveredPlaces: selectedPlaceObjects,
                }),
            });

            const reader = response.body?.getReader?.();
            // React Native fetch doesn't support ReadableStream natively,
            // so fall back to reading the full text response
            const text = await response.text();

            // Parse SSE events from the text
            let itineraryData = null;
            let geocodedData = null;
            let routedData = null;

            const events = text.split('\n\n').filter(Boolean);
            for (const eventBlock of events) {
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
                    if (eventType === 'itinerary') itineraryData = parsed;
                    if (eventType === 'geocoded') geocodedData = parsed;
                    if (eventType === 'routed') routedData = parsed;
                } catch (e) {
                    console.warn('Failed to parse SSE event:', e);
                }
            }

            // Use the most complete data available
            const finalItinerary = routedData?.itinerary || geocodedData?.itinerary || itineraryData?.itinerary;
            const destination = itineraryData?.destination || selectedLocation?.name;
            const totalDays = itineraryData?.totalDays || numDays;

            onTripCreated?.({
                numDays: totalDays,
                locationName: destination,
                itinerary: finalItinerary,
                discoveredPlaces: selectedPlaceObjects,
            });

            // Auto-save trip to backend
            try {
                const userStr = storage.getString('user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    const userId = user?.id || user?._id;
                    if (userId) {
                        await fetch(`${BACKEND_URL}/api/trips`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                userId,
                                destination: destination || selectedLocation?.name,
                                days: totalDays || numDays,
                                interests: selectedPrefs.map(p => PREF_TO_INTEREST[p] || p.toLowerCase()),
                                itinerary: finalItinerary,
                                discoveredPlaces: selectedPlaceObjects,
                            }),
                        });
                    }
                }
            } catch (saveErr) {
                console.warn('Failed to save trip to backend:', saveErr);
            }

            ref.current?.close();
        } catch (error) {
            console.error('Failed to plan trip:', error);
        } finally {
            setIsPlanning(false);
        }
    };

    // Build dynamic spot categories from discovered data
    const spotCategories = useMemo(() => {
        if (isFromVideo) {
            // For video places, use country names as categories
            const cats = new Set(['All']);
            discoveredPlaces.forEach(p => {
                if (p.country) cats.add(p.country);
            });
            return Array.from(cats);
        }
        const cats = new Set(['All']);
        discoveredPlaces.forEach(p => {
            if (p.interest) cats.add(p.interest.charAt(0).toUpperCase() + p.interest.slice(1));
        });
        return Array.from(cats);
    }, [discoveredPlaces, isFromVideo]);

    // Filter spots by selected category
    const filteredSpots = useMemo(() => {
        if (spotCategory === 'All') return discoveredPlaces;
        if (isFromVideo) {
            return discoveredPlaces.filter(p => p.country === spotCategory);
        }
        return discoveredPlaces.filter(p => {
            const cat = p.interest?.charAt(0).toUpperCase() + p.interest?.slice(1);
            return cat === spotCategory;
        });
    }, [discoveredPlaces, spotCategory, isFromVideo]);

    const toggleSpot = (id) => {
        setSelectedSpots(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    const renderDiscoverSpots = () => (
        <Animated.View entering={FadeIn} style={[styles.content, { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }]}>
            <View style={styles.discoverHeader}>
                <View style={styles.discoverTitleRow}>
                    <Text style={styles.discoverTitle}>Discover spots</Text>
                </View>

                {isLoadingPlaces ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryContainer}>
                        {[1, 2, 3, 4].map((i) => (
                            <Animated.View key={`cat-skel-${i}`} style={[styles.skeletonCategoryChip, skeletonStyle]} />
                        ))}
                    </ScrollView>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryContainer}>
                        {spotCategories.map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                style={[styles.categoryChip, spotCategory === cat && styles.categoryChipActive]}
                                onPress={() => setSpotCategory(cat)}
                            >
                                <Text style={[styles.categoryText, spotCategory === cat && styles.categoryTextActive]}>{cat}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>

            <View style={{ flex: 1 }}>
                {isLoadingPlaces ? (
                    <BottomSheetScrollView style={styles.spotsList} contentContainerStyle={{ paddingBottom: 100 }}>
                        {/* Skeleton City Header */}
                        <View style={styles.cityHeader}>
                            <View style={styles.cityHeaderLeft}>
                                <Animated.View style={[styles.cityCheck, styles.skeletonCityCheck, skeletonStyle]} />
                                <Animated.View style={[styles.skeletonCityName, skeletonStyle]} />
                            </View>
                            <Animated.View style={[styles.skeletonSpotsCount, skeletonStyle]} />
                        </View>

                        {/* Skeleton Spot Rows */}
                        {[0, 1, 2, 3, 4, 5].map(renderSkeletonSpot)}
                    </BottomSheetScrollView>
                ) : isFromVideo ? (
                    /* ── Grouped by Country → City for video places ── */
                    <BottomSheetScrollView style={styles.spotsList} contentContainerStyle={{ paddingBottom: 160 }}>
                        {(() => {
                            // Group filteredSpots by country → city
                            const grouped = {};
                            filteredSpots.forEach(spot => {
                                const c = spot.country || 'Unknown';
                                const ci = spot.city || 'Unknown';
                                if (!grouped[c]) grouped[c] = {};
                                if (!grouped[c][ci]) grouped[c][ci] = [];
                                grouped[c][ci].push(spot);
                            });
                            let globalIdx = 0;
                            return Object.entries(grouped).map(([country, cities]) => (
                                <View key={country}>
                                    {/* Country Header */}
                                    <View style={[styles.cityHeader, { backgroundColor: '#F8FAFC', marginTop: 4 }]}>
                                        <View style={styles.cityHeaderLeft}>
                                            <Text style={{ fontSize: 16 }}>🌍</Text>
                                            <Text style={[styles.cityName, { fontWeight: '700', fontSize: 15, color: '#1E293B' }]}>{country}</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.addLocationBtn}
                                            activeOpacity={0.7}
                                            onPress={() => fetchDiscoverPlacesWithArgs(country, ['popular'], 4)}
                                        >
                                            <Svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                <Path d="M12 5v14M5 12h14" />
                                            </Svg>
                                            <Text style={styles.addLocationBtnText}>Add spots in {country}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    {Object.entries(cities).map(([city, spots]) => {
                                        const citySpotIds = spots.map(s => s.id);
                                        const anyCitySelected = citySpotIds.some(id => selectedSpots.includes(id));
                                        const allCitySelected = citySpotIds.every(id => selectedSpots.includes(id));
                                        return (
                                            <View key={`${country}-${city}`}>
                                                {/* City Sub-header */}
                                                <TouchableOpacity
                                                    style={[styles.cityHeader, { paddingLeft: 28 }]}
                                                    activeOpacity={0.7}
                                                    onPress={() => {
                                                        if (allCitySelected) {
                                                            setSelectedSpots(prev => prev.filter(id => !citySpotIds.includes(id)));
                                                        } else {
                                                            setSelectedSpots(prev => [...new Set([...prev, ...citySpotIds])]);
                                                        }
                                                    }}
                                                >
                                                    <View style={styles.cityHeaderLeft}>
                                                        <View style={[styles.cityCheck, !anyCitySelected && styles.cityCheckInactive]}>
                                                            {anyCitySelected && (
                                                                <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                                    <Path d="M20 6L9 17l-5-5" />
                                                                </Svg>
                                                            )}
                                                        </View>
                                                        <Text style={styles.cityName}>{city}</Text>
                                                    </View>
                                                    <Text style={{ fontSize: 12, color: '#94A3B8' }}>{spots.length} spots</Text>
                                                </TouchableOpacity>
                                                {/* Spots */}
                                                {spots.map((spot) => {
                                                    globalIdx++;
                                                    const isChecked = selectedSpots.includes(spot.id);
                                                    return (
                                                        <TouchableOpacity key={spot.id} style={styles.spotRow} onPress={() => toggleSpot(spot.id)} activeOpacity={0.7} delayPressIn={100}>
                                                            <Text style={styles.spotNumber}>{globalIdx}.</Text>
                                                            {spot.photoUrl ? (
                                                                <Image source={{ uri: spot.photoUrl }} style={styles.spotImage} />
                                                            ) : (
                                                                <View style={[styles.spotImage, styles.spotImagePlaceholder]}>
                                                                    <Text style={styles.spotImagePlaceholderText}>📍</Text>
                                                                </View>
                                                            )}
                                                            <View style={styles.spotInfo}>
                                                                <Text style={styles.spotName} numberOfLines={1}>{spot.name}</Text>
                                                                {spot.address ? <Text style={styles.spotDesc} numberOfLines={2}>{spot.address}</Text> : null}
                                                            </View>
                                                            <View style={[styles.spotCheck, isChecked && styles.spotCheckActive]}>
                                                                {isChecked && (
                                                                    <Svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                                                        <Path d="M20 6L9 17l-5-5" />
                                                                    </Svg>
                                                                )}
                                                            </View>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                                {/* Add More Button below spots list */}
                                                <TouchableOpacity
                                                    style={[styles.addLocationBtn, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', paddingVertical: 8, paddingHorizontal: 16, marginTop: 12, marginBottom: 20, marginHorizontal: 24, justifyContent: 'center' }]}
                                                    activeOpacity={0.7}
                                                    onPress={() => fetchDiscoverPlacesWithArgs(city, ['popular'], 4)}
                                                >
                                                    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                        <Path d="M12 5v14M5 12h14" />
                                                    </Svg>
                                                    <Text style={[styles.addLocationBtnText, { fontSize: 13, color: '#64748B' }]}>Add more spots in {city}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })}
                                </View>
                            ));
                        })()}
                    </BottomSheetScrollView>
                ) : (
                    <BottomSheetScrollView style={styles.spotsList} contentContainerStyle={{ paddingBottom: 160 }}>
                        {/* City Section */}
                        <View style={styles.cityHeader}>
                            <View style={styles.cityHeaderLeft}>
                                <View style={styles.cityCheck}>
                                    <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <Path d="M20 6L9 17l-5-5" />
                                    </Svg>
                                </View>
                                <Text style={styles.cityName}>{selectedLocation?.name || 'Unknown'}</Text>
                            </View>
                        </View>

                        {/* Spots List */}
                        {filteredSpots.map((spot, idx) => {
                            const isChecked = selectedSpots.includes(spot.id);
                            const shortDesc = spot._isSavedSpot
                                ? '📌 From your saved spots'
                                : spot.interest
                                    ? spot.interest.charAt(0).toUpperCase() + spot.interest.slice(1)
                                    : spot.address || '';
                            return (
                                <TouchableOpacity key={spot.id} style={styles.spotRow} onPress={() => toggleSpot(spot.id)} activeOpacity={0.7} delayPressIn={100}>
                                    <Text style={styles.spotNumber}>{idx + 1}.</Text>
                                    {spot.photoUrl ? (
                                        <Image source={{ uri: spot.photoUrl }} style={styles.spotImage} />
                                    ) : (
                                        <View style={[styles.spotImage, styles.spotImagePlaceholder]}>
                                            <Text style={styles.spotImagePlaceholderText}>📍</Text>
                                        </View>
                                    )}
                                    <View style={styles.spotInfo}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={styles.spotName} numberOfLines={1}>{spot.name}</Text>
                                            {spot._isSavedSpot && (
                                                <View style={styles.savedTag}>
                                                    <Text style={styles.savedTagText}>Saved</Text>
                                                </View>
                                            )}
                                        </View>
                                        {shortDesc ? <Text style={styles.spotDesc} numberOfLines={2}>{shortDesc}</Text> : null}
                                    </View>
                                    <View style={[styles.spotCheck, isChecked && styles.spotCheckActive]}>
                                        {isChecked && (
                                            <Svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                                <Path d="M20 6L9 17l-5-5" />
                                            </Svg>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}

                        {/* Add More Button below spots list (Single Location View) */}
                        <TouchableOpacity
                            style={[styles.addLocationBtn, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', paddingVertical: 10, paddingHorizontal: 20, marginTop: 12, marginBottom: 40, justifyContent: 'center' }]}
                            activeOpacity={0.7}
                            onPress={() => fetchDiscoverPlacesWithArgs(selectedLocation?.name || 'Unknown', ['popular'], 4)}
                        >
                            <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <Path d="M12 5v14M5 12h14" />
                            </Svg>
                            <Text style={[styles.addLocationBtnText, { fontSize: 14, color: '#64748B' }]}>Add more spots in {selectedLocation?.name || 'Unknown'}</Text>
                        </TouchableOpacity>
                    </BottomSheetScrollView>
                )}

            </View>
        </Animated.View>
    );

    return (
        <BottomSheet
            ref={bottomSheetInternalRef}
            index={-1}
            snapPoints={snapPoints}
            enableDynamicSizing={false}
            enablePanDownToClose={true}
            enableContentPanningGesture={step !== 'howManyDays'}
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
            backdropComponent={renderBackdrop}
            backgroundStyle={step === 'discoverSpots' ? styles.sheetBackgroundWhite : styles.sheetBackground}
            handleIndicatorStyle={styles.handleIndicator}
            containerStyle={{ zIndex: 100 }}
            onChange={(index) => {
                onChange(index);
                if (index === -1) {
                    setStep('home');
                    setSearchActive(false);
                    setSearchQuery('');
                    setSelectedLocation(null);
                    setNumDays(4);
                    setSelectionMode('days');
                    setSelectedDates({});
                    setStartDate(null);
                    setEndDate(null);
                    setDaysSelected(false);
                    setSelectedPrefs([]);
                    setSpotCategory('All');
                    setSelectedSpots([]);
                    setDiscoveredPlaces([]);
                    setIsFromVideo(false);
                    setIsFromSavedSpots(false);
                }
            }}
            animationConfigs={animationConfigs}
        >
            <View style={[styles.container, { height: FULL_SHEET_HEIGHT }]}>

                {/* Gradient background — visible on all steps except discovery */}
                {step !== 'discoverSpots' && (
                    <LinearGradient
                        colors={['#F5F3FF', '#E0E7FF', '#BAE6FD', '#A7F3D0']}
                        locations={[0, 0.3, 0.65, 1]}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={styles.homeGradient}
                        pointerEvents="none"
                    />
                )}

                {step === 'home' && renderHome()}
                {step === 'preferences' && renderPreferences()}
                {step === 'howManyDays' && renderHowManyDays()}
                {step === 'discoverSpots' && renderDiscoverSpots()}

                {/* Bottom fade gradient + Floating Plan Trip Button */}
                {step === 'discoverSpots' && (
                    <>
                        {/* Fade gradient: transparent → white */}
                        <LinearGradient
                            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0.9)', 'rgba(255,255,255,1)']}
                            locations={[0, 0.25, 0.5, 0.75]}
                            style={styles.addSpotsGradient}
                            pointerEvents="none"
                        />
                        <View style={[styles.addSpotsBar, { bottom: Platform.OS === 'android' ? Math.max(60, 10 + insets.bottom) : 40 }]} pointerEvents="box-none">
                            {/* Save Spots button for discovered places */}
                            {!isFromSavedSpots && selectedSpots.length > 0 && !isPlanning && !isLoadingPlaces && (
                                <TouchableOpacity
                                    style={[styles.addSpotsButton, { backgroundColor: '#10B981', marginBottom: 8 }]}
                                    onPress={async () => {
                                        const storedUser = (() => { try { const u = storage.getString('user'); return u ? JSON.parse(u) : null; } catch { return null; } })();
                                        const userId = storedUser?.id || storedUser?._id;
                                        if (!userId) return;
                                        setIsSavingSpots(true);
                                        try {
                                            const spotsToSave = discoveredPlaces.filter(p => selectedSpots.includes(p.id)).map(p => ({
                                                country: p.country || 'Unknown',
                                                city: p.city || 'Unknown',
                                                name: p.name,
                                                placeId: p.id,
                                                address: p.address,
                                                rating: p.rating,
                                                userRatingCount: p.userRatingCount,
                                                photoUrl: p.photoUrl,
                                                coordinates: p.coordinates,
                                                source: 'discovery',
                                            }));
                                            const response = await fetch(`${BACKEND_URL}/api/spots`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ userId, spots: spotsToSave }),
                                            });
                                            const data = await response.json();
                                            if (data.success) {
                                                // Update UI: mark as saved and clear selection
                                                setDiscoveredPlaces(prev => prev.map(p => 
                                                    selectedSpots.includes(p.id) ? { ...p, _isSavedSpot: true } : p
                                                ));
                                                setSelectedSpots([]);
                                            }
                                        } catch (e) { console.warn('Save spots failed:', e); }
                                        setIsSavingSpots(false);
                                    }}
                                    disabled={isSavingSpots}
                                >
                                    {isSavingSpots ? (
                                        <View style={styles.planningRow}>
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                            <Text style={styles.addSpotsText}>  Saving spots...</Text>
                                        </View>
                                    ) : (
                                        <Text style={styles.addSpotsText}>💾 Save {selectedSpots.length} spots</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[styles.addSpotsButton, (isPlanning || isLoadingPlaces) && { opacity: 0.7 }]}
                                onPress={handlePlanTrip}
                                disabled={isPlanning || isLoadingPlaces || selectedSpots.length === 0}
                            >
                                {isPlanning ? (
                                    <View style={styles.planningRow}>
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                        <Text style={styles.addSpotsText}>  Planning your trip...</Text>
                                    </View>
                                ) : isLoadingPlaces ? (
                                    <View style={styles.planningRow}>
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                        <Text style={styles.addSpotsText}>  Discovering spots...</Text>
                                    </View>
                                ) : (
                                    <>
                                        <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <Path d="M5 12h14M12 5l7 7-7 7" />
                                        </Svg>
                                        <Text style={styles.addSpotsText}>Plan Trip</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>
        </BottomSheet>
    );
});

const styles = StyleSheet.create({
    sheetBackground: {
        backgroundColor: '#F5F3FF',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
    },
    sheetBackgroundWhite: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
    },
    sheetBackgroundGradient: {
        backgroundColor: 'transparent',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
    },
    homeGradient: {
        ...StyleSheet.absoluteFillObject,
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
    },

    searchOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.85)',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
    },
    handleIndicator: {
        width: 48,
        height: 5,
        backgroundColor: 'rgba(109, 40, 217, 0.22)',
        borderRadius: 100,
        alignSelf: 'center',
        marginTop: 12,
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
    },
    handleIndicatorGradient: {
        width: 40,
        height: 5,
        backgroundColor: 'rgba(99, 102, 241, 0.35)',
        borderRadius: 3,
        alignSelf: 'center',
        marginTop: 12,
    },
    handleIndicatorLight: {
        width: 40,
        height: 5,
        backgroundColor: 'rgba(255,255,255,0.6)',
        borderRadius: 3,
        alignSelf: 'center',
        marginTop: 12,
    },
    container: {
        flex: 1,
        overflow: 'hidden',
    },
    mainGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        flex: 1,
        paddingBottom: 80,
    },
    locationContainer: {
        paddingHorizontal: 32,
    },
    locationItem: {
        marginVertical: 8,
    },
    textRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    flagEmoji: {
        fontSize: 26,
        marginRight: 16,
    },
    locationText: {
        fontSize: 38,
        fontWeight: '800',
        letterSpacing: -1,
    },
    activeText: {
        color: '#0F172A',
    },
    inactiveText: {
        color: 'rgba(15, 23, 42, 0.15)',
    },
    footer: {
        paddingHorizontal: 22,
    },
    footerTitle: {
        fontSize: 52,
        fontFamily: FONT_SERIF,
        ...Platform.select({ ios: { fontStyle: 'italic', fontWeight: '600' }, android: {} }),
        color: '#0F172A',
        marginBottom: 10,
        letterSpacing: -0.5,
        lineHeight: 60,
    },
    footerSubtitle: {
        fontSize: 20,
        fontWeight: '600',
        color: 'rgba(12, 23, 46, 0.6)',
        marginBottom: 16,
    },
    searchBar: {
        backgroundColor: '#FFFFFF',
        height: 52,
        borderRadius: 26,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    searchIconContainer: {
        marginRight: 10,
    },
    searchText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    // Search View Styles
    searchHeader: {
        flex: 1,
        paddingHorizontal: 24,
    },
    searchInputContainer: {
        backgroundColor: '#FFFFFF',
        height: 54,
        borderRadius: 27,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 20,
        shadowColor: 'transparent',
    },
    backButton: {
        padding: 4,
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 17,
        fontWeight: '600',
        color: '#0F172A',
        paddingVertical: 10,
    },
    clearButton: {
        padding: 4,
    },
    resultsList: {
        paddingTop: 0,
        paddingBottom: 40,
    },
    resultItem: {
        marginBottom: 20,
        paddingHorizontal: 4,
    },
    resultName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0F172A',
        letterSpacing: -0.5,
    },
    resultCountry: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(15, 23, 42, 0.4)',
        marginTop: 1,
    },
    // Add Location buttons in discovery
    addLocationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    addLocationBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#3B82F6',
    },
    // Selected Location Bar (in Preferences)
    selectedLocationBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 14,
        marginHorizontal: 20,
        marginBottom: 40,
        marginTop: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.04)',
        borderRadius: 16,
    },
    selectedLocationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    selectedBarFlag: {
        fontSize: 22,
        marginRight: 10,
    },
    selectedBarName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    editButton: {
        marginLeft: 12,
    },
    editIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    continueButton: {
        backgroundColor: '#FFFFFF',
        height: 52,
        borderRadius: 26,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    continueText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },


    tagGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 32,
    },
    tagChip: {
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        paddingHorizontal: 12,
        paddingVertical: 14,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 0,
        borderColor: 'transparent',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        flexGrow: 0,
        flexShrink: 0,
        marginRight: 10,
        marginBottom: 10,
    },
    tagIcon: {
        fontSize: 15,
        marginRight: 8,
    },
    tagText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0F172A',
    },
    tagChipSelected: {
        borderColor: '#0F172A',
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        paddingHorizontal: 10,
        paddingVertical: 12,
    },
    tagTextSelected: {
        fontWeight: '600',
    },

    blackContinueButton: {
        backgroundColor: '#000000',
        height: 56,
        borderRadius: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    blackContinueText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    prefSection: {
        marginBottom: 24,
    },
    prefSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
    },
    prefSectionTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0F172A',
    },
    durationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    durationRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    durationRowIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    durationRowTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0F172A',
    },
    durationRowValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
        marginTop: 2,
    },
    // How Many Days Styles
    howManyHeader: {
        paddingHorizontal: 24,
        paddingTop: 40,
        zIndex: 10,
    },
    howManyTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 40,
    },
    backButtonLarge: {
        padding: 12,
    },
    segmentContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(15, 23, 42, 0.05)',
        padding: 4,
        borderRadius: 20,
    },
    segmentItem: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 16,
    },
    segmentItemActive: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    segmentTextInactive: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(15, 23, 42, 0.4)',
    },
    segmentTextActive: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    howManyTitle: {
        fontSize: 34,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -1,
    },
    pickerContainer: {
        height: 320,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pickerText: {
        fontSize: 54,
        fontWeight: '800',
    },
    pickerTextActive: {
        color: '#000000',
    },
    pickerTextInactive: {
        color: 'rgba(15, 23, 42, 0.4)',
    },
    calendarContainer: {
        height: 380,
        paddingHorizontal: 10,
    },
    blackConfirmButton: {
        backgroundColor: '#000000',
        height: 56,
        borderRadius: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    blackConfirmText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    // Discover Spots Styles
    discoverHeader: {
        paddingHorizontal: 24,
        paddingTop: 8,
    },
    discoverTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.5,
    },
    categoryScroll: {
        marginBottom: 8,
    },
    categoryContainer: {
        gap: 8,
        paddingRight: 24,
    },
    categoryChip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 16,
        borderWidth: 0,
        borderColor: 'transparent',
        backgroundColor: '#FFFFFF',
    },
    categoryChipActive: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
        borderWidth: 1.5,
        paddingHorizontal: 12.5,
        paddingVertical: 5.5,
    },
    categoryText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    categoryTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    spotsList: {
        flex: 1,
        paddingHorizontal: 24,
        paddingBottom: 110,
    },
    cityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    cityHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cityCheck: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cityCheckInactive: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: '#CBD5E1',
    },
    cityName: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
    },
    spotRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
        gap: 12,
    },
    spotNumber: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94A3B8',
        width: 22,
    },
    spotImage: {
        width: 56,
        height: 56,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
    },
    spotInfo: {
        flex: 1,
    },
    spotName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 2,
    },
    spotDesc: {
        fontSize: 12,
        fontWeight: '500',
        color: '#94A3B8',
        lineHeight: 16,
    },
    savedTag: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    savedTagText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#059669',
        letterSpacing: 0.3,
    },
    spotCheck: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    spotCheckActive: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
    },
    addSpotsGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 80,
    },
    addSpotsBar: {
        position: 'absolute',
        bottom: 40,
        left: 22,
        right: 22,
    },
    addSpotsButton: {
        backgroundColor: '#000000',
        height: 48,
        borderRadius: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    addSpotsText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748B',
    },
    planningRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    spotRating: {
        fontSize: 12,
        fontWeight: '600',
        color: '#F59E0B',
        marginTop: 2,
    },
    spotImagePlaceholder: {
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    spotImagePlaceholderText: {
        fontSize: 22,
    },
    spotsCount: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94A3B8',
    },
    // Discover Spots Title Row
    discoverTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        marginTop: -10
    },
    // Skeleton Placeholder Styles
    skeletonCategoryChip: {
        width: 72,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E2E8F0',
    },
    skeletonCityCheck: {
        backgroundColor: '#CBD5E1',
    },
    skeletonCityName: {
        width: 120,
        height: 20,
        borderRadius: 8,
        backgroundColor: '#E2E8F0',
    },
    skeletonSpotsCount: {
        width: 60,
        height: 16,
        borderRadius: 6,
        backgroundColor: '#E2E8F0',
    },
    skeletonNumber: {
        width: 18,
        height: 14,
        borderRadius: 4,
        backgroundColor: '#E2E8F0',
    },
    skeletonImage: {
        backgroundColor: '#E2E8F0',
    },
    skeletonTextLong: {
        width: '85%',
        height: 14,
        borderRadius: 6,
        backgroundColor: '#E2E8F0',
        marginBottom: 6,
    },
    skeletonTextMedium: {
        width: '65%',
        height: 12,
        borderRadius: 6,
        backgroundColor: '#E2E8F0',
        marginBottom: 4,
    },
    skeletonTextShort: {
        width: '40%',
        height: 12,
        borderRadius: 6,
        backgroundColor: '#E2E8F0',
    },
    skeletonCheck: {
        backgroundColor: '#E2E8F0',
        borderColor: '#E2E8F0',
    },
});

export default CreateTripSheet;
