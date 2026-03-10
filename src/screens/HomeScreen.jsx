/**
 * Home Screen - TripWays
 * @format
 */

import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Dimensions, Platform, ScrollView, TextInput, Keyboard, Image, ActivityIndicator, FlatList, Modal } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing, interpolate } from 'react-native-reanimated';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { MMKV } from 'react-native-mmkv';
import Config from 'react-native-config';

import CreateTripSheet from '../components/CreateTripSheet';
import TripOverviewSheet from '../components/TripOverviewSheet';
import SpotDetailSheet from '../components/SpotDetailSheet';
import ProfileOverlay from '../components/ProfileOverlay';
import { detectPlatformFromUrl, getSharedUrl, setAppGroupData } from '../services/ShareIntent';
import MySpotIcon from '../assets/My-spot';

const storage = new MMKV();
const BACKEND_URL = Config.BACKEND_URL || 'http://localhost:3000';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Day colors matching the frontendweb reference
const DAY_COLORS = ['#6366F1', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

// Custom map style — natural map, hide clutter labels, muted roads, smaller city names
const customMapStyle = [
    // Hide POI labels (restaurants, shops, etc.)
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    // Hide road name labels
    { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    // Mute road geometry — lighter, desaturated
    { featureType: 'road', elementType: 'geometry', stylers: [{ saturation: -80 }, { lightness: 30 }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ saturation: -70 }, { lightness: 25 }] },
    // Hide transit labels
    { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    // City / locality labels — lighter color, thin stroke
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#aaaaaa' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 1 }] },
    // Neighborhood labels — very light
    { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#cccccc' }] },
    { featureType: 'administrative.neighborhood', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 1 }] },
];

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
    const route = useRoute();
    const sharedUrlProcessed = useRef(false);
    const tabBarHeight = 52 + insets.bottom + (Platform.OS === 'android' ? 120 : 40); // Increased buffer to fully hide on both platforms
    const bottomSheetRef = useRef(null);

    const createTripSheetRef = useRef(null); // Ref for Create Trip BottomSheet
    const tripOverviewSheetRef = useRef(null);
    const spotDetailSheetRef = useRef(null);
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
    const [isTripLoading, setIsTripLoading] = useState(false);
    const [isTripOverviewOpen, setIsTripOverviewOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSavingTrip, setIsSavingTrip] = useState(false);
    const [selectedItinerarySpot, setSelectedItinerarySpot] = useState(null);

    // Spot search state
    const [spotSearchResults, setSpotSearchResults] = useState([]);
    const [spotSearchLoading, setSpotSearchLoading] = useState(false);
    const [selectedSpotDetail, setSelectedSpotDetail] = useState(null);
    const [spotDetailLoading, setSpotDetailLoading] = useState(false);
    const [savingSpotId, setSavingSpotId] = useState(null); // placeId currently being saved
    const [savedPlaceIds, setSavedPlaceIds] = useState(new Set()); // already-saved placeIds

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

        // Sync userId & backendUrl to App Group UserDefaults for the Share Extension
        const userId = storedUser?.id || storedUser?._id;
        if (userId) {
            setAppGroupData(userId, BACKEND_URL);
        }
    }, [fetchTrips, fetchSpots]);

    // ── Handle shared URL from share intent (Instagram/TikTok share) ──
    useEffect(() => {
        const handleSharedUrl = (url) => {
            if (!url || sharedUrlProcessed.current) return;
            sharedUrlProcessed.current = true;
            const platform = detectPlatformFromUrl(url) || 'instagram';
            // Activate social mode and set the URL — this triggers the existing
            // processVideoUrl useEffect automatically
            setSocialMode(platform);
            setSearchText(url);
            setSearchFocused(true);
            // Expand the bottom sheet so user sees the processing state
            setTimeout(() => {
                bottomSheetRef.current?.snapToIndex(2);
            }, 300);
        };

        // Cold launch: check route params
        if (route.params?.sharedUrl) {
            handleSharedUrl(route.params.sharedUrl);
            // Clear the param so it doesn't re-trigger
            navigation.setParams({ sharedUrl: null });
            return;
        }

        // Also check native module directly (in case param wasn't set yet)
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
                    sharedUrlProcessed.current = false; // reset for new share
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

    useEffect(() => {
        if (activeTab === 'trips') {
            fetchTrips();
        }
        if (activeTab === 'home') {
            fetchSpots();
        }
    }, [activeTab, fetchTrips, fetchSpots]);

    // Build a Set of already-saved placeIds so we can show the filled bookmark
    useEffect(() => {
        const ids = new Set();
        Object.values(savedSpots).forEach(cities => {
            Object.values(cities).forEach(cityData => {
                (cityData.spots || []).forEach(spot => {
                    if (spot.placeId) ids.add(spot.placeId);
                });
            });
        });
        setSavedPlaceIds(ids);
    }, [savedSpots]);

    // Google Places Autocomplete (v1) for spot search
    useEffect(() => {
        if (socialMode || searchText.length < 2) {
            setSpotSearchResults([]);
            return;
        }
        setSpotSearchLoading(true);

        const fetchSpotSearch = async () => {
            try {
                const apiKey = Config.GOOGLE_MAPS_API_KEY;
                if (!apiKey) return;
                const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': apiKey,
                    },
                    body: JSON.stringify({ input: searchText }),
                });
                const data = await response.json();
                if (data.suggestions && data.suggestions.length > 0) {
                    const mapped = data.suggestions
                        .filter(s => s.placePrediction)
                        .map(s => ({
                            placeId: s.placePrediction.placeId,
                            name: s.placePrediction.structuredFormat?.mainText?.text || s.placePrediction.text?.text || '',
                            secondary: s.placePrediction.structuredFormat?.secondaryText?.text || '',
                        }));
                    setSpotSearchResults(mapped);
                } else {
                    setSpotSearchResults([]);
                }
            } catch (e) {
                console.warn('Spot search failed:', e);
            } finally {
                setSpotSearchLoading(false);
            }
        };

        const timeout = setTimeout(fetchSpotSearch, 300);
        return () => clearTimeout(timeout);
    }, [searchText, socialMode]);

    // Fetch full place details (v1) when a search result is tapped
    const fetchSpotDetail = useCallback(async (placeId) => {
        setSpotDetailLoading(true);
        setSelectedSpotDetail(null);
        try {
            const apiKey = Config.GOOGLE_MAPS_API_KEY;
            if (!apiKey) return;
            const fieldMask = [
                'displayName', 'formattedAddress', 'rating', 'userRatingCount',
                'photos', 'location', 'editorialSummary', 'generativeSummary',
                'types', 'primaryType', 'primaryTypeDisplayName',
                'currentOpeningHours', 'regularOpeningHours',
            ].join(',');
            const url = `https://places.googleapis.com/v1/places/${placeId}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': fieldMask,
                },
            });
            const r = await response.json();
            if (r.displayName) {
                let photoUrl = null;
                if (r.photos && r.photos.length > 0) {
                    photoUrl = `https://places.googleapis.com/v1/${r.photos[0].name}/media?maxWidthPx=600&key=${apiKey}`;
                }
                // Try to parse city/country from address parts
                const addressParts = (r.formattedAddress || '').split(', ');
                const country = addressParts.length > 1 ? addressParts[addressParts.length - 1] : 'Unknown';
                const city = addressParts.length > 2 ? addressParts[addressParts.length - 3] || addressParts[0] : addressParts[0] || 'Unknown';

                // Format types into readable labels
                const HIDDEN_TYPES = ['point_of_interest', 'establishment', 'political', 'geocode'];
                const readableTypes = (r.types || [])
                    .filter(t => !HIDDEN_TYPES.includes(t))
                    .slice(0, 3)
                    .map(t => t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
                console.log(r)
                // Pick best summary: generativeSummary > editorialSummary
                const summary = r.generativeSummary?.overview?.text
                    || r.editorialSummary?.text
                    || null;

                setSelectedSpotDetail({
                    placeId,
                    name: r.displayName?.text || '',
                    address: r.formattedAddress || '',
                    rating: r.rating || null,
                    userRatingCount: r.userRatingCount || 0,
                    photoUrl,
                    coordinates: {
                        lat: r.location?.latitude || null,
                        lng: r.location?.longitude || null,
                    },
                    summary,
                    types: readableTypes,
                    primaryType: r.primaryTypeDisplayName?.text || null,
                    openNow: r.currentOpeningHours?.openNow ?? null,
                    country,
                    city,
                });
            }
        } catch (e) {
            console.warn('Place details fetch failed:', e);
        } finally {
            setSpotDetailLoading(false);
        }
    }, []);

    // Save a spot to bucket list
    const saveSpotToBucketList = useCallback(async (spot) => {
        const userId = storedUser?.id || storedUser?._id;
        if (!userId || !spot) return;
        setSavingSpotId(spot.placeId);
        try {
            const response = await fetch(`${BACKEND_URL}/api/spots`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    spots: [{
                        country: spot.country || 'Unknown',
                        city: spot.city || 'Unknown',
                        name: spot.name,
                        placeId: spot.placeId,
                        address: spot.address || '',
                        rating: spot.rating || null,
                        userRatingCount: spot.userRatingCount || 0,
                        photoUrl: spot.photoUrl || null,
                        coordinates: spot.coordinates || { lat: null, lng: null },
                        source: 'manual',
                    }],
                }),
            });
            const data = await response.json();
            if (data.success) {
                setSavedPlaceIds(prev => new Set([...prev, spot.placeId]));
                fetchSpots(); // refresh My Spots
            }
        } catch (e) {
            console.warn('Failed to save spot:', e);
        } finally {
            setSavingSpotId(null);
        }
    }, [storedUser, fetchSpots]);

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

                // Stream SSE events as they arrive using body reader
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let placesData = null;
                const accumulatedPlaces = [];

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    // Process complete SSE events (separated by double newline)
                    const parts = buffer.split('\n\n');
                    buffer = parts.pop(); // keep incomplete last chunk

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
                                // Accumulate places from each batch as they arrive
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
        setIsTripOverviewOpen(index > -1);
        if (index > -1) {
            // Close My Spots sheet when TripOverview opens
            bottomSheetRef.current?.close();
            tabBarTranslateY.value = withTiming(tabBarHeight, {
                duration: 400,
                easing: Easing.bezier(0.33, 1, 0.68, 1)
            });
        } else {
            setIsEditMode(false);
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

    const handleSpotPress = useCallback((spot) => {
        setSelectedItinerarySpot(spot);
        setTimeout(() => {
            spotDetailSheetRef.current?.expand();
        }, 100);
    }, []);

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
                userInterfaceStyle="light"
                customMapStyle={customMapStyle}
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
                                anchor={{ x: 0.5, y: 0.85 }}
                            >
                                <View style={{ alignItems: 'center', width: 100 }}>
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
                                    <Text
                                        numberOfLines={1}
                                        style={{
                                            marginTop: 3,
                                            fontSize: 10,
                                            fontWeight: '700',
                                            color: '#1E293B',
                                            textAlign: 'center',
                                            backgroundColor: 'rgba(255,255,255,0.85)',
                                            paddingHorizontal: 5,
                                            paddingVertical: 1,
                                            borderRadius: 4,
                                            overflow: 'hidden',
                                            textShadowColor: 'rgba(255,255,255,0.9)',
                                            textShadowOffset: { width: 0, height: 0 },
                                            textShadowRadius: 3,
                                        }}
                                    >{place.name}</Text>
                                </View>
                            </Marker>
                        ));
                })}

                {/* Route outline polylines — shadow behind the coloured route */}
                {tripData?.itinerary?.map((day, dayIndex) => {
                    if (!day.route?.polyline) return null;
                    return (
                        <Polyline
                            key={`route-outline-${day.day}`}
                            coordinates={decodePolyline(day.route.polyline)}
                            strokeColor="rgba(0,0,0,0.12)"
                            strokeWidth={8}
                        />
                    );
                })}

                {/* Route polylines — decoded from backend route data */}
                {tripData?.itinerary?.map((day, dayIndex) => {
                    if (!day.route?.polyline) return null;
                    return (
                        <Polyline
                            key={`route-${day.day}`}
                            coordinates={decodePolyline(day.route.polyline)}
                            strokeColor={DAY_COLORS[dayIndex % DAY_COLORS.length]}
                            strokeWidth={5}
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
                            strokeWidth={4}
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
                                                        onPress={() => fetchSpotDetail(item.placeId)}
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

            {/* Spot Detail Card Modal */}
            <Modal
                visible={selectedSpotDetail !== null || spotDetailLoading}
                transparent
                animationType="slide"
                onRequestClose={() => { setSelectedSpotDetail(null); setSpotDetailLoading(false); }}
            >
                <TouchableOpacity
                    style={styles.detailOverlay}
                    activeOpacity={1}
                    onPress={() => { setSelectedSpotDetail(null); setSpotDetailLoading(false); }}
                >
                    <View style={styles.detailCard} onStartShouldSetResponder={() => true}>
                        {spotDetailLoading ? (
                            <View style={styles.detailLoading}>
                                <ActivityIndicator size="large" color="#3B82F6" />
                                <Text style={{ color: '#94A3B8', marginTop: 12, fontSize: 14, fontWeight: '500' }}>Loading place details…</Text>
                            </View>
                        ) : selectedSpotDetail ? (
                            <>
                                {/* Close button */}
                                <TouchableOpacity
                                    style={styles.detailCloseBtn}
                                    onPress={() => setSelectedSpotDetail(null)}
                                >
                                    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <Path d="M18 6 6 18M6 6l12 12" />
                                    </Svg>
                                </TouchableOpacity>

                                {/* Photo */}
                                {selectedSpotDetail.photoUrl ? (
                                    <Image
                                        source={{ uri: selectedSpotDetail.photoUrl }}
                                        style={styles.detailImage}
                                    />
                                ) : (
                                    <View style={[styles.detailImage, { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }]}>
                                        <Svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
                                            <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                            <Circle cx="12" cy="10" r="3" />
                                        </Svg>
                                    </View>
                                )}

                                {/* Info */}
                                <View style={styles.detailInfo}>
                                    <Text style={styles.detailName}>{selectedSpotDetail.name}</Text>
                                    <Text style={styles.detailAddress} numberOfLines={2}>{selectedSpotDetail.address}</Text>

                                    {/* Type tags + open/closed */}
                                    {(selectedSpotDetail.types.length > 0 || selectedSpotDetail.openNow !== null) && (
                                        <View style={styles.detailTagsRow}>
                                            {selectedSpotDetail.openNow !== null && (
                                                <View style={[styles.detailOpenBadge, { backgroundColor: selectedSpotDetail.openNow ? '#ECFDF5' : '#FEF2F2' }]}>
                                                    <View style={[styles.detailOpenDot, { backgroundColor: selectedSpotDetail.openNow ? '#10B981' : '#EF4444' }]} />
                                                    <Text style={[styles.detailOpenText, { color: selectedSpotDetail.openNow ? '#059669' : '#DC2626' }]}>
                                                        {selectedSpotDetail.openNow ? 'Open Now' : 'Closed'}
                                                    </Text>
                                                </View>
                                            )}
                                            {selectedSpotDetail.types.map((type, i) => (
                                                <View key={i} style={styles.detailTypeTag}>
                                                    <Text style={styles.detailTypeText}>{type}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    {/* Rating row */}
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

                                    {/* Summary / brief info */}
                                    {selectedSpotDetail.summary && (
                                        <Text style={styles.detailSummary} numberOfLines={3}>{selectedSpotDetail.summary}</Text>
                                    )}

                                    {/* Add to Bucket List button */}
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
                                                            _id: fullTrip._id,
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


                </ScrollView>
            </Animated.View>

            {/* Create Options Menu */}
            {showCreateOptions && (
                <TouchableOpacity
                    style={[styles.createMenuBackdrop, { paddingBottom: 52 + insets.bottom + (Platform.OS === 'android' ? 27 : 12) }]}
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
                                <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EC4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                savedSpotsData={savedSpots}
                onPlanningStarted={() => {
                    setIsTripLoading(true);
                    setTripData(null); // Clear previous data
                    secondarySheetOpen.current = true;
                    createTripSheetRef.current?.close();
                    setTimeout(() => {
                        tripOverviewSheetRef.current?.expand();
                    }, 300);
                }}
                onTripCreated={(data) => {
                    setIsTripLoading(false);
                    setTripData(data);
                    // Fetch trips after delay to ensure backend has saved
                    setTimeout(() => {
                        fetchTrips();
                    }, 2000);
                }}
            />

            {/* Floating Trip Overview Buttons - Top of Screen */}
            {isTripOverviewOpen && (
                <>
                    {/* Close Button - Top Left */}
                    <TouchableOpacity
                        style={[styles.tripOverviewFloatingBtn, { left: 16, top: insets.top + 12 }]}
                        onPress={() => {
                            setIsEditMode(false);
                            tripOverviewSheetRef.current?.close();
                        }}
                        activeOpacity={0.7}
                    >
                        <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M18 6 6 18M6 6l12 12" />
                        </Svg>
                    </TouchableOpacity>

                    {/* Edit / Done Button - Top Right */}
                    <TouchableOpacity
                        style={[
                            styles.tripOverviewFloatingBtn,
                            {
                                right: 16,
                                top: insets.top + 12,
                                width: 'auto',
                                paddingHorizontal: 14,
                                backgroundColor: '#0F172A',
                                opacity: isSavingTrip ? 0.7 : 1
                            }
                        ]}
                        disabled={isSavingTrip}
                        onPress={async () => {
                            if (isEditMode) {
                                console.log('[Done Button] Clicked in Edit Mode');
                                console.log('[Done Button] tripData._id:', tripData?._id);
                                if (tripData?._id) {
                                    // Save changes to backend when clicking Done
                                    setIsSavingTrip(true);
                                    try {
                                        const url = `${BACKEND_URL}/api/trips/${tripData._id}`;
                                        console.log(`[Done Button] Sending PATCH to: ${url}`);

                                        const response = await fetch(url, {
                                            method: 'PATCH',
                                            headers: {
                                                'Content-Type': 'application/json',
                                            },
                                            body: JSON.stringify({
                                                itinerary: tripData.itinerary,
                                                discoveredPlaces: tripData.discoveredPlaces
                                            })
                                        });

                                        console.log(`[Done Button] Response status: ${response.status}`);
                                        if (response.ok) {
                                            const result = await response.json();
                                            console.log('[Done Button] Save success:', result.success);
                                            if (result.success && result.trip) {
                                                setTripData(result.trip);
                                                fetchTrips();
                                            }
                                        } else {
                                            console.error(`[Done Button] Failed to save trip changes. Status: ${response.status}`);
                                        }
                                    } catch (error) {
                                        console.error("[Done Button] Error saving trip:", error);
                                    } finally {
                                        setIsSavingTrip(false);
                                    }
                                }
                                // Only exit edit mode AFTER the save is complete
                                setIsEditMode(false);
                            } else {
                                // Entering edit mode
                                setIsEditMode(true);
                            }
                        }}
                        activeOpacity={0.7}
                    >
                        {isSavingTrip ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>{isEditMode ? 'Done' : 'Edit'}</Text>
                        )}
                    </TouchableOpacity>
                </>
            )}

            {/* Trip Overview Bottom Sheet */}
            <TripOverviewSheet
                ref={tripOverviewSheetRef}
                onSpotPress={handleSpotPress}
                onChange={handleTripOverviewSheetChange}
                animationConfigs={sheetAnimationConfig}
                tripData={tripData}
                isLoading={isTripLoading}
                isEditMode={isEditMode}
                isSavingTrip={isSavingTrip}
                onSpotsReorder={(dayNum, reorderedPlaces) => {
                    setTripData(prev => {
                        if (!prev?.itinerary) return prev;
                        const newItinerary = prev.itinerary.map(d => {
                            if (d.day !== dayNum) return d;
                            // Map the custom UI objects back to their original backend objects
                            const restoredPlaces = reorderedPlaces.map(s => s.originalPlace);
                            return { ...d, places: restoredPlaces };
                        });
                        return { ...prev, itinerary: newItinerary };
                    });
                }}
                onSpotsRemove={(selectedPlaces) => {
                    // selectedPlaces is an array of the original place objects
                    const placesToRemove = new Set(selectedPlaces);
                    setTripData(prev => {
                        if (!prev?.itinerary) return prev;
                        const newItinerary = prev.itinerary.map(dayData => {
                            const filteredPlaces = dayData.places.filter(place => !placesToRemove.has(place));
                            if (filteredPlaces.length === dayData.places.length) return dayData;
                            return { ...dayData, places: filteredPlaces };
                        });
                        return { ...prev, itinerary: newItinerary };
                    });
                }}
                onSpotsMove={(selectedPlaces, targetDay) => {
                    const placesToMove = new Set(selectedPlaces);
                    setTripData(prev => {
                        if (!prev?.itinerary) return prev;
                        const movedPlaces = [];
                        // First pass: collect places to move and remove them from source days
                        const newItinerary = prev.itinerary.map(dayData => {
                            const kept = [];
                            dayData.places.forEach(place => {
                                if (placesToMove.has(place)) {
                                    movedPlaces.push(place);
                                } else {
                                    kept.push(place);
                                }
                            });
                            return { ...dayData, places: kept };
                        });

                        // Second pass: append collected places to the target day
                        const finalItinerary = newItinerary.map(dayData => {
                            if (dayData.day === targetDay) {
                                return { ...dayData, places: [...dayData.places, ...movedPlaces] };
                            }
                            return dayData;
                        });

                        return { ...prev, itinerary: finalItinerary };
                    });
                }}
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

            <SpotDetailSheet
                ref={spotDetailSheetRef}
                spot={selectedItinerarySpot}
                onClose={() => setSelectedItinerarySpot(null)}
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
        zIndex: 10,
        elevation: 10,
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
        zIndex: 30, // Sit above tab bar and other overlays
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    createMenuContainer: {
        width: SCREEN_WIDTH - 80,
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    createOptionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
    },
    optionIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionTextContainer: {
        marginLeft: 10,
        flex: 1,
    },
    optionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E293B',
    },
    optionSubtitle: {
        fontSize: 11,
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
    // Spot search result row
    spotSearchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    spotSearchIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    spotSearchTextWrap: {
        flex: 1,
        marginRight: 8,
    },
    spotSearchName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B',
    },
    spotSearchSub: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 2,
    },
    spotBookmarkBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
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
    tripOverviewFloatingBtn: {
        position: 'absolute',
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255,255,255,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        elevation: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
    },
});

export default HomeScreen;
