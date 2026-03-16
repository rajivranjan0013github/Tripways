import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image, StyleSheet, Keyboard, Dimensions, Platform } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { BottomSheetView, BottomSheetScrollView, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import Animated, { withTiming, Easing } from 'react-native-reanimated';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SpotsExploreContent = ({
    socialMode,
    setSocialMode,
    searchText,
    setSearchText,
    searchFocused,
    setSearchFocused,
    videoProcessing,
    videoProgress,
    spotSearchLoading,
    spotSearchResults,
    savedPlaceIds,
    savingSpotId,
    saveSpotToBucketList,
    setSelectedSpotPlaceId,
    mySpotsCountries,
    totalSpotsCount,
    spotsLoading,
    savedViewMode,
    setSavedViewMode,
    importedVideos,
    totalImportsCount,
    onImportPress,
    sheetAnimatedPosition,
    thresholdY,
    fadeRange,
    avatarAnimatedStyle,
    closeAnimatedStyle,
    searchInputRef,
    bottomSheetRef,
    createTripSheetRef,
    tabBarHeight,
    tabBarTranslateY,
    setShowProfile
}) => {
    return (
        <View style={styles.sheetContent}>
            {/* Search Row */}
            <View style={styles.sheetSearchRow}>
                <View style={styles.sheetSearchBar}>
                    {socialMode === 'instagram' ? (
                        <Svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                            <Rect x="2" y="2" width="20" height="20" rx="5" stroke="#E1306C" strokeWidth="2" />
                            <Circle cx="12" cy="12" r="5" stroke="#E1306C" strokeWidth="2" />
                            <Circle cx="17.5" cy="6.5" r="1.5" fill="#E1306C" />
                        </Svg>
                    ) : socialMode === 'tiktok' ? (
                        <Svg width="17" height="19" viewBox="0 0 22 24" fill="none">
                            <Path d="M16 0H12v16.5a3.5 3.5 0 1 1-3-3.46V9a7.5 7.5 0 1 0 7 7.5V8a8.22 8.22 0 0 0 4 1V5a4 4 0 0 1-4-4" fill="#000" />
                        </Svg>
                    ) : (
                        <Svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <Circle cx="11" cy="11" r="8" />
                            <Path d="m21 21-4.3-4.3" />
                        </Svg>
                    )}
                    <TextInput
                        ref={searchInputRef}
                        style={styles.sheetSearchInput}
                        placeholder={socialMode === 'instagram' ? 'Paste reels URL...' : socialMode === 'tiktok' ? 'Paste video URL...' : 'Search / Add spots...'}
                        placeholderTextColor={socialMode === 'instagram' ? '#E1306C' : socialMode === 'tiktok' ? '#000' : '#94A3B8'}
                        value={searchText}
                        onChangeText={setSearchText}
                        onFocus={() => {
                            setSearchFocused(true);
                            bottomSheetRef.current?.snapToIndex(2);
                        }}
                        onBlur={() => setSearchFocused(false)}
                        returnKeyType="search"
                    />
                </View>
                <View style={styles.searchButtonWrap}>
                    <TouchableOpacity
                        style={styles.sheetSearchAvatar}
                        activeOpacity={0.8}
                        onPress={() => {
                            if (sheetAnimatedPosition.value < thresholdY - fadeRange / 2) {
                                setSearchText('');
                                setSocialMode(null);
                                searchInputRef.current?.blur();
                                Keyboard.dismiss();
                                bottomSheetRef.current?.snapToIndex(1);
                            } else {
                                setShowProfile(true);
                            }
                        }}
                    >
                        <Animated.View style={[StyleSheet.absoluteFill, avatarAnimatedStyle, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
                            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <Circle cx="12" cy="7" r="4" />
                            </Svg>
                        </Animated.View>
                        <Animated.View style={[StyleSheet.absoluteFill, closeAnimatedStyle, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
                            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <Path d="M18 6 6 18M6 6l12 12" />
                            </Svg>
                        </Animated.View>
                    </TouchableOpacity>
                </View>
            </View>
            {/* Exploration Content */}
            {searchFocused && searchText.length === 0 && !socialMode ? (
                <BottomSheetScrollView style={styles.socialSearchContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <Text style={styles.sheetSectionLabel}>Search on</Text>
                    <View style={styles.socialCardsRow}>
                        <TouchableOpacity style={styles.socialCard} activeOpacity={0.8} onPress={() => setSocialMode('instagram')}>
                            <View style={[styles.socialIconWrap, { backgroundColor: '#FFEEF4' }]}>
                                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Rect x="2" y="2" width="20" height="20" rx="5" stroke="#E1306C" strokeWidth="2" /><Circle cx="12" cy="12" r="5" stroke="#E1306C" strokeWidth="2" /><Circle cx="17.5" cy="6.5" r="1.5" fill="#E1306C" /></Svg>
                            </View>
                            <Text style={styles.socialCardTitle}>Instagram</Text>
                            <Text style={styles.socialCardSub}>Paste reels link</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.socialCard} activeOpacity={0.8} onPress={() => setSocialMode('tiktok')}>
                            <View style={[styles.socialIconWrap, { backgroundColor: '#F0F0F0' }]}>
                                <Svg width="22" height="24" viewBox="0 0 22 24" fill="none"><Path d="M16 0H12v16.5a3.5 3.5 0 1 1-3-3.46V9a7.5 7.5 0 1 0 7 7.5V8a8.22 8.22 0 0 0 4 1V5a4 4 0 0 1-4-4" fill="#000" /></Svg>
                            </View>
                            <Text style={styles.socialCardTitle}>TikTok</Text>
                            <Text style={styles.socialCardSub}>Paste video link</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={[styles.sheetSectionLabel, { marginTop: 20 }]}>Trending Searches</Text>
                    <View style={styles.chipRow}>
                        {['Cafés in Paris', 'Bali hidden gems', 'Tokyo street food', 'NYC rooftops'].map((chip, i) => (
                            <TouchableOpacity key={i} style={styles.trendChip} activeOpacity={0.7} onPress={() => setSearchText(chip)}>
                                <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><Path d="M22 12h-4l-3 9L9 3l-3 9H2" /></Svg>
                                <Text style={styles.trendChipText}>{chip}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </BottomSheetScrollView>
            ) : searchFocused && (searchText.length > 0 || socialMode) ? (
                <View style={styles.searchResultsContainer}>
                    {socialMode ? (
                        <>
                            <Text style={styles.sheetSectionLabel}>{socialMode === 'instagram' ? 'Instagram Reels' : 'TikTok Video'}</Text>
                            <View style={styles.emptySpots}>
                                {videoProcessing ? <ActivityIndicator size="large" color={socialMode === 'instagram' ? '#E1306C' : '#000'} /> : socialMode === 'instagram' ? <Svg width="40" height="40" viewBox="0 0 24 24" fill="none"><Rect x="2" y="2" width="20" height="20" rx="5" stroke="#E1306C" strokeWidth="1.5" /><Circle cx="12" cy="12" r="5" stroke="#E1306C" strokeWidth="1.5" /><Circle cx="17.5" cy="6.5" r="1.5" fill="#E1306C" /></Svg> : <Svg width="36" height="40" viewBox="0 0 22 24" fill="none"><Path d="M16 0H12v16.5a3.5 3.5 0 1 1-3-3.46V9a7.5 7.5 0 1 0 7 7.5V8a8.22 8.22 0 0 0 4 1V5a4 4 0 0 1-4-4" fill="#CBD5E1" /></Svg>}
                                <Text style={[styles.emptySpotsText, { marginTop: 12 }]}>{videoProcessing ? (videoProgress || 'Processing video...') : searchText.length === 0 ? `Paste a ${socialMode === 'instagram' ? 'reels' : 'TikTok'} URL above` : 'Processing link…'}</Text>
                                <Text style={styles.emptySpotsHint}>{videoProcessing ? 'This may take a minute' : "We'll extract places from the video"}</Text>
                            </View>
                        </>
                    ) : (
                        <>
                            <Text style={styles.sheetSectionLabel}>Results for "{searchText}"</Text>
                            {spotSearchLoading && spotSearchResults.length === 0 ? (
                                <View style={styles.emptySpots}><ActivityIndicator size="small" color="#94A3B8" /><Text style={[styles.emptySpotsText, { marginTop: 12 }]}>Searching places…</Text></View>
                            ) : spotSearchResults.length > 0 ? (
                                <BottomSheetFlatList data={spotSearchResults} keyExtractor={(item) => item.placeId} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} renderItem={({ item }) => {
                                    const isSaved = savedPlaceIds.has(item.placeId);
                                    const isSaving = savingSpotId === item.placeId;
                                    return (
                                        <TouchableOpacity style={styles.spotSearchRow} activeOpacity={0.7} onPress={() => setSelectedSpotPlaceId(item.placeId)}>
                                            <View style={styles.spotSearchIcon}><Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><Circle cx="12" cy="10" r="3" /></Svg></View>
                                            <View style={styles.spotSearchTextWrap}><Text style={styles.spotSearchName} numberOfLines={1}>{item.name}</Text><Text style={styles.spotSearchSub} numberOfLines={1}>{item.secondary}</Text></View>
                                            <TouchableOpacity style={styles.spotBookmarkBtn} onPress={(e) => { e.stopPropagation?.(); if (isSaved || isSaving) return; saveSpotToBucketList({ placeId: item.placeId, name: item.name, address: item.secondary, city: item.secondary?.split(', ')?.[0] || 'Unknown', country: item.secondary?.split(', ')?.pop() || 'Unknown' }); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>{isSaving ? <ActivityIndicator size="small" color="#3B82F6" /> : <Svg width="20" height="20" viewBox="0 0 24 24" fill={isSaved ? '#3B82F6' : 'none'} stroke={isSaved ? '#3B82F6' : '#94A3B8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></Svg>}</TouchableOpacity>
                                        </TouchableOpacity>
                                    );
                                }} />
                            ) : (
                                <View style={styles.emptySpots}><Image source={require('../assets/spots.png')} style={[styles.emptySpotsImage, { width: 140, height: 140 }]} resizeMode="contain" /><Text style={[styles.emptySpotsText, { marginTop: 0 }]}>No results found</Text><Text style={styles.emptySpotsHint}>Try a different search term</Text></View>
                            )}
                        </>
                    )}
                </View>
            ) : (
                <BottomSheetScrollView style={styles.mySpotsList} contentContainerStyle={styles.mySpotsListContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.mySpotsHeader}>
                        <View style={styles.savedModeSwitch}>
                            <TouchableOpacity style={[styles.savedModeChip, savedViewMode === 'spots' && styles.savedModeChipActive]} activeOpacity={0.8} onPress={() => setSavedViewMode('spots')}>
                                <Text style={[styles.savedModeChipText, savedViewMode === 'spots' && styles.savedModeChipTextActive]}>My Spots</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.savedModeChip, savedViewMode === 'imports' && styles.savedModeChipActive]} activeOpacity={0.8} onPress={() => setSavedViewMode('imports')}>
                                <Text style={[styles.savedModeChipText, savedViewMode === 'imports' && styles.savedModeChipTextActive]}>Imported</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.mySpotsTitle}>{savedViewMode === 'spots' ? 'My Spots' : 'Imported Reels & TikToks'}</Text>
                        <Text style={styles.mySpotsSubtitle}>
                            {savedViewMode === 'spots'
                                ? `${totalSpotsCount} ${totalSpotsCount === 1 ? 'Spot' : 'Spots'} Saved`
                                : `${totalImportsCount} ${totalImportsCount === 1 ? 'Import' : 'Imports'} Saved`}
                        </Text>
                    </View>
                    {savedViewMode === 'spots' ? (
                        mySpotsCountries.length === 0 ? (
                            <View style={styles.emptySpots}>
                                <Image source={require('../assets/spots.png')} style={styles.emptySpotsImage} />
                                <Text style={styles.emptySpotsText}>No saved spots yet</Text>
                                <Text style={styles.emptySpotsHint}>Save spots from your trips to see them here</Text>
                            </View>
                        ) : (
                            mySpotsCountries.map((item) => {
                                const { country, cities, cityCount, spotCount } = item;
                                return (
                                    <View key={country} style={styles.countrySection}>
                                        <View style={styles.countryHeader}><Text style={styles.countryTitle}>{country}</Text><Text style={styles.countrySubtitle}>{cityCount} {cityCount === 1 ? 'City' : 'Cities'} • {spotCount} {spotCount === 1 ? 'Spot' : 'Spots'}</Text></View>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cityCardsRow}>
                                            {Object.entries(cities).map(([city, cityData]) => {
                                                const cityKey = `${country}::${city}`;
                                                return (
                                                    <TouchableOpacity key={cityKey} activeOpacity={0.85} onPress={() => { bottomSheetRef.current?.close(); tabBarTranslateY.value = withTiming(tabBarHeight, { duration: 400, easing: Easing.bezier(0.33, 1, 0.68, 1) }); setTimeout(() => { createTripSheetRef.current?.openWithSavedSpots(country, city, cities); }, 350); }} style={styles.cityCard}>{cityData.cityPhoto ? <Image source={{ uri: cityData.cityPhoto }} style={styles.cityCardImage} /> : <View style={styles.cityCardImagePlaceholder}><Text style={styles.cityCardEmoji}>🏙️</Text></View>}<View style={styles.cityCardInfo}><Text style={styles.cityCardTitle} numberOfLines={1}>{city}</Text><Text style={styles.cityCardSubtitle}>{cityData.spots.length} {cityData.spots.length === 1 ? 'Spot' : 'Spots'}</Text></View></TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>
                                );
                            })
                        )
                    ) : importedVideos.length === 0 ? (
                        <View style={styles.emptySpots}>
                            <Image source={require('../assets/spots.png')} style={styles.emptySpotsImage} />
                            <Text style={styles.emptySpotsText}>No imported videos yet</Text>
                            <Text style={styles.emptySpotsHint}>Import a reel or TikTok to keep the video, caption, and extracted places here</Text>
                        </View>
                    ) : (
                        importedVideos.map((item) => {
                            const importTitle = item.title || item.destination || 'Untitled import';
                            return (
                                <TouchableOpacity key={item._id} style={styles.importCard} activeOpacity={0.85} onPress={() => onImportPress(item)}>
                                    {item.thumbnailUrl ? (
                                        <Image source={{ uri: item.thumbnailUrl }} style={styles.importCardImage} />
                                    ) : (
                                        <View style={styles.importCardImagePlaceholder}>
                                            <Text style={styles.importCardImageEmoji}>{item.platform === 'tiktok' ? '♪' : '▣'}</Text>
                                        </View>
                                    )}
                                    <View style={styles.importCardInfo}>
                                        <View style={styles.importCardTopRow}>
                                            <Text style={styles.importPlatformPill}>{item.platform === 'tiktok' ? 'TikTok' : item.platform === 'instagram' ? 'Reel' : 'Video'}</Text>
                                            <Text style={styles.importStatusText}>{item.status}</Text>
                                        </View>
                                        <Text style={styles.importCardTitle} numberOfLines={2}>{importTitle}</Text>
                                        {!!item.caption && <Text style={styles.importCardCaption} numberOfLines={2}>{item.caption}</Text>}
                                        <Text style={styles.importCardMeta}>{item.totalExtractedPlaces || 0} extracted • {item.savedSpotCount || 0} saved</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </BottomSheetScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    sheetContent: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 0,
        marginTop: -10,
    },
    sheetSearchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 8,
        marginBottom: 16,
    },
    sheetSearchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 24,
        paddingHorizontal: 14,
        height: 48,
    },
    sheetSearchInput: {
        flex: 1,
        fontSize: 15,
        fontWeight: '500',
        color: '#1E293B',
        marginLeft: 10,
        paddingVertical: 0,
    },
    searchButtonWrap: {
        width: 44,
        height: 44,
    },
    sheetSearchAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetSectionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#94A3B8',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    socialSearchContainer: {
        flex: 1,
        paddingTop: 4,
    },
    socialCardsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    socialCard: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    socialIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    socialCardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 2,
    },
    socialCardSub: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '500',
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
    },
    trendChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    trendChipText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#64748B',
    },
    searchResultsContainer: {
        flex: 1,
        paddingTop: 4,
    },
    mySpotsList: {
        flex: 1,
        marginLeft: 0,
    },
    mySpotsListContent: {
        paddingBottom: 120,
    },
    mySpotsHeader: {
        marginBottom: 10,
    },
    savedModeSwitch: {
        flexDirection: 'row',
        alignSelf: 'flex-start',
        backgroundColor: '#EEF2F7',
        borderRadius: 999,
        padding: 4,
        marginBottom: 12,
        gap: 6,
    },
    savedModeChip: {
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
    },
    savedModeChipActive: {
        backgroundColor: '#FFFFFF',
    },
    savedModeChipText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B',
    },
    savedModeChipTextActive: {
        color: '#0F172A',
    },
    mySpotsTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        letterSpacing: -0.5,
    },
    mySpotsSubtitle: {
        fontSize: 13,
        color: '#94A3B8',
        marginTop: 1,
    },
    countrySection: {
        marginTop: 10,
    },
    countryHeader: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        paddingHorizontal: 5,
        marginBottom: 12,
    },
    countryTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1E293B',
    },
    countrySubtitle: {
        fontSize: 12,
        color: '#94A3B8',
    },
    cityCardsRow: {
        paddingLeft: 5,
        paddingRight: 0,
    },
    cityCard: {
        width: 150,
        marginRight: 12,
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: '#F1F5F9',
    },
    cityCardImage: {
        width: 150,
        height: 110,
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
    },
    cityCardImagePlaceholder: {
        width: 150,
        height: 110,
        backgroundColor: '#E2E8F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cityCardEmoji: {
        fontSize: 32,
    },
    cityCardInfo: {
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    cityCardTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E293B',
    },
    cityCardSubtitle: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 1,
    },
    importCard: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderRadius: 18,
        padding: 10,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#EEF2F7',
    },
    importCardImage: {
        width: 104,
        height: 128,
        borderRadius: 14,
        backgroundColor: '#E2E8F0',
    },
    importCardImagePlaceholder: {
        width: 104,
        height: 128,
        borderRadius: 14,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    importCardImageEmoji: {
        fontSize: 28,
        color: '#475569',
    },
    importCardInfo: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'space-between',
    },
    importCardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    importPlatformPill: {
        fontSize: 11,
        fontWeight: '800',
        color: '#334155',
        backgroundColor: '#E2E8F0',
        overflow: 'hidden',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
    },
    importStatusText: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '700',
        textTransform: 'capitalize',
    },
    importCardTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
        lineHeight: 21,
    },
    importCardCaption: {
        fontSize: 13,
        color: '#64748B',
        lineHeight: 18,
        marginTop: 6,
    },
    importCardMeta: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 10,
        fontWeight: '700',
    },
    spotSearchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    spotSearchIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    spotSearchTextWrap: {
        flex: 1,
    },
    spotSearchName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 2,
    },
    spotSearchSub: {
        fontSize: 13,
        color: '#64748B',
    },
    spotBookmarkBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    emptySpots: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    emptySpotsImage: {
        width: 400,
        height: 250,
        marginBottom: 12,
    },
    emptySpotsText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94A3B8',
    },
    emptySpotsHint: {
        fontSize: 12,
        color: '#CBD5E1',
        marginTop: 4,
    },
    skeletonCountryHeader: {
        marginBottom: 12,
        paddingHorizontal: 5,
    },
    skeletonTitle: {
        width: 120,
        height: 24,
        backgroundColor: '#E2E8F0',
        borderRadius: 4,
        marginBottom: 8,
    },
    skeletonSubtitle: {
        width: 80,
        height: 14,
        backgroundColor: '#E2E8F0',
        borderRadius: 4,
    },
    skeletonCard: {
        width: 150,
        height: 160,
        backgroundColor: '#F1F5F9',
        borderRadius: 14,
        marginRight: 12,
    },
});

export default SpotsExploreContent;
