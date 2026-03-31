import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image, StyleSheet, Keyboard, Dimensions, Platform, Modal, FlatList } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { BottomSheetView, BottomSheetScrollView, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import Animated, { withTiming, Easing } from 'react-native-reanimated';
import Svg, { Path, Circle, Rect, Polyline, Line, Check, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import { useUserStore } from '../store/userStore';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const IMPORT_GUIDE_STEPS = [
    {
        gif: require('../assets/1.gif'),
        title: 'Find a Travel Video',
        description: 'Open Instagram or TikTok and find a travel video you love.',
        emoji: '🔍',
        accent: '#E1306C',
        accentBg: '#FFF0F5',
    },
    {
        gif: require('../assets/3.gif'),
        title: 'Tap the Share Button',
        description: 'Tap on the share button to share the video link.',
        emoji: '🔗',
        accent: '#8B5CF6',
        accentBg: '#F5F3FF',
    },
    {
        gif: require('../assets/2.gif'),
        title: 'Tap on the Where App',
        description: 'Tap on the Where app and we\'ll extract all the places for you!',
        emoji: '✨',
        accent: '#10B981',
        accentBg: '#ECFDF5',
    },
];

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
    setShowProfile,
    setShowPremiumOverlay
}) => {
    const isPremium = useUserStore((state) => state.isPremium);
    const [showImportGuide, setShowImportGuide] = useState(false);
    const [guideStep, setGuideStep] = useState(0);
    const guideFlatListRef = useRef(null);
    
    return (
        <View style={styles.sheetContent}>
            {/* Search Row */}
            {savedViewMode === 'spots' && (
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
                            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <Defs>
                                    <SvgLinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <Stop offset="0%" stopColor="#8B5CF6" />
                                        <Stop offset="50%" stopColor="#D946EF" />
                                        <Stop offset="100%" stopColor="#F43F5E" />
                                    </SvgLinearGradient>
                                </Defs>
                                <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <Circle cx="12" cy="7" r="4" />
                            </Svg>
                        </Animated.View>
                        <Animated.View style={[StyleSheet.absoluteFill, closeAnimatedStyle, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
                            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#grad2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <Defs>
                                    <SvgLinearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <Stop offset="0%" stopColor="#8B5CF6" />
                                        <Stop offset="50%" stopColor="#D946EF" />
                                        <Stop offset="100%" stopColor="#F43F5E" />
                                    </SvgLinearGradient>
                                </Defs>
                                <Path d="M18 6 6 18M6 6l12 12" />
                            </Svg>
                        </Animated.View>
                    </TouchableOpacity>
                </View>
            </View>
            )}
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
                <BottomSheetScrollView style={styles.mySpotsList} contentContainerStyle={[styles.mySpotsListContent, savedViewMode !== 'spots' && { paddingTop: 24 }]} showsVerticalScrollIndicator={false}>
                    <View style={styles.mySpotsHeader}>
                        {savedViewMode === 'spots' ? (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View>
                                    <Text style={styles.mySpotsTitle}>My Spots</Text>
                                    <Text style={styles.mySpotsSubtitle}>
                                        {totalSpotsCount} {totalSpotsCount === 1 ? 'Spot' : 'Spots'} Saved
                                    </Text>
                                </View>
                                <TouchableOpacity 
                                    style={styles.importedBtn} 
                                    activeOpacity={0.8} 
                                    onPress={() => setSavedViewMode('imports')}
                                >
                                    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                                        <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <Polyline points="7 10 12 15 17 10" />
                                        <Line x1="12" y1="15" x2="12" y2="3" />
                                    </Svg>
                                    <View style={styles.importedBtnBadge}>
                                        <LinearGradient
                                            colors={['#8B5CF6', '#D946EF', '#F43F5E']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={[StyleSheet.absoluteFill, { borderRadius: 8 }]}
                                        />
                                        <Text style={styles.importedBtnBadgeText}>{totalImportsCount}</Text>
                                    </View>
                                    <Text style={styles.importedBtnText}> Imported</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <TouchableOpacity 
                                    style={styles.backBtn} 
                                    activeOpacity={0.8} 
                                    onPress={() => setSavedViewMode('spots')}
                                >
                                    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <Path d="m15 18-6-6 6-6"/>
                                    </Svg>
                                </TouchableOpacity>
                                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View>
                                        <Text style={styles.mySpotsTitle}>Imported Reels & TikToks</Text>
                                        {!isPremium ? (
                                            <View style={styles.freeLimitContainer}>
                                                <View style={styles.freeLimitProgressTrack}>
                                                    <View style={[styles.freeLimitProgressBar, { width: `${Math.min((totalImportsCount / 5) * 100, 100)}%` }]} />
                                                </View>
                                                <Text style={styles.freeLimitText}>
                                                    {totalImportsCount >= 5 ? '5 / 5 free imports used' : `${totalImportsCount} / 5 free imports saved`}
                                                </Text>
                                            </View>
                                        ) : (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                <View style={styles.premiumBadgeIcon}>
                                                    <Svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                        <Path d="M20 6 9 17l-5-5"/>
                                                    </Svg>
                                                </View>
                                                <Text style={styles.premiumText}>Unlimited Imports</Text>
                                                <Text style={styles.premiumCountText}> • {totalImportsCount} Saved</Text>
                                            </View>
                                        )}
                                    </View>
                                    {!isPremium && (
                                        <TouchableOpacity 
                                            style={styles.upgradeBtnSmall} 
                                            activeOpacity={0.8}
                                            onPress={() => setShowPremiumOverlay(true)}
                                        >
                                            <View style={styles.upgradeBtnSmallInner}>
                                                <Svg width="11" height="11" viewBox="0 0 24 24" fill="#FFFFFF" style={{ marginRight: 4 }}>
                                                    <Path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5ZM19 19C19 19.5523 18.5523 20 18 20H6C5.44772 20 5 19.5523 5 19V18H19V19Z" />
                                                </Svg>
                                                <Text style={styles.upgradeBtnSmallText}>Upgrade</Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        )}
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
                                                    <TouchableOpacity key={cityKey} activeOpacity={0.85} onPress={() => { bottomSheetRef.current?.close(); tabBarTranslateY.value = withTiming(tabBarHeight, { duration: 400, easing: Easing.bezier(0.33, 1, 0.68, 1) }); setTimeout(() => { createTripSheetRef.current?.openWithSavedSpots(country, city, cities); }, 350); }} style={styles.cityCard}>
                                                        {cityData.cityPhoto ? <Image source={{ uri: cityData.cityPhoto }} style={styles.cityCardImage} /> : <View style={styles.cityCardImagePlaceholder}><Text style={styles.cityCardEmoji}>🏙️</Text></View>}
                                                        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)']} locations={[0, 0.6, 1]} style={styles.cityCardGradient} />
                                                        <View style={styles.cityCardInfo}>
                                                            <Text style={styles.cityCardTitle} numberOfLines={1}>{city}</Text>
                                                            <Text style={styles.cityCardSubtitle}>{cityData.spots.length} {cityData.spots.length === 1 ? 'Spot' : 'Spots'}</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>
                                );
                            })
                        )
                    ) : importedVideos.length === 0 ? (
                        <View style={styles.emptyImports}>
                            <View style={styles.emptyImportsIconWrap}>
                                <Text style={{ fontSize: 36 }}>🎬</Text>
                            </View>
                            <Text style={styles.emptyImportsTitle}>No imported videos yet</Text>
                            <Text style={styles.emptyImportsDesc}>
                                Save travel reels & TikToks here.{'\n'}We'll extract all the places for you!
                            </Text>
                            <TouchableOpacity
                                style={styles.emptyImportsGuideBtn}
                                activeOpacity={0.8}
                                onPress={() => {
                                    setGuideStep(0);
                                    setShowImportGuide(true);
                                }}
                            >
                                <Text style={styles.emptyImportsGuideBtnText}>See How It Works</Text>
                                <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <Path d="m9 18 6-6-6-6"/>
                                </Svg>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        importedVideos.map((item) => {
                            const importTitle = item.title || item.destination || 'Untitled import';
                            return (
                                <TouchableOpacity key={item._id} style={styles.importCard} activeOpacity={0.85} onPress={() => onImportPress(item)}>
                                    {item.thumbnailUrl ? (
                                        <Image 
                                            source={{ 
                                                uri: item.thumbnailUrl,
                                                headers: {
                                                    Referer: item.platform === 'instagram' ? 'https://www.instagram.com/' : 
                                                             item.platform === 'tiktok' ? 'https://www.tiktok.com/' : 
                                                             'https://www.google.com/'
                                                }
                                            }} 
                                            style={styles.importCardImage} 
                                        />
                                    ) : (
                                        <View style={styles.importCardImagePlaceholder}>
                                            <Text style={styles.importCardImageEmoji}>{item.platform === 'tiktok' ? '♪' : '▣'}</Text>
                                        </View>
                                    )}
                                    <View style={styles.importCardInfo}>
                                        <View style={styles.importCardTopRow}>
                                            <Text style={styles.importPlatformPill}>{item.platform === 'tiktok' ? 'TikTok' : item.platform === 'instagram' ? 'Reel' : 'Video'}</Text>
                                            <Text style={styles.importCardMeta}>{item.totalExtractedPlaces || 0} extracted </Text>
                                        </View>
                                        <Text style={styles.importCardTitle} numberOfLines={2}>{importTitle}</Text>
                                        {!!item.caption && <Text style={styles.importCardCaption} numberOfLines={2}>{item.caption}</Text>}
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </BottomSheetScrollView>
            )}

            {/* Import Guide Modal */}
            <Modal
                visible={showImportGuide}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowImportGuide(false)}
            >
                <View style={styles.guideOverlay}>
                    <View style={styles.guideContainer}>
                        {/* Close button */}
                        <TouchableOpacity
                            style={styles.guideCloseBtn}
                            activeOpacity={0.7}
                            onPress={() => setShowImportGuide(false)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <Path d="M18 6 6 18M6 6l12 12" />
                            </Svg>
                        </TouchableOpacity>

                        {/* Header */}
                        <Text style={styles.guideHeaderTitle}>How to Import</Text>
                        <Text style={styles.guideHeaderSub}>3 simple steps to save any reel or TikTok</Text>

                        {/* Step Indicators */}
                        <View style={styles.guideStepIndicators}>
                            {IMPORT_GUIDE_STEPS.map((_, idx) => (
                                <View
                                    key={idx}
                                    style={[
                                        styles.guideStepDot,
                                        guideStep === idx && styles.guideStepDotActive,
                                    ]}
                                />
                            ))}
                        </View>

                        {/* GIF Carousel */}
                        <FlatList
                            ref={guideFlatListRef}
                            data={IMPORT_GUIDE_STEPS}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            scrollEnabled={false}
                            keyExtractor={(_, idx) => String(idx)}
                            renderItem={({ item, index }) => (
                                <View style={styles.guideSlide}>
                                    <View style={[styles.guideGifWrap, { borderColor: item.accent + '20' }]}>
                                        <View style={styles.guideGifInner}>
                                            <Image
                                                source={item.gif}
                                                style={styles.guideGif}
                                                resizeMode="cover"
                                            />
                                        </View>
                                    </View>
                                    <View style={styles.guideSlideInfo}>
                                        <View style={[styles.guideStepBadge, { backgroundColor: item.accentBg }]}>
                                            <Text style={styles.guideStepEmoji}>{item.emoji}</Text>
                                            <Text style={[styles.guideStepBadgeText, { color: item.accent }]}>Step {index + 1}</Text>
                                        </View>
                                        <Text style={styles.guideSlideTitle}>{item.title}</Text>
                                        <Text style={styles.guideSlideDesc}>{item.description}</Text>
                                    </View>
                                </View>
                            )}
                        />

                        {/* Navigation Buttons */}
                        <View style={styles.guideNavRow}>
                            {guideStep > 0 ? (
                                <TouchableOpacity
                                    style={styles.guidePrevBtn}
                                    activeOpacity={0.8}
                                    onPress={() => {
                                        const next = guideStep - 1;
                                        setGuideStep(next);
                                        guideFlatListRef.current?.scrollToIndex({ index: next, animated: true });
                                    }}
                                >
                                    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <Path d="m15 18-6-6 6-6"/>
                                    </Svg>
                                    <Text style={styles.guidePrevBtnText}>Back</Text>
                                </TouchableOpacity>
                            ) : (
                                <View />
                            )}
                            {guideStep < IMPORT_GUIDE_STEPS.length - 1 ? (
                                <TouchableOpacity
                                    style={styles.guideNextBtn}
                                    activeOpacity={0.8}
                                    onPress={() => {
                                        const next = guideStep + 1;
                                        setGuideStep(next);
                                        guideFlatListRef.current?.scrollToIndex({ index: next, animated: true });
                                    }}
                                >
                                    <Text style={styles.guideNextBtnText}>Next</Text>
                                    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <Path d="m9 18 6-6-6-6"/>
                                    </Svg>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={styles.guideNextBtn}
                                    activeOpacity={0.8}
                                    onPress={() => setShowImportGuide(false)}
                                >
                                    <Text style={styles.guideNextBtnText}>Got it!</Text>
                                    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <Path d="M20 6 9 17l-5-5"/>
                                    </Svg>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
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
    importedBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    importedBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1E293B',
    },
    importedBtnBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        marginRight: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    importedBtnBadgeText: {
        fontSize: 13,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
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
        height: 150,
        marginRight: 12,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#F1F5F9',
        position: 'relative',
    },
    cityCardImage: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
    cityCardImagePlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#E2E8F0',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
    },
    cityCardGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '75%',
    },
    cityCardEmoji: {
        fontSize: 32,
    },
    cityCardInfo: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    cityCardTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#FFFFFF',
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    cityCardSubtitle: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.9)',
        marginTop: 2,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    importCard: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#EEF2F7',
    },
    importCardImage: {
        width: 64,
        height: 80,
        borderRadius: 10,
        backgroundColor: '#E2E8F0',
    },
    importCardImagePlaceholder: {
        width: 64,
        height: 80,
        borderRadius: 10,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    importCardImageEmoji: {
        fontSize: 20,
        color: '#475569',
    },
    importCardInfo: {
        flex: 1,
        marginLeft: 10,
        justifyContent: 'space-between',
    },
    importCardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    importPlatformPill: {
        fontSize: 9,
        fontWeight: '800',
        color: '#334155',
        backgroundColor: '#E2E8F0',
        overflow: 'hidden',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 999,
    },
    importStatusText: {
        fontSize: 10,
        color: '#64748B',
        fontWeight: '700',
        textTransform: 'capitalize',
    },
    importCardTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
        lineHeight: 18,
    },
    importCardCaption: {
        fontSize: 11,
        color: '#64748B',
        lineHeight: 14,
        marginTop: 2,
    },
    importCardMeta: {
        fontSize: 10,
        color: '#94A3B8',
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
    emptyImports: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20,
    },
    emptyImportsIconWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#F5F3FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyImportsTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 8,
        letterSpacing: -0.3,
    },
    emptyImportsDesc: {
        fontSize: 14,
        fontWeight: '500',
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    emptyImportsGuideBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F3FF',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        gap: 6,
        borderWidth: 1,
        borderColor: '#EDE9FE',
    },
    emptyImportsGuideBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#8B5CF6',
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
    freeLimitContainer: {
        marginTop: 6,
        paddingRight: 32, 
    },
    freeLimitProgressTrack: {
        height: 6,
        backgroundColor: '#E2E8F0',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 6,
    },
    freeLimitProgressBar: {
        height: '100%',
        backgroundColor: '#3B82F6',
        borderRadius: 3,
    },
    freeLimitText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
    premiumBadgeIcon: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
    },
    premiumText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#10B981',
    },
    premiumCountText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#94A3B8',
    },
    upgradeBtnSmall: {
        borderRadius: 20,
        backgroundColor: '#00C3F9',
        elevation: 4,
        shadowColor: '#00C3F9',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    upgradeBtnSmallInner: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    upgradeBtnSmallText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.4,
    },
    // Import Guide Button
    importGuideBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#F5F3FF',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#EDE9FE',
        gap: 6,
    },
    importGuideBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#8B5CF6',
    },
    // Import Guide Modal
    guideOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    guideContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingTop: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        paddingHorizontal: 20,
        maxHeight: SCREEN_HEIGHT * 0.88,
    },
    guideCloseBtn: {
        position: 'absolute',
        top: 18,
        right: 18,
        zIndex: 10,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    guideHeaderTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.5,
        marginBottom: 4,
    },
    guideHeaderSub: {
        fontSize: 14,
        color: '#94A3B8',
        fontWeight: '500',
        marginBottom: 16,
    },
    guideStepIndicators: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 16,
    },
    guideStepDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#E2E8F0',
    },
    guideStepDotActive: {
        width: 24,
        backgroundColor: '#8B5CF6',
        borderRadius: 4,
    },
    guideSlide: {
        width: SCREEN_WIDTH - 40,
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    guideGifWrap: {
        width: SCREEN_WIDTH - 60,
        height: SCREEN_HEIGHT * 0.40,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    guideGifInner: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    guideGif: {
        width: '100%',
        height: '105%',
    },
    guideSlideInfo: {
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    guideStepBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F3FF',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
        marginBottom: 8,
        gap: 6,
    },
    guideStepEmoji: {
        fontSize: 14,
    },
    guideStepBadgeText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#8B5CF6',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    guideSlideTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 4,
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    guideSlideDesc: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 16,
        fontWeight: '500',
    },
    guideNavRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
    },
    guidePrevBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        gap: 4,
    },
    guidePrevBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748B',
    },
    guideNextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: '#8B5CF6',
        gap: 6,
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    guideNextBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default SpotsExploreContent;
