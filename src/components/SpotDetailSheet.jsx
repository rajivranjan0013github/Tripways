import React, { forwardRef, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import Svg, { Path, Circle } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

const SpotDetailSheet = forwardRef(({ spot, onClose }, ref) => {
    const snapPoints = useMemo(() => ['60%'], []);

    useEffect(() => {
        if (spot) {
            ref.current?.expand();
        } else {
            ref.current?.close();
        }
    }, [spot, ref]);

    const renderBackdrop = (props) => (
        <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
            opacity={0.5}
        />
    );

    const config = spot ? (CATEGORY_CONFIG[spot.category] || CATEGORY_CONFIG['Attractions']) : CATEGORY_CONFIG['Attractions'];

    return (
        <BottomSheet
            ref={ref}
            index={-1}
            snapPoints={snapPoints}
            enablePanDownToClose
            containerStyle={{ zIndex: 200 }}
            backdropComponent={renderBackdrop}
            backgroundStyle={styles.sheetBackground}
            handleComponent={null}
            onClose={onClose}
        >
            {spot ? (
                <BottomSheetScrollView contentContainerStyle={styles.content}>
                    {/* Header Image */}
                    <View style={styles.imageContainer}>
                        {spot.image ? (
                            <Image source={{ uri: spot.image }} style={styles.spotImage} />
                        ) : (
                            <View style={[styles.spotImage, styles.imagePlaceholder]}>
                                <Text style={styles.placeholderEmoji}>{config.emoji}</Text>
                            </View>
                        )}
                        <TouchableOpacity style={styles.closeButton} onPress={() => ref.current?.close()}>
                            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <Path d="M18 6L6 18M6 6l12 12" />
                            </Svg>
                        </TouchableOpacity>
                    </View>

                    {/* Info Section */}
                    <View style={styles.infoSection}>
                        <View style={styles.titleRow}>
                            <Text style={styles.spotName}>{spot.fullName || spot.name}</Text>
                            <View style={[styles.categoryBadge, { backgroundColor: config.bg }]}>
                                <Text style={[styles.categoryText, { color: config.color }]}>{spot.category}</Text>
                            </View>
                        </View>

                        <View style={styles.metaRow}>
                            <Text style={styles.ratingText}>⭐ {spot.rating || '4.5'}</Text>
                            <Text style={styles.dot}>•</Text>
                            <Text style={styles.timeText}>🕒 {spot.estimatedTimeHours || 2} hours</Text>
                        </View>

                        {spot.address && (
                            <View style={styles.addressRow}>
                                <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <Circle cx="12" cy="10" r="3" />
                                </Svg>
                                <Text style={styles.addressText} numberOfLines={2}>{spot.address}</Text>
                            </View>
                        )}

                        <Text style={styles.description}>
                            {spot.description || "A beautiful spot to explore and enjoy. Perfect for sightseeing and soaking in the local culture."}
                        </Text>

                        {/* Actions */}
                        <View style={styles.actionsContainer}>
                            <TouchableOpacity style={styles.directionsButton}>
                                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <Path d="M9 11l3 3L22 4" />
                                    <Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                                </Svg>
                                <Text style={styles.directionsText}>Get Directions</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </BottomSheetScrollView>
            ) : (
                <View style={{ height: 100 }} />
            )}
        </BottomSheet>
    );
});

const styles = StyleSheet.create({
    sheetBackground: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -10,
        },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 20,
    },
    handleIndicator: {
        backgroundColor: '#E2E8F0',
        width: 40,
        height: 5,
        borderRadius: 3,
    },
    content: {
        paddingBottom: 40,
    },
    imageContainer: {
        width: '100%',
        height: 250,
        position: 'relative',
        backgroundColor: '#F1F5F9',
        overflow: 'hidden',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
    },
    spotImage: {
        width: '100%',
        height: '100%',
    },
    imagePlaceholder: {
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderEmoji: {
        fontSize: 64,
    },
    closeButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoSection: {
        padding: 24,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    spotName: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0F172A',
        flex: 1,
        marginRight: 12,
    },
    categoryBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    categoryText: {
        fontSize: 13,
        fontWeight: '700',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 20,
        gap: 8,
    },
    addressText: {
        fontSize: 14,
        color: '#64748B',
        lineHeight: 20,
        flex: 1,
    },
    ratingText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#475569',
    },
    dot: {
        marginHorizontal: 8,
        color: '#CBD5E1',
    },
    timeText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#64748B',
    },
    description: {
        fontSize: 16,
        lineHeight: 24,
        color: '#334155',
        marginBottom: 32,
    },
    actionsContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    directionsButton: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#0F172A',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    directionsText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default SpotDetailSheet;
