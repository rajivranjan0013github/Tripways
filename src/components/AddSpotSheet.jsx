import React, { forwardRef, useState, useMemo, useCallback, useRef, useImperativeHandle } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    Dimensions, ActivityIndicator, Platform, Keyboard
} from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSpotSearch } from '../hooks/useSpotSearch';
import { fetchSpotDetailFn } from '../hooks/useSpotDetail';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * AddSpotSheet — a bottom sheet for searching and adding a place to a trip day.
 *
 * Usage:
 *   <AddSpotSheet ref={addSpotSheetRef} onSpotSelected={(place) => { ... }} />
 *   addSpotSheetRef.current?.open();
 */
const AddSpotSheet = forwardRef(({ onSpotSelected }, ref) => {
    const snapPoints = useMemo(() => ['70%', '92%'], []);
    const sheetRef = useRef(null);
    const searchInputRef = useRef(null);

    const [searchText, setSearchText] = useState('');
    const [loadingPlaceId, setLoadingPlaceId] = useState(null);

    const { data: searchResults = [], isLoading: searchLoading } = useSpotSearch(searchText);

    useImperativeHandle(ref, () => ({
        open: () => {
            setSearchText('');
            setLoadingPlaceId(null);
            sheetRef.current?.expand();
            setTimeout(() => searchInputRef.current?.focus(), 400);
        },
        close: () => {
            Keyboard.dismiss();
            sheetRef.current?.close();
        },
    }));

    const handleSelectPlace = useCallback(async (item) => {
        if (loadingPlaceId) return;
        setLoadingPlaceId(item.placeId);
        try {
            const detail = await fetchSpotDetailFn(item.placeId);
            if (detail && detail.coordinates?.lat) {
                // Build a place object matching the itinerary's places shape
                const place = {
                    name: detail.name,
                    address: detail.address || '',
                    coordinates: detail.coordinates,
                    photoUrl: detail.photoUrl || null,
                    rating: detail.rating || null,
                    userRatingCount: detail.userRatingCount || 0,
                    category: detail.primaryType || '',
                    description: detail.summary || '',
                    estimatedTimeHours: 2,
                    bestTimeOfDay: 'morning',
                };
                onSpotSelected?.(place);
                setSearchText('');
                Keyboard.dismiss();
                sheetRef.current?.close();
            }
        } catch (err) {
            console.warn('Failed to fetch place details:', err);
        } finally {
            setLoadingPlaceId(null);
        }
    }, [loadingPlaceId, onSpotSelected]);

    const renderItem = useCallback(({ item }) => {
        const isLoading = loadingPlaceId === item.placeId;
        return (
            <TouchableOpacity
                style={styles.resultItem}
                onPress={() => handleSelectPlace(item)}
                activeOpacity={0.7}
                disabled={!!loadingPlaceId}
            >
                <View style={styles.resultIcon}>
                    {isLoading ? (
                        <ActivityIndicator size="small" color="#6366F1" />
                    ) : (
                        <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <Circle cx="12" cy="10" r="3" />
                        </Svg>
                    )}
                </View>
                <View style={styles.resultText}>
                    <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                    {item.secondary ? (
                        <Text style={styles.resultSecondary} numberOfLines={1}>{item.secondary}</Text>
                    ) : null}
                </View>
                <View style={styles.addIcon}>
                    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M12 5v14M5 12h14" />
                    </Svg>
                </View>
            </TouchableOpacity>
        );
    }, [loadingPlaceId, handleSelectPlace]);

    return (
        <BottomSheet
            ref={sheetRef}
            index={-1}
            snapPoints={snapPoints}
            enablePanDownToClose
            enableDynamicSizing={false}
            backgroundStyle={styles.sheetBackground}
            handleIndicatorStyle={styles.handleIndicator}
            containerStyle={{ zIndex: 300 }}
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
            android_keyboardInputMode="adjustResize"
            onChange={(index) => {
                if (index === -1) {
                    setSearchText('');
                    setLoadingPlaceId(null);
                    Keyboard.dismiss();
                }
            }}
        >
            <BottomSheetView style={styles.header}>
                <Text style={styles.title}>Add Spot</Text>
                <View style={styles.searchBar}>
                    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <Circle cx="11" cy="11" r="8" />
                        <Path d="m21 21-4.35-4.35" />
                    </Svg>
                    <TextInput
                        ref={searchInputRef}
                        style={styles.searchInput}
                        placeholder="Search for a place..."
                        placeholderTextColor="#94A3B8"
                        value={searchText}
                        onChangeText={setSearchText}
                        returnKeyType="search"
                        autoCorrect={false}
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <Path d="M18 6 6 18M6 6l12 12" />
                            </Svg>
                        </TouchableOpacity>
                    )}
                </View>
            </BottomSheetView>

            {searchLoading && searchText.length >= 2 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#6366F1" />
                    <Text style={styles.loadingText}>Searching...</Text>
                </View>
            ) : searchResults.length > 0 ? (
                <BottomSheetFlatList
                    data={searchResults}
                    keyExtractor={(item) => item.placeId}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                />
            ) : searchText.length >= 2 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No places found</Text>
                </View>
            ) : null}
        </BottomSheet>
    );
});

const styles = StyleSheet.create({
    sheetBackground: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 10,
    },
    handleIndicator: {
        backgroundColor: '#E5E7EB',
        width: 48,
        height: 6,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 14,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 46,
        gap: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        fontWeight: '500',
        color: '#0F172A',
        padding: 0,
    },
    listContent: {
        paddingHorizontal: 12,
        paddingTop: 80,
        paddingBottom: 40,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#F1F5F9',
    },
    resultIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    resultText: {
        flex: 1,
    },
    resultName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0F172A',
    },
    resultSecondary: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 2,
    },
    addIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        gap: 10,
    },
    loadingText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#94A3B8',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingTop: 80,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#94A3B8',
    },
    emptyHint: {
        fontSize: 13,
        color: '#CBD5E1',
        textAlign: 'center',
        paddingHorizontal: 40,
    },
});

export default AddSpotSheet;
