/**
 * Home Screen - TripWays
 * @format
 */

import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Dimensions, Platform, ScrollView, TextInput, Keyboard, Image, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing, interpolate } from 'react-native-reanimated';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { MMKV } from 'react-native-mmkv';
import Config from 'react-native-config';

import CreateTripSheet from '../components/CreateTripSheet';
import TripOverviewSheet from '../components/TripOverviewSheet';
import ProfileOverlay from '../components/ProfileOverlay';
import MySpotIcon from '../assets/My-spot';

const storage = new MMKV();
const BACKEND_URL = Config.BACKEND_URL || 'http://localhost:3000';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Day colors matching the frontendweb reference
const DAY_COLORS = ['#6366F1', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

/**
 * Decode an encoded polyline string into an array of {latitude, longitude} coordinates.
 * Uses the standard Google Polyline Encoding Algorithm.
 */
function decodePolyline(encoded) {
    const points = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
        let b, shift = 0, result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        lat += (result & 1) ? ~(result >> 1) : (result >> 1);

        shift = 0; result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        lng += (result & 1) ? ~(result >> 1) : (result >> 1);

        points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
}

const HomeScreen = () => {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const tabBarHeight = 52 + insets.bottom;
    const bottomSheetRef = useRef(null);

    const createTripSheetRef = useRef(null); // Ref for Create Trip BottomSheet
    const tripOverviewSheetRef = useRef(null);
    const mapRef = useRef(null);
    const searchInputRef = useRef(null);
    const secondarySheetOpen = useRef(false); // Track if any overlay sheet is open
    const [tripData, setTripData] = useState(null);
    const [activeTab, setActiveTab] = React.useState('home');
    const [showCreateOptions, setShowCreateOptions] = React.useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [sheetIndex, setSheetIndex] = useState(1);
    const [savedTrips, setSavedTrips] = useState([]);
    const [savedSpots, setSavedSpots] = useState({});
    const [totalSpotsCount, setTotalSpotsCount] = useState(0);
    const [searchText, setSearchText] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    const [socialMode, setSocialMode] = useState(null); // null | 'instagram' | 'tiktok'
    const [videoProcessing, setVideoProcessing] = useState(false);
    const [videoProgress, setVideoProgress] = useState('');

    // Load user data from MMKV
    const storedUser = useMemo(() => {
        try {
            const userStr = storage.getString('user');
            return userStr ? JSON.parse(userStr) : null;
        } catch (e) {
            return null;
        }
    }, []);

    const userName = storedUser?.name || 'Traveler';
    const userInitials = useMemo(() => {
        if (!userName) return '?';
        const parts = userName.trim().split(' ');
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return userName.substring(0, 2).toUpperCase();
    }, [userName]);

    // Fetch saved trips from backend
    const fetchTrips = useCallback(() => {
        const userId = storedUser?.id || storedUser?._id;
        if (userId) {
            fetch(`${BACKEND_URL}/api/trips/user/${userId}`)
                .then(res => res.json())
                .then(data => {
                    if (data?.success && data?.trips) {
                        setSavedTrips(data.trips);
                    }
                })
                .catch(err => console.warn('Failed to fetch saved trips:', err));
        }
    }, [storedUser]);

    // Fetch saved spots from backend (grouped by country → city)
    const fetchSpots = useCallback(() => {
        const userId = storedUser?.id || storedUser?._id;
        if (userId) {
            fetch(`${BACKEND_URL}/api/spots/user/${userId}`)
                .then(res => res.json())
                .then(data => {
                    if (data?.success && data?.grouped) {
                        setSavedSpots(data.grouped);
                        setTotalSpotsCount(data.totalSpots || 0);
                    }
                })
                .catch(err => console.warn('Failed to fetch saved spots:', err));
        }
    }, [storedUser]);

    useEffect(() => {
        fetchTrips();
        fetchSpots();
    }, [fetchTrips, fetchSpots]);

    useEffect(() => {
        if (activeTab === 'trips') {
            fetchTrips();
        }
        if (activeTab === 'home') {
            fetchSpots();
        }
    }, [activeTab, fetchTrips, fetchSpots]);

    // Detect when user pastes a video URL in social mode and process it
    useEffect(() => {
        if (!socialMode || !searchText || videoProcessing) return;
        // Check if it looks like a URL
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

                const text = await response.text();
                // Parse SSE events
                let placesData = null;
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
                        if (eventType === 'progress') {
                            setVideoProgress(parsed.message || 'Processing...');
                        } else if (eventType === 'places') {
                            placesData = parsed;
                        } else if (eventType === 'error') {
                            throw new Error(parsed.message || 'Unknown error');
                        }
                    } catch (e) {
                        if (e.message && !e.message.includes('JSON')) throw e;
                    }
                }

                if (placesData && placesData.places && placesData.places.length > 0) {
                    // Clear search state
                    setSearchText('');
                    setSocialMode(null);
                    searchInputRef.current?.blur();
                    Keyboard.dismiss();
                    bottomSheetRef.current?.close();

                    // Open CreateTripSheet with video places
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

    // Animation values
    const overlayOpacity = useSharedValue(0);
    const overlayTranslateY = useSharedValue(20);

    // Create menu animation values
    const createMenuOpacity = useSharedValue(0);
    const createMenuScale = useSharedValue(0.9);
    const plusRotation = useSharedValue(0);
    const tabBarTranslateY = useSharedValue(0);
    // Tracks the real-time Y position of the spots sheet (from top of screen)
    const sheetAnimatedPosition = useSharedValue(SCREEN_HEIGHT * 0.5);

    const animatedOverlayStyle = useAnimatedStyle(() => {
        return {
            opacity: overlayOpacity.value,
            transform: [{ translateY: overlayTranslateY.value }],
        };
    });

    const animatedCreateMenuStyle = useAnimatedStyle(() => {
        return {
            opacity: createMenuOpacity.value,
            transform: [{ scale: createMenuScale.value }, { translateY: (1 - createMenuOpacity.value) * 20 }],
        };
    });

    const animatedPlusStyle = useAnimatedStyle(() => {
        return {
            transform: [{ rotate: `${plusRotation.value}deg` }],
        };
    });

    const animatedTabBarStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: tabBarTranslateY.value }],
        };
    });

    // FAB floats 16px above whatever height the sheet currently is.
    // On Android, animatedPosition is relative to the full screen, so we use
    // screen height (includes nav bar) rather than window height.
    // Only visible near the 50% snap point — fades out both above AND below.
    const fabScreenHeight = Platform.OS === 'android'
        ? Dimensions.get('screen').height
        : SCREEN_HEIGHT;
    const halfSnapY = SCREEN_HEIGHT * 0.5; // Y position when sheet is at 50%
    const bottomSnapY = SCREEN_HEIGHT * 0.88; // Y position when sheet is at 12%
    const fabAnimatedStyle = useAnimatedStyle(() => {
        // Fade out above 50%
        const opacityAbove = interpolate(
            sheetAnimatedPosition.value,
            [halfSnapY - SCREEN_HEIGHT * 0.08, halfSnapY],
            [0, 1],
            'clamp'
        );
        // Fade out below 50%
        const opacityBelow = interpolate(
            sheetAnimatedPosition.value,
            [halfSnapY, bottomSnapY],
            [1, 0],
            'clamp'
        );
        return {
            bottom: fabScreenHeight - sheetAnimatedPosition.value + 16,
            opacity: opacityAbove * opacityBelow,
        };
    });

    // Crossfade between avatar and close button based on sheet position
    const thresholdY = SCREEN_HEIGHT * 0.5;  // 50% snap Y from top
    const fadeRange = SCREEN_HEIGHT * 0.06;   // smooth over ~6% of screen
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

    // Hide floating tab bar when keyboard is open
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = () => {
            setKeyboardVisible(true);
            tabBarTranslateY.value = withTiming(200, { duration: 250 });
        };
        const onHide = () => {
            setKeyboardVisible(false);
            // Only restore tab bar if no secondary sheet is open
            if (!secondarySheetOpen.current) {
                tabBarTranslateY.value = withTiming(0, { duration: 250 });
            }
        };

        const sub1 = Keyboard.addListener(showEvent, onShow);
        const sub2 = Keyboard.addListener(hideEvent, onHide);
        return () => {
            sub1.remove();
            sub2.remove();
        };
    }, []);

    useEffect(() => {
        if (activeTab === 'trips') {
            overlayOpacity.value = withTiming(1, { duration: 300 });
            overlayTranslateY.value = withTiming(0, { duration: 300 });
        } else {
            overlayOpacity.value = withTiming(0, { duration: 350 });
            overlayTranslateY.value = withTiming(20, { duration: 350 });

            // Only restore if no secondary sheet is open
            if (!secondarySheetOpen.current) {
                tabBarTranslateY.value = withTiming(0, {
                    duration: 400,
                    easing: Easing.bezier(0.33, 1, 0.68, 1)
                });
                setTimeout(() => {
                    bottomSheetRef.current?.snapToIndex(1);
                }, 150);
            }
        }
    }, [activeTab]);

    // Fit the map to show all itinerary markers when tripData changes
    useEffect(() => {
        if (!tripData?.itinerary || !mapRef.current) return;
        const coords = [];
        tripData.itinerary.forEach(day => {
            (day.places || []).forEach(place => {
                if (place.coordinates?.lat && place.coordinates?.lng) {
                    coords.push({ latitude: place.coordinates.lat, longitude: place.coordinates.lng });
                }
            });
        });
        if (coords.length > 0) {
            setTimeout(() => {
                mapRef.current?.fitToCoordinates(coords, {
                    edgePadding: { top: 100, right: 60, bottom: 400, left: 60 },
                    animated: true,
                });
            }, 600);
        }
    }, [tripData]);

    useEffect(() => {
        if (showCreateOptions) {
            createMenuOpacity.value = withTiming(1, { duration: 250 });
            createMenuScale.value = withTiming(1, { duration: 250 });
            plusRotation.value = withTiming(45, { duration: 250 });
        } else {
            createMenuOpacity.value = withTiming(0, { duration: 200 });
            createMenuScale.value = withTiming(0.9, { duration: 200 });
            plusRotation.value = withTiming(0, { duration: 200 });
        }
    }, [showCreateOptions]);



    const snapPoints = useMemo(() => ['12%', '50%', '90%'], []);

    const sheetAnimationConfig = useMemo(() => ({
        duration: 400,
        easing: Easing.bezier(0.33, 1, 0.68, 1),
    }), []);

    const renderBackdrop = useCallback(
        (props) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.4}
            />
        ),
        []
    );

    const handleSheetChanges = useCallback((index) => {
        console.log('handleSheetChanges', index);
        setSheetIndex(index);
        if (index !== 2) {
            Keyboard.dismiss();
        }
    }, []);


    const handleTripOverviewSheetChange = useCallback((index) => {
        secondarySheetOpen.current = index > -1;
        if (index > -1) {
            tabBarTranslateY.value = withTiming(tabBarHeight, {
                duration: 400,
                easing: Easing.bezier(0.33, 1, 0.68, 1)
            });
        } else {
            tabBarTranslateY.value = withTiming(0, {
                duration: 400,
                easing: Easing.bezier(0.33, 1, 0.68, 1)
            });
            if (activeTab === 'home') {
                setTimeout(() => {
                    bottomSheetRef.current?.snapToIndex(1);
                }, 150);
            }
        }
    }, [tabBarHeight, activeTab]);

    const handleCreateTripSheetChange = useCallback((index) => {
        secondarySheetOpen.current = index > -1;
        if (index > -1) {
            tabBarTranslateY.value = withTiming(tabBarHeight, {
                duration: 400,
                easing: Easing.bezier(0.33, 1, 0.68, 1)
            });
        } else {
            tabBarTranslateY.value = withTiming(0, {
                duration: 400,
                easing: Easing.bezier(0.33, 1, 0.68, 1)
            });
            if (activeTab === 'home') {
                setTimeout(() => {
                    bottomSheetRef.current?.snapToIndex(1);
                }, 150);
            }
        }
    }, [tabBarHeight, activeTab]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            {/* Map Background */}
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={{
                    latitude: 28.6139,
                    longitude: 77.2090,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                }}
            >
                {/* Default marker when no trip data */}
                {!tripData && (
                    <Marker
                        coordinate={{ latitude: 28.6139, longitude: 77.2090 }}
                        title={"TripWays"}
                        description={"Start your journey here"}
                    />
                )}

                {/* Itinerary place markers — styled circles with numbers like frontendweb */}
                {tripData?.itinerary?.flatMap((day, dayIndex) => {
                    const dayColor = DAY_COLORS[dayIndex % DAY_COLORS.length];
                    return (day.places || [])
                        .filter(place => place.coordinates?.lat && place.coordinates?.lng)
                        .map((place, placeIndex) => (
                            <Marker
                                key={`marker-${day.day}-${placeIndex}`}
                                coordinate={{
                                    latitude: place.coordinates.lat,
                                    longitude: place.coordinates.lng,
                                }}
                                title={place.name}
                                description={`Day ${day.day} • ${place.category || 'sightseeing'}`}
                                anchor={{ x: 0.5, y: 0.5 }}
                            >
                                <View style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    backgroundColor: dayColor,
                                    borderWidth: 2,
                                    borderColor: '#FFFFFF',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 3,
                                    elevation: 4,
                                }}>
                                    <Text style={{
                                        color: '#FFFFFF',
                                        fontSize: 12,
                                        fontWeight: '700',
                                    }}>{placeIndex + 1}</Text>
                                </View>
                            </Marker>
                        ));
                })}

                {/* Route polylines — decoded from backend route data */}
                {tripData?.itinerary?.map((day, dayIndex) => {
                    if (!day.route?.polyline) return null;
                    return (
                        <Polyline
                            key={`route-${day.day}`}
                            coordinates={decodePolyline(day.route.polyline)}
                            strokeColor={DAY_COLORS[dayIndex % DAY_COLORS.length]}
                            strokeWidth={4}
                        />
                    );
                })}

                {/* Fallback straight-line polylines when no route polyline exists */}
                {tripData?.itinerary?.map((day, dayIndex) => {
                    if (day.route?.polyline) return null;
                    const coords = (day.places || [])
                        .filter(p => p.coordinates?.lat && p.coordinates?.lng)
                        .map(p => ({ latitude: p.coordinates.lat, longitude: p.coordinates.lng }));
                    if (coords.length <= 1) return null;
                    return (
                        <Polyline
                            key={`fallback-${day.day}`}
                            coordinates={coords}
                            strokeColor={DAY_COLORS[dayIndex % DAY_COLORS.length]}
                            strokeWidth={3}
                            lineDashPattern={[6, 4]}
                        />
                    );
                })}
            </MapView>


            {/* Floating My Spots button — tracks the spots sheet */}
            <Animated.View
                style={[styles.mySpotFab, fabAnimatedStyle]}
                pointerEvents="box-none"
            >
                <TouchableOpacity activeOpacity={0.85} style={styles.mySpotFabInner}>
                    <MySpotIcon width={22} height={22} fill="#3B82F6" />
                </TouchableOpacity>
            </Animated.View>

            {/* Bottom Sheet spots */}
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
                    {/* Apple Maps-style search row */}
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
                                    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                                    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <Path d="M18 6 6 18M6 6l12 12" />
                                    </Svg>
                                </TouchableOpacity>
                            </Animated.View>
                        </View>
                    </View>

                    {/* Conditional content based on search focus & text */}
                    {searchFocused && searchText.length === 0 && !socialMode ? (
                        /* ── Social Search: shown when focused + nothing typed + no platform selected ── */
                        <View style={styles.socialSearchContainer}>
                            <Text style={styles.sheetSectionLabel}>Search on</Text>
                            <View style={styles.socialCardsRow}>
                                {/* Instagram card */}
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

                                {/* TikTok card */}
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

                            {/* Quick suggestion chips */}
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
                        /* ── Search results / URL input: shown when focused + user has typed or platform selected ── */
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
                                    <View style={styles.emptySpots}>
                                        <Svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <Circle cx="11" cy="11" r="8" />
                                            <Path d="m21 21-4.3-4.3" />
                                        </Svg>
                                        <Text style={[styles.emptySpotsText, { marginTop: 12 }]}>Searching places…</Text>
                                        <Text style={styles.emptySpotsHint}>Results will appear here</Text>
                                    </View>
                                </>
                            )}
                        </View>
                    ) : (
                        /* ── My Spots: default view when not searching ── */
                        <View>
                            {/* Header row */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 4 }}>
                                <View>
                                    <Text style={{ fontSize: 22, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 }}>My Spots</Text>
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
                                        <View key={country} style={{ marginTop: 16 }}>
                                            {/* Country row */}
                                            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 }}>
                                                <Text style={{ fontSize: 20, fontWeight: '700', color: '#1E293B' }}>{country}</Text>
                                                <Text style={{ fontSize: 12, color: '#94A3B8' }}>{cityCount} {cityCount === 1 ? 'City' : 'Cities'} • {spotCount} {spotCount === 1 ? 'Spot' : 'Spots'}</Text>
                                            </View>

                                            {/* City cards — horizontal scroll */}
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 12 }}>
                                                {Object.entries(cities).map(([city, cityData]) => {
                                                    const cityKey = `${country}::${city}`;
                                                    return (
                                                        <TouchableOpacity
                                                            key={cityKey}
                                                            activeOpacity={0.85}
                                                            onPress={() => {
                                                                // Close bottom sheet & hide tab bar, then open Discover Spots
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
            </BottomSheet>

            {/* Trips Overlay */}
            <Animated.View
                style={[
                    styles.tripsOverlay,
                    { paddingTop: insets.top },
                    animatedOverlayStyle
                ]}
                pointerEvents={activeTab === 'trips' ? 'auto' : 'none'}
            >
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tripsScrollContent}>
                    <View style={styles.tripsHeader}>
                        <Text style={styles.tripsLogo}>Roamy</Text>
                        <TouchableOpacity style={styles.tripsAvatar}>
                            <Text style={styles.tripsAvatarText}>A</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.sectionTitle}>Travel Guides</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.guidesScroll}>
                        {[
                            { title: '1-Day Paris Trip', spots: '9 Spots', color: '#C4B5A5' },
                            { title: '1-Day Rome Trip', spots: '7 Spots', color: '#94A3A8' },
                            { title: '3-Day London Trip', spots: '19 Spots', color: '#6366F1' },
                        ].map((guide, idx) => (
                            <TouchableOpacity key={idx} style={[styles.guideCard, { backgroundColor: guide.color }]}>
                                <View style={styles.guideCardOverlay}>
                                    <Text style={styles.guideTitle}>{guide.title}</Text>
                                    <Text style={styles.guideSpots}>{guide.spots}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <Text style={styles.sectionTitle}>My Trips</Text>
                    <View style={styles.myTripsList}>
                        {savedTrips.length > 0 ? (
                            savedTrips.map((trip, idx) => {
                                const tripColors = ['#EEF2FF', '#F7FEE7', '#FDF2F8', '#FFF7ED', '#F0F9FF'];
                                const iconColors = ['#3B82F6', '#84CC16', '#D946EF', '#F97316', '#06B6D4'];
                                return (
                                    <TouchableOpacity
                                        key={trip._id || idx}
                                        style={[styles.tripCard, { backgroundColor: tripColors[idx % tripColors.length] }]}
                                        activeOpacity={0.7}
                                        delayPressIn={100}
                                        onPress={() => {
                                            const tripId = trip._id;
                                            if (!tripId) return;
                                            fetch(`${BACKEND_URL}/api/trips/${tripId}`)
                                                .then(res => res.json())
                                                .then(data => {
                                                    if (data?.success && data?.trip) {
                                                        const fullTrip = data.trip;
                                                        setTripData({
                                                            numDays: fullTrip.days,
                                                            locationName: fullTrip.destination,
                                                            itinerary: fullTrip.itinerary,
                                                            discoveredPlaces: fullTrip.discoveredPlaces || [],
                                                        });
                                                        setActiveTab('home');
                                                        setTimeout(() => {
                                                            bottomSheetRef.current?.close();
                                                            setTimeout(() => {
                                                                tabBarTranslateY.value = withTiming(tabBarHeight, {
                                                                    duration: 400,
                                                                    easing: Easing.bezier(0.33, 1, 0.68, 1),
                                                                });
                                                            }, 150);
                                                            setTimeout(() => {
                                                                tripOverviewSheetRef.current?.expand();
                                                            }, 400);
                                                        }, 200);
                                                    }
                                                })
                                                .catch(err => console.warn('Failed to fetch trip details:', err));
                                        }}
                                    >
                                        {trip.tripRepPic ? (
                                            <Image source={{ uri: trip.tripRepPic }} style={styles.tripImage} />
                                        ) : (
                                            <View style={styles.tripImagePlaceholder} />
                                        )}
                                        <View style={styles.tripInfo}>
                                            <Text style={[styles.tripTitle, { color: iconColors[idx % iconColors.length] }]}>
                                                {trip.days}-Day {trip.destination} Trip
                                            </Text>
                                            <Text style={styles.tripDetails}>{trip.days} Days {trip.days - 1} Nights</Text>
                                            <Text style={styles.tripDetails}>{(trip.interests || []).join(', ')}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })
                        ) : (
                            <View style={{ padding: 20, alignItems: 'center' }}>
                                <Text style={{ color: '#94A3B8', fontSize: 14, fontWeight: '500' }}>No saved trips yet</Text>
                                <Text style={{ color: '#CBD5E1', fontSize: 12, marginTop: 4 }}>Create your first trip to see it here!</Text>
                            </View>
                        )}
                    </View>

                    {/* Saved Spots Section */}
                    {Object.keys(savedSpots).length > 0 && (
                        <>
                            <Text style={styles.sectionTitle}>📍 Saved Spots</Text>
                            {Object.entries(savedSpots).map(([country, cities]) => (
                                <View key={country} style={{ marginBottom: 12 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B', paddingHorizontal: 20, marginBottom: 8 }}>
                                        🌍 {country}
                                    </Text>
                                    {Object.entries(cities).map(([city, cityData]) => (
                                        <View key={`${country}-${city}`} style={{ marginBottom: 12 }}>
                                            {/* City banner with representative photo */}
                                            {cityData.cityPhoto && (
                                                <View style={{ marginHorizontal: 20, marginBottom: 8, borderRadius: 12, overflow: 'hidden' }}>
                                                    <Image source={{ uri: cityData.cityPhoto }} style={{ width: '100%', height: 100, borderRadius: 12 }} />
                                                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, backgroundColor: 'rgba(0,0,0,0.4)' }}>
                                                        <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>{city}</Text>
                                                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>{cityData.spots.length} saved spots</Text>
                                                    </View>
                                                </View>
                                            )}
                                            {!cityData.cityPhoto && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, marginBottom: 6 }}>
                                                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#475569', flex: 1 }}>{city}</Text>
                                                    <Text style={{ fontSize: 11, color: '#94A3B8' }}>{cityData.spots.length} spots</Text>
                                                </View>
                                            )}
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 12 }}>
                                                {cityData.spots.map((spot) => (
                                                    <View key={spot._id} style={{ width: 120, marginRight: 10 }}>
                                                        {spot.photoUrl ? (
                                                            <Image source={{ uri: spot.photoUrl }} style={{ width: 120, height: 80, borderRadius: 10 }} />
                                                        ) : (
                                                            <View style={{ width: 120, height: 80, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }}>
                                                                <Text style={{ fontSize: 24 }}>📍</Text>
                                                            </View>
                                                        )}
                                                        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '600', color: '#334155', marginTop: 4 }}>{spot.name}</Text>
                                                        {spot.rating && (
                                                            <Text style={{ fontSize: 10, color: '#94A3B8' }}>⭐ {spot.rating}</Text>
                                                        )}
                                                    </View>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    ))}
                                </View>
                            ))}
                        </>
                    )}
                </ScrollView>
            </Animated.View>

            {/* Create Options Menu */}
            {showCreateOptions && (
                <TouchableOpacity
                    style={[styles.createMenuBackdrop, { paddingBottom: 52 + insets.bottom + 12 }]}
                    activeOpacity={1}
                    onPress={() => setShowCreateOptions(false)}
                >
                    <Animated.View style={[styles.createMenuContainer, animatedCreateMenuStyle]}>
                        <TouchableOpacity
                            style={styles.createOptionItem}
                            onPress={() => {
                                setShowCreateOptions(false);

                                // Step 1: Handle Trips Overlay if visible
                                let overlayDelay = 0;
                                if (activeTab === 'trips') {
                                    setActiveTab('home');
                                    overlayDelay = 200; // Give some head start to overlay closing
                                }

                                // Sequence: Close Welcome Sheet -> Hide Tab Bar -> Open Create Trip
                                setTimeout(() => {
                                    bottomSheetRef.current?.close();

                                    setTimeout(() => {
                                        tabBarTranslateY.value = withTiming(tabBarHeight, {
                                            duration: 400,
                                            easing: Easing.bezier(0.33, 1, 0.68, 1)
                                        });
                                    }, 150);

                                    setTimeout(() => {
                                        createTripSheetRef.current?.expand();
                                    }, 400);
                                }, overlayDelay);
                            }}
                        >
                            <View style={styles.optionIconContainer}>
                                <Svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EC4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <Rect x="2" y="7" width="20" height="14" rx="2" />
                                    <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                                    <Path d="M12 11v6M9 14h6" />
                                </Svg>
                            </View>
                            <View style={styles.optionTextContainer}>
                                <Text style={styles.optionTitle}>Create New Trip</Text>
                                <Text style={styles.optionSubtitle}>Plan your next adventure</Text>
                            </View>
                        </TouchableOpacity>


                    </Animated.View>
                </TouchableOpacity>
            )}



            {/* Create Trip Bottom Sheet */}
            <CreateTripSheet
                ref={createTripSheetRef}
                onChange={handleCreateTripSheetChange}
                animationConfigs={sheetAnimationConfig}
                onTripCreated={(data) => {
                    setTripData(data);
                    // Fetch trips after delay to ensure backend has saved
                    setTimeout(() => {
                        fetchTrips();
                    }, 2000);
                    setTimeout(() => {
                        tripOverviewSheetRef.current?.expand();
                    }, 500);
                }}
            />

            {/* Trip Overview Bottom Sheet */}
            <TripOverviewSheet
                ref={tripOverviewSheetRef}
                onChange={handleTripOverviewSheetChange}
                animationConfigs={sheetAnimationConfig}
                tripData={tripData}
            />

            {/* Custom Bottom Tab Bar — floating pill */}
            <Animated.View style={[styles.tabBarContainer, { bottom: insets.bottom + (Platform.OS === 'android' ? 15 : 0) }, animatedTabBarStyle]}>
                <TouchableOpacity
                    style={styles.tabItem}
                    onPress={() => {
                        setActiveTab('home');
                        setShowCreateOptions(false);
                    }}
                >
                    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={activeTab === 'home' ? "#3B82F6" : "#71717A"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <Circle cx="12" cy="12" r="10" />
                        <Path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" fill={activeTab === 'home' ? "#3B82F6" : "none"} />
                    </Svg>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.plusButton}
                    onPress={() => setShowCreateOptions(!showCreateOptions)}
                >
                    <Animated.View style={animatedPlusStyle}>
                        <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M12 5v14M5 12h14" />
                        </Svg>
                    </Animated.View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tabItem}
                    onPress={() => {
                        setActiveTab('trips');
                        setShowCreateOptions(false);
                    }}
                >
                    <Svg width="20" height="20" viewBox="0 0 24 24" fill={activeTab === 'trips' ? "#3B82F6" : "none"} stroke={activeTab === 'trips' ? "#3B82F6" : "#71717A"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <Rect x="2" y="7" width="20" height="14" rx="2" />
                        <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </Svg>
                </TouchableOpacity>
            </Animated.View>

            {/* Profile Overlay */}
            <ProfileOverlay
                visible={showProfile}
                onClose={() => setShowProfile(false)}
                navigation={navigation}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    map: {
        flex: 1,
    },
    // Sheet search row (avatar sits outside the pill)
    sheetSearchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 8,
        marginBottom: 16,
    },
    // Sheet search bar (Apple Maps style)
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
        width: 38,
        height: 38,
    },
    searchButtonLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 38,
        height: 38,
    },
    sheetSearchClose: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetSearchAvatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetSearchAvatarText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    sheetSectionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#94A3B8',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    spotRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 11,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    spotIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    spotEmoji: {
        fontSize: 20,
    },
    spotTextWrap: {
        flex: 1,
    },
    spotName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B',
    },
    spotSub: {
        fontSize: 13,
        color: '#94A3B8',
        marginTop: 2,
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
    // Social Search styles
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
    mySpotFab: {
        position: 'absolute',
        right: 16,
        width: 46,
        height: 46,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
        zIndex: 5,
    },
    mySpotFabInner: {
        width: 46,
        height: 46,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetBackground: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
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
    welcomeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    welcomeLabel: {
        fontSize: 18,
        color: '#71717A',
        fontWeight: '500',
    },
    userName: {
        fontSize: 24,
        fontWeight: '800',
        color: '#18181B',
        marginTop: 2,
    },
    importGuideBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF7ED',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    importGuideText: {
        color: '#FF8C42',
        fontSize: 14,
        fontWeight: '600',
    },
    illustrationContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginVertical: 0,
        height: 140,
        width: 300,
        marginTop: -15
    },
    illustration: {
        width: SCREEN_WIDTH * 0.7,
        height: '100%',
    },
    importSpotCard: {
        backgroundColor: '#F0F9FF',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    importRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    importIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#E0F2FE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    importText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#18181B',
    },
    getStartedBtn: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    getStartedText: {
        color: '#94A3B8',
        fontSize: 16,
        fontWeight: '600',
    },
    tabBarContainer: {
        position: 'absolute',
        left: 90,
        right: 90,
        height: 52,
        backgroundColor: 'rgba(255,255,255,0.95)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 20,
        borderRadius: 26,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.10,
        shadowRadius: 16,
        elevation: 10,
        zIndex: 1000,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
    },
    tabItem: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    plusButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#3F3F46',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#3F3F46',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 4,
    },
    // Trips Overlay Styles
    tripsOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#FFFFFF',
        zIndex: 10,
    },
    tripsScrollContent: {
        paddingBottom: 100,
    },
    tripsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 20,
    },
    tripsLogo: {
        fontSize: 32,
        fontWeight: '900',
        color: '#18181B',
        letterSpacing: -1,
    },
    tripsAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#7C3AED',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tripsAvatarText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '600',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#94A3B8',
        paddingHorizontal: 24,
        marginTop: 10,
        marginBottom: 15,
    },
    guidesScroll: {
        paddingLeft: 24,
        paddingRight: 10,
    },
    guideCard: {
        width: 160,
        height: 220,
        borderRadius: 24,
        marginRight: 14,
        overflow: 'hidden',
    },
    guideCardOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.1)',
        justifyContent: 'flex-end',
        padding: 16,
    },
    guideTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    guideSpots: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
        marginTop: 4,
    },
    myTripsList: {
        paddingHorizontal: 24,
        gap: 16,
        marginTop: 5,
    },
    tripCard: {
        flexDirection: 'row',
        padding: 12,
        borderRadius: 24,
        alignItems: 'center',
    },
    tripImagePlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    tripImage: {
        width: 100,
        height: 100,
        borderRadius: 20,
    },
    tripInfo: {
        flex: 1,
        marginLeft: 16,
    },
    tripTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    tripDetails: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
        marginTop: 2,
    },
    // Create Menu Styles
    createMenuBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.1)',
        zIndex: 15, // Sit between overlay and tab bar
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    createMenuContainer: {
        width: SCREEN_WIDTH - 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    createOptionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    optionIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionTextContainer: {
        marginLeft: 12,
        flex: 1,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
    },
    optionSubtitle: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 1,
        fontWeight: '500',
    },
    menuDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginHorizontal: 15,
    },
    sheetHandleIndicator: {
        width: 40,
        height: 5,
        backgroundColor: '#E2E8F0',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 20,
    },
});

export default HomeScreen;
