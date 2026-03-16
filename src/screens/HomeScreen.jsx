/**
 * Home Screen - TripWays
 * @format
 */

import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Dimensions, Platform, Keyboard, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, interpolate, useDerivedValue } from 'react-native-reanimated';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { MMKV } from 'react-native-mmkv';
import Config from 'react-native-config';

import CreateTripSheet from '../components/CreateTripSheet';
import TripOverviewSheet from '../components/TripOverviewSheet';
import SpotDetailSheet from '../components/SpotDetailSheet';
import ProfileOverlay from '../components/ProfileOverlay';
import SpotsBottomSheet from '../components/SpotsBottomSheet';
import { setAppGroupData } from '../services/ShareIntent';
import MySpotIcon from '../assets/My-spot';
import countriesGeoJson from '../assets/countries.geo.json';
import { getCountryMapData, COUNTRY_COLORS as MAP_COUNTRY_COLORS } from '../utils/countryMapUtils';
// useMapClusters no longer needed — replaced with city-wise grouping

// Zustand stores
import { useUIStore } from '../store/uiStore';
import { useTripStore } from '../store/tripStore';

// TanStack Query hooks
import { useSavedTrips } from '../hooks/useTrips';
import { useSavedSpots } from '../hooks/useSpots';

const storage = new MMKV();
const BACKEND_URL = Config.BACKEND_URL || 'http://localhost:3000';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Day colors matching the frontendweb reference
const DAY_COLORS = ['#6366F1', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

// Single static map style — never changes at runtime to avoid tile reload flicker.
// City and country labels are always off; flag emoji markers serve as labels.
const CUSTOM_MAP_STYLE = [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ saturation: -80 }, { lightness: 30 }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ saturation: -70 }, { lightness: 25 }] },
    { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative.country', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative.locality', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative.neighborhood', elementType: 'labels', stylers: [{ visibility: 'off' }] },
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
    const sharedUrlProcessed = useRef(false);
    const tabBarHeight = 50 + insets.bottom; // Google Maps style height (compact focus)
    const bottomSheetRef = useRef(null);

    const createTripSheetRef = useRef(null); // Ref for Create Trip BottomSheet
    const tripOverviewSheetRef = useRef(null);
    const spotDetailSheetRef = useRef(null);
    const mapRef = useRef(null);
    const searchInputRef = useRef(null);
    const secondarySheetOpen = useRef(false); // Track if any overlay sheet is open

    // --- Zustand stores ---
    const { activeTab, setActiveTab, showCreateOptions, setShowCreateOptions,
        showProfile, setShowProfile, isEditMode, setEditMode,
        isTripOverviewOpen, setTripOverviewOpen, selectedItinerarySpot,
        setSelectedSpot, socialMode, setSocialMode } = useUIStore();

    const { tripData, setTripData, isTripLoading, setTripLoading,
        isSavingTrip, setIsSavingTrip, clearTrip } = useTripStore();

    // --- Local-only UI state (not shared across components) ---
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [sheetIndex, setSheetIndex] = useState(1);

    // Zoom level + map region stored in refs to avoid re-renders on every pan/zoom.
    const mapZoomRef = useRef(3);
    const mapRegionRef = useRef(null);
    const [showItineraryLabels, setShowItineraryLabels] = useState(false); // >= 10
    const [mapZoom, setMapZoom] = useState(3); // Current zoom as state for collision recalc

    // Simple boolean for flag vs cluster view — opacity handles the visual transition.
    const showFlagsRef = useRef(true);
    // Whether to show individual spots vs city clusters (higher zoom = individual)
    const [showIndividualSpots, setShowIndividualSpots] = useState(false);

    // Animated crossfade for flag ↔ cluster transition
    const flagOpacity = useSharedValue(1);
    const clusterOpacity = useSharedValue(0);
    const flagAnimatedStyle = useAnimatedStyle(() => ({ opacity: flagOpacity.value }));
    const clusterAnimatedStyle = useAnimatedStyle(() => ({ opacity: clusterOpacity.value }));

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

    // --- TanStack Query hooks ---
    const userId = storedUser?.id || storedUser?._id;
    const queryClient = useQueryClient();

    const { data: savedTrips = [], refetch: refetchTrips } = useSavedTrips(userId);
    const { data: spotsData } = useSavedSpots(userId);
    const savedSpots = spotsData?.grouped || {};
    const totalSpotsCount = spotsData?.totalSpots || 0;

    // Memoize country map data for the "My Spots" colored country polygons
    const countryMapData = useMemo(() => {
        if (!savedSpots || Object.keys(savedSpots).length === 0) return [];
        return getCountryMapData(savedSpots, countriesGeoJson);
    }, [savedSpots]);

    // Build city-level cluster data from the grouped spots structure
    const cityClusterData = useMemo(() => {
        if (!savedSpots || Object.keys(savedSpots).length === 0) return [];
        const cities = [];
        Object.entries(savedSpots).forEach(([countryName, countryCities], countryIndex) => {
            const countryColor = MAP_COUNTRY_COLORS[countryIndex % MAP_COUNTRY_COLORS.length];
            Object.entries(countryCities || {}).forEach(([cityName, cityData]) => {
                // Skip Unknown city names
                if (!cityName || cityName === 'Unknown') return;
                const spots = (cityData.spots || []).filter(s => s.coordinates?.lat && s.coordinates?.lng);
                if (spots.length === 0) return;
                // Centroid = average of all spot coordinates in this city
                const centroid = {
                    latitude: spots.reduce((sum, s) => sum + s.coordinates.lat, 0) / spots.length,
                    longitude: spots.reduce((sum, s) => sum + s.coordinates.lng, 0) / spots.length,
                };
                cities.push({
                    key: `${countryName}-${cityName}`,
                    cityName,
                    countryName,
                    spotCount: spots.length,
                    centroid,
                    color: countryColor,
                    spots: spots.map(s => ({ ...s, color: countryColor })),
                });
            });
        });
        return cities;
    }, [savedSpots]);

    // Flatten all spots with their assigned country colors for individual marker display
    const individualSpotsData = useMemo(() => {
        return cityClusterData.flatMap(city => city.spots);
    }, [cityClusterData]);

    // Collision avoidance for city cluster markers — prevent overlap
    const visibleCityClusters = useMemo(() => {
        if (cityClusterData.length === 0) return [];
        const zoom = mapZoomRef.current;
        // Degrees per pixel at this zoom (Web Mercator approximation)
        const degLngPerPx = 360 / (256 * Math.pow(2, zoom));
        // Minimum gap in pixels between city cluster markers
        const MIN_GAP_PX = 80;
        const minGapDeg = MIN_GAP_PX * degLngPerPx;

        const visible = [];
        const placed = []; // { lat, lng } of already placed markers

        // Sort by spot count descending so larger cities win placement priority
        const sorted = [...cityClusterData].sort((a, b) => b.spotCount - a.spotCount);

        for (const city of sorted) {
            const lat = city.centroid.latitude;
            const lng = city.centroid.longitude;
            let tooClose = false;
            for (const other of placed) {
                const dLat = Math.abs(lat - other.lat);
                const dLng = Math.abs(lng - other.lng);
                // Adjust for latitude (cos correction)
                const latRad = (lat * Math.PI) / 180;
                const adjustedDLat = dLat / Math.cos(latRad);
                if (adjustedDLat < minGapDeg && dLng < minGapDeg) {
                    tooClose = true;
                    break;
                }
            }
            if (!tooClose) {
                visible.push(city);
                placed.push({ lat, lng });
            }
        }
        return visible;
    }, [cityClusterData, mapZoom]);

    // --- Logic for Marker Label Collision Avoidance ---
    // Calculates which labels should be shown based on zoom and relative screen distance
    const visibleLabelIds = useMemo(() => {
        if (!tripData?.itinerary) return new Set();

        const allPlaces = tripData.itinerary.flatMap((day, dayIndex) =>
            (day.places || [])
                .filter(place => place.coordinates?.lat && place.coordinates?.lng)
                .map((place, placeIndex) => ({
                    id: `marker-${day.day}-${placeIndex}`,
                    lat: place.coordinates.lat,
                    lng: place.coordinates.lng,
                    name: place.name,
                }))
        );

        // 1. Zoom Threshold: Show labels only when sufficiently zoomed in
        if (!showItineraryLabels) return new Set();

        const zoom = mapZoomRef.current;
        const visibleIds = new Set();
        const screenPositions = [];

        // 2. Pre-calculate mapping from pixels to degrees for current zoom and world scale
        // In Web Mercator, 1 pixel at zoom level z roughly equals:
        const degLngPerPixel = 360 / (256 * Math.pow(2, zoom));
        
        // Horizontal spacing for labels (roughly 100px - 140px depending on name length)
        // Vertical spacing (roughly 40px)
        const HORIZONTAL_GAP_PX = 120;
        const VERTICAL_GAP_PX = 32;

        allPlaces.forEach((place) => {
            // Mercator correction: 1 pixel covers fewer degrees of latitude at higher lats
            const latRad = (place.lat * Math.PI) / 180;
            const degLatPerPixel = degLngPerPixel * Math.cos(latRad);

            const horizontalThreshold = HORIZONTAL_GAP_PX * degLngPerPixel;
            const verticalThreshold = VERTICAL_GAP_PX * degLatPerPixel;

            let isTooClose = false;
            for (const other of screenPositions) {
                const dLat = Math.abs(place.lat - other.lat);
                const dLng = Math.abs(place.lng - other.lng);

                // Check if current place collides with an already visible label's "box"
                if (dLat < verticalThreshold && dLng < horizontalThreshold) {
                    isTooClose = true;
                    break;
                }
            }

            if (!isTooClose) {
                visibleIds.add(place.id);
                screenPositions.push({ lat: place.lat, lng: place.lng });
            }
        });

        return visibleIds;
    }, [tripData, showItineraryLabels]);


    // Whether to show the country map overlay (My Spots default view, no trip open)
    const showCountryMap = !tripData && countryMapData.length > 0;

    // Sync userId & backendUrl to App Group UserDefaults for the Share Extension
    useEffect(() => {
        if (userId) {
            setAppGroupData(userId, BACKEND_URL);
        }
    }, [userId]);

    // Create menu animation values
    const createMenuOpacity = useSharedValue(0);
    const createMenuScale = useSharedValue(0.9);
    const plusRotation = useSharedValue(0);
    const tabBarTranslateY = useSharedValue(0);
    // Tracks the real-time Y position of the spots sheet (from top of screen)
    const sheetAnimatedPosition = useSharedValue(SCREEN_HEIGHT * 0.5);



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
    // Only visible near the 60% snap point — fades out both above AND below.
    const fabScreenHeight = Platform.OS === 'android'
        ? Dimensions.get('screen').height
        : SCREEN_HEIGHT;
    const halfSnapY = SCREEN_HEIGHT * 0.4; // Y position when sheet is at 60%
    const bottomSnapY = SCREEN_HEIGHT * 0.88; // Y position when sheet is at 12%
    const fabAnimatedStyle = useAnimatedStyle(() => {
        // Fade out above 60%
        const opacityAbove = interpolate(
            sheetAnimatedPosition.value,
            [halfSnapY - SCREEN_HEIGHT * 0.08, halfSnapY],
            [0, 1],
            'clamp'
        );
        // Fade out below 60%
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

    // Dynamic map padding to keep markers/UI above bottom sheets
    const dynamicMapPadding = useMemo(() => {
        if (isTripOverviewOpen) {
            return { top: 50, right: 10, bottom: SCREEN_HEIGHT * 0.5, left: 10 };
        }
        // When my spots sheet is open, we cap the padding at the 50% snap point
        // so the map doesn't abruptly re-center/shift when pulled to 90%
        const snapPadding = [0.12, 0.5, 0.5][sheetIndex] * SCREEN_HEIGHT;
        return { top: 50, right: 10, bottom: snapPadding, left: 10 };
    }, [isTripOverviewOpen, sheetIndex]);



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
            bottomSheetRef.current?.expand();
        } else {
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
            // Include route polyline coordinates in the fit range
            if (day.route?.polyline) {
                try {
                    const polyPoints = decodePolyline(day.route.polyline);
                    coords.push(...polyPoints);
                } catch (e) {
                    console.warn('Polyline decode failed for fitToCoordinates', e);
                }
            }
        });

        if (coords.length > 0) {
            // Match timeout with bottom sheet animation duration for smoothness
            setTimeout(() => {
                mapRef.current?.fitToCoordinates(coords, {
                    edgePadding: { 
                        top: 80, 
                        right: 40, 
                        bottom: 40, // consistent small buffer
                        left: 40 
                    },
                    animated: true,
                });
            }, 400);
        }
    }, [tripData, dynamicMapPadding.bottom]); // Re-fit when trip loads OR when sheet snaps to new height

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
        setTripOverviewOpen(index > -1);
        if (index > -1) {
            // Close My Spots sheet when TripOverview opens
            bottomSheetRef.current?.close();
            tabBarTranslateY.value = withTiming(tabBarHeight, {
                duration: 400,
                easing: Easing.bezier(0.33, 1, 0.68, 1)
            });
        } else {
            setEditMode(false);
            clearTrip(); // Reset tripData → showCountryMap becomes true → flags reappear
            tabBarTranslateY.value = withTiming(0, {
                duration: 400,
                easing: Easing.bezier(0.33, 1, 0.68, 1)
            });
            if (activeTab === 'home') {
                setTimeout(() => {
                    bottomSheetRef.current?.snapToIndex(1);
                }, 150);
                // Zoom map back to show the latest saved spot, or all country flags if none
                setTimeout(() => {
                    const latestSpot = spotsData?.spots?.[0];
                    if (latestSpot && latestSpot.coordinates?.lat) {
                        mapRef.current?.animateToRegion({
                            latitude: latestSpot.coordinates.lat,
                            longitude: latestSpot.coordinates.lng,
                            latitudeDelta: 10.0,
                            longitudeDelta: 10.0,
                        }, 400);
                    } else if (countryMapData.length > 0) {
                        const coords = countryMapData.map(c => c.centroid);
                        mapRef.current?.fitToCoordinates(coords, {
                            edgePadding: { top: 80, right: 40, bottom: SCREEN_HEIGHT * 0.5, left: 40 },
                            animated: true,
                        });
                    }
                }, 400);
            }
        }
    }, [tabBarHeight, activeTab, countryMapData, spotsData]);

    const handleTripsSheetChange = useCallback((index) => {
        secondarySheetOpen.current = index > -1;
        if (index === -1 && activeTab === 'trips') {
            setActiveTab('home');
        }
    }, [activeTab, setActiveTab]);

    const handleSpotPress = useCallback((spot) => {
        setSelectedSpot(spot);
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

    // Calculate initial region based on the latest saved spot, or fallback to default
    const initialMapRegion = useMemo(() => {
        const latestSpot = spotsData?.spots?.[0];
        if (latestSpot && latestSpot.coordinates?.lat && latestSpot.coordinates?.lng) {
            return {
                latitude: latestSpot.coordinates.lat,
                longitude: latestSpot.coordinates.lng,
                latitudeDelta: 10.0,
                longitudeDelta: 10.0,
            };
        }
        // Fallback (Panama Canal area zoomed out)
        return {
            latitude: -20.0,
            longitude: -80.0,
            latitudeDelta: 75.0,
            longitudeDelta: 75.0,
        };
    }, [spotsData]);



    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            {/* Map Background */}
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                userInterfaceStyle="light"
                mapPadding={dynamicMapPadding}
                customMapStyle={CUSTOM_MAP_STYLE}
                initialRegion={initialMapRegion}
                onRegionChangeComplete={(region) => {
                    const zoom = Math.round(Math.log2(360 / region.longitudeDelta));
                    mapZoomRef.current = zoom;
                    mapRegionRef.current = region;
                    if (zoom !== mapZoom) setMapZoom(zoom);


                    // Hysteresis for flag↔cluster crossfade (zoom 4 = show clusters, zoom 3 = back to flags)
                    if (showFlagsRef.current && zoom >= 4) {
                        showFlagsRef.current = false;
                        flagOpacity.value = withTiming(0, { duration: 300 });
                        clusterOpacity.value = withTiming(1, { duration: 300 });
                    } else if (!showFlagsRef.current && zoom < 3) {
                        showFlagsRef.current = true;
                        flagOpacity.value = withTiming(1, { duration: 300 });
                        clusterOpacity.value = withTiming(0, { duration: 300 });
                    }

                    // Show individual spots at zoom >= 8, city clusters below
                    const shouldShowIndividual = zoom >= 8;
                    if (shouldShowIndividual !== showIndividualSpots) {
                        setShowIndividualSpots(shouldShowIndividual);
                    }

                    const labelsVisible = zoom >= 10;
                    if (labelsVisible !== showItineraryLabels) setShowItineraryLabels(labelsVisible);
                }}
            >

                {/* ── My Spots: Country flag markers (always mounted, opacity-controlled) ── */}
                {showCountryMap && countryMapData.map((item) => (
                    <Marker
                        key={`flag-${item.countryName}`}
                        coordinate={item.centroid}
                        anchor={{ x: 0.5, y: 0.5 }}
                        tracksViewChanges={false}
                    >
                        <Animated.View style={[styles.flagMarkerContainer, flagAnimatedStyle]}>
                            <View style={styles.flagMarkerInner}>
                                <Text style={styles.flagMarkerEmoji}>{item.flagEmoji}</Text>
                                <View style={styles.flagMarkerBadge}>
                                    <Text style={styles.flagMarkerBadgeText}>{item.spotCount}</Text>
                                </View>
                            </View>
                        </Animated.View>
                    </Marker>
                ))}

                {/* ── My Spots: City cluster markers (mid zoom, opacity-controlled) ── */}
                {showCountryMap && !showIndividualSpots && visibleCityClusters.map((city) => {
                    const size = 38 + Math.min(city.spotCount, 20) * 0.6;
                    return (
                        <Marker
                            key={`city-${city.key}`}
                            coordinate={city.centroid}
                            anchor={{ x: 0.5, y: 0.85 }}
                            tracksViewChanges={false}
                            onPress={() => {
                                mapRef.current?.animateToRegion({
                                    latitude: city.centroid.latitude,
                                    longitude: city.centroid.longitude,
                                    latitudeDelta: 0.5,
                                    longitudeDelta: 0.5,
                                }, 400);
                            }}
                        >
                            <Animated.View style={[styles.cityClusterContainer, clusterAnimatedStyle]}>
                                <View style={[
                                    styles.cityClusterCircle,
                                    { width: size, height: size, borderRadius: size / 2, backgroundColor: city.color }
                                ]}>
                                    <Text style={styles.cityClusterCount}>{city.spotCount}</Text>
                                </View>
                                <Text style={styles.cityClusterLabel} numberOfLines={1}>{city.cityName}</Text>
                            </Animated.View>
                        </Marker>
                    );
                })}

                {/* ── My Spots: Individual spot markers (high zoom, opacity-controlled) ── */}
                {showCountryMap && showIndividualSpots && individualSpotsData.map((spot, idx) => (
                    <Marker
                        key={`spot-${spot._id || spot.placeId || idx}`}
                        coordinate={{ latitude: spot.coordinates.lat, longitude: spot.coordinates.lng }}
                        anchor={{ x: 0.5, y: 0.3 }}
                        onPress={() => handleSpotPress(spot)}
                        tracksViewChanges={false}
                    >
                        <Animated.View style={[styles.spotMarkerContainer, clusterAnimatedStyle]}>
                            <View style={[styles.spotMarkerDot, { backgroundColor: spot.color }]} />
                            <Text style={styles.spotMarkerLabel} numberOfLines={1}>{spot.name}</Text>
                        </Animated.View>
                    </Marker>
                ))}

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
                                    {visibleLabelIds.has(`marker-${day.day}-${placeIndex}`) && (
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
                                    )}
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



            <SpotsBottomSheet
                bottomSheetRef={bottomSheetRef}
                createTripSheetRef={createTripSheetRef}
                tripOverviewSheetRef={tripOverviewSheetRef}
                setSheetIndex={setSheetIndex}
                sheetAnimatedPosition={sheetAnimatedPosition}
                tabBarTranslateY={tabBarTranslateY}
                tabBarHeight={tabBarHeight}
            />



            {/* Create Options Menu */}
            {showCreateOptions && (
                <TouchableOpacity
                    style={[styles.createMenuBackdrop, { paddingBottom: 50 + insets.bottom + 12 }]}
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
                onPlanningStarted={() => {
                    setTripLoading(true);
                    setTripData(null); // Clear previous data
                    secondarySheetOpen.current = true;
                    createTripSheetRef.current?.close();
                    setTimeout(() => {
                        tripOverviewSheetRef.current?.expand();
                    }, 300);
                }}
                onTripCreated={(data) => {
                    setTripLoading(false);
                    setTripData(data);
                    // Fetch trips after delay to ensure backend has saved
                    setTimeout(() => {
                        refetchTrips();
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
                            setEditMode(false);
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
                                                refetchTrips();
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
                                setEditMode(false);
                            } else {
                                // Entering edit mode
                                setEditMode(true);
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
                onChange={handleTripOverviewSheetChange}
                animationConfigs={sheetAnimationConfig}
            />

            {/* Custom Bottom Tab Bar — Google Maps Style */}
            <Animated.View style={[styles.tabBarContainer, { height: 50 + insets.bottom, paddingBottom: insets.bottom, bottom: 0 }, animatedTabBarStyle]}>
                {/* Explore Tab (Home) */}
                <TouchableOpacity
                    style={styles.tabItem}
                    activeOpacity={0.7}
                    onPress={() => {
                        setActiveTab('home');
                        setShowCreateOptions(false);
                    }}
                >
                    <View style={[styles.pillContainer, activeTab === 'home' && styles.pillActive]}>
                        <Svg width="24" height="24" viewBox="0 0 24 24" fill={activeTab === 'home' ? "#024f5c" : "none"} stroke={activeTab === 'home' ? "none" : "#444746"} strokeWidth={activeTab === 'home' ? "0" : "2"} strokeLinecap="round" strokeLinejoin="round">
                            {activeTab === 'home' ? (
                                <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                            ) : (
                                <>
                                    <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                                    <Circle cx="12" cy="9" r="2.5" />
                                </>
                            )}
                        </Svg>
                    </View>
                    <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>Explore</Text>
                </TouchableOpacity>

                {/* Contribute Tab (Create) - Centered, No Label */}
                <TouchableOpacity
                    style={styles.tabItem}
                    activeOpacity={0.7}
                    onPress={() => setShowCreateOptions(!showCreateOptions)}
                >
                    <View style={styles.pillContainer}>
                        <Animated.View style={animatedPlusStyle}>
                            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={showCreateOptions ? "#024f5c" : "#444746"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <Circle cx="12" cy="12" r="10" />
                                <Path d="M12 8v8M8 12h8" />
                            </Svg>
                        </Animated.View>
                    </View>
                    <Text style={styles.tabLabel}>Create</Text>
                </TouchableOpacity>

                {/* You Tab (Trips) */}
                <TouchableOpacity
                    style={styles.tabItem}
                    activeOpacity={0.7}
                    onPress={() => {
                        setActiveTab('trips');
                        setShowCreateOptions(false);
                    }}
                >
                    <View style={[styles.pillContainer, activeTab === 'trips' && styles.pillActive]}>
                        <Svg width="24" height="24" viewBox="0 0 24 24" fill={activeTab === 'trips' ? "#024f5c" : "none"} stroke={activeTab === 'trips' ? "#024f5c" : "#444746"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                        </Svg>
                    </View>
                    <Text style={[styles.tabLabel, activeTab === 'trips' && styles.tabLabelActive]}>My Trips</Text>
                </TouchableOpacity>
            </Animated.View>

            {/* Profile Overlay */}
            <ProfileOverlay
                visible={showProfile}
                onClose={() => setShowProfile(false)}
                navigation={navigation}
                bottomSheetRef={bottomSheetRef}
            />

            <SpotDetailSheet
                ref={spotDetailSheetRef}
                spot={selectedItinerarySpot}
                onClose={() => setSelectedSpot(null)}
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
        left: 0,
        right: 0,
        backgroundColor: '#eaedeeff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        zIndex: 10,
        elevation: 10,
        paddingTop : 5
    },
    tabItem: {
        flex: 1,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pillContainer: {
        width: 56,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
        overflow: 'hidden',
    },
    pillActive: {
        backgroundColor: '#C2E7FF',
        borderRadius: 14,
    },
    tabLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#444746',
    },
    tabLabelActive: {
        color: '#444746',
        fontWeight: '700',
    },
    plusButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#3F3F46',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#3F3F46',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 4,
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
    // Country flag marker styles
    flagMarkerContainer: {
        alignItems: 'center',
        width: 100,
    },
    flagMarkerInner: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    flagMarkerEmoji: {
        fontSize: 36,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    flagMarkerBadge: {
        position: 'absolute',
        top: -4,
        right: -8,
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#EF4444',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
    },
    flagMarkerBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
    },
    flagMarkerLabel: {
        marginTop: 2,
        fontSize: 10,
        fontWeight: '700',
        color: '#1E293B',
        textAlign: 'center',
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    // Cluster marker styles
    clusterMarker: {
        backgroundColor: 'rgba(59, 130, 246, 0.85)',
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 6,
    },
    clusterMarkerText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    // City cluster marker styles — colored circle with count + city name below
    cityClusterContainer: {
        alignItems: 'center',
        width: 80,
    },
    cityClusterCircle: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.95)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
    },
    cityClusterCount: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
        textShadowColor: 'rgba(0,0,0,0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    cityClusterLabel: {
        marginTop: 3,
        fontSize: 11,
        fontWeight: '700',
        color: '#1E293B',
        textAlign: 'center',
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        overflow: 'hidden',
        maxWidth: 78,
    },
    // Individual spot markers (zoomed in)
    spotMarkerContainer: {
        alignItems: 'center',
        width: 90,
    },
    spotMarkerDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2.5,
        borderColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
    },
    spotMarkerLabel: {
        marginTop: 3,
        fontSize: 10,
        fontWeight: '600',
        color: '#334155',
        textAlign: 'center',
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 5,
        overflow: 'hidden',
        maxWidth: 88,
    },
});

export default HomeScreen;
