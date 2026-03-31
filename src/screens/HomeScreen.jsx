/**
 * Home Screen - TripWays
 * @format
 */

import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Dimensions, Platform, Keyboard, ActivityIndicator, Image } from 'react-native';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withTiming, 
    Easing, 
    interpolate, 
    useDerivedValue, 
    interpolateColor 
} from 'react-native-reanimated';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { MMKV } from 'react-native-mmkv';
import Config from 'react-native-config';
import Supercluster from 'supercluster';

import CreateTripSheet from '../components/CreateTripSheet';
import { trackActionAndMaybeAskReview } from '../utils/reviewManager';
import TripOverviewSheet from '../components/TripOverviewSheet';
import SpotDetailSheet from '../components/SpotDetailSheet';
import ProfileOverlay from '../components/ProfileOverlay';
import SpotsBottomSheet from '../components/SpotsBottomSheet';
import { setAppGroupData } from '../services/ShareIntent';
import tripIcon from '../assets/trip.png';
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
const getDayColor = (dayIndex) => {
    // 137.5 degrees is the golden angle, ensuring every sequential color is maximally distinct
    const hue = (dayIndex * 137.5) % 360;
    // Deep, rich colors: High saturation (95%), very low lightness (25-32%)
    const lightness = 25 + (dayIndex % 2 === 0 ? 7 : 0); 
    return `hsl(${hue}, 95%, ${lightness}%)`;};

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

/**
 * Simplify a polyline by evenly sampling points to avoid native map crashes
 * from rendering too many path segments. Keeps first and last points.
 */
function simplifyPolyline(points, maxPoints = 150) {
    if (!points || points.length <= maxPoints) return points;
    const result = [points[0]];
    const step = (points.length - 1) / (maxPoints - 1);
    for (let i = 1; i < maxPoints - 1; i++) {
        result.push(points[Math.round(i * step)]);
    }
    result.push(points[points.length - 1]);
    return result;
}

const HomeScreen = () => {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
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
        isSavingTrip, setIsSavingTrip, clearTrip, backupTrip, restoreTrip } = useTripStore();

    // --- Local-only UI state (not shared across components) ---
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [sheetIndex, setSheetIndex] = useState(1);
    const [tripOverviewSheetIndex, setTripOverviewSheetIndex] = useState(-1);
    const [activeTripDay, setActiveTripDay] = useState(null); // Overview by default
    // Progressive marker loading — load one marker at a time to prevent memory burst
    const [loadedMarkerCount, setLoadedMarkerCount] = useState(0);
    // Zoom level + map region stored in refs to avoid re-renders on every pan/zoom.
    const mapZoomRef = useRef(3);
    const mapRegionRef = useRef(null);
    const savedCameraBeforeTripRef = useRef(null);
    const animationActiveRef = useRef(false);
    const tripIdRef = useRef(null);
    const [mapZoom, setMapZoom] = useState(3); // Current zoom as state for collision recalc

    // Simple boolean for flag vs cluster view — opacity handles the visual transition.
    const [showFlags, setShowFlags] = useState(true);
    // Whether to show individual spots vs city clusters (higher zoom = individual)
    const [showIndividualSpots, setShowIndividualSpots] = useState(false);

    // Animated crossfade for flag ↔ cluster transition
    const flagOpacity = useSharedValue(1);
    const clusterOpacity = useSharedValue(0);
    const markerScaleAnim = useSharedValue(1);

    const flagAnimatedStyle = useAnimatedStyle(() => ({ 
        opacity: Platform.OS === 'ios' ? flagOpacity.value : (showFlags ? 1 : 0) 
    }));
    const clusterAnimatedStyle = useAnimatedStyle(() => ({ 
        opacity: Platform.OS === 'ios' ? clusterOpacity.value : (!showFlags ? 1 : 0) 
    }));
    const markerAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: markerScaleAnim.value }],
    }));

    // Update marker scale smoothly when zoom level changes
    useEffect(() => {
        const targetScale = mapZoom >= 15 ? 1 : mapZoom <= 10 ? 0.65 : 0.65 + (mapZoom - 10) * 0.07;
        markerScaleAnim.value = withTiming(targetScale, { duration: 400, easing: Easing.out(Easing.quad) });
    }, [mapZoom]);

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

    // Memoize decoded polylines — use itinerary reference (not full tripData) for granularity
    const itineraryRef = tripData?.itinerary;
    const decodedPolylines = useMemo(() => {
        if (!itineraryRef) return {};
        const result = {};
        itineraryRef.forEach(day => {
            if (day.route?.polyline) {
                try {
                    const raw = decodePolyline(day.route.polyline);
                    result[day.day] = {
                        full: simplifyPolyline(raw, 150),     // For day view
                        overview: simplifyPolyline(raw, 50),  // For overview (lighter)
                    };
                } catch (e) {
                    console.warn('Polyline decode failed for day', day.day, e);
                }
            }
        });
        return result;
    }, [itineraryRef]);



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
        return cityClusterData.flatMap(city => city.spots.map(s => ({ ...s, cityName: city.cityName })));
    }, [cityClusterData]);

    // Initialize Supercluster once for highly-optimized native-speed clustering
    const supercluster = useMemo(() => {
        const cluster = new Supercluster({
            radius: 45,
            maxZoom: 16,
            map: (props) => ({ 
                spotCount: 1, 
                color: props.color, 
                cityName: props.cityName || 'Area'
            }),
            reduce: (accumulated, props) => {
                accumulated.spotCount += props.spotCount;
            }
        });
        
        const geoJsonPoints = individualSpotsData.map(spot => ({
            type: 'Feature',
            properties: {
                id: spot._id || spot.placeId || Math.random(),
                spotCount: 1,
                color: spot.color, // Color of the first point in cluster will be retained
                cityName: spot.cityName
            },
            geometry: {
                type: 'Point',
                coordinates: [spot.coordinates.lng, spot.coordinates.lat] // GeoJSON requires [lng, lat]
            }
        }));
        
        cluster.load(geoJsonPoints);
        return cluster;
    }, [individualSpotsData]);

    // O(1) fetch from Supercluster using the current map zoom
    const visibleCityClusters = useMemo(() => {
        if (!individualSpotsData || individualSpotsData.length === 0) return [];
        const zoom = Math.max(mapZoomRef.current || mapZoom, 4);
        
        // Fetch globally or based on Map region bounds
        const bounds = [-180, -90, 180, 90]; 
        const clusters = supercluster.getClusters(bounds, zoom);
        
        return clusters.map(cluster => {
            const [lng, lat] = cluster.geometry.coordinates;
            const props = cluster.properties;
            const isCluster = props.cluster;
            
            return {
                key: isCluster ? `cluster-${props.cluster_id}` : `cluster-${props.id}`,
                centroid: { latitude: lat, longitude: lng },
                spotCount: isCluster ? props.point_count : 1,
                color: props.color,
                cityName: props.cityName || 'Area',
            };
        });
    }, [individualSpotsData, mapZoom, supercluster]);

    // --- Logic for Marker Label Collision Avoidance ---
    // Calculates which labels should be shown based on zoom and relative screen distance
    const visibleLabelIds = useMemo(() => {
        if (!tripData?.itinerary) return new Set();

        const allPlaces = tripData.itinerary.flatMap((day, dayIndex) =>
            (day.places || [])
                .filter(place => place && place.coordinates?.lat && place.coordinates?.lng)
                .map((place, placeIndex) => ({
                    id: `marker-${day.day}-${placeIndex}`,
                    lat: place.coordinates.lat,
                    lng: place.coordinates.lng,
                    name: place.name,
                }))
        );

        const zoom = mapZoomRef.current || 10;
        const visibleIds = new Set();
        
        // 2. Spatial Grid Hash for O(N) collision detection
        // At higher zooms, the grid cells are smaller, allowing labels to sit closer geographically
        let gridPrecision;
        if (zoom >= 14) gridPrecision = 0.002;      // ~200m
        else if (zoom >= 12) gridPrecision = 0.005; // ~500m
        else if (zoom >= 10) gridPrecision = 0.015; // ~1.5km
        else if (zoom >= 8) gridPrecision = 0.05;   // ~5km
        else if (zoom >= 6) gridPrecision = 0.15;   // ~15km
        else if (zoom >= 4) gridPrecision = 0.5;    // ~50km
        else gridPrecision = 1.0;                   // ~100km
        const occupiedCells = new Set();

        allPlaces.forEach((place) => {
            const cellX = Math.round(place.lng / gridPrecision);
            const cellY = Math.round(place.lat / gridPrecision);
            // Combine with map zoom for cache key logic if needed, but precision handles scope
            const cellKey = `${cellX},${cellY}`;

            // Check if exact cell or immediate 4-way neighbors are occupied
            if (
                !occupiedCells.has(cellKey) &&
                !occupiedCells.has(`${cellX + 1},${cellY}`) &&
                !occupiedCells.has(`${cellX - 1},${cellY}`) &&
                !occupiedCells.has(`${cellX},${cellY + 1}`) &&
                !occupiedCells.has(`${cellX},${cellY - 1}`)
            ) {
                visibleIds.add(place.id);
                // Mark cell as occupied
                occupiedCells.add(cellKey);
            }
        });

        return visibleIds;
    }, [tripData, mapZoom]);

    // ── Memoized itinerary markers — prevents creating new native GMSMarker objects on every render ──
    const itineraryMarkers = useMemo(() => {
        if (!tripData?.itinerary) return null;
        try {
        const isOverview = activeTripDay === null;
        let globalIdx = 0; // sequential index across all days
        return tripData.itinerary.flatMap((day, dayIndex) => {
            // When viewing a specific day, show only that day (no progressive limit)
            if (activeTripDay !== null && day.day !== activeTripDay) {
                // Still count places for correct globalIdx
                globalIdx += (day.places?.length || 0);
                return [];
            }
            const dayColor = getDayColor(dayIndex);
            const markers = (day.places || [])
                .filter(place => place && place.coordinates?.lat && place.coordinates?.lng)
                .map((place, placeIndex) => {
                    const myIdx = globalIdx++;
                    // In overview, only render if this marker has been progressively loaded
                    if (isOverview && myIdx >= loadedMarkerCount) return null;
                    return (
                    <Marker
                        key={`marker-${day.day}-${placeIndex}`}
                        coordinate={{
                            latitude: place.coordinates.lat,
                            longitude: place.coordinates.lng,
                        }}
                        title={place.name || ''}
                        description={`Day ${day.day} • ${place.category || 'sightseeing'}`}
                        // Center is the middle of the top circle, bounding box is taller
                        anchor={{ x: 0.5, y: isOverview ? 11/50 : 14/60 }}
                        tracksViewChanges={false}
                    >
                        {isOverview ? (
                            /* Fixed bounding box (100x50) to prevent clipping. 
                               Circle is 22x22 at the very top. Exact center is y=11. */
                            <View style={{ alignItems: 'center', width: 100, height: 50 }}>
                                <View style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: 11,
                                    backgroundColor: dayColor,
                                    borderWidth: 2,
                                    borderColor: '#FFFFFF',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>{placeIndex + 1}</Text>
                                </View>
                                {visibleLabelIds.has(`marker-${day.day}-${placeIndex}`) && (
                                    <Text
                                        numberOfLines={1}
                                        style={{
                                            marginTop: 2,
                                            fontSize: 9,
                                            fontWeight: '700',
                                            color: '#FFFFFF',
                                            textAlign: 'center',
                                            backgroundColor: 'rgba(0,0,0,0.75)',
                                            paddingHorizontal: 4,
                                            paddingVertical: 1,
                                            borderRadius: 3,
                                            overflow: 'hidden',
                                        }}
                                    >{place.name}</Text>
                                )}
                            </View>
                        ) : (
                            /* Fixed bounding box (120x60) to prevent clipping. 
                               Circle is 28x28 at the very top. Exact center is y=14. */
                            <Animated.View style={[markerAnimatedStyle, { alignItems: 'center', width: 120, height: 60 }]}>
                                <View style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    backgroundColor: dayColor,
                                    borderWidth: 2,
                                    borderColor: '#FFFFFF',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    // Removed native shadows to prevent severe GPU memory & RN Maps heating bugs
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
                                        maxWidth: 120, // ensure it doesn't overflow container width
                                        fontSize: 10,
                                        fontWeight: '700',
                                        color: '#FFFFFF',
                                        textAlign: 'center',
                                        backgroundColor: 'rgba(0,0,0,0.85)',
                                        paddingHorizontal: 5,
                                        paddingVertical: 1,
                                        borderRadius: 4,
                                        overflow: 'hidden',
                                        // Removed expensive textShadow
                                    }}
                                >{place.name}</Text>
                            </Animated.View>
                        )}
                    </Marker>
                    );
                }).filter(Boolean);
            return markers;
        });
        } catch (e) {
            console.warn('[itineraryMarkers] Render error:', e);
            return null;
        }
    }, [tripData, activeTripDay, loadedMarkerCount, visibleLabelIds, selectedItinerarySpot, markerAnimatedStyle]);

    // ── Memoized polylines — prevents orphaned GMSPolyline2D native objects ──
    const memoizedPolylines = useMemo(() => {
        if (!tripData?.itinerary) return null;
        const isOverview = activeTripDay === null;
        let globalIdx = 0;
        return tripData.itinerary.flatMap((day, dayIndex) => {
            const dayPlaces = (day.places || []).filter(p => p?.coordinates?.lat && p?.coordinates?.lng);
            const dayPlaceCount = dayPlaces.length;
            const dayStartIdx = globalIdx;
            globalIdx += (day.places?.length || 0);
            // When viewing a specific day, show only that day
            if (activeTripDay !== null && day.day !== activeTripDay) return [];

            const polyData = decodedPolylines[day.day];
            if (!polyData) return [];
            const polyCoords = isOverview ? polyData.overview : polyData.full;
            if (!polyCoords || polyCoords.length < 2) return [];

            const dayColor = getDayColor(dayIndex);
            const elements = [];

            // How many spots of THIS day have been loaded?
            const loadedInThisDay = Math.max(0, Math.min(dayPlaceCount, loadedMarkerCount - dayStartIdx));

            // Need at least 2 loaded spots to draw a route segment
            if (loadedInThisDay < 2) return [];

            // Find the polyline slice up to the last loaded spot's nearest point
            const lastLoadedSpot = dayPlaces[loadedInThisDay - 1];
            let sliceEnd = polyCoords.length; // default: show all

            if (loadedInThisDay < dayPlaceCount) {
                // Still loading — find the closest polyline point to the last loaded spot
                let bestIdx = 0;
                let bestDist = Infinity;
                for (let k = 0; k < polyCoords.length; k++) {
                    const dLat = polyCoords[k].latitude - lastLoadedSpot.coordinates.lat;
                    const dLng = polyCoords[k].longitude - lastLoadedSpot.coordinates.lng;
                    const dist = dLat * dLat + dLng * dLng;
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestIdx = k;
                    }
                }
                sliceEnd = bestIdx + 1; // inclusive
            }

            const visibleCoords = polyCoords.slice(0, sliceEnd);
            if (visibleCoords.length < 2) return [];

            // Shadow/outline (skip in overview to save memory)
            if (!isOverview) {
                elements.push(
                    <Polyline
                        key={`route-outline-${day.day}-${sliceEnd}`}
                        coordinates={visibleCoords}
                        strokeColor="rgba(0,0,0,0.12)"
                        strokeWidth={12}
                        lineJoin="round"
                        lineCap="round"
                    />
                );
            }
            // Colored route
            elements.push(
                <Polyline
                    key={`route-${day.day}-${sliceEnd}`}
                    coordinates={visibleCoords}
                    strokeColor={dayColor}
                    strokeWidth={isOverview ? 5 : 8}
                    lineJoin="round"
                    lineCap="round"
                />
            );
            return elements;
        });
    }, [tripData, activeTripDay, loadedMarkerCount, decodedPolylines]);

    // Whether to show the country map overlay (My Spots default view, no trip open)
    const showCountryMap = !tripData && countryMapData.length > 0;

    // Sync userId & backendUrl to App Group UserDefaults for the Share Extension
    useEffect(() => {
        if (userId) {
            setAppGroupData(userId, BACKEND_URL);
        }
    }, [userId]);

    // Once spots data loads, animate the map to the latest saved spot
    const hasAnimatedToSpot = useRef(false);
    useEffect(() => {
        if (hasAnimatedToSpot.current || !spotsData?.spots?.length || tripData) return;
        const latestSpot = spotsData.spots.find(s => s.coordinates?.lat && s.coordinates?.lng);
        if (latestSpot && mapRef.current) {
            hasAnimatedToSpot.current = true;
            mapRef.current.animateToRegion({
                latitude: latestSpot.coordinates.lat,
                longitude: latestSpot.coordinates.lng,
                latitudeDelta: 65.0,
                longitudeDelta: 65.0,
            }, 600);
        }
    }, [spotsData, tripData]);

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
            backgroundColor: interpolateColor(
                createMenuOpacity.value,
                [0, 1],
                ['#eaedee', '#acb5b9']
            )
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
            const bottomPadding = tripOverviewSheetIndex === 0 ? 185 : SCREEN_HEIGHT * 0.6;
            return { top: 50, right: 10, bottom: bottomPadding, left: 10 };
        }
        // When my spots sheet is open, we cap the padding at the 50% snap point
        // so the map doesn't abruptly re-center/shift when pulled to 90%
        const snapPadding = [0.12, 0.5, 0.5][sheetIndex] * SCREEN_HEIGHT;
        return { top: 50, right: 10, bottom: snapPadding, left: 10 };
    }, [isTripOverviewOpen, sheetIndex, tripOverviewSheetIndex]);

    // Progressive Trip Animation Loop
    // IMPORTANT: Only depends on tripData to avoid re-triggers from sheet state changes.
    // All other values are read from refs at execution time.
    useEffect(() => {
        if (!tripData?.itinerary) {
            setLoadedMarkerCount(0);
            tripIdRef.current = null;
            return;
        }

        // Already animated this exact trip — don't re-animate
        if (tripIdRef.current === tripData._id) {
            return;
        }

        const total = tripData.itinerary.reduce((sum, day) => sum + (day.places?.length || 0), 0);
        tripIdRef.current = tripData._id;
        animationActiveRef.current = true;
        setLoadedMarkerCount(0);

        const runTripAnimation = async () => {
            // Small delay to let TripOverviewSheet mount and map settle
            await new Promise(r => setTimeout(r, 300));
            if (!animationActiveRef.current) return;

            // Collect coords per day for progressive zoom-out
            const coordsByDay = tripData.itinerary.map(day =>
                (day.places || [])
                    .filter(p => p.coordinates?.lat && p.coordinates?.lng)
                    .map(p => ({ latitude: p.coordinates.lat, longitude: p.coordinates.lng }))
            );

            // Start by zooming into Day 1 only
            const day1Coords = coordsByDay[0] || [];
            if (day1Coords.length > 1) {
                mapRef.current?.fitToCoordinates(day1Coords, {
                    edgePadding: { top: 60, right: 60, bottom: 120, left: 60 },
                    animated: true,
                });
            } else if (day1Coords.length === 1) {
                mapRef.current?.animateToRegion({
                    latitude: day1Coords[0].latitude,
                    longitude: day1Coords[0].longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                }, 600);
            }

            // Wait for initial zoom
            await new Promise(r => setTimeout(r, 300));
            if (!animationActiveRef.current) return;

            // Progressively reveal spots, zooming out after each day
            let currentLoaded = 0;
            const allRevealedCoords = []; // accumulates coords across days

            for (let i = 0; i < tripData.itinerary.length; i++) {
                if (!animationActiveRef.current) break;

                const day = tripData.itinerary[i];
                const dayPlaces = (day.places || []).filter(p => p.coordinates?.lat && p.coordinates?.lng);

                // Draw this day's spots one by one
                for (let j = 0; j < dayPlaces.length; j++) {
                    if (!animationActiveRef.current) break;
                    currentLoaded++;
                    setLoadedMarkerCount(currentLoaded);
                    allRevealedCoords.push({
                        latitude: dayPlaces[j].coordinates.lat,
                        longitude: dayPlaces[j].coordinates.lng,
                    });
                    await new Promise(r => setTimeout(r, 100));
                }

                // After this day finishes, zoom out to fit all revealed days so far
                if (animationActiveRef.current && i < tripData.itinerary.length - 1 && allRevealedCoords.length > 1) {
                    // Also include next day's coords in the zoom so user sees where it's heading
                    const nextDayCoords = coordsByDay[i + 1] || [];
                    const previewCoords = [...allRevealedCoords, ...nextDayCoords];

                    mapRef.current?.fitToCoordinates(previewCoords, {
                        edgePadding: { top: 60, right: 60, bottom: 120, left: 60 },
                        animated: true,
                    });
                    // Wait for zoom-out transition
                    await new Promise(r => setTimeout(r, 200));
                }
            }

            animationActiveRef.current = false;
        };

        runTripAnimation();

        return () => {
            animationActiveRef.current = false;
        };
    }, [tripData]);


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

    // Track camera before a trip opens so we can restore it when the trip closes
    useEffect(() => {
        if (!tripData) {
            // Trip was cleared, restore the saved camera
            if (savedCameraBeforeTripRef.current && mapRef.current) {
                const saved = savedCameraBeforeTripRef.current;
                savedCameraBeforeTripRef.current = null;

                // First, snap the main bottom sheet back to the saved position
                // so dynamicMapPadding settles to the same value as before the trip
                if (saved.sheetIdx !== undefined) {
                    bottomSheetRef.current?.snapToIndex(saved.sheetIdx);
                }

                // Wait for the sheet position + map padding to fully settle,
                // THEN animate the camera back to the exact pre-trip view
                setTimeout(() => {
                    mapRef.current?.animateCamera(saved.camera, { duration: 600 });
                }, 500);
            }
        }
    }, [tripData]);

    // Fit the map to show markers based on active day/trip changes
    const fitTimeout = useRef(null);
    useEffect(() => {
        if (!tripData?.itinerary || !mapRef.current) return;
        if (isEditMode) return;
        if (animationActiveRef.current) return; // Wait for the progressive animation to finish first!

        let daysToFit = [];
        if (activeTripDay === null) {
            daysToFit = tripData.itinerary;
        } else {
            daysToFit = tripData.itinerary.filter(d => d.day === activeTripDay);
        }

        // Gather all valid coordinates
        const allCoords = [];
        daysToFit.forEach(day => {
            (day.places || []).forEach(p => {
                if (p?.coordinates?.lat && p?.coordinates?.lng) {
                    allCoords.push({
                        latitude: p.coordinates.lat,
                        longitude: p.coordinates.lng
                    });
                }
            });
        });

        if (allCoords.length > 0) {
            if (fitTimeout.current) clearTimeout(fitTimeout.current);
            fitTimeout.current = setTimeout(() => {
                if (allCoords.length === 1) {
                    // Just one point, animate to region with fixed zoom
                    mapRef.current?.animateToRegion({
                        latitude: allCoords[0].latitude,
                        longitude: allCoords[0].longitude,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    }, 400);
                } else {
                    // Let native Maps handle the perfect bounding box zoom natively!
                    // dynamicMapPadding handles the UI obstruction at the bottom, 
                    // this just gives some breathing room inside the safe area.
                    mapRef.current?.fitToCoordinates(allCoords, {
                        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                        animated: true,
                    });
                }
            }, 300);
        }

        return () => {
            if (fitTimeout.current) clearTimeout(fitTimeout.current);
        };
    }, [tripData, activeTripDay, dynamicMapPadding.bottom, isEditMode]);

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
        setSheetIndex(index);
        if (index !== 2) {
            Keyboard.dismiss();
        }
    }, []);


    const handleTripOverviewSheetChange = useCallback((index) => {
        setTripOverviewSheetIndex(index);
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
                            latitudeDelta: 65.0,
                            longitudeDelta: 65.0,
                        }, 400);
                    } else if (countryMapData.length > 0) {
                        const centroids = countryMapData.map(c => c.centroid);
                        let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
                        centroids.forEach(c => {
                            minLat = Math.min(minLat, c.latitude);
                            maxLat = Math.max(maxLat, c.latitude);
                            minLng = Math.min(minLng, c.longitude);
                            maxLng = Math.max(maxLng, c.longitude);
                        });
                        const latPad = Math.max((maxLat - minLat) * 0.3, 5);
                        const lngPad = Math.max((maxLng - minLng) * 0.3, 5);
                        mapRef.current?.animateToRegion({
                            latitude: (minLat + maxLat) / 2,
                            longitude: (minLng + maxLng) / 2,
                            latitudeDelta: (maxLat - minLat) + latPad,
                            longitudeDelta: (maxLng - minLng) + lngPad,
                        }, 400);
                    }
                }, 400);
            } else if (activeTab === 'trips') {
                setTimeout(() => {
                    bottomSheetRef.current?.snapToIndex(2);
                }, 150);
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

    // Zoom map when a spot is selected either from the map or the itinerary list
    useEffect(() => {
        if (selectedItinerarySpot?.coordinates?.lat && selectedItinerarySpot?.coordinates?.lng) {
            mapRef.current?.animateToRegion({
                latitude: selectedItinerarySpot.coordinates.lat,
                longitude: selectedItinerarySpot.coordinates.lng,
                // Zoom in close
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            }, 400);
        } else if (!selectedItinerarySpot && tripData?.itinerary && mapRef.current) {
            // Closing spot detail — zoom back to active day if one is selected, else full trip
            const daysToFit = activeTripDay !== null
                ? tripData.itinerary.filter(d => d.day === activeTripDay)
                : tripData.itinerary;

            const allCoords = [];
            daysToFit.forEach(day => {
                (day.places || []).forEach(place => {
                    if (place.coordinates?.lat && place.coordinates?.lng) {
                        allCoords.push({
                            latitude: place.coordinates.lat,
                            longitude: place.coordinates.lng,
                        });
                    }
                });
            });

            if (allCoords.length > 0) {
                if (allCoords.length === 1) {
                    mapRef.current?.animateToRegion({
                        latitude: allCoords[0].latitude,
                        longitude: allCoords[0].longitude,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    }, 400);
                } else {
                    mapRef.current?.fitToCoordinates(allCoords, {
                        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                        animated: true,
                    });
                }
            }
        }
    }, [selectedItinerarySpot, tripData, activeTripDay]);

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
                latitudeDelta: 65.0,
                longitudeDelta: 65.0,
            };
        }
        // Fallback (Europe zoomed out)
        return {
            latitude: 48.0,
            longitude: 15.0,
            latitudeDelta: 70.0,
            longitudeDelta: 70.0,
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
                onPanDrag={() => {
                    // Instantly cancel animation if user manually pans map
                    if (animationActiveRef.current) {
                        animationActiveRef.current = false;
                        const total = tripData?.itinerary?.reduce((sum, day) => sum + (day.places?.length || 0), 0) || 0;
                        setLoadedMarkerCount(total);
                    }
                }}
                onRegionChangeComplete={(region) => {
                    const zoom = Math.round(Math.log2(360 / region.longitudeDelta));
                    mapZoomRef.current = zoom;
                    mapRegionRef.current = region;

                    // Continuously save the camera when no trip is active,
                    // so we always have the exact pre-trip view to restore later.
                    // We use getCamera() because camera center+zoom is NOT affected by mapPadding,
                    // unlike region deltas which shift when padding changes.
                    if (!tripData && mapRef.current) {
                        mapRef.current.getCamera().then(cam => {
                            if (!tripData) {
                                savedCameraBeforeTripRef.current = { camera: cam, sheetIdx: sheetIndex };
                            }
                        });
                    }

                    // Update state if the integer zoom level has changed
                    if (zoom !== mapZoom) {
                        setMapZoom(zoom);
                    }


                    // Smooth crossfade between country flags and spot clusters at zoom 4
                    if (showFlags && zoom >= 4) {
                        setShowFlags(false);
                        flagOpacity.value = withTiming(0, { duration: 300 });
                        clusterOpacity.value = withTiming(1, { duration: 300 });
                    } else if (!showFlags && zoom < 4) {
                        setShowFlags(true);
                        flagOpacity.value = withTiming(1, { duration: 300 });
                        clusterOpacity.value = withTiming(0, { duration: 300 });
                    }

                    // Show individual spots at zoom >= 8, city clusters below
                    const shouldShowIndividual = zoom >= 8;
                    if (shouldShowIndividual !== showIndividualSpots) {
                        setShowIndividualSpots(shouldShowIndividual);
                    }
                }}
            >

                {/* ── My Spots: Country flag markers (always mounted, opacity-controlled) ── */}
                {showCountryMap && showFlags && countryMapData.map((item) => (
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
                {showCountryMap && !showFlags && !showIndividualSpots && visibleCityClusters.map((city) => {
                    const size = 38 + Math.min(city.spotCount, 20) * 0.6;
                    return (
                        <Marker
                            key={`city-${city.key}`}
                            coordinate={city.centroid}
                            anchor={{ x: 0.5, y: 0.85 }}
                            tracksViewChanges={Platform.OS === 'android'}
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
                            </Animated.View>
                        </Marker>
                    );
                })}

                {/* ── My Spots: Individual spot markers (high zoom, opacity-controlled) ── */}
                {showCountryMap && !showFlags && showIndividualSpots && individualSpotsData.map((spot, idx) => (
                    <Marker
                        key={`spot-${spot._id || spot.placeId || idx}`}
                        coordinate={{ latitude: spot.coordinates.lat, longitude: spot.coordinates.lng }}
                        anchor={{ x: 0.5, y: 0.3 }}
                        onPress={() => handleSpotPress(spot)}
                        tracksViewChanges={Platform.OS === 'android'}
                    >
                        <Animated.View style={[styles.spotMarkerContainer, clusterAnimatedStyle]}>
                            <View style={[styles.spotMarkerDot, { backgroundColor: spot.color }]} />
                            <Text style={styles.spotMarkerLabel} numberOfLines={1}>{spot.name}</Text>
                        </Animated.View>
                    </Marker>
                ))}

                {/* Itinerary place markers — only active day (memoized) */}
                {itineraryMarkers}

                {/* Route polylines — memoized to prevent native object leaks */}
                {memoizedPolylines}
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
                                <Image source={tripIcon} style={{ width: 22, height: 22 }} resizeMode="contain" />
                            </View>
                            <View style={styles.optionTextContainer}>
                                <Text style={styles.optionTitle}>Create New Trip</Text>
                                <Text style={styles.optionSubtitle}>Plan your next destination</Text>
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
                    // Track meaningful action & maybe prompt for review
                    trackActionAndMaybeAskReview();
                }}
            />

            {/* Floating Trip Overview Buttons - Top of Screen */}
            {isTripOverviewOpen && (
                <>
                    {/* Close / Discard Button - Top Left */}
                    <TouchableOpacity
                        style={[
                            styles.tripOverviewFloatingBtn,
                            { 
                                left: 16, 
                                top: insets.top + 12,
                                backgroundColor: isEditMode ? '#0F172A' : 'rgba(255, 255, 255, 0.85)',
                                borderColor: isEditMode ? 'rgba(15, 23, 42, 0.2)' : 'rgba(255, 255, 255, 0.5)',
                            }
                        ]}
                        onPress={() => {
                            if (isEditMode) {
                                restoreTrip();
                                setEditMode(false);
                            } else {
                                tripOverviewSheetRef.current?.close();
                            }
                        }}
                        activeOpacity={0.7}
                        disabled={isSavingTrip}
                    >
                        {isEditMode ? (
                            <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <Path d="M18 6 6 18M6 6l12 12" />
                            </Svg>
                        ) : (
                            <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <Path d="M18 6 6 18M6 6l12 12" />
                            </Svg>
                        )}
                    </TouchableOpacity>

                    {/* Edit / Done Button - Top Right */}
                    <TouchableOpacity
                        style={[
                            styles.tripOverviewFloatingBtn,
                            {
                                right: 16,
                                top: insets.top + 12,
                                width: 'auto',
                                paddingHorizontal: 16,
                                backgroundColor: isEditMode ? '#0F172A' : 'rgba(255, 255, 255, 0.85)',
                                opacity: isSavingTrip ? 0.7 : 1,
                                borderColor: isEditMode ? 'rgba(15, 23, 42, 0.2)' : 'rgba(255, 255, 255, 0.5)',
                            }
                        ]}
                        disabled={isSavingTrip}
                        onPress={async () => {
                            if (isEditMode) {
                                if (tripData?._id) {
                                    // Save changes to backend when clicking Done
                                    setIsSavingTrip(true);
                                    try {
                                        const url = `${BACKEND_URL}/api/trips/${tripData._id}`;

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

                                        if (response.ok) {
                                            const result = await response.json();
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
                                backupTrip();
                                setEditMode(true);
                            }
                        }}
                        activeOpacity={0.7}
                    >
                        {isSavingTrip ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                {isEditMode ? (
                                    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <Path d="M20 6L9 17l-5-5" />
                                    </Svg>
                                ) : (
                                    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </Svg>
                                )}
                                <Text style={{ 
                                    fontSize: 12, 
                                    fontWeight: '800', 
                                    color: isEditMode ? '#FFFFFF' : '#1E293B',
                                    marginLeft: 6 
                                }}>
                                    {isEditMode ? 'Done' : 'Edit'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </>
            )}

            {/* Trip Overview Bottom Sheet */}
            <TripOverviewSheet
                ref={tripOverviewSheetRef}
                onChange={handleTripOverviewSheetChange}
                onDayChange={(day) => {
                    // If user manually selects a specific day, cancel the progressive animation
                    if (day !== null && animationActiveRef.current) {
                        animationActiveRef.current = false;
                        const total = tripData?.itinerary?.reduce((sum, d) => sum + (d.places?.length || 0), 0) || 0;
                        setLoadedMarkerCount(total);
                    }
                    setActiveTripDay(day);
                }}
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
        fontSize: 18,
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
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    // Country flag marker styles
    flagMarkerContainer: {
        alignItems: 'center',
        width: 100,
    },
    flagMarkerInner: {
        position: 'relative',
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    flagMarkerEmoji: {
        fontSize: 30,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    flagMarkerBadge: {
        position: 'absolute',
        top: 9,
        right: -10,
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#000000',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
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
    },
    // Cluster marker styles
    clusterMarker: {
        backgroundColor: 'rgba(59, 130, 246, 0.85)',
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
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
    },
    cityClusterCount: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
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
    },
    spotMarkerLabel: {
        marginTop: 3,
        fontSize: 10,
        fontWeight: '600',
        color: '#FFFFFF',
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.85)',
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 5,
        overflow: 'hidden',
        maxWidth: 88,
    },
});

export default HomeScreen;
