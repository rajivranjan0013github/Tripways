/**
 * Home Screen - TripWays
 * @format
 */

import React, { useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Image, Dimensions, Platform, ScrollView } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const HomeScreen = () => {
    const bottomSheetRef = useRef(null);
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = React.useState('home');



    const snapPoints = useMemo(() => ['12%', '50%', '90%'], []);

    const handleSheetChanges = useCallback((index) => {
        console.log('handleSheetChanges', index);
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            {/* Map Background */}
            <MapView
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={{
                    latitude: 28.6139,
                    longitude: 77.2090,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                }}
            >
                <Marker
                    coordinate={{ latitude: 28.6139, longitude: 77.2090 }}
                    title={"TripWays"}
                    description={"Start your journey here"}
                />
            </MapView>

            {/* Top Header Actions */}
            <View style={[styles.headerContainer, { top: insets.top + 10 }]}>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.iconButton}>
                        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <Path d="m17 8-5-5-5 5" />
                            <Path d="M12 3v12" />
                        </Svg>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.notificationButton}>
                        <Text style={styles.notificationText}>5</Text>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>2</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.avatarButton}>
                        <Text style={styles.avatarText}>Ak</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Bottom Sheet */}
            <BottomSheet
                ref={bottomSheetRef}
                index={1}
                snapPoints={snapPoints}
                onChange={handleSheetChanges}
                backgroundStyle={styles.sheetBackground}
                handleIndicatorStyle={styles.handleIndicator}
            >
                <BottomSheetView style={styles.sheetContent}>
                    <View style={styles.welcomeRow}>
                        <View>
                            <Text style={styles.welcomeLabel}>Welcome,</Text>
                            <Text style={styles.userName}>Ak K!</Text>
                        </View>
                        <TouchableOpacity style={styles.importGuideBtn}>
                            <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF8C42" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <Path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                                <Path d="M6 2v20" />
                                <Rect x="10" y="6" width="6" height="4" rx="1" />
                            </Svg>
                            <Text style={styles.importGuideText}>Import Guide</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.illustrationContainer}>
                        <Image
                            source={require('../assets/illustration.png')}
                            style={styles.illustration}
                            resizeMode="contain"
                        />
                    </View>

                    <View style={styles.importSpotCard}>
                        <View style={styles.importRow}>
                            <View style={styles.importIconContainer}>
                                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <Circle cx="8.5" cy="8.5" r="1.5" />
                                    <Path d="m21 15-5-5L5 21" />
                                </Svg>
                            </View>
                            <Text style={styles.importText}>Import your First Spots</Text>
                        </View>

                        <TouchableOpacity style={styles.getStartedBtn}>
                            <Text style={styles.getStartedText}>Get Started</Text>
                        </TouchableOpacity>
                    </View>
                </BottomSheetView>
            </BottomSheet>

            {/* Trips Overlay */}
            {activeTab === 'trips' && (
                <View style={[styles.tripsOverlay, { paddingTop: insets.top }]}>
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
                            {[
                                { title: '5-Day Delhi Trip', info: '5 Days 4 Nights', spots: '30 Spots', color: '#EEF2FF', iconColor: '#3B82F6' },
                                { title: '4-Day Varanasi Trip', info: '4 Days 3 Nights', spots: '24 Spots', color: '#F7FEE7', iconColor: '#84CC16' },
                                { title: '2-Day Bengaluru Trip', info: '2 Days 1 Night', spots: '15 Spots', color: '#FDF2F8', iconColor: '#D946EF' },
                            ].map((trip, idx) => (
                                <TouchableOpacity key={idx} style={[styles.tripCard, { backgroundColor: trip.color }]}>
                                    <View style={styles.tripImagePlaceholder} />
                                    <View style={styles.tripInfo}>
                                        <Text style={[styles.tripTitle, { color: trip.iconColor }]}>{trip.title}</Text>
                                        <Text style={styles.tripDetails}>{trip.info}</Text>
                                        <Text style={styles.tripDetails}>{trip.spots}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                </View>
            )}

            {/* Custom Bottom Tab Bar */}
            <View style={[styles.tabBarContainer, { bottom: Platform.OS === 'android' ? insets.bottom + 10 : insets.bottom }]}>
                <TouchableOpacity
                    style={styles.tabItem}
                    onPress={() => setActiveTab('trips')}
                >
                    <Svg width="24" height="24" viewBox="0 0 24 24" fill={activeTab === 'trips' ? "#3B82F6" : "none"} stroke={activeTab === 'trips' ? "#3B82F6" : "#71717A"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <Rect x="2" y="7" width="20" height="14" rx="2" />
                        <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </Svg>
                </TouchableOpacity>

                <TouchableOpacity style={styles.plusButton}>
                    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M12 5v14M5 12h14" />
                    </Svg>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tabItem}
                    onPress={() => setActiveTab('home')}
                >
                    <Svg width="24" height="24" viewBox="0 0 24 24" fill={activeTab === 'home' ? "#3B82F6" : "none"} stroke={activeTab === 'home' ? "#3B82F6" : "#71717A"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                    </Svg>
                </TouchableOpacity>
            </View>
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
    headerContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        paddingHorizontal: 20,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    notificationButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    notificationText: {
        fontSize: 18,
        fontWeight: '500',
        color: '#333',
    },
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#4ADE80',
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    badgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '700',
    },
    avatarButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FB923C',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    avatarText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '600',
    },
    sheetBackground: {
        backgroundColor: '#FFFFFF',
        borderRadius: 32,
    },
    handleIndicator: {
        backgroundColor: '#E5E7EB',
        width: 48,
        height: 6,
    },
    sheetContent: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 12,
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
        left: 70,
        right: 70,
        backgroundColor: '#FFFFFF',
        height: 54,
        borderRadius: 27,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 10,
    },
    tabItem: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    plusButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#3F3F46',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#3F3F46',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
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
});

export default HomeScreen;
