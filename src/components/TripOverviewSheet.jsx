import React, { forwardRef, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Platform, Image, ActivityIndicator } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

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

const TripOverviewSheet = forwardRef(({ onChange, animationConfigs, tripData }, ref) => {
    const [mode, setMode] = useState('overview'); // 'overview' or 'itinerary'
    const [selectedDay, setSelectedDay] = useState(1);
    const [expandedDays, setExpandedDays] = useState({});
    const snapPoints = useMemo(() => ['60%'], []);

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

    const renderBackdrop = (props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
    );

    // Determine which day to show
    const getActiveDayData = () => {
        return itineraryDays.find(d => d.day === selectedDay) || itineraryDays[0];
    };

    const renderSpotCard = (spot, index, travelInfo, isLast) => {
        const config = CATEGORY_CONFIG[spot.category] || CATEGORY_CONFIG['Attractions'];
        return (
            <View style={styles.spotCard}>
                {/* Left Column: Image + dots below */}
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
                    {/* Dots below image (inside card) */}
                    {travelInfo && (
                        <View style={styles.dotsColumn}>
                            <View style={styles.dot} />
                            <View style={styles.dot} />
                            <View style={[styles.dot, { marginBottom: -5 }]} />
                        </View>
                    )}
                </View>

                {/* Right Column: Info + Travel */}
                <View style={styles.spotInfo}>
                    <Text style={styles.spotName} numberOfLines={1}>{spot.name}</Text>
                    <View style={styles.spotMeta}>
                        <View style={[styles.categoryBadge, { backgroundColor: config.bg }]}>
                            <Text style={[styles.categoryText, { color: config.color }]}>{spot.category}</Text>
                        </View>
                        <Text style={styles.spotRating}>⭐ {spot.rating || '4.5'}</Text>
                    </View>

                    {/* Travel info + Directions */}
                    {travelInfo && (
                        <View style={styles.cardTravelRow}>
                            <View>
                                <Text style={styles.travelText}>
                                    {travelInfo.mode === 'walking' ? '🚶' : travelInfo.mode === 'transit' ? '🚌' : '🚗'}{' '}
                                    {travelInfo.time} • {travelInfo.distance}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.directionsButton}>
                                <Text style={styles.directionsText}>Directions</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    const renderDottedConnector = (index) => (
        <View key={`connector-${index}`} style={styles.dottedConnectorContainer}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
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
                        {renderSpotCard(spot, idx, dayData.travelInfo[idx], idx === dayData.spots.length - 1)}
                        {idx < dayData.spots.length - 1 && renderDottedConnector(idx)}
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
        const names = spots.map(s => s.fullName || s.name);
        const lines = [];
        let current = '';
        for (let i = 0; i < names.length; i++) {
            if (current === '') {
                current = names[i];
            } else {
                current += ' → ' + names[i];
            }
            if (current.length > 30 || i === names.length - 1) {
                lines.push(current);
                current = '';
            }
        }
        return lines.map(l => '• ' + l).join('\n');
    };

    const renderOverviewItems = () => {
        if (itineraryDays.length === 0) {
            return (
                <View style={styles.emptyStateContainer}>
                    <ActivityIndicator size="large" color="#0F172A" />
                    <Text style={styles.emptyStateText}>Generating your itinerary...</Text>
                </View>
            );
        }
        return (
            <>
                {itineraryDays.map((dayData) => (
                    <View key={dayData.day} style={styles.overviewDayCard}>
                        <View style={styles.overviewImageWrapper}>
                            {getDayImage(dayData) ? (
                                <Image
                                    source={{ uri: getDayImage(dayData) }}
                                    style={styles.overviewDayImage}
                                />
                            ) : (
                                <View style={[styles.overviewDayImage, styles.overviewDayImageFallback]}>
                                    <Text style={{ fontSize: 28 }}>📍</Text>
                                </View>
                            )}
                            <View style={styles.overviewDayBadge}>
                                <Text style={styles.overviewDayBadgeText}>Day {dayData.day}</Text>
                            </View>
                        </View>
                        <View style={styles.overviewDayInfo}>
                            {dayData.theme && <Text style={styles.overviewDayTheme}>{dayData.theme}</Text>}
                            <Text style={styles.overviewDayCardSpots}>
                                {formatSpots(dayData.spots)}
                            </Text>
                        </View>
                    </View>
                ))}
            </>
        );
    };

    const renderItineraryItems = () => {
        const activeDayData = getActiveDayData();
        return renderDayItinerary(activeDayData);
    };

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
                                onPress={() => setSelectedDay(d.day)}
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
                style={styles.scrollContent}
                contentContainerStyle={{ paddingBottom: 40 }}
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
        paddingTop: 8,
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
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        overflow: 'hidden',
        marginTop: 4,
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
        padding: 16,
        justifyContent: 'center',
    },
    overviewDayCardTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 8,
    },
    overviewDayCardSpots: {
        fontSize: 13,
        fontWeight: '500',
        color: '#64748B',
        lineHeight: 20,
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
        width: 64,
        height: 64,
        borderRadius: 12,
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

    // Dotted connector between cards (aligned with image center)
    dottedConnectorContainer: {
        alignItems: 'center',
        paddingLeft: 12,   // matches card padding
        width: 12 + 64,    // card padding + image width (centers dots under image)
        paddingVertical: 2,
        gap: 2,
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
});

export default TripOverviewSheet;
