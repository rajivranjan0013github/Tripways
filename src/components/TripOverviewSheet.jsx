import React, { forwardRef, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Platform, Image, ActivityIndicator } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, { FadeIn, FadeOut, LinearTransition, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, interpolate } from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

// Travel mode icons
const TRAVEL_MODES = {
    walking: { icon: '🚶', label: 'Walking' },
    driving: { icon: '🚗', label: 'Driving' },
};

const TripOverviewSheet = forwardRef(({ onChange, animationConfigs, tripData, isLoading }, ref) => {
    const [mode, setMode] = useState('overview'); // 'overview' or 'itinerary'
    const [selectedDay, setSelectedDay] = useState(1);
    const [expandedDays, setExpandedDays] = useState({});
    const snapPoints = useMemo(() => ['60%'], []);
    const scrollViewRef = useRef(null);
    const dayLayoutRefs = useRef({});

    // Scroll to top when mode changes
    useEffect(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, [mode]);

    // Skeleton pulse animation
    const pulseAnim = useSharedValue(0);
    useEffect(() => {
        if (isLoading) {
            pulseAnim.value = withRepeat(
                withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
                -1,
                true
            );
        } else {
            pulseAnim.value = 0;
        }
    }, [isLoading]);

    const skeletonStyle = useAnimatedStyle(() => ({
        opacity: interpolate(pulseAnim.value, [0, 1], [0.3, 0.7]),
    }));

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
            const spots = (dayData.places || []).map((place) => {
                const nameLower = place.name?.toLowerCase() || '';
                return {
                    name: place.name?.length > 30 ? place.name.slice(0, 28) + '...' : place.name,
                    fullName: place.name,
                    category: mapCategory(place.category),
                    image: photoLookup[nameLower] || null,
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

                    // Check if route data exists (from the 'routed' SSE event)
                    if (currentPlace.routeToNext) {
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

    const renderSpotCard = (spot, index) => {
        const config = CATEGORY_CONFIG[spot.category] || CATEGORY_CONFIG['Attractions'];
        return (
            <View style={styles.spotCard}>
                {/* Left Column: Image */}
                <View style={styles.leftColumn}>
                    <View style={styles.imageWrapper}>
                        <View style={styles.spotNumberBadge}>
                            <Text style={styles.spotNumberText}>{index + 1}</Text>
                        </View>
                        {spot.image ? (
                            <Image
                                source={{ uri: spot.image }}
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
            </View>
        );
    };

    const renderTravelConnector = (index, travelInfo) => (
        <View key={`connector-${index}`} style={styles.travelConnectorContainer}>
            <View style={styles.dotsColumn}>
                <View style={styles.dot} />
                <View style={styles.dot} />
                <View style={styles.dot} />
            </View>
            {travelInfo && (
                <View style={styles.travelInfoRow}>
                    <View style={styles.travelModeBadge}>
                        {travelInfo.mode !== 'walking' ? (
                            <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                               <Path
                                     d="M14 22V16.9612C14 16.3537 13.7238 15.7791 13.2494 15.3995L11.5 14M11.5 14L13 7.5M11.5 14L10 13M13 7.5L11 7M13 7.5L15.0426 10.7681C15.3345 11.2352 15.8062 11.5612 16.3463 11.6693L18 12M10 13L11 7M10 13L8 22M11 7L8.10557 8.44721C7.428 8.786 7 9.47852 7 10.2361V12M14.5 3.5C14.5 4.05228 14.0523 4.5 13.5 4.5C12.9477 4.5 12.5 4.05228 12.5 3.5C12.5 2.94772 12.9477 2.5 13.5 2.5C14.0523 2.5 14.5 2.94772 14.5 3.5Z"
                                     stroke="#000000"
                                     strokeWidth={2}
                                     strokeLinecap="round"
                                     strokeLinejoin="round"
                                   />
                            </Svg>
                        ) : travelInfo.mode === 'transit' ? (
                            <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <Path d="M8 6v6M16 6v6M2 12h20M6 18h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2zM6 18l-2 2M18 18l2 2" />
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
                    <TouchableOpacity style={styles.directionsButton}>
                        <Text style={styles.directionsText}>Directions</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    const renderDayItinerary = (dayData) => {
        return (
            <View key={`day-${dayData.day}`}>
                {/* Day title + Optimize button */}
                <View style={styles.optimizeRow}>
                    <Text style={styles.dayTitle}>Day {dayData.day}</Text>
                    <TouchableOpacity style={styles.optimizeButton}>
                        <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M2 20h.01M7 20v-4M12 20V10M17 20V4" />
                        </Svg>
                        <Text style={styles.optimizeText}>Optimize</Text>
                    </TouchableOpacity>
                </View>

                {/* Spots List */}
                {dayData.spots.map((spot, idx) => (
                    <View key={`item-${idx}`}>
                        {renderSpotCard(spot, idx)}
                        {idx < dayData.spots.length - 1 && renderTravelConnector(idx, dayData.travelInfo[idx])}
                    </View>
                ))}
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

    const renderSkeletonItems = () => {
        return [1, 2, 3].map((i) => (
            <View key={`skel-${i}`} style={styles.overviewDayCard}>
                <Animated.View style={[styles.overviewDayImage, styles.skeletonBox, skeletonStyle]} />
                <View style={styles.overviewDayInfo}>
                    <Animated.View style={[styles.skeletonTextTitle, skeletonStyle]} />
                    <Animated.View style={[styles.skeletonTextLine, skeletonStyle]} />
                    <Animated.View style={[styles.skeletonTextLine, { width: '60%' }, skeletonStyle]} />
                </View>
            </View>
        ));
    };

    const renderOverviewItems = () => {
        if (isLoading || itineraryDays.length === 0) {
            return (
                <View>
                    <View style={styles.generatingBadge}>
                        <ActivityIndicator size="small" color="#6366F1" />
                        <Text style={styles.generatingText}>Generating adventure...</Text>
                    </View>
                    {renderSkeletonItems()}
                </View>
            );
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
                            <Text style={styles.overviewDayLabel}>Day {dayData.day}</Text>
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
            <View
                key={`day-${dayData.day}`}
                onLayout={(e) => {
                    dayLayoutRefs.current[dayData.day] = e.nativeEvent.layout.y;
                }}
            >
                {renderDayItinerary(dayData)}
            </View>
        ));
    };

    const scrollToDay = (day) => {
        setSelectedDay(day);
        const y = dayLayoutRefs.current[day];
        if (y != null) {
            scrollViewRef.current?.scrollTo({ y, animated: true });
        }
    };

    const handleItineraryScroll = useCallback((event) => {
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
        if (currentDay !== selectedDay) {
            setSelectedDay(currentDay);
        }
    }, [selectedDay]);

    return (
        <BottomSheet
            ref={ref}
            index={-1}
            snapPoints={snapPoints}
            enableDynamicSizing={false}
            enablePanDownToClose={true}
            backdropComponent={renderBackdrop}
            backgroundStyle={styles.sheetBackground}
            handleIndicatorStyle={styles.handleIndicator}
            containerStyle={{ zIndex: 100 }}
            onChange={onChange}
            animationConfigs={animationConfigs}
        >
            {/* Fixed Header + Tabs */}
            <View style={styles.header}>
                {mode === 'overview' && (
                    <View>
                        <View style={styles.titleRow}>
                            <Text style={styles.tripTitle}>{numDays}-Day {locationName} Trip</Text>
                            <TouchableOpacity style={styles.shareIconButton}>
                                <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <Path d="m17 8-5-5-5 5" />
                                    <Path d="M12 3v12" />
                                </Svg>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.duration}>📅 {numDays} days {numDays - 1} nights • <Text style={{ color: '#0F172A' }}>Choose dates {'>'}</Text></Text>
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

            {/* Scrollable Content */}
            <BottomSheetScrollView
                ref={scrollViewRef}
                style={styles.scrollContent}
                contentContainerStyle={{ paddingBottom: 40 }}
                onScroll={mode === 'itinerary' ? handleItineraryScroll : undefined}
                scrollEventThrottle={16}
            >
                {mode === 'overview' ? renderOverviewItems() : renderItineraryItems()}
            </BottomSheetScrollView>
        </BottomSheet>
    );
});

const styles = StyleSheet.create({
    sheetBackground: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
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
        paddingTop: 0,
        marginTop: 0
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    tripTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.5,
        flex: 1,
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
        fontSize: 15,
        fontWeight: '500',
        color: '#94A3B8',
        marginBottom: 16,
        marginTop: 4,
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
    overviewDayLabel: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 2,
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
    optimizeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
        marginBottom: 16,
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
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    optimizeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0F172A',
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
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
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
        backgroundColor: '#1E293B',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 10,
    },
    directionsText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
    },

    // Travel connector between cards
    travelConnectorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingLeft: 12,
        gap: 12,
    },
    travelInfoRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    travelModeBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dot: {
        width: 2,
        height: 3,
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
    // Skeleton Styles
    skeletonBox: {
        backgroundColor: '#E2E8F0',
    },
    skeletonTextTitle: {
        height: 20,
        backgroundColor: '#E2E8F0',
        borderRadius: 4,
        marginBottom: 10,
        width: '40%',
    },
    skeletonTextLine: {
        height: 12,
        backgroundColor: '#E2E8F0',
        borderRadius: 4,
        marginBottom: 6,
        width: '90%',
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
});

export default TripOverviewSheet;
