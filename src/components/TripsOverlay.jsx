/**
 * TripsOverlay — Full-screen overlay showing Travel Guides and My Trips.
 * Extracted from HomeScreen to reduce component bloat.
 * @format
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    Dimensions,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Config from 'react-native-config';

// Zustand stores
import { useUIStore } from '../store/uiStore';
import { useTripStore } from '../store/tripStore';
import { useSavedTrips } from '../hooks/useTrips';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();
const BACKEND_URL = Config.BACKEND_URL || 'http://localhost:3000';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * @param {object} props
 * @param {object} props.animatedOverlayStyle - Animated style for the overlay entrance/exit
 * @param {function} props.onTripOpen - Called after a trip is fetched and ready to display.
 *   Receives the full trip object. Parent is responsible for closing the bottom sheet,
 *   hiding the tab bar, and expanding the trip overview sheet.
 */
const TripsOverlay = ({ animatedOverlayStyle, onTripOpen }) => {
    const insets = useSafeAreaInsets();
    const { activeTab } = useUIStore();
    const { setTripData } = useTripStore();

    // Get userId for TanStack Query
    const storedUser = React.useMemo(() => {
        try {
            const userStr = storage.getString('user');
            return userStr ? JSON.parse(userStr) : null;
        } catch (e) {
            return null;
        }
    }, []);
    const userId = storedUser?.id || storedUser?._id;
    const { data: savedTrips = [] } = useSavedTrips(userId);

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
                onTripOpen?.();
            }
        } catch (err) {
            console.warn('Failed to fetch trip details:', err);
        }
    };

    return (
        <Animated.View
            style={[
                styles.tripsOverlay,
                { paddingTop: insets.top },
                animatedOverlayStyle,
            ]}
            pointerEvents={activeTab === 'trips' ? 'auto' : 'none'}
        >
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.tripsScrollContent}
            >
                <View style={styles.tripsHeader}>
                    <Text style={styles.tripsLogo}>Roamy</Text>
                    <TouchableOpacity style={styles.tripsAvatar}>
                        <Text style={styles.tripsAvatarText}>A</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>Travel Guides</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.guidesScroll}
                >
                    {[
                        { title: '1-Day Paris Trip', spots: '9 Spots', color: '#C4B5A5' },
                        { title: '1-Day Rome Trip', spots: '7 Spots', color: '#94A3A8' },
                        { title: '3-Day London Trip', spots: '19 Spots', color: '#6366F1' },
                    ].map((guide, idx) => (
                        <TouchableOpacity
                            key={idx}
                            style={[styles.guideCard, { backgroundColor: guide.color }]}
                        >
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
                                    style={[
                                        styles.tripCard,
                                        { backgroundColor: tripColors[idx % tripColors.length] },
                                    ]}
                                    activeOpacity={0.7}
                                    delayPressIn={100}
                                    onPress={() => handleTripPress(trip._id)}
                                >
                                    {trip.tripRepPic ? (
                                        <Image
                                            source={{ uri: trip.tripRepPic }}
                                            style={styles.tripImage}
                                        />
                                    ) : (
                                        <View style={styles.tripImagePlaceholder} />
                                    )}
                                    <View style={styles.tripInfo}>
                                        <Text
                                            style={[
                                                styles.tripTitle,
                                                { color: iconColors[idx % iconColors.length] },
                                            ]}
                                        >
                                            {trip.days}-Day {trip.destination} Trip
                                        </Text>
                                        <Text style={styles.tripDetails}>
                                            {trip.days} Days {trip.days - 1} Nights
                                        </Text>
                                        <Text style={styles.tripDetails}>
                                            {(trip.interests || []).join(', ')}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    ) : (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <Text style={{ color: '#94A3B8', fontSize: 14, fontWeight: '500' }}>
                                No saved trips yet
                            </Text>
                            <Text style={{ color: '#CBD5E1', fontSize: 12, marginTop: 4 }}>
                                Create your first trip to see it here!
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    tripsOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#FFFFFF',
        zIndex: 5,
    },
    tripsScrollContent: {
        paddingBottom: 120,
    },
    tripsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    tripsLogo: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -0.5,
    },
    tripsAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tripsAvatarText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
        marginLeft: 20,
        marginTop: 18,
        marginBottom: 12,
    },
    guidesScroll: {
        paddingHorizontal: 20,
        gap: 12,
    },
    guideCard: {
        width: SCREEN_WIDTH * 0.42,
        height: 140,
        borderRadius: 18,
        overflow: 'hidden',
    },
    guideCardOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        padding: 14,
        backgroundColor: 'rgba(0,0,0,0.15)',
    },
    guideTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    guideSpots: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
    myTripsList: {
        paddingHorizontal: 20,
        gap: 12,
    },
    tripCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 18,
    },
    tripImage: {
        width: 56,
        height: 56,
        borderRadius: 14,
        marginRight: 14,
    },
    tripImagePlaceholder: {
        width: 56,
        height: 56,
        borderRadius: 14,
        marginRight: 14,
        backgroundColor: 'rgba(0,0,0,0.06)',
    },
    tripInfo: {
        flex: 1,
    },
    tripTitle: {
        fontSize: 15,
        fontWeight: '800',
        marginBottom: 2,
    },
    tripDetails: {
        fontSize: 12,
        fontWeight: '500',
        color: '#64748B',
    },
});

export default TripsOverlay;
