import React, { forwardRef, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Platform, Image, ActivityIndicator, Linking } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, LinearTransition, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, interpolate } from 'react-native-reanimated';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView, TouchableOpacity as RNGHTouchableOpacity } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Svg, { Path, Circle } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import Config from 'react-native-config';
import { useQueryClient } from '@tanstack/react-query';
import { MMKV } from 'react-native-mmkv';

// Zustand stores
import { useUIStore } from '../store/uiStore';
import { useTripStore } from '../store/tripStore';
import { useUserStore } from '../store/userStore';
import AddSpotSheet from './AddSpotSheet';
import PremiumOverlay from './PremiumOverlay';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const tripStorage = new MMKV();
const BACKEND_URL = Config.BACKEND_URL || 'http://localhost:3000';

// Stable ID generator for places without explicit IDs
const PLACE_ID_MAP = new WeakMap();
let stablePlaceIdCounter = 0;
const getStablePlaceId = (place) => {
    if (!place || typeof place !== 'object') return `fallback-${Math.random()}`;
    if (place.placeId) return `pid-${place.placeId}`;
    if (place._id) return `_id-${place._id}`;
    if (place.id) return `id-${place.id}`;
    if (place.fsq_id) return `fsq-${place.fsq_id}`;

    if (!PLACE_ID_MAP.has(place)) {
        stablePlaceIdCounter += 1;
        PLACE_ID_MAP.set(place, `stable-${stablePlaceIdCounter}`);
    }
    return PLACE_ID_MAP.get(place);
};

// Error boundary to catch rendering crashes
class SheetErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('[TripOverviewSheet CRASH]', error?.message, error?.stack);
        console.error('[TripOverviewSheet CRASH info]', JSON.stringify(errorInfo));
    }
    render() {
        if (this.state.hasError) {
            return (
                <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 16 }}>Something went wrong</Text>
                    <Text style={{ color: '#64748B', fontSize: 12, marginTop: 8 }}>{String(this.state.error?.message || '')}</Text>
                </View>
            );
        }
        return this.props.children;
    }
}

// Category colors & emoji mapping
const CATEGORY_CONFIG = {
    'Attractions': { emoji: '🎡', color: '#F59E0B', bg: '#FFFBEB' },
    'Museum': { emoji: '🏛️', color: '#8B5CF6', bg: '#F5F3FF' },
    'Temple': { emoji: '🛕', color: '#EC4899', bg: '#FDF2F8' },
    'Restaurant': { emoji: '🍽️', color: '#EF4444', bg: '#FEF2F2' },
    'Cafe': { emoji: '☕', color: '#D97706', bg: '#FFFBEB' },
    'Ghat': { emoji: '🌊', color: '#06B6D4', bg: '#ECFEFF' },
    'Nature': { emoji: '🌿', color: '#22C55E', bg: '#F0FDF4' },
    'Shopping': { emoji: '🛍️', color: '#F472B6', bg: '#FDF2F8' },
    'Observatory': { emoji: '🔭', color: '#6366F1', bg: '#EEF2FF' },
    'Station': { emoji: '🚂', color: '#64748B', bg: '#F8FAFC' },
};

// Day colors matching the map paths
const DAY_COLORS = ['#6366F1', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

// Travel mode icons
const TRAVEL_MODES = {
    walking: { icon: '🚶', label: 'Walking' },
    driving: { icon: '🚗', label: 'Driving' },
};

const ChecklistStepItem = ({ step, idx, currentTick, dots, activePulseStyle }) => {
    const stepStartTick = idx * 5;
    const isPending = currentTick < stepStartTick;
    const isActive = currentTick >= stepStartTick && currentTick < stepStartTick + 3;
    const isCompleted = currentTick >= stepStartTick + 3;
    const drawLine = currentTick >= stepStartTick + 4;

    const lineStyle = useAnimatedStyle(() => ({
        height: withTiming(drawLine ? '100%' : '0%', { duration: 500 })
    }));

    const textStyle = useAnimatedStyle(() => {
        const activeColor = '#0F172A';
        const completedColor = '#475569';
        const pendingColor = '#94A3B8';
        
        let targetColor = pendingColor;
        let targetSize = 16;
        
        if (isActive) {
            targetColor = activeColor;
            targetSize = 17;
        } else if (isCompleted) {
            targetColor = completedColor;
            targetSize = 16;
        }
        
        return {
            color: withTiming(targetColor, { duration: 400 }),
            fontSize: withTiming(targetSize, { duration: 400, easing: Easing.out(Easing.quad) }),
        };
    });

    return (
        <Animated.View
            entering={FadeIn.delay(idx * 150).duration(300)}
            style={[
                styles.checklistRow,
                isActive && styles.checklistRowActive,
                isCompleted && styles.checklistRowCompleted,
            ]}
        >
            {/* Status indicator */}
            <View style={styles.checklistIndicator}>
                {isCompleted ? (
                    <View style={styles.checklistCheckCircle}>
                        <Animated.View entering={ZoomIn.duration(500)}>
                            <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                <Path d="M20 6L9 17l-5-5" />
                            </Svg>
                        </Animated.View>
                    </View>
                ) : isActive ? (
                    <Animated.View style={[styles.checklistActiveCircle, activePulseStyle]} />
                ) : (
                    <View style={styles.checklistPendingCircle} />
                )}
                {/* Connecting line (except last) */}
                {idx < 3 && ( // Hardcoded 3 based on 4 LOADING_STEPS to avoid passing array length overhead
                    <View style={[styles.checklistLine, { overflow: 'hidden' }]}>
                        <Animated.View 
                            style={[
                                { width: '100%', backgroundColor: '#10B981', alignSelf: 'flex-start' },
                                lineStyle
                            ]} 
                        />
                    </View>
                )}
            </View>

            {/* Content */}
            <Animated.View 
                style={styles.checklistContent}
                layout={LinearTransition.springify().damping(15)}
            >
                <Animated.Text 
                    style={[
                        styles.checklistText,
                        textStyle,
                        isActive ? { fontWeight: '800' } : (isCompleted ? { fontWeight: '600' } : { fontWeight: '500' })
                    ]}
                    layout={LinearTransition.springify().damping(15)}
                >
                    {isActive ? step.text + dots : step.text}
                </Animated.Text>
            </Animated.View>
        </Animated.View>
    );
};

const TripOverviewSheet = forwardRef(({ onChange, onDayChange, animationConfigs }, ref) => {
    const { tripData, isTripLoading: storeLoading, isSavingTrip, isTemplateTripView, setIsTemplateTripView, reorderSpots, removeSpots, moveSpots, optimizeDayOrder, addSpotToDay } = useTripStore();
    const isPremium = useUserStore((state) => state.isPremium);
    const [showPremiumOverlay, setShowPremiumOverlay] = useState(false);
    
    // UI Local state for the loader visibility to allow for "Success" animation delay
    const [isLoaderVisible, setIsLoaderVisible] = useState(storeLoading);

    const { isEditMode, setSelectedSpot } = useUIStore();
    const queryClient = useQueryClient();
    const onSpotPress = setSelectedSpot;
    const [mode, setMode] = useState('overview'); // 'overview' or 'itinerary'
    const [selectedDay, setSelectedDay] = useState(1);
    const [expandedDays, setExpandedDays] = useState({});

    // Notify parent whenever active day or mode changes
    // Pass null when in overview mode so all routes are shown
    useEffect(() => {
        onDayChange?.(mode === 'overview' ? null : selectedDay);
    }, [selectedDay, mode]);
    const snapPoints = useMemo(() => [185, '60%'], []);
    const scrollViewRef = useRef(null);
    const dayLayoutRefs = useRef({});
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);

    // Save template trip to user's trips
    const handleSaveTemplateTrip = async () => {
        if (!tripData || isSavingTemplate) return;
        try {
            setIsSavingTemplate(true);
            const userStr = tripStorage.getString('user');
            if (!userStr) return;
            const user = JSON.parse(userStr);
            const userId = user?.id || user?._id;
            if (!userId) return;

            const res = await fetch(`${BACKEND_URL}/api/trips`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    destination: tripData.locationName,
                    days: tripData.numDays,
                    interests: [],
                    itinerary: tripData.itinerary,
                    discoveredPlaces: tripData.discoveredPlaces || [],
                }),
            });

            const data = await res.json();
            if (data?.success && data?.trip) {
                // Update current tripData with the new saved trip ID
                const saved = data.trip;
                useTripStore.getState().setTripData({
                    ...tripData,
                    _id: saved._id,
                });
                setIsTemplateTripView(false);
                // Refresh the saved trips list
                queryClient.invalidateQueries({ queryKey: ['trips', userId] });
            }
        } catch (err) {
            console.warn('Failed to save template trip:', err);
        } finally {
            setIsSavingTemplate(false);
        }
    };

    // Edit mode state
    const [selectedSpots, setSelectedSpots] = useState(new Set()); // stores spot.originalPlace objects
    const [isItemDragging, setIsItemDragging] = useState(false);
    const movePickerSheetRef = useRef(null);
    const movePickerSnapPoints = useMemo(() => ['40%'], []);

    // Add Spot sheet
    const addSpotSheetRef = useRef(null);
    const [addSpotDayTarget, setAddSpotDayTarget] = useState(null);

    // Optimize route state
    const [optimizingDay, setOptimizingDay] = useState(null);

    const handleOptimize = async (dayNum) => {
        if (!isPremium) {
            setShowPremiumOverlay(true);
            return;
        }
        if (optimizingDay !== null) return; // Already optimizing
        const dayData = tripData?.itinerary?.find(d => d.day === dayNum);
        if (!dayData?.places || dayData.places.length < 2) return;

        const validPlaces = dayData.places.filter(p => p.coordinates?.lat && p.coordinates?.lng);
        if (validPlaces.length < 2) return;

        setOptimizingDay(dayNum);
        try {
            const res = await fetch(`${BACKEND_URL}/api/optimize-day`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ places: dayData.places }),
            });
            const result = await res.json();
            if (result.success && result.optimizedPlaces) {
                const cleanPlaces = result.optimizedPlaces.filter(Boolean);
                optimizeDayOrder(dayNum, cleanPlaces, result.route);

                // Auto-save to backend
                if (tripData?._id) {
                    const updatedItinerary = tripData.itinerary.map(d => {
                        if (d.day !== dayNum) return d;
                        return { ...d, places: cleanPlaces, route: result.route || d.route };
                    });
                    fetch(`${BACKEND_URL}/api/trips/${tripData._id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ itinerary: updatedItinerary }),
                    }).catch(err => console.warn('Auto-save after optimize failed:', err));
                }
            }
        } catch (err) {
            console.warn('Optimize route failed:', err);
        } finally {
            setOptimizingDay(null);
        }
    };

    // Local state for draggable list data (avoids blink from useMemo round-trip)
    const [localSpotsMap, setLocalSpotsMap] = useState({});
    const dragJustHappened = useRef(false);

    // Clear selections when edit mode is turned off
    useEffect(() => {
        if (!isEditMode) {
            setSelectedSpots(new Set());
        }
    }, [isEditMode]);

    // Reset view state to Overview/Day 1 when trip is cleared
    useEffect(() => {
        if (!tripData) {
            setMode('overview');
            setSelectedDay(1);
        }
    }, [tripData]);

    // Switch to itinerary mode when edit mode is activated
    useEffect(() => {
        if (isEditMode && mode !== 'itinerary') {
            setMode('itinerary');
            setSelectedDay(1);
        }
    }, [isEditMode]);

    // Sync draggable data from itineraryDays (skip after our own drags to prevent blink)
    useEffect(() => {
        setLocalSpotsMap(prev => {
            const nextMap = { ...prev };
            let hasTrueChanges = false;

            itineraryDays.forEach(d => {
                const prevSpots = prev[d.day];
                const nextSpots = d.spots;

                if (!prevSpots || prevSpots.length !== nextSpots.length) {
                    nextMap[d.day] = nextSpots;
                    hasTrueChanges = true;
                    return;
                }

                // Compare stable IDs to see if the order or items changed
                const prevIds = prevSpots.map(s => s.id).join(',');
                const nextIds = nextSpots.map(s => s.id).join(',');

                if (prevIds !== nextIds) {
                    if (dragJustHappened.current) {
                        // We just dragged, so `prevSpots` (local map) already has the correct order!
                        // The parent might be lagging behind or sending us out-of-date order.
                        // We do NOT update the map to avoid reverting the user's drag visually.
                    } else {
                        // A legitimate change (not from our drag) has arrived
                        nextMap[d.day] = nextSpots;
                        hasTrueChanges = true;
                    }
                } else {
                    // Order and IDs match exactly. 
                    // To prevent `DraggableFlatList` from unmounting (blinking) due to new array/object references,
                    // we preserve the exact `prevSpots` object references!
                    // (Any changed internal values like times/descriptions won't be reflected without new references, 
                    // but during an active drag-state, preserving references is more important).
                }
            });

            if (dragJustHappened.current) {
                dragJustHappened.current = false;
            }

            return hasTrueChanges ? nextMap : prev;
        });
    }, [itineraryDays]);

    // Initialize expandedDays to all true by default
    useEffect(() => {
        if (itineraryDays.length > 0 && Object.keys(expandedDays).length === 0) {
            const initialMap = {};
            itineraryDays.forEach(d => {
                initialMap[d.day] = true;
            });
            setExpandedDays(initialMap);
        }
    }, [itineraryDays]);

    const toggleSpotSelection = (spotOriginalPlace) => {
        setSelectedSpots(prev => {
            const next = new Set(prev);
            if (next.has(spotOriginalPlace)) {
                next.delete(spotOriginalPlace);
            } else {
                next.add(spotOriginalPlace);
            }
            return next;
        });
    };

    // Scroll to top when mode changes
    useEffect(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, [mode]);

    // ── Logic Checklist Loader ──
    const LOADING_STEPS = [
        { text: 'Discovering the best spots' },
        { text: 'Crafting the perfect route' },
        { text: 'Optimizing travel times' },
        { text: 'Applying finishing touches' },
    ];
    const [currentTick, setCurrentTick] = useState(0);
    // Stop at the last tick of the "Active" phase for the final step (3 ticks for 1.5s typewriter)
    // This prevents the loader from finishing early and appearing stuck
    const MAX_TICK = (LOADING_STEPS.length - 1) * 5 + 2; 

    useEffect(() => {
        if (!isLoaderVisible) {
            setCurrentTick(0);
            return;
        }
        
        // Reset strictly to 0
        setCurrentTick(0);
        
        let interval;
        const timeout = setTimeout(() => {
            interval = setInterval(() => {
                setCurrentTick(prev => {
                    if (prev < MAX_TICK) return prev + 1;
                    return prev;
                });
            }, 500); // 500ms per tick logic
        }, 500); // 500ms head start
        
        return () => {
            clearTimeout(timeout);
            if (interval) clearInterval(interval);
        };
    }, [isLoaderVisible]);

    // Sync local loader visibility with store loading
    useEffect(() => {
        if (storeLoading) {
            setIsLoaderVisible(true);
        } else if (isLoaderVisible && !storeLoading) {
            // SUCCESS TRANSITION:
            // 1. Force the final checkmark to appear
            setCurrentTick((LOADING_STEPS.length - 1) * 5 + 3); 
            // 2. Wait a bit so user sees the "Complete" state
            const timer = setTimeout(() => {
                setIsLoaderVisible(false);
            }, 500); 
            return () => clearTimeout(timer);
        }
    }, [storeLoading]);

    // Pulse animation for the active step dot
    const pulseAnim = useSharedValue(0);
    useEffect(() => {
        if (isLoaderVisible) {
            pulseAnim.value = 0; // Strictly rest to 0 before starting new pulse
            pulseAnim.value = withRepeat(
                withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
                -1,
                true
            );
        } else {
            pulseAnim.value = 0;
        }
    }, [isLoaderVisible]);

    const activePulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [1, 1.3]) }],
        opacity: interpolate(pulseAnim.value, [0, 1], [1, 0.6]),
    }));

    // Typewriter effect for active dots "..."
    const [dots, setDots] = useState('');
    useEffect(() => {
        if (!isLoaderVisible) return;
        const dotsInterval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '' : prev + '.');
        }, 350);
        return () => clearInterval(dotsInterval);
    }, [isLoaderVisible]);

    const numDays = tripData?.numDays || 4;
    const locationName = tripData?.locationName || 'Trip';
    const discoveredPlaces = tripData?.discoveredPlaces || [];

    // Build a lookup map from place name to photoUrl from discovered places
    const photoLookup = useMemo(() => {
        const map = {};
        discoveredPlaces.forEach(p => {
            if (p.name && p.photoUrl) map[p.name.toLowerCase()] = p.photoUrl;
        });
        return map;
    }, [discoveredPlaces]);

    // Map category string to a display-friendly category
    const mapCategory = (cat) => {
        if (!cat) return 'Attractions';
        const lower = cat.toLowerCase();
        if (lower === 'food' || lower === 'restaurant') return 'Restaurant';
        if (lower === 'cafe' || lower === 'coffee') return 'Cafe';
        if (lower === 'museum') return 'Museum';
        if (lower === 'nature') return 'Nature';
        if (lower === 'shopping') return 'Shopping';
        if (lower === 'spiritual' || lower === 'temple' || lower === 'religious') return 'Temple';
        if (lower === 'sightseeing' || lower === 'popular') return 'Attractions';
        if (lower === 'adventure') return 'Attractions';
        if (lower === 'culture' || lower === 'history') return 'Museum';
        if (lower === 'leisure') return 'Nature';
        return 'Attractions';
    };

    // Transform backend itinerary into the format our UI expects
    const itineraryDays = useMemo(() => {
        const backendItinerary = tripData?.itinerary;
        if (!backendItinerary || !Array.isArray(backendItinerary) || backendItinerary.length === 0) {
            return [];
        }

        return backendItinerary.map((dayData) => {
            const spots = (dayData.places || []).filter(place => place).map((place, placeIdx) => {
                const nameLower = place.name?.toLowerCase() || '';
                const stableId = getStablePlaceId(place);
                return {
                    id: `${dayData.day}-${stableId}`,
                    originalPlace: place, // Keep reference to original backend object for state updates
                    name: place.name?.length > 30 ? place.name.slice(0, 28) + '...' : place.name,
                    fullName: place.name,
                    address: place.address || '',
                    category: mapCategory(place.category),
                    image: photoLookup[nameLower] || place.photoUrl || null,
                    description: place.description || '',
                    estimatedTimeHours: place.estimatedTimeHours || 2,
                    bestTimeOfDay: place.bestTimeOfDay || 'morning',
                    coordinates: place.coordinates || null,
                };
            });

            // Build travel info from route data if available
            const travelInfo = [];
            if (dayData.places) {
                for (let i = 0; i < dayData.places.length - 1; i++) {
                    const currentPlace = dayData.places[i];
                    const nextPlace = dayData.places[i + 1];

                    // Check if route data exists from the backend's routingService (dayData.route.legs)
                    const leg = dayData.route?.legs?.[i];

                    if (leg) {
                        travelInfo.push({
                            mode: 'driving',
                            time: leg.durationMinutes >= 60
                                ? `${Math.floor(leg.durationMinutes / 60)}h ${leg.durationMinutes % 60}m`
                                : `${leg.durationMinutes} min`,
                            distance: `${leg.distanceKm} km`,
                        });
                    } else if (currentPlace.routeToNext) {
                        // Fallback for old streaming SSE event format
                        travelInfo.push({
                            mode: currentPlace.routeToNext.travelMode?.toLowerCase() || 'driving',
                            time: currentPlace.routeToNext.duration || '~',
                            distance: currentPlace.routeToNext.distance || '~',
                        });
                    } else {
                        // Estimate based on coordinates if available
                        travelInfo.push({
                            mode: 'driving',
                            time: '~',
                            distance: '~',
                        });
                    }
                }
            }

            return {
                day: dayData.day,
                theme: dayData.theme || `Day ${dayData.day}`,
                spots,
                travelInfo,
            };
        });
    }, [tripData, photoLookup]);

    const toggleDayExpanded = (day) => {
        setExpandedDays(prev => ({ ...prev, [day]: !prev[day] }));
    };

    const renderBackdrop = () => null;

    // Determine which day to show
    const getActiveDayData = () => {
        return itineraryDays.find(d => d.day === selectedDay) || itineraryDays[0];
    };

    const renderSpotCard = (spot, index, dayNum, { drag, isActive } = {}) => {
        const config = CATEGORY_CONFIG[spot.category] || CATEGORY_CONFIG['Attractions'];
        // Is this spot selected? Check by reference since new spots might lack IDs
        const isSelected = selectedSpots.has(spot.originalPlace);

        const TouchableComponent = isEditMode ? RNGHTouchableOpacity : TouchableOpacity;

        return (
            <TouchableComponent
                activeOpacity={0.7}
                onPress={() => {
                    if (isEditMode) {
                        toggleSpotSelection(spot.originalPlace);
                    } else {
                        onSpotPress?.(spot);
                    }
                }}
                onLongPress={isEditMode ? drag : undefined}
                delayLongPress={200}
                disabled={isActive}
                style={[styles.spotCard, isEditMode && isSelected && styles.spotCardSelected, isActive && styles.spotCardDragging]}
            >
                {/* Checkbox in edit mode */}
                {isEditMode && (
                    <View style={styles.checkboxContainer}>
                        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                            {isSelected && (
                                <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <Path d="M20 6 9 17l-5-5" />
                                </Svg>
                            )}
                        </View>
                    </View>
                )}

                {/* Left Column: Image */}
                <View style={styles.leftColumn}>
                    <View style={styles.imageWrapper}>
                        <View style={styles.spotNumberBadge}>
                            <Text style={styles.spotNumberText}>{index + 1}</Text>
                        </View>
                        {spot.image ? (
                            <Image
                                source={{ uri: spot.image.includes('googleusercontent') ? `${spot.image}=w96-h96` : spot.image }}
                                style={styles.spotImage}
                            />
                        ) : (
                            <View style={[styles.spotImage, styles.spotImageFallback]}>
                                <Text style={styles.spotImageFallbackText}>{config.emoji}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Right Column: Info */}
                <View style={styles.spotInfo}>
                    <Text style={styles.spotName} numberOfLines={1}>{spot.name}</Text>
                    <View style={styles.spotMeta}>
                        <View style={[styles.categoryBadge, { backgroundColor: config.bg }]}>
                            <Text style={[styles.categoryText, { color: config.color }]}>{spot.category}</Text>
                        </View>
                        <Text style={styles.spotRating}>⭐ {spot.rating || '4.5'}</Text>
                    </View>
                </View>

                {/* Drag handle in edit mode */}
                {isEditMode && (
                    <RNGHTouchableOpacity
                        onPressIn={drag}
                        style={styles.dragHandle}
                    >
                        <Svg width="16" height="16" viewBox="0 0 24 24" fill="#94A3B8">
                            <Circle cx="9" cy="6" r="1.5" />
                            <Circle cx="15" cy="6" r="1.5" />
                            <Circle cx="9" cy="12" r="1.5" />
                            <Circle cx="15" cy="12" r="1.5" />
                            <Circle cx="9" cy="18" r="1.5" />
                            <Circle cx="15" cy="18" r="1.5" />
                        </Svg>
                    </RNGHTouchableOpacity>
                )}
            </TouchableComponent>
        );
    };

    const handleTravelDirections = (fromSpot, toSpot) => {
        const fromLat = fromSpot?.coordinates?.lat;
        const fromLng = fromSpot?.coordinates?.lng;
        const toLat = toSpot?.coordinates?.lat;
        const toLng = toSpot?.coordinates?.lng;
        if (toLat == null || toLng == null) return;
        const destLabel = encodeURIComponent(toSpot.fullName || toSpot.name || 'Destination');
        const hasOrigin = fromLat != null && fromLng != null;
        const url = Platform.select({
            ios: hasOrigin
                ? `maps://app?saddr=${fromLat},${fromLng}&daddr=${toLat},${toLng}`
                : `maps://app?daddr=${toLat},${toLng}&q=${destLabel}`,
            android: hasOrigin
                ? `google.navigation:q=${toLat},${toLng}&origin=${fromLat},${fromLng}`
                : `google.navigation:q=${toLat},${toLng}`,
        });
        Linking.openURL(url).catch(() => {
            const webUrl = hasOrigin
                ? `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${toLat},${toLng}`
                : `https://www.google.com/maps/dir/?api=1&destination=${toLat},${toLng}`;
            Linking.openURL(webUrl);
        });
    };

    const renderTravelConnector = (index, travelInfo, fromSpot, toSpot) => (
        <View key={`connector-${index}`} style={styles.travelConnectorContainer}>
            <View style={styles.dotsColumn}>
                {[...Array(10)].map((_, i) => (
                    <View key={i} style={styles.dot} />
                ))}
            </View>
            {travelInfo && (
                <View style={styles.travelInfoRow}>
                    <View style={styles.travelInfoGroup}>
                        <View style={styles.travelModeBadge}>
                            {travelInfo.mode === 'walking' ? (
                                <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <Path
                                        d="M14 22V16.9612C14 16.3537 13.7238 15.7791 13.2494 15.3995L11.5 14M11.5 14L13 7.5M11.5 14L10 13M13 7.5L11 7M13 7.5L15.0426 10.7681C15.3345 11.2352 15.8062 11.5612 16.3463 11.6693L18 12M10 13L11 7M10 13L8 22M11 7L8.10557 8.44721C7.428 8.786 7 9.47852 7 10.2361V12M14.5 3.5C14.5 4.05228 14.0523 4.5 13.5 4.5C12.9477 4.5 12.5 4.05228 12.5 3.5C12.5 2.94772 12.9477 2.5 13.5 2.5C14.0523 2.5 14.5 2.94772 14.5 3.5Z"
                                        stroke="#000000"
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </Svg>
                            ) : travelInfo.mode !== 'transit' ? (
                                <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <Path
                                        d="M19.78 9.44L17.94 4.44C17.8238 4.09604 17.6036 3.79671 17.3097 3.5835C17.0159 3.37029 16.663 3.25374 16.3 3.25H7.7C7.3418 3.2508 6.99248 3.36151 6.6992 3.56716C6.40592 3.77281 6.18281 4.06351 6.06 4.4L4.22 9.4C3.92473 9.54131 3.67473 9.76216 3.49808 10.0377C3.32142 10.3133 3.22512 10.6327 3.22 10.96V15.46C3.21426 15.7525 3.28279 16.0417 3.41921 16.3006C3.55562 16.5594 3.75544 16.7794 4 16.94V17V19C4 19.2652 4.10536 19.5196 4.29289 19.7071C4.48043 19.8946 4.73478 20 5 20H6C6.26522 20 6.51957 19.8946 6.70711 19.7071C6.89464 19.5196 7 19.2652 7 19V17.25H17V19C17 19.2652 17.1054 19.5196 17.2929 19.7071C17.4804 19.8946 17.7348 20 18 20H19C19.2652 20 19.5196 19.8946 19.7071 19.7071C19.8946 19.5196 20 19.2652 20 19V17C20 17 20 17 20 16.94C20.2351 16.7808 20.4275 16.5661 20.56 16.315C20.6925 16.0639 20.7612 15.784 20.76 15.5V11C20.7567 10.6748 20.6634 10.3569 20.4904 10.0815C20.3174 9.80616 20.0715 9.58411 19.78 9.44ZM19.25 15.5C19.25 15.5663 19.2237 15.6299 19.1768 15.6768C19.1299 15.7237 19.0663 15.75 19 15.75H5C4.93369 15.75 4.87011 15.7237 4.82322 15.6768C4.77634 15.6299 4.75 15.5663 4.75 15.5V11C4.75 10.9337 4.77634 10.8701 4.82322 10.8232C4.87011 10.7763 4.93369 10.75 5 10.75H19C19.0663 10.75 19.1299 10.7763 19.1768 10.8232C19.2237 10.8701 19.25 10.9337 19.25 11V15.5ZM7.47 4.91C7.48797 4.86341 7.51949 4.82327 7.56048 4.79475C7.60147 4.76624 7.65007 4.75065 7.7 4.75H16.3C16.3499 4.75065 16.3985 4.76624 16.4395 4.79475C16.4805 4.82327 16.512 4.86341 16.53 4.91L17.93 8.75H6.07L7.47 4.91Z"
                                        fill="#000000"
                                    />
                                    <Path
                                        d="M8 14.75C8.82843 14.75 9.5 14.0784 9.5 13.25C9.5 12.4216 8.82843 11.75 8 11.75C7.17157 11.75 6.5 12.4216 6.5 13.25C6.5 14.0784 7.17157 14.75 8 14.75Z"
                                        fill="#000000"
                                    />
                                    <Path
                                        d="M16 14.75C16.8284 14.75 17.5 14.0784 17.5 13.25C17.5 12.4216 16.8284 11.75 16 11.75C15.1716 11.75 14.5 12.4216 14.5 13.25C14.5 14.0784 15.1716 14.75 16 14.75Z"
                                        fill="#000000"
                                    />
                                </Svg>
                            ) : (
                                <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <Path d="M5 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M15 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0" />
                                    <Path d="M5 17H3V6l9-4 9 4v11h-2M9 17h6" />
                                </Svg>
                            )}
                        </View>
                        <Text style={styles.travelText}>
                            {travelInfo.time} • {travelInfo.distance}
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.directionsButton} onPress={() => handleTravelDirections(fromSpot, toSpot)}>
                        <Svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                            <Path d="M3 11l19-9-9 19-2-8-8-2z" />
                        </Svg>
                        <Text style={styles.directionsText}>Directions</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    const renderDayItinerary = (dayData) => {
        const isExpanded = expandedDays[dayData.day] !== false;

        if (isEditMode) {
            return (
                <View key={`day-${dayData.day}`} style={styles.daySection}>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => toggleDayExpanded(dayData.day)}
                        style={styles.optimizeRow}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Text style={styles.dayTitle}>Day {dayData.day}</Text>
                        </View>

                        <Animated.View style={{ transform: [{ rotate: isExpanded ? '0deg' : '-90deg' }] }}>
                            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <Path d="m6 9 6 6 6-6" />
                            </Svg>
                        </Animated.View>
                    </TouchableOpacity>

                    <Animated.View layout={LinearTransition.springify().damping(15)} style={{ overflow: 'hidden' }}>
                        {isExpanded && (
                            <Animated.View
                                entering={FadeIn.duration(200)}
                                exiting={FadeOut.duration(200)}
                            >
                                <DraggableFlatList
                                    data={localSpotsMap[dayData.day] || dayData.spots}
                                    keyExtractor={(item) => item.id}
                                    onDragEnd={({ data }) => {
                                        dragJustHappened.current = true;
                                        setLocalSpotsMap(prev => ({ ...prev, [dayData.day]: data }));
                                        reorderSpots(dayData.day, data);
                                    }}
                                    onDragBegin={() => setIsItemDragging(true)}
                                    onRelease={() => setIsItemDragging(false)}
                                    renderItem={({ item, getIndex, drag, isActive }) => {
                                        const idx = getIndex();
                                        return (
                                            <ScaleDecorator activeScale={0.98}>
                                                <View style={{ marginBottom: 12 }}>
                                                    {renderSpotCard(item, idx, dayData.day, { drag, isActive })}
                                                </View>
                                            </ScaleDecorator>
                                        );
                                    }}
                                    scrollEnabled={false}
                                    activationDistance={20}
                                    containerStyle={{ overflow: 'visible' }}
                                />
                                <TouchableOpacity
                                    style={styles.addSpotButton}
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        setAddSpotDayTarget(dayData.day);
                                        addSpotSheetRef.current?.open();
                                    }}
                                >
                                    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <Path d="M12 5v14M5 12h14" />
                                    </Svg>
                                    <Text style={styles.addSpotText}>Add Spot</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        )}
                    </Animated.View>
                </View>
            );
        }

        return (
            <View key={`day-${dayData.day}`} style={styles.daySection}>
                {/* Day title + Optimize button */}
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toggleDayExpanded(dayData.day)}
                    style={styles.optimizeRow}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={styles.dayTitle}>Day {dayData.day}</Text>
                        <TouchableOpacity
                            style={styles.optimizeButton}
                            onPress={(e) => {
                                e.stopPropagation();
                                handleOptimize(dayData.day);
                            }}
                            disabled={optimizingDay === dayData.day}
                        >
                            {optimizingDay === dayData.day ? (
                                <ActivityIndicator size="small" color="#0F172A" style={{ width: 12, height: 12 }} />
                            ) : (
                                <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <Path d="M2 20h.01M7 20v-4M12 20V10M17 20V4" />
                                </Svg>
                            )}
                            <Text style={styles.optimizeText}>{optimizingDay === dayData.day ? 'Optimizing...' : 'Optimize'}</Text>
                        </TouchableOpacity>
                    </View>

                    <Animated.View style={{ transform: [{ rotate: isExpanded ? '0deg' : '-90deg' }] }}>
                        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="m6 9 6 6 6-6" />
                        </Svg>
                    </Animated.View>
                </TouchableOpacity>

                {/* Spots List */}
                <Animated.View layout={LinearTransition.springify().damping(15)} style={{ overflow: 'hidden' }}>
                    {isExpanded && (
                        <Animated.View
                            entering={FadeIn.duration(200)}
                            exiting={FadeOut.duration(200)}
                        >
                            {dayData.spots.map((spot, idx) => (
                                <View key={`item-${idx}`}>
                                    {renderSpotCard(spot, idx, dayData.day)}
                                    {idx < dayData.spots.length - 1 && renderTravelConnector(idx, dayData.travelInfo[idx], dayData.spots[idx], dayData.spots[idx + 1])}
                                </View>
                            ))}
                        </Animated.View>
                    )}
                </Animated.View>
            </View>
        );
    };

    // Pick a representative image for each day
    const getDayImage = (dayData) => {
        const spotWithImage = dayData.spots.find(s => s.image);
        return spotWithImage?.image || null;
    };

    // Format spots as bullet points
    const formatSpots = (spots) => {
        return spots.map(s => s.fullName || s.name).join(' → ');
    };


    const renderChecklistLoader = () => (
        <View style={styles.checklistContainer}>
            {/* Header */}
            <View style={styles.checklistHeader}>
                <Text style={styles.checklistTitle}>Planning your trip</Text>
                <Text style={styles.checklistSubtitle}>Our Agent is building your perfect itinerary</Text>
            </View>

            {/* Steps */}
            <View style={styles.checklistSteps}>
                {LOADING_STEPS.map((step, idx) => (
                    <ChecklistStepItem 
                        key={idx}
                        step={step}
                        idx={idx}
                        currentTick={currentTick}
                        dots={dots}
                        activePulseStyle={activePulseStyle}
                    />
                ))}
            </View>
        </View>
    );

    const renderOverviewItems = () => {
        if (isLoaderVisible || itineraryDays.length === 0) {
            return renderChecklistLoader();
        }
        return (
            <>
                {itineraryDays.map((dayData) => (
                    <TouchableOpacity
                        key={dayData.day}
                        style={styles.overviewDayCard}
                        activeOpacity={0.7}
                        onPress={() => {
                            setMode('itinerary');
                            setSelectedDay(dayData.day);
                        }}
                    >
                        <View style={styles.overviewDayInfo}>
                            <View style={styles.overviewDayHeader}>
                                <Text style={styles.overviewDayLabel}>Day {dayData.day}</Text>
                                <View style={[styles.dayColorDot, { backgroundColor: DAY_COLORS[(dayData.day - 1) % DAY_COLORS.length] }]} />
                            </View>
                            <Text style={styles.overviewDayCardSpots}>
                                {formatSpots(dayData.spots)}
                            </Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </>
        );
    };

    const renderItineraryItems = () => {
        return itineraryDays.map((dayData) => (
            <Animated.View
                key={`day-${dayData.day}`}
                layout={LinearTransition.springify().damping(15)}
                onLayout={(e) => {
                    dayLayoutRefs.current[dayData.day] = e.nativeEvent.layout.y;
                }}
            >
                {renderDayItinerary(dayData)}
            </Animated.View>
        ));
    };

    const scrollToDay = (day) => {
        setSelectedDay(day);
        const y = dayLayoutRefs.current[day];
        if (y != null) {
            isProgrammaticScroll.current = true;
            scrollViewRef.current?.scrollTo({ y, animated: true });
            // Give the animation time to finish before re-enabling the listener
            setTimeout(() => {
                isProgrammaticScroll.current = false;
            }, 600);
        }
    };

    const selectedDayRef = useRef(selectedDay);
    selectedDayRef.current = selectedDay;
    // Flag to suppress scroll-listener updates during programmatic scrolls
    const isProgrammaticScroll = useRef(false);

    const handleItineraryScroll = useCallback((event) => {
        // Ignore scroll events triggered by programmatic scrollToDay calls
        if (isProgrammaticScroll.current) return;
        const scrollY = event.nativeEvent.contentOffset.y;
        const days = Object.keys(dayLayoutRefs.current)
            .map(Number)
            .sort((a, b) => a - b);
        let currentDay = days[0] || 1;
        for (const day of days) {
            if (scrollY >= dayLayoutRefs.current[day] - 50) {
                currentDay = day;
            }
        }
        if (currentDay !== selectedDayRef.current) {
            setSelectedDay(currentDay);
        }
    }, []);

    return (
        <>
            <BottomSheet
                ref={ref}
                index={-1}
                snapPoints={snapPoints}
                enableDynamicSizing={false}
                enablePanDownToClose={false}
                enableContentPanningGesture={!isEditMode}
                backgroundStyle={styles.sheetBackground}
                handleIndicatorStyle={styles.handleIndicator}
                containerStyle={{ zIndex: 100 }}
                onChange={onChange}
                animationConfigs={animationConfigs}
            >
              <SheetErrorBoundary>
                {/* Fixed Header + Tabs */}
                {!isLoaderVisible && (
                    <View style={styles.header}>
                        {mode === 'overview' && (
                            <View>
                                <View style={styles.titleRow}>
                                    <View style={styles.titleContent}>
                                        <Text style={styles.tripTitle} numberOfLines={2}>{numDays}-Day {locationName} Trip</Text>
                                        <Text style={styles.duration}>📅 {numDays} days {numDays - 1} nights • <Text style={{ color: '#0F172A' }}>Choose dates {'>'}</Text></Text>
                                    </View>
                                    <TouchableOpacity style={styles.shareIconButton}>
                                        <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <Path d="m17 8-5-5-5 5" />
                                            <Path d="M12 3v12" />
                                        </Svg>
                                    </TouchableOpacity>
                                </View>
                                {isTemplateTripView && (
                                    <TouchableOpacity
                                        style={styles.saveTemplateButton}
                                        activeOpacity={0.8}
                                        onPress={handleSaveTemplateTrip}
                                        disabled={isSavingTemplate}
                                    >
                                        {isSavingTemplate ? (
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                        ) : (
                                            <>
                                                <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <Path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                                    <Path d="M17 21v-8H7v8" />
                                                    <Path d="M7 3v5h8" />
                                                </Svg>
                                                <Text style={styles.saveTemplateButtonText}>Save to My Trips</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {/* Tabs */}
                        {mode === 'overview' ? (
                            /* Full-width tabs for overview mode */
                            <View style={styles.tabsFullWidth}>
                                <TouchableOpacity
                                    style={[styles.tabFull, styles.tabActive]}
                                    onPress={() => setMode('overview')}
                                >
                                    <Text style={[styles.tabText, styles.tabTextActive]}>Overview</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.tabFull}
                                    onPress={() => { setMode('itinerary'); setSelectedDay(1); }}
                                >
                                    <Text style={styles.tabText}>Itinerary</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            /* Scrollable compact tabs for itinerary mode */
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.tabsScrollView}
                                contentContainerStyle={styles.tabsContainer}
                            >
                                <TouchableOpacity
                                    style={styles.tab}
                                    onPress={() => setMode('overview')}
                                >
                                    <Text style={styles.tabText}>Overview</Text>
                                </TouchableOpacity>
                                {itineraryDays.map((d) => (
                                    <TouchableOpacity
                                        key={d.day}
                                        style={[styles.tab, selectedDay === d.day && styles.tabActive]}
                                        onPress={() => scrollToDay(d.day)}
                                    >
                                        <Text style={[styles.tabText, selectedDay === d.day && styles.tabTextActive]}>
                                            Day {d.day}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                )}

                {/* Scrollable Content */}
                <BottomSheetScrollView
                    ref={scrollViewRef}
                    style={styles.scrollContent}
                    contentContainerStyle={{ paddingBottom: isEditMode && selectedSpots.size > 0 ? 180 : 40 }}
                    onScroll={mode === 'itinerary' ? handleItineraryScroll : undefined}
                    scrollEventThrottle={32}
                    scrollEnabled={!isItemDragging}
                    nestedScrollEnabled={true}
                >
                    {mode === 'overview' ? renderOverviewItems() : renderItineraryItems()}
                </BottomSheetScrollView>

                {/* Edit Mode Bottom Action Bar */}
                {isEditMode && selectedSpots.size > 0 && (
                    <View style={styles.editActionBarContainer} pointerEvents="box-none">
                        <LinearGradient
                            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)', '#FFFFFF']}
                            locations={[0, 0.45, 1]}
                            style={StyleSheet.absoluteFillObject}
                            pointerEvents="none"
                        />
                        <View style={styles.editActionBar}>
                            <TouchableOpacity
                                style={styles.editActionBtn}
                                onPress={() => movePickerSheetRef.current?.expand()}
                                activeOpacity={0.7}
                            >
                                <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <Path d="M5 12h14M12 5l7 7-7 7" />
                                </Svg>
                                <Text style={styles.editActionBtnText}>Move</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.editActionBtn, styles.editActionBtnRemove]}
                                onPress={() => {
                                    removeSpots(Array.from(selectedSpots));
                                    setSelectedSpots(new Set());
                                }}
                                activeOpacity={0.7}
                            >
                                <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <Path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                </Svg>
                                <Text style={[styles.editActionBtnText, { color: '#EF4444' }]}>Remove</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Saving Overlay */}
                {isSavingTrip && (
                    <View style={styles.savingOverlay}>
                        <ActivityIndicator size="large" color="#3B82F6" />
                        <Text style={styles.savingOverlayText}>Saving changes...</Text>
                    </View>
                )}
              </SheetErrorBoundary>
            </BottomSheet>

            {/* Move to Day Picker Bottom Sheet — outside main sheet so it renders on top */}
            <BottomSheet
                ref={movePickerSheetRef}
                index={-1}
                snapPoints={['60%']}
                enablePanDownToClose={true}
                enableDynamicSizing={false}
                backdropComponent={(props) => (
                    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
                )}
                backgroundStyle={styles.movePickerSheetBg}
                handleIndicatorStyle={styles.movePickerHandle}
                containerStyle={{ zIndex: 200 }}
            >
                <View style={styles.movePickerHeader}>
                    <Text style={styles.movePickerTitle}>Move to Day</Text>
                    <Text style={styles.movePickerSubtitle}>
                        {selectedSpots.size} {selectedSpots.size === 1 ? 'spot' : 'spots'} selected
                    </Text>
                </View>
                <BottomSheetScrollView style={{ flex: 1 }} contentContainerStyle={styles.movePickerScrollContent}>
                    {itineraryDays.filter(d => !d.spots.some(s => selectedSpots.has(s.originalPlace))).map((d) => (
                        <TouchableOpacity
                            key={d.day}
                            style={styles.overviewDayCard}
                            activeOpacity={0.7}
                            onPress={() => {
                                moveSpots(Array.from(selectedSpots), d.day);
                                setSelectedSpots(new Set());
                                movePickerSheetRef.current?.close();
                            }}
                        >
                            <View style={styles.overviewDayInfo}>
                                <View style={styles.overviewDayHeader}>
                                    <Text style={styles.overviewDayLabel}>Day {d.day}</Text>
                                    <View style={[styles.dayColorDot, { backgroundColor: DAY_COLORS[(d.day - 1) % DAY_COLORS.length] }]} />
                                </View>
                                <Text style={styles.overviewDayCardSpots}>
                                    {formatSpots(d.spots)}
                                </Text>
                                {d.spots.length === 0 && (
                                    <Text style={styles.movePickerEmptyText}>No spots yet</Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    ))}
                </BottomSheetScrollView>
            </BottomSheet>
            <AddSpotSheet
                ref={addSpotSheetRef}
                onSpotSelected={(place) => {
                    if (addSpotDayTarget !== null) {
                        addSpotToDay(addSpotDayTarget, place);
                        // Clear stale cached drag data so the list picks up the new spots
                        setLocalSpotsMap(prev => {
                            const next = { ...prev };
                            delete next[addSpotDayTarget];
                            return next;
                        });
                        setAddSpotDayTarget(null);
                    }
                }}
            />
            <PremiumOverlay visible={showPremiumOverlay} onClose={() => setShowPremiumOverlay(false)} />
        </>
    );
});

const styles = StyleSheet.create({
    sheetBackground: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 20,
    },
    handleIndicator: {
        backgroundColor: '#CBD5E1',
        width: 40,
        height: 5,
        borderRadius: 3,
    },
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 24,
        // marginTop: -10
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 16,
    },
    titleContent: {
        flex: 1,
        marginTop: -5
    },
    tripTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.5,
    },
    shareIconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#0F172A',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    shareButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    duration: {
        fontSize: 14,
        fontWeight: '500',
        color: '#94A3B8',
        marginTop: 6,
    },

    // Tab styles - Full width for overview mode
    tabsFullWidth: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    tabFull: {
        flex: 1,
        alignItems: 'center',
        paddingBottom: 12,
    },

    // Tab styles - Scrollable for itinerary mode
    tabsScrollView: {
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        flexGrow: 0,
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingRight: 24,
        flexGrow: 0,
    },
    tab: {
        paddingBottom: 12,
        marginRight: 24,
    },
    tabActive: {
        borderBottomWidth: 3,
        borderBottomColor: '#0F172A',
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#94A3B8',
    },
    tabTextActive: {
        color: '#0F172A',
        fontWeight: '700',
    },

    // Scroll content
    scrollContent: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 10,
    },

    // Overview styles
    overviewDayCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginBottom: 16,
        padding: 16,
        paddingTop: 18,
        // Elevation/Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    overviewImageWrapper: {
        position: 'relative',
    },
    overviewDayImage: {
        width: 130,
        height: 160,
        backgroundColor: '#E2E8F0',
    },
    overviewDayBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    overviewDayBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    overviewDayInfo: {
        flex: 1,
    },
    overviewDayHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    overviewDayLabel: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
    },
    dayColorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    overviewDayCardTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 8,
    },
    overviewDayCardSpots: {
        fontSize: 14,
        fontWeight: '500',
        color: '#334155',
        lineHeight: 22,
        letterSpacing: 0.1,
    },

    // Day itinerary styles
    daySection: {
        marginBottom: 32,
    },
    optimizeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
        marginBottom: 10,
    },
    dayTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
    },
    optimizeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    optimizeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0F172A',
    },
    addSpotButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        marginTop: 4,
        marginBottom: 4,
        borderWidth: 1.5,
        borderColor: '#E0E7FF',
        borderStyle: 'dashed',
        borderRadius: 14,
        backgroundColor: '#FAFAFE',
    },
    addSpotText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6366F1',
    },

    // Spot card styles
    spotCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E8EDF2',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    leftColumn: {
        alignItems: 'center',
    },
    imageWrapper: {
        position: 'relative',
    },
    spotNumberBadge: {
        position: 'absolute',
        top: -4,
        left: -4,
        backgroundColor: '#FFFFFF',
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        zIndex: 2,
    },
    spotNumberText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#475569',
    },
    dotsColumn: {
        width: 24,
        alignItems: 'flex-end',
        gap: 4,
    },
    spotImage: {
        width: 48,
        height: 48,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
    },
    spotInfo: {
        flex: 1,
        marginLeft: 12,
    },
    spotName: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 4,
    },
    spotMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    spotRating: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    categoryText: {
        fontSize: 12,
        fontWeight: '700',
    },

    // Travel info inside card (right column)
    cardTravelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    travelModeLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 1,
    },
    travelText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    directionsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    directionsText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },

    // Travel connector between cards
    travelConnectorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 0,
        marginVertical: -16, // Bridge the top and bottom card padding (12+12)
        paddingLeft: 12,
        gap: 4,
        zIndex: 5,
    },
    travelInfoRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingRight: 4,
    },
    travelInfoGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 0,
    },
    travelModeBadge: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dot: {
        width: 2,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#CBD5E1',
    },
    spotImageFallback: {
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    spotImageFallbackText: {
        fontSize: 22,
    },
    emptyStateContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: 16,
    },
    emptyStateText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748B',
    },
    overviewDayTheme: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 4,
    },
    overviewDayImageFallback: {
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // ── Checklist Loader Styles ──
    checklistContainer: {
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 40,
    },
    checklistHeader: {
        marginBottom: 28,
        alignItems: 'center', // Center align header text for a more premium look
    },
    checklistTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    checklistSubtitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#64748B',
        marginTop: 8,
        textAlign: 'center',
    },
    progressBarTrack: {
        height: 6,
        backgroundColor: '#F1F5F9',
        borderRadius: 3,
        marginBottom: 36,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#3B82F6', // Blue accent for progress
        borderRadius: 3,
    },
    checklistSteps: {
        gap: 0,
        paddingHorizontal: 0, // Indent steps slightly to balance centered header
    },
    checklistRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        minHeight: 64, // Taller rows for better breathing room
    },
    checklistRowActive: {},
    checklistRowCompleted: {},
    checklistIndicator: {
        width: 32,
        alignItems: 'center',
        marginRight: 16,
        alignSelf: 'stretch', // Stretch to full height of dynamic text row
        zIndex: 1,
    },
    checklistCheckCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
        zIndex: 2,
    },
    checklistActiveCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#3B82F6',
        marginTop: 4,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
        zIndex: 2,
    },
    checklistPendingCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#E2E8F0',
        marginTop: 4,
        zIndex: 2,
    },
    checklistLine: {
        position: 'absolute',
        top: 22,       // Start just inside the top circle
        bottom: -16,   // Stretch safely into the next row, overlapping the next circle
        width: 2,
        backgroundColor: '#F1F5F9',
        overflow: 'hidden',
        zIndex: 0,     // Stay behind the circles
    },
    checklistLineCompleted: {
        backgroundColor: '#10B981',
    },
    checklistContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
        paddingTop: 2,
    },
    checklistText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#475569', // Completed text is slightly greyed 
    },
    checklistTextActive: {
        color: '#0F172A', // Active text is strong dark
        fontWeight: '800',
        fontSize: 17, // Slightly larger active text
    },
    checklistTextPending: {
        color: '#94A3B8',
        fontWeight: '500',
    },
    generatingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        marginBottom: 16,
        alignSelf: 'center',
    },
    generatingText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#6366F1',
    },

    // Edit mode styles
    spotCardSelected: {
        borderColor: '#3B82F6',
        backgroundColor: '#EFF6FF',
    },
    checkboxContainer: {
        justifyContent: 'center',
        marginRight: 10,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    checkboxChecked: {
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
    },
    dragHandle: {
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
        paddingHorizontal: 4,
        paddingVertical: 8,
    },
    spotCardDragging: {
        backgroundColor: '#F8FAFC',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 10,
    },
    editActionBarContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingTop: 60,            // Gradient fade area height
        justifyContent: 'flex-end',
        zIndex: 100,               // Ensure it sits above scroll view
        elevation: 10,
    },
    editActionBar: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 120 : 105, // Sit higher above tab bar
        paddingVertical: 10,
        gap: 10,
        zIndex: 2,
    },
    editActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    editActionBtnRemove: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
    },
    editActionBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#3B82F6',
    },

    // Move Picker Bottom Sheet
    movePickerSheetBg: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 16,
    },
    movePickerHandle: {
        backgroundColor: '#CBD5E1',
        width: 36,
        height: 4,
        borderRadius: 2,
    },
    movePickerHeader: {
        paddingHorizontal: 24,
        paddingTop: 8,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    movePickerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 4,
    },
    movePickerSubtitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#94A3B8',
    },
    movePickerScrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        gap: 12,
    },
    movePickerEmptyText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#94A3B8',
        fontStyle: 'italic',
    },

    // Saving Overlay
    savingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
        elevation: 10,
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
    },
    savingOverlayText: {
        marginTop: 12,
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    saveTemplateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#3B82F6',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 14,
        marginTop: 12,
    },
    saveTemplateButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default TripOverviewSheet;
