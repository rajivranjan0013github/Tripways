import React, { forwardRef, useMemo, useState, useRef, useEffect, useCallback, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, FlatList, Platform, Image, ScrollView, ActivityIndicator } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, {
    FadeIn,
    FadeOut,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
    interpolate,
} from 'react-native-reanimated';
import WheelPicker from '@quidone/react-native-wheel-picker';
import { Calendar } from 'react-native-calendars';
import Config from 'react-native-config';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();
const BACKEND_URL = Config.BACKEND_URL || 'http://localhost:3000';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FULL_SHEET_HEIGHT = SCREEN_HEIGHT * 0.92;

const CreateTripSheet = forwardRef(({ onChange, animationConfigs, onTripCreated }, ref) => {
    const [step, setStep] = useState('home'); // 'home', 'searching', 'preferences', 'howManyDays', 'discoverSpots'
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [numDays, setNumDays] = useState(4);
    const [selectionMode, setSelectionMode] = useState('days'); // 'days' or 'calendar'
    const [selectedDates, setSelectedDates] = useState({});
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [daysSelected, setDaysSelected] = useState(false);
    const [selectedPrefs, setSelectedPrefs] = useState([]);
    const [spotCategory, setSpotCategory] = useState('All');
    const [selectedSpots, setSelectedSpots] = useState([]);
    const [discoveredPlaces, setDiscoveredPlaces] = useState([]);
    const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
    const [isPlanning, setIsPlanning] = useState(false);
    const [isFromVideo, setIsFromVideo] = useState(false);
    const [isFromSavedSpots, setIsFromSavedSpots] = useState(false);
    const [isSavingSpots, setIsSavingSpots] = useState(false);
    const inputRef = useRef(null);
    const bottomSheetInternalRef = useRef(null);

    // Expose BottomSheet methods + custom openDiscoverSpots
    useImperativeHandle(ref, () => ({
        snapToIndex: (...args) => bottomSheetInternalRef.current?.snapToIndex(...args),
        snapToPosition: (...args) => bottomSheetInternalRef.current?.snapToPosition(...args),
        expand: (...args) => bottomSheetInternalRef.current?.expand(...args),
        collapse: (...args) => bottomSheetInternalRef.current?.collapse(...args),
        close: (...args) => bottomSheetInternalRef.current?.close(...args),
        forceClose: (...args) => bottomSheetInternalRef.current?.forceClose(...args),
        // DEV: Open directly to discover spots with trip data
        openDiscoverSpots: (trip) => {
            setSelectedLocation({ name: trip.destination });
            setNumDays(trip.days || 4);
            setSelectedPrefs((trip.interests || []).map(i => i.charAt(0).toUpperCase() + i.slice(1)));
            setStep('discoverSpots');
            bottomSheetInternalRef.current?.expand();
            // Trigger fetch after state is set
            setTimeout(() => {
                fetchDiscoverPlacesWithArgs(trip.destination, trip.interests || ['popular'], trip.days || 4);
            }, 100);
        },
        // Open with places already extracted from a video URL
        openWithVideoPlaces: (destination, places) => {
            setSelectedLocation({ name: destination });
            setNumDays(4);
            setDiscoveredPlaces(places);
            setSelectedSpots(places.map(p => p.id));
            setIsLoadingPlaces(false);
            setIsFromVideo(true);
            setIsFromSavedSpots(false);
            setStep('discoverSpots');
            bottomSheetInternalRef.current?.expand();
        },
        // Open Discover Spots with saved spots from a country, pre-selecting a specific city
        openWithSavedSpots: (country, selectedCity, cities) => {
            // Flatten all spots from all cities, mapping _id → id for compatibility
            const allSpots = [];
            Object.entries(cities).forEach(([city, cityData]) => {
                (cityData.spots || []).forEach(spot => {
                    allSpots.push({
                        ...spot,
                        id: spot._id || spot.id,
                        city: city,
                        country: country,
                        interest: spot.category || 'sightseeing',
                    });
                });
            });
            // Pre-select only the tapped city's spots
            const preSelected = allSpots
                .filter(s => s.city === selectedCity)
                .map(s => s.id);

            setSelectedLocation({ name: country });
            setNumDays(4);
            setDiscoveredPlaces(allSpots);
            setSelectedSpots(preSelected);
            setIsLoadingPlaces(false);
            setIsFromVideo(true);
            setIsFromSavedSpots(true);
            setStep('discoverSpots');
            bottomSheetInternalRef.current?.expand();
        },
    }));

    // Skeleton pulse animation
    const pulseAnim = useSharedValue(0);
    useEffect(() => {
        if (isLoadingPlaces) {
            pulseAnim.value = withRepeat(
                withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
                -1,
                true
            );
        } else {
            pulseAnim.value = 0;
        }
    }, [isLoadingPlaces]);

    const skeletonStyle = useAnimatedStyle(() => ({
        opacity: interpolate(pulseAnim.value, [0, 1], [0.3, 0.7]),
    }));

    const renderSkeletonSpot = useCallback((index) => (
        <View key={`skeleton-${index}`} style={styles.spotRow}>
            <Animated.View style={[styles.skeletonNumber, skeletonStyle]} />
            <Animated.View style={[styles.spotImage, styles.skeletonImage, skeletonStyle]} />
            <View style={styles.spotInfo}>
                <Animated.View style={[styles.skeletonTextLong, skeletonStyle]} />
                <Animated.View style={[styles.skeletonTextMedium, skeletonStyle]} />
                <Animated.View style={[styles.skeletonTextShort, skeletonStyle]} />
            </View>
            <Animated.View style={[styles.spotCheck, styles.skeletonCheck, skeletonStyle]} />
        </View>
    ), [skeletonStyle]);

    const snapPoints = useMemo(() => ['92%'], []);

    const locations = [
        { name: 'France', flag: '🇫🇷', active: false },
        { name: 'Thailand', flag: '🇹🇭', active: true },
        { name: 'Canada', flag: '🇨🇦', active: false },
        { name: 'Japan', flag: '🇯🇵', active: false },
    ];

    const [searchResults, setSearchResults] = useState([]);

    // Fetch Google Places Autocomplete when searchQuery changes
    React.useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        const fetchPlaces = async () => {
            try {
                const apiKey = Config.GOOGLE_MAPS_API_KEY;
                if (!apiKey) {
                    console.warn("Google Maps API Key missing in react-native-config");
                    return;
                }
                const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(searchQuery)}&types=(regions)&key=${apiKey}`;

                const response = await fetch(url);
                const data = await response.json();

                if (data.status === 'OK') {
                    const mappedResults = data.predictions.map(prediction => ({
                        id: prediction.place_id,
                        name: prediction.structured_formatting.main_text,
                        country: prediction.structured_formatting.secondary_text,
                        flag: '📍'
                    }));
                    setSearchResults(mappedResults);
                } else {
                    console.warn("Places API Error:", data.status, data.error_message);
                }
            } catch (error) {
                console.error("Failed to fetch places", error);
            }
        };

        const timeoutId = setTimeout(fetchPlaces, 300); // 300ms debounce
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    const renderBackdrop = React.useCallback(
        (props) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.5}
            />
        ),
        []
    );

    const renderHome = () => (
        <Animated.View exiting={FadeOut} style={[styles.content, { justifyContent: 'flex-end', paddingTop: 0 }]}>
            <View style={[styles.locationContainer, { marginBottom: 40 }]}>
                {locations.map((loc, idx) => (
                    <View key={idx} style={styles.locationItem}>
                        <View style={styles.textRow}>
                            {loc.active && <Text style={styles.flagEmoji}>{loc.flag}</Text>}
                            <Text style={[
                                styles.locationText,
                                loc.active ? styles.activeText : styles.inactiveText
                            ]}>
                                {loc.name}
                            </Text>
                        </View>
                    </View>
                ))}
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerTitle}>Where are we going?</Text>
                <Text style={styles.footerSubtitle}>Search for your destination</Text>

                <TouchableOpacity
                    style={styles.searchBar}
                    onPress={() => {
                        setStep('searching');
                        setTimeout(() => inputRef.current?.focus(), 100);
                    }}
                >
                    <View style={styles.searchIconContainer}>
                        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M21 21l-6-6" />
                            <Circle cx="11" cy="11" r="8" />
                        </Svg>
                    </View>
                    <Text style={styles.searchText}>Search</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

    const renderSearching = () => (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.content, { justifyContent: 'flex-start', paddingTop: 20 }]}>
            <View style={styles.searchHeader}>
                <View style={styles.searchInputContainer}>
                    <TouchableOpacity onPress={() => setStep('home')} style={styles.backButton}>
                        <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M19 12H5M12 19l-7-7 7-7" />
                        </Svg>
                    </TouchableOpacity>
                    <TextInput
                        ref={inputRef}
                        style={styles.searchInput}
                        placeholder="Search destination"
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCorrect={false}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                            <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                <Circle cx="12" cy="12" r="10" fill="#94A3B8" opacity={0.6} />
                                <Path d="m15 9-6 6M9 9l6 6" stroke="#FFF" strokeWidth="2" strokeLinecap="round" />
                            </Svg>
                        </TouchableOpacity>
                    )}
                </View>

                <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.resultsList}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.resultItem}
                            onPress={() => {
                                setSelectedLocation(item);
                                setStep('preferences');
                            }}
                        >
                            <Text style={styles.resultName}>{item.name}</Text>
                            <Text style={styles.resultCountry}>{item.country}</Text>
                        </TouchableOpacity>
                    )}
                />
            </View>
        </Animated.View>
    );

    const renderPreferences = () => (
        <Animated.View entering={FadeIn} style={[styles.content, { justifyContent: 'flex-end' }]}>
            {selectedLocation && (
                <View style={styles.selectedLocationBar}>
                    <View style={styles.selectedLocationInfo}>
                        <Text style={styles.selectedBarFlag}>{selectedLocation.flag}</Text>
                        <Text style={styles.selectedBarName}>{selectedLocation.name}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setStep('searching')} style={styles.editButton}>
                        <View style={styles.editIconCircle}>
                            <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5">
                                <Path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </Svg>
                        </View>
                    </TouchableOpacity>
                </View>
            )}
            <View style={styles.footer}>
                {/* Trip Preferences Section */}
                <View style={styles.prefSection}>
                    <View style={styles.prefSectionHeader}>
                        <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                        </Svg>
                        <Text style={styles.prefSectionTitle}>Trip Preferences</Text>
                    </View>
                    <View style={styles.tagGrid}>
                        {[
                            { name: 'Popular', icon: '📌' },
                            { name: 'Museum', icon: '🎨' },
                            { name: 'Nature', icon: '⛰️' },
                            { name: 'Foodie', icon: '🍕' },
                            { name: 'History', icon: '🏛️' },
                            { name: 'Shopping', icon: '🛍️' },
                        ].map((tag, idx) => {
                            const isSelected = selectedPrefs.includes(tag.name);
                            return (
                                <TouchableOpacity
                                    key={idx}
                                    style={[styles.tagChip, isSelected && styles.tagChipSelected]}
                                    onPress={() => {
                                        setSelectedPrefs(prev =>
                                            prev.includes(tag.name)
                                                ? prev.filter(p => p !== tag.name)
                                                : [...prev, tag.name]
                                        );
                                    }}
                                >
                                    <Text style={styles.tagIcon}>{tag.icon}</Text>
                                    <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>{tag.name}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Trip Duration Section */}
                <TouchableOpacity style={styles.durationRow} onPress={() => setStep('howManyDays')}>
                    <View style={styles.durationRowLeft}>
                        <View style={styles.durationRowIcon}>
                            <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <Path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18" />
                            </Svg>
                        </View>
                        <View>
                            <Text style={styles.durationRowTitle}>Trip Duration</Text>
                            <Text style={styles.durationRowValue}>{daysSelected ? `${numDays} days` : 'Choose trip duration'}</Text>
                        </View>
                    </View>
                    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M9 18l6-6-6-6" />
                    </Svg>
                </TouchableOpacity>

                {/* Continue Button */}
                <TouchableOpacity
                    style={[styles.blackContinueButton, { marginTop: 24 }]}
                    onPress={() => {
                        setStep('discoverSpots');
                        fetchDiscoverPlaces();
                    }}
                >
                    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M5 12h14M12 5l7 7-7 7" />
                    </Svg>
                    <Text style={styles.blackContinueText}>Continue</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

    const renderHowManyDays = () => (
        <Animated.View entering={FadeIn} style={[styles.content, { justifyContent: 'space-between' }]}>
            <LinearGradient
                colors={['#CCFBF1', '#FFFFFF']}
                style={[StyleSheet.absoluteFill, { height: '50%' }]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
            />

            <View style={styles.howManyHeader}>
                <View style={styles.howManyTopRow}>
                    <TouchableOpacity onPress={() => setStep('preferences')} style={styles.backButtonLarge}>
                        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M15 18l-6-6 6-6" />
                        </Svg>
                    </TouchableOpacity>

                    <View style={styles.segmentContainer}>
                        <TouchableOpacity
                            style={selectionMode === 'calendar' ? styles.segmentItemActive : styles.segmentItem}
                            onPress={() => setSelectionMode('calendar')}
                        >
                            <Text style={selectionMode === 'calendar' ? styles.segmentTextActive : styles.segmentTextInactive}>Calender</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={selectionMode === 'days' ? styles.segmentItemActive : styles.segmentItem}
                            onPress={() => setSelectionMode('days')}
                        >
                            <Text style={selectionMode === 'days' ? styles.segmentTextActive : styles.segmentTextInactive}>Days</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={styles.howManyTitle}>
                    {selectionMode === 'calendar' && startDate && endDate
                        ? `${numDays} days`
                        : 'How many days?'}
                </Text>
            </View>

            {selectionMode === 'days' ? (
                <View style={styles.pickerContainer}>
                    <WheelPicker
                        data={Array.from({ length: 30 }, (_, i) => ({ value: i + 1, label: (i + 1).toString() }))}
                        value={numDays}
                        onValueChanged={({ item }) => setNumDays(item.value)}
                        width={SCREEN_WIDTH}
                        height={320}
                        itemHeight={80}
                        itemTextStyle={[styles.pickerText, styles.pickerTextInactive]}
                        selectedItemTextStyle={[styles.pickerText, styles.pickerTextActive]}
                    />
                </View>
            ) : (
                <View style={styles.calendarContainer}>
                    <Calendar
                        theme={{
                            backgroundColor: 'transparent',
                            calendarBackground: 'transparent',
                            textSectionTitleColor: '#94A3B8',
                            selectedDayBackgroundColor: '#0F172A',
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: '#2DD4BF',
                            dayTextColor: '#0F172A',
                            textDisabledColor: '#CBD5E1',
                            dotColor: '#2DD4BF',
                            selectedDotColor: '#ffffff',
                            arrowColor: '#0F172A',
                            monthTextColor: '#0F172A',
                            indicatorColor: '#0F172A',
                            textDayFontWeight: '600',
                            textMonthFontWeight: '700',
                            textDayHeaderFontWeight: '600',
                            textDayFontSize: 14,
                            textMonthFontSize: 16,
                            textDayHeaderFontSize: 12
                        }}
                        markingType={'period'}
                        markedDates={selectedDates}
                        onDayPress={(day) => {
                            const dateString = day.dateString;

                            if (!startDate || (startDate && endDate)) {
                                // Start new selection
                                setStartDate(dateString);
                                setEndDate(null);
                                setSelectedDates({
                                    [dateString]: { startingDay: true, color: '#0F172A', textColor: '#ffffff' }
                                });
                            } else {
                                // Complete range selection
                                if (dateString < startDate) {
                                    // New date is before start, make it the new start
                                    setStartDate(dateString);
                                    setSelectedDates({
                                        [dateString]: { startingDay: true, color: '#0F172A', textColor: '#ffffff' }
                                    });
                                } else if (dateString > startDate) {
                                    setEndDate(dateString);

                                    // Calculate range and fill dates
                                    let range = {};
                                    let start = new Date(startDate);
                                    let end = new Date(dateString);

                                    // Calculate difference in days
                                    const diffTime = Math.abs(end - start);
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                                    setNumDays(diffDays);

                                    let current = start;
                                    while (current <= end) {
                                        const curStr = current.toISOString().split('T')[0];
                                        if (curStr === startDate) {
                                            range[curStr] = { startingDay: true, color: '#0F172A', textColor: '#ffffff' };
                                        } else if (curStr === dateString) {
                                            range[curStr] = { endingDay: true, color: '#0F172A', textColor: '#ffffff' };
                                        } else {
                                            range[curStr] = { color: 'rgba(15, 23, 42, 0.1)', textColor: '#0F172A' };
                                        }
                                        current.setDate(current.getDate() + 1);
                                    }
                                    setSelectedDates(range);
                                }
                            }
                        }}
                    />
                </View>
            )}

            <View style={styles.footer}>
                <TouchableOpacity style={styles.blackConfirmButton} onPress={() => { setDaysSelected(true); setStep('preferences'); }}>
                    <Text style={styles.blackConfirmText}>Confirm</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

    // Preference name -> backend interest name mapping
    const PREF_TO_INTEREST = {
        'Popular': 'popular',
        'Museum': 'museum',
        'Nature': 'nature',
        'Foodie': 'food',
        'History': 'history',
        'Shopping': 'shopping',
    };

    const fetchDiscoverPlaces = async () => {
        if (!selectedLocation) return;
        setIsLoadingPlaces(true);
        setDiscoveredPlaces([]);
        setSelectedSpots([]);
        try {
            const backendUrl = Config.BACKEND_URL || 'http://localhost:3000';
            const interests = selectedPrefs.length > 0
                ? selectedPrefs.map(p => PREF_TO_INTEREST[p] || p.toLowerCase())
                : ['popular'];
            const response = await fetch(`${backendUrl}/api/discover-places`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    place: selectedLocation.name,
                    interests,
                    days: numDays,
                }),
            });
            const data = await response.json();
            if (data.success && data.places) {
                setDiscoveredPlaces(data.places);
                // Auto-select all places
                setSelectedSpots(data.places.map(p => p.id));
            }
        } catch (error) {
            console.error('Failed to discover places:', error);
        } finally {
            setIsLoadingPlaces(false);
        }
    };

    // DEV: Fetch discover places with explicit args (used by openDiscoverSpots)
    const fetchDiscoverPlacesWithArgs = async (placeName, interests, days) => {
        setIsLoadingPlaces(true);
        setDiscoveredPlaces([]);
        setSelectedSpots([]);
        try {
            const backendUrl = Config.BACKEND_URL || 'http://localhost:3000';
            const response = await fetch(`${backendUrl}/api/discover-places`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ place: placeName, interests, days }),
            });
            const data = await response.json();
            if (data.success && data.places) {
                setDiscoveredPlaces(data.places);
                setSelectedSpots(data.places.map(p => p.id));
            }
        } catch (error) {
            console.error('Failed to discover places:', error);
        } finally {
            setIsLoadingPlaces(false);
        }
    };

    const handlePlanTrip = async () => {
        setIsPlanning(true);
        try {
            const backendUrl = Config.BACKEND_URL || 'http://localhost:3000';
            const interests = selectedPrefs.length > 0
                ? selectedPrefs.map(p => PREF_TO_INTEREST[p] || p.toLowerCase())
                : ['popular'];
            // Get selected place objects
            const selectedPlaceObjects = discoveredPlaces.filter(p => selectedSpots.includes(p.id));

            const response = await fetch(`${backendUrl}/api/plan-stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    place: selectedLocation?.name || 'Unknown',
                    days: numDays,
                    interests,
                    discoveredPlaces: selectedPlaceObjects,
                }),
            });

            const reader = response.body?.getReader?.();
            // React Native fetch doesn't support ReadableStream natively,
            // so fall back to reading the full text response
            const text = await response.text();

            // Parse SSE events from the text
            let itineraryData = null;
            let geocodedData = null;
            let routedData = null;

            const events = text.split('\n\n').filter(Boolean);
            for (const eventBlock of events) {
                const lines = eventBlock.split('\n');
                let eventType = '';
                let eventData = '';
                for (const line of lines) {
                    if (line.startsWith('event: ')) eventType = line.slice(7);
                    if (line.startsWith('data: ')) eventData = line.slice(6);
                }
                if (!eventType || !eventData) continue;
                try {
                    const parsed = JSON.parse(eventData);
                    if (eventType === 'itinerary') itineraryData = parsed;
                    if (eventType === 'geocoded') geocodedData = parsed;
                    if (eventType === 'routed') routedData = parsed;
                } catch (e) {
                    console.warn('Failed to parse SSE event:', e);
                }
            }

            // Use the most complete data available
            const finalItinerary = routedData?.itinerary || geocodedData?.itinerary || itineraryData?.itinerary;
            const destination = itineraryData?.destination || selectedLocation?.name;
            const totalDays = itineraryData?.totalDays || numDays;

            onTripCreated?.({
                numDays: totalDays,
                locationName: destination,
                itinerary: finalItinerary,
                discoveredPlaces: selectedPlaceObjects,
            });

            // Auto-save trip to backend
            try {
                const userStr = storage.getString('user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    const userId = user?.id || user?._id;
                    if (userId) {
                        await fetch(`${BACKEND_URL}/api/trips`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                userId,
                                destination: destination || selectedLocation?.name,
                                days: totalDays || numDays,
                                interests: selectedPrefs.map(p => PREF_TO_INTEREST[p] || p.toLowerCase()),
                                itinerary: finalItinerary,
                                discoveredPlaces: selectedPlaceObjects,
                            }),
                        });
                    }
                }
            } catch (saveErr) {
                console.warn('Failed to save trip to backend:', saveErr);
            }

            ref.current?.close();
        } catch (error) {
            console.error('Failed to plan trip:', error);
        } finally {
            setIsPlanning(false);
        }
    };

    // Build dynamic spot categories from discovered data
    const spotCategories = useMemo(() => {
        if (isFromVideo) {
            // For video places, use country names as categories
            const cats = new Set(['All']);
            discoveredPlaces.forEach(p => {
                if (p.country) cats.add(p.country);
            });
            return Array.from(cats);
        }
        const cats = new Set(['All']);
        discoveredPlaces.forEach(p => {
            if (p.interest) cats.add(p.interest.charAt(0).toUpperCase() + p.interest.slice(1));
        });
        return Array.from(cats);
    }, [discoveredPlaces, isFromVideo]);

    // Filter spots by selected category
    const filteredSpots = useMemo(() => {
        if (spotCategory === 'All') return discoveredPlaces;
        if (isFromVideo) {
            return discoveredPlaces.filter(p => p.country === spotCategory);
        }
        return discoveredPlaces.filter(p => {
            const cat = p.interest?.charAt(0).toUpperCase() + p.interest?.slice(1);
            return cat === spotCategory;
        });
    }, [discoveredPlaces, spotCategory, isFromVideo]);

    const toggleSpot = (id) => {
        setSelectedSpots(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    const renderDiscoverSpots = () => (
        <Animated.View entering={FadeIn} style={[styles.content, { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }]}>
            <View style={styles.discoverHeader}>
                <View style={styles.discoverTitleRow}>
                    <Text style={styles.discoverTitle}>Discover spots</Text>
                    {isLoadingPlaces && (
                        <View style={styles.discoverLoadingBadge}>
                            <ActivityIndicator size="small" color="#FFFFFF" />
                            <Text style={styles.discoverLoadingBadgeText}>Loading</Text>
                        </View>
                    )}
                </View>

                {isLoadingPlaces ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryContainer}>
                        {[1, 2, 3, 4].map((i) => (
                            <Animated.View key={`cat-skel-${i}`} style={[styles.skeletonCategoryChip, skeletonStyle]} />
                        ))}
                    </ScrollView>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryContainer}>
                        {spotCategories.map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                style={[styles.categoryChip, spotCategory === cat && styles.categoryChipActive]}
                                onPress={() => setSpotCategory(cat)}
                            >
                                <Text style={[styles.categoryText, spotCategory === cat && styles.categoryTextActive]}>{cat}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>

            <View style={{ flex: 1 }}>
                {isLoadingPlaces ? (
                    <ScrollView style={styles.spotsList} contentContainerStyle={{ paddingBottom: 100 }}>
                        {/* Skeleton City Header */}
                        <View style={styles.cityHeader}>
                            <View style={styles.cityHeaderLeft}>
                                <Animated.View style={[styles.cityCheck, styles.skeletonCityCheck, skeletonStyle]} />
                                <Animated.View style={[styles.skeletonCityName, skeletonStyle]} />
                            </View>
                            <Animated.View style={[styles.skeletonSpotsCount, skeletonStyle]} />
                        </View>

                        {/* Skeleton Spot Rows */}
                        {[0, 1, 2, 3, 4, 5].map(renderSkeletonSpot)}
                    </ScrollView>
                ) : isFromVideo ? (
                    /* ── Grouped by Country → City for video places ── */
                    <ScrollView style={styles.spotsList} contentContainerStyle={{ paddingBottom: 100 }}>
                        {(() => {
                            // Group filteredSpots by country → city
                            const grouped = {};
                            filteredSpots.forEach(spot => {
                                const c = spot.country || 'Unknown';
                                const ci = spot.city || 'Unknown';
                                if (!grouped[c]) grouped[c] = {};
                                if (!grouped[c][ci]) grouped[c][ci] = [];
                                grouped[c][ci].push(spot);
                            });
                            let globalIdx = 0;
                            return Object.entries(grouped).map(([country, cities]) => (
                                <View key={country}>
                                    {/* Country Header */}
                                    <View style={[styles.cityHeader, { backgroundColor: '#F8FAFC', marginTop: 4 }]}>
                                        <View style={styles.cityHeaderLeft}>
                                            <Text style={{ fontSize: 16 }}>🌍</Text>
                                            <Text style={[styles.cityName, { fontWeight: '700', fontSize: 15, color: '#1E293B' }]}>{country}</Text>
                                        </View>
                                    </View>
                                    {Object.entries(cities).map(([city, spots]) => (
                                        <View key={`${country}-${city}`}>
                                            {/* City Sub-header */}
                                            <View style={[styles.cityHeader, { paddingLeft: 28 }]}>
                                                <View style={styles.cityHeaderLeft}>
                                                    <View style={styles.cityCheck}>
                                                        <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                            <Path d="M20 6L9 17l-5-5" />
                                                        </Svg>
                                                    </View>
                                                    <Text style={styles.cityName}>{city}</Text>
                                                </View>
                                                <Text style={{ fontSize: 12, color: '#94A3B8' }}>{spots.length} spots</Text>
                                            </View>
                                            {/* Spots */}
                                            {spots.map((spot) => {
                                                globalIdx++;
                                                const isChecked = selectedSpots.includes(spot.id);
                                                return (
                                                    <TouchableOpacity key={spot.id} style={styles.spotRow} onPress={() => toggleSpot(spot.id)} activeOpacity={0.7} delayPressIn={100}>
                                                        <Text style={styles.spotNumber}>{globalIdx}.</Text>
                                                        {spot.photoUrl ? (
                                                            <Image source={{ uri: spot.photoUrl }} style={styles.spotImage} />
                                                        ) : (
                                                            <View style={[styles.spotImage, styles.spotImagePlaceholder]}>
                                                                <Text style={styles.spotImagePlaceholderText}>📍</Text>
                                                            </View>
                                                        )}
                                                        <View style={styles.spotInfo}>
                                                            <Text style={styles.spotName} numberOfLines={1}>✨ {spot.name}</Text>
                                                            {spot.address ? <Text style={styles.spotDesc} numberOfLines={2}>{spot.address}</Text> : null}
                                                        </View>
                                                        <View style={[styles.spotCheck, isChecked && styles.spotCheckActive]}>
                                                            {isChecked && (
                                                                <Svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                                                    <Path d="M20 6L9 17l-5-5" />
                                                                </Svg>
                                                            )}
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    ))}
                                </View>
                            ));
                        })()}
                    </ScrollView>
                ) : (
                    <ScrollView style={styles.spotsList} contentContainerStyle={{ paddingBottom: 100 }}>
                        {/* City Section */}
                        <View style={styles.cityHeader}>
                            <View style={styles.cityHeaderLeft}>
                                <View style={styles.cityCheck}>
                                    <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <Path d="M20 6L9 17l-5-5" />
                                    </Svg>
                                </View>
                                <Text style={styles.cityName}>{selectedLocation?.name || 'Unknown'}</Text>
                            </View>
                            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <Path d="M6 9l6 6 6-6" />
                            </Svg>
                        </View>

                        {/* Spots List */}
                        {filteredSpots.map((spot, idx) => {
                            const isChecked = selectedSpots.includes(spot.id);
                            const shortDesc = spot.interest
                                ? spot.interest.charAt(0).toUpperCase() + spot.interest.slice(1)
                                : spot.address || '';
                            return (
                                <TouchableOpacity key={spot.id} style={styles.spotRow} onPress={() => toggleSpot(spot.id)} activeOpacity={0.7} delayPressIn={100}>
                                    <Text style={styles.spotNumber}>{idx + 1}.</Text>
                                    {spot.photoUrl ? (
                                        <Image source={{ uri: spot.photoUrl }} style={styles.spotImage} />
                                    ) : (
                                        <View style={[styles.spotImage, styles.spotImagePlaceholder]}>
                                            <Text style={styles.spotImagePlaceholderText}>📍</Text>
                                        </View>
                                    )}
                                    <View style={styles.spotInfo}>
                                        <Text style={styles.spotName} numberOfLines={1}>✨ {spot.name}</Text>
                                        {shortDesc ? <Text style={styles.spotDesc} numberOfLines={2}>{shortDesc}</Text> : null}
                                    </View>
                                    <View style={[styles.spotCheck, isChecked && styles.spotCheckActive]}>
                                        {isChecked && (
                                            <Svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                                <Path d="M20 6L9 17l-5-5" />
                                            </Svg>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}

            </View>
        </Animated.View>
    );

    return (
        <BottomSheet
            ref={bottomSheetInternalRef}
            index={-1}
            snapPoints={snapPoints}
            enableDynamicSizing={false}
            enablePanDownToClose={true}
            backdropComponent={renderBackdrop}
            backgroundStyle={styles.sheetBackground}
            handleIndicatorStyle={styles.handleIndicator}
            onChange={(index) => {
                onChange(index);
                if (index === -1) {
                    setStep('home');
                    setSearchQuery('');
                    setSelectedLocation(null);
                    setNumDays(4);
                    setSelectionMode('days');
                    setSelectedDates({});
                    setStartDate(null);
                    setEndDate(null);
                    setDaysSelected(false);
                    setSelectedPrefs([]);
                    setSpotCategory('All');
                    setSelectedSpots([]);
                    setDiscoveredPlaces([]);
                    setIsFromVideo(false);
                    setIsFromSavedSpots(false);
                }
            }}
            animationConfigs={animationConfigs}
        >
            <BottomSheetView style={[styles.container, { height: FULL_SHEET_HEIGHT }]}>


                {step === 'home' && renderHome()}
                {step === 'searching' && renderSearching()}
                {step === 'preferences' && renderPreferences()}
                {step === 'howManyDays' && renderHowManyDays()}
                {step === 'discoverSpots' && renderDiscoverSpots()}

                {/* Floating Plan Trip Button — rendered at BottomSheetView level */}
                {step === 'discoverSpots' && (
                    <View style={styles.addSpotsBar} pointerEvents="box-none">
                        {/* Save Spots button for video places */}
                        {isFromVideo && !isFromSavedSpots && selectedSpots.length > 0 && !isPlanning && !isLoadingPlaces && (
                            <TouchableOpacity
                                style={[styles.addSpotsButton, { backgroundColor: '#10B981', marginBottom: 8 }]}
                                onPress={async () => {
                                    const storedUser = (() => { try { const u = storage.getString('user'); return u ? JSON.parse(u) : null; } catch { return null; } })();
                                    const userId = storedUser?.id || storedUser?._id;
                                    if (!userId) return;
                                    setIsSavingSpots(true);
                                    try {
                                        const spotsToSave = discoveredPlaces.filter(p => selectedSpots.includes(p.id)).map(p => ({
                                            country: p.country || 'Unknown',
                                            city: p.city || 'Unknown',
                                            name: p.name,
                                            placeId: p.id,
                                            address: p.address,
                                            rating: p.rating,
                                            userRatingCount: p.userRatingCount,
                                            photoUrl: p.photoUrl,
                                            coordinates: p.coordinates,
                                            source: 'video',
                                        }));
                                        await fetch(`${BACKEND_URL}/api/spots`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ userId, spots: spotsToSave }),
                                        });
                                    } catch (e) { console.warn('Save spots failed:', e); }
                                    setIsSavingSpots(false);
                                }}
                                disabled={isSavingSpots}
                            >
                                {isSavingSpots ? (
                                    <View style={styles.planningRow}>
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                        <Text style={styles.addSpotsText}>  Saving spots...</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.addSpotsText}>💾 Save {selectedSpots.length} spots</Text>
                                )}
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.addSpotsButton, (isPlanning || isLoadingPlaces) && { opacity: 0.7 }]}
                            onPress={handlePlanTrip}
                            disabled={isPlanning || isLoadingPlaces || selectedSpots.length === 0}
                        >
                            {isPlanning ? (
                                <View style={styles.planningRow}>
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                    <Text style={styles.addSpotsText}>  Planning your trip...</Text>
                                </View>
                            ) : isLoadingPlaces ? (
                                <View style={styles.planningRow}>
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                    <Text style={styles.addSpotsText}>  Discovering spots...</Text>
                                </View>
                            ) : (
                                <Text style={styles.addSpotsText}>Plan Trip</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </BottomSheetView>
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
        width: 40,
        height: 5,
        backgroundColor: '#E2E8F0',
        borderRadius: 3,
        alignSelf: 'center',
        marginTop: 12,
    },
    container: {
        flex: 1,
        overflow: 'hidden',
    },
    mainGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        flex: 1,
        paddingBottom: Platform.select({ ios: 80, android: 80 }),
    },
    locationContainer: {
        paddingHorizontal: 32,
    },
    locationItem: {
        marginVertical: 8,
    },
    textRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    flagEmoji: {
        fontSize: 26,
        marginRight: 16,
    },
    locationText: {
        fontSize: 38,
        fontWeight: '800',
        letterSpacing: -1,
    },
    activeText: {
        color: '#0F172A',
    },
    inactiveText: {
        color: 'rgba(15, 23, 42, 0.15)',
    },
    footer: {
        paddingHorizontal: 22,
    },
    footerTitle: {
        fontSize: 26,
        fontWeight: '600',
        color: '#0F172A',
        marginBottom: 16,
        letterSpacing: -0.5,
    },
    footerSubtitle: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(15, 23, 42, 0.6)',
        marginBottom: 16,
    },
    searchBar: {
        backgroundColor: '#FFFFFF',
        height: 52,
        borderRadius: 26,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    searchIconContainer: {
        marginRight: 10,
    },
    searchText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    // Search View Styles
    searchHeader: {
        flex: 1,
        paddingHorizontal: 24,
    },
    searchInputContainer: {
        backgroundColor: '#FFFFFF',
        height: 54,
        borderRadius: 27,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 20,
        shadowColor: 'transparent',
    },
    backButton: {
        padding: 4,
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 17,
        fontWeight: '600',
        color: '#0F172A',
        paddingVertical: 10,
    },
    clearButton: {
        padding: 4,
    },
    resultsList: {
        paddingTop: 0,
        paddingBottom: 40,
    },
    resultItem: {
        marginBottom: 20,
        paddingHorizontal: 4,
    },
    resultName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0F172A',
        letterSpacing: -0.5,
    },
    resultCountry: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(15, 23, 42, 0.4)',
        marginTop: 1,
    },
    // Selected Location Bar (in Preferences)
    selectedLocationBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 14,
        marginHorizontal: 24,
        marginBottom: 20,
        marginTop: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.04)',
        borderRadius: 16,
    },
    selectedLocationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    selectedBarFlag: {
        fontSize: 22,
        marginRight: 10,
    },
    selectedBarName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    editButton: {
        marginLeft: 12,
    },
    editIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    continueButton: {
        backgroundColor: '#FFFFFF',
        height: 52,
        borderRadius: 26,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    continueText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },


    tagGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 32,
    },
    tagChip: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 10,
        paddingVertical: 12,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        flexGrow: 0,
        flexShrink: 0,
        marginRight: 10,
        marginBottom: 10,
    },
    tagIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    tagText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0F172A',
    },
    tagChipSelected: {
        borderColor: '#0F172A',
        backgroundColor: '#FFFFFF',
    },
    tagTextSelected: {
        fontWeight: '700',
    },

    blackContinueButton: {
        backgroundColor: '#000000',
        height: 56,
        borderRadius: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    blackContinueText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    prefSection: {
        marginBottom: 24,
    },
    prefSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
    },
    prefSectionTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0F172A',
    },
    durationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    durationRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    durationRowIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    durationRowTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0F172A',
    },
    durationRowValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
        marginTop: 2,
    },
    // How Many Days Styles
    howManyHeader: {
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    howManyTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 40,
    },
    backButtonLarge: {
        padding: 4,
    },
    segmentContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(15, 23, 42, 0.05)',
        padding: 4,
        borderRadius: 20,
    },
    segmentItem: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 16,
    },
    segmentItemActive: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    segmentTextInactive: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(15, 23, 42, 0.4)',
    },
    segmentTextActive: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    howManyTitle: {
        fontSize: 34,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -1,
    },
    pickerContainer: {
        height: 320,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pickerText: {
        fontSize: 48,
        fontWeight: '700',
    },
    pickerTextActive: {
        color: '#0F172A',
    },
    pickerTextInactive: {
        color: 'rgba(15, 23, 42, 0.2)',
    },
    calendarContainer: {
        height: 380,
        paddingHorizontal: 10,
    },
    blackConfirmButton: {
        backgroundColor: '#000000',
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    blackConfirmText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    // Discover Spots Styles
    discoverHeader: {
        paddingHorizontal: 24,
        paddingTop: 8,
    },
    discoverTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.5,
    },
    categoryScroll: {
        marginBottom: 8,
    },
    categoryContainer: {
        gap: 10,
        paddingRight: 24,
    },
    categoryChip: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
    },
    categoryChipActive: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
    },
    categoryText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    categoryTextActive: {
        color: '#FFFFFF',
    },
    spotsList: {
        flex: 1,
        paddingHorizontal: 24,
    },
    cityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    cityHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cityCheck: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cityName: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
    },
    spotRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
        gap: 12,
    },
    spotNumber: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94A3B8',
        width: 22,
    },
    spotImage: {
        width: 56,
        height: 56,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
    },
    spotInfo: {
        flex: 1,
    },
    spotName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 2,
    },
    spotDesc: {
        fontSize: 13,
        fontWeight: '500',
        color: '#94A3B8',
        lineHeight: 18,
    },
    spotCheck: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    spotCheckActive: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
    },
    addSpotsBar: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 28 : 16,
        left: 24,
        right: 24,
    },
    addSpotsButton: {
        backgroundColor: '#0F172A',
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addSpotsText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748B',
    },
    planningRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    spotRating: {
        fontSize: 12,
        fontWeight: '600',
        color: '#F59E0B',
        marginTop: 2,
    },
    spotImagePlaceholder: {
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    spotImagePlaceholderText: {
        fontSize: 22,
    },
    spotsCount: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94A3B8',
    },
    // Discover Spots Title Row
    discoverTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    discoverLoadingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    discoverLoadingBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    // Skeleton Placeholder Styles
    skeletonCategoryChip: {
        width: 72,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E2E8F0',
    },
    skeletonCityCheck: {
        backgroundColor: '#CBD5E1',
    },
    skeletonCityName: {
        width: 120,
        height: 20,
        borderRadius: 8,
        backgroundColor: '#E2E8F0',
    },
    skeletonSpotsCount: {
        width: 60,
        height: 16,
        borderRadius: 6,
        backgroundColor: '#E2E8F0',
    },
    skeletonNumber: {
        width: 18,
        height: 14,
        borderRadius: 4,
        backgroundColor: '#E2E8F0',
    },
    skeletonImage: {
        backgroundColor: '#E2E8F0',
    },
    skeletonTextLong: {
        width: '85%',
        height: 14,
        borderRadius: 6,
        backgroundColor: '#E2E8F0',
        marginBottom: 6,
    },
    skeletonTextMedium: {
        width: '65%',
        height: 12,
        borderRadius: 6,
        backgroundColor: '#E2E8F0',
        marginBottom: 4,
    },
    skeletonTextShort: {
        width: '40%',
        height: 12,
        borderRadius: 6,
        backgroundColor: '#E2E8F0',
    },
    skeletonCheck: {
        backgroundColor: '#E2E8F0',
        borderColor: '#E2E8F0',
    },
});

export default CreateTripSheet;
