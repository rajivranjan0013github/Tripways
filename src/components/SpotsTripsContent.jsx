import React from 'react';
import { View, Text, TouchableOpacity, Image, ImageBackground, ActivityIndicator, StyleSheet, Dimensions, Platform } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { ScrollView } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FONT_SERIF = Platform.select({
    ios: 'Cormorant Garamond',
    android: 'CormorantGaramond-SemiBoldItalic',
    default: 'System',
});

// Fallback colors for guide cards without a cover image
const GUIDE_FALLBACK_COLORS = ['#C4B5A5', '#94A3A8', '#6366F1', '#D946EF', '#F59E0B'];

const SpotsTripsContent = ({
    templatesLoading,
    templateTrips,
    handleGuidePress,
    tripsLoading,
    savedTrips,
    handleTripPress,
}) => {
    return (
        <BottomSheetScrollView
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={[styles.tripsScrollContent, { paddingBottom: 100 }]}
        >
            <Text style={styles.sectionTitle}>Travel Guides</Text>
            {templatesLoading ? (
                <ActivityIndicator size="small" color="#64748B" style={{ marginTop: 20 }} />
            ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.guidesScroll}>
                    {templateTrips.map((guide, idx) => (
                        <TouchableOpacity key={guide._id || idx} style={[styles.guideCard, !guide.coverImage && { backgroundColor: GUIDE_FALLBACK_COLORS[idx % GUIDE_FALLBACK_COLORS.length] }]} activeOpacity={0.8} onPress={() => handleGuidePress(guide._id)}>{guide.coverImage ? <ImageBackground source={{ uri: guide.coverImage }} style={styles.guideCardBg} imageStyle={{ borderRadius: 18 }}><View style={styles.guideCardOverlay}><Text style={styles.guideTitle}>{guide.title}</Text><Text style={styles.guideSpots}>{guide.spots} Spots</Text></View></ImageBackground> : <View style={styles.guideCardOverlay}><Text style={styles.guideTitle}>{guide.title}</Text><Text style={styles.guideSpots}>{guide.spots} Spots</Text></View>}</TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>My Trips</Text>
            <View style={styles.myTripsList}>
                {tripsLoading ? (
                    <ActivityIndicator size="small" color="#64748B" style={{ marginTop: 20 }} />
                ) : savedTrips.length > 0 ? (
                    savedTrips.map((trip, idx) => {
                        return (
                            <TouchableOpacity key={trip._id || idx} style={styles.tripCard} activeOpacity={0.7} delayPressIn={100} onPress={() => handleTripPress(trip._id)}>
                                {trip.tripRepPic ? (
                                    <Image source={{ uri: trip.tripRepPic }} style={styles.tripImage} />
                                ) : (
                                    <View style={styles.tripImagePlaceholder} />
                                )}
                                <View style={styles.tripInfo}>
                                    <Text style={styles.tripTitle} numberOfLines={1}>{trip.days}-Day {trip.destination} Trip</Text>
                                    <Text style={styles.tripDetails}>{trip.days} Days • {trip.days - 1} Nights</Text>
                                    {trip.interests && trip.interests.length > 0 && (
                                        <Text style={styles.tripInterests} numberOfLines={1}>{trip.interests.join(', ')}</Text>
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    })
                ) : (
                    <View style={{ padding: 20, alignItems: 'center' }}><Text style={{ color: '#94A3B8', fontSize: 14, fontWeight: '500' }}>No saved trips yet</Text><Text style={{ color: '#CBD5E1', fontSize: 12, marginTop: 4 }}>Create your first trip to see it here!</Text></View>
                )}
            </View>
        </BottomSheetScrollView>
    );
};

const styles = StyleSheet.create({
    tripsScrollContent: {
        paddingTop: 0,
    },
    sectionTitle: {
        fontSize: 28,
        fontFamily: FONT_SERIF,
        ...Platform.select({ ios: { fontStyle: 'italic', fontWeight: '600' }, android: {} }),
        color: '#0F172A',
        marginLeft: 20,
        marginTop: 0,
        marginBottom: 12,
        textTransform: 'lowercase',
    },
    guidesScroll: {
        paddingHorizontal: 16,
        paddingBottom: 4,
        paddingRight: 32,
    },
    guideCard: {
        width: SCREEN_WIDTH * 0.4,
        height: 160,
        borderRadius: 18,
        marginRight: 10,
        overflow: 'hidden',
    },
    guideCardBg: {
        flex: 1,
    },
    guideCardOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        padding: 14,
        backgroundColor: 'rgba(0,0,0,0.25)',
        borderRadius: 18,
    },
    guideTitle: {
        fontSize: 17,
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
        gap: 14,
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    tripCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    tripImage: {
        width: 72,
        height: 72,
        borderRadius: 16,
        marginRight: 16,
    },
    tripImagePlaceholder: {
        width: 72,
        height: 72,
        borderRadius: 16,
        marginRight: 16,
        backgroundColor: '#F1F5F9',
    },
    tripInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    tripTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 4,
    },
    tripDetails: {
        fontSize: 13,
        fontWeight: '500',
        color: '#64748B',
        marginBottom: 2,
    },
    tripInterests: {
        fontSize: 12,
        fontWeight: '500',
        color: '#94A3B8',
    },
});

export default SpotsTripsContent;
