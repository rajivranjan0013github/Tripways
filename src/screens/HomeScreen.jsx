/**
 * Home Screen - TripWays
 * @format
 */

import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Dimensions, Platform, Keyboard, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, interpolate } from 'react-native-reanimated';
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
import TripsOverlay from '../components/TripsOverlay';
import SpotsBottomSheet from '../components/SpotsBottomSheet';
import { setAppGroupData } from '../services/ShareIntent';
import MySpotIcon from '../assets/My-spot';

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
    const sharedUrlProcessed = useRef(false);
    const tabBarHeight = 52 + insets.bottom + (Platform.OS === 'android' ? 120 : 40); // Increased buffer to fully hide on both platforms
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
        isSavingTrip, setIsSavingTrip } = useTripStore();

    // --- Local-only UI state (not shared across components) ---
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [sheetIndex, setSheetIndex] = useState(1);

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

    // Sync userId & backendUrl to App Group UserDefaults for the Share Extension
    useEffect(() => {
        if (userId) {
            setAppGroupData(userId, BACKEND_URL);
        }
    }, [userId]);

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
                    latitude: -20.0, // Centered perfectly on the Caribbean/Central America to match screenshot framing above the bottom sheet
                    longitude: -80.0,
                    latitudeDelta: 75.0,
                    longitudeDelta: 75.0,
                }}
            >

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


           
            {/* Spots Bottom Sheet */}
            <SpotsBottomSheet
                bottomSheetRef={bottomSheetRef}
                createTripSheetRef={createTripSheetRef}
                setSheetIndex={setSheetIndex}
                sheetAnimatedPosition={sheetAnimatedPosition}
                tabBarTranslateY={tabBarTranslateY}
                tabBarHeight={tabBarHeight}
            />

            {/* Trips Overlay */}
            <TripsOverlay
                animatedOverlayStyle={animatedOverlayStyle}
                onTripOpen={() => {
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
                }}
            />

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
});

export default HomeScreen;
