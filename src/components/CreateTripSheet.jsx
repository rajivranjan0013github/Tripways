import React, { forwardRef, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, FlatList, Platform, Image, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, {
    FadeIn,
    FadeOut,
} from 'react-native-reanimated';
import WheelPicker from '@quidone/react-native-wheel-picker';
import { Calendar } from 'react-native-calendars';

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
    const inputRef = useRef(null);

    const snapPoints = useMemo(() => ['92%'], []);

    const locations = [
        { name: 'France', flag: '🇫🇷', active: false },
        { name: 'Thailand', flag: '🇹🇭', active: true },
        { name: 'Canada', flag: '🇨🇦', active: false },
        { name: 'Japan', flag: '🇯🇵', active: false },
    ];

    const searchResults = [
        { id: '1', name: 'Varanasi', country: 'India', flag: '🇮🇳' },
        { id: '2', name: 'Puerto Varas', country: 'Chile', flag: '🇨🇱' },
        { id: '3', name: 'Varaždin', country: 'Croatia', flag: '🇭🇷' },
        { id: '4', name: 'Varadero', country: 'Cuba', flag: '🇨🇺' },
        { id: '5', name: 'Varaždin County', country: 'Croatia', flag: '🇭🇷' },
    ];

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
                    onPress={() => setStep('discoverSpots')}
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

    const spotCategories = ['All', 'Attractions', 'Cafe', 'Museum', 'Nature', 'Shopping'];

    const spots = [
        { id: 1, name: 'Varanasi railway station', desc: '', image: 'https://lh5.googleusercontent.com/p/AF1QipMvGezknCpaTKcM7g0dMSqR9psMaGebsMW4AF1v=w408-h306-k-no' },
        { id: 2, name: 'Sarnath Buddhist Temple Va...', desc: 'Expansive Buddhist temple complex with a museum, multiple shrines & an archaeolo...', image: 'https://lh5.googleusercontent.com/p/AF1QipNxBT6-mU-kg-8OI8F_HFkHWl7HVXZ9jz3GKGQ=w408-h544-k-no' },
        { id: 3, name: 'Kerala Cafe Since 1962', desc: 'Cafe', image: 'https://lh5.googleusercontent.com/p/AF1QipP11BWKNZ_A2hCGR7jeNnB3bMbMbwhC2EKYXk4k=w408-h272-k-no' },
        { id: 4, name: 'Banaras Railway Station', desc: '', image: 'https://lh5.googleusercontent.com/p/AF1QipMvGezknCpaTKcM7g0dMSqR9psMaGebsMW4AF1v=w408-h306-k-no' },
        { id: 5, name: 'Sarnath Museum', desc: 'Museum in Sarnath. See the original Lion Capital of Ashoka Pillar.', image: 'https://lh5.googleusercontent.com/p/AF1QipNxBT6-mU-kg-8OI8F_HFkHWl7HVXZ9jz3GKGQ=w408-h544-k-no' },
        { id: 6, name: 'Taste king', desc: 'Restaurant', image: 'https://lh5.googleusercontent.com/p/AF1QipP11BWKNZ_A2hCGR7jeNnB3bMbMbwhC2EKYXk4k=w408-h272-k-no' },
        { id: 7, name: 'Shree Shivay Thali Dining Var...', desc: 'Vegetarian courses are served in bronze bowls during the set thali meals at this wa...', image: 'https://lh5.googleusercontent.com/p/AF1QipMvGezknCpaTKcM7g0dMSqR9psMaGebsMW4AF1v=w408-h306-k-no' },
    ];

    const toggleSpot = (id) => {
        setSelectedSpots(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    const renderDiscoverSpots = () => (
        <Animated.View entering={FadeIn} style={[styles.content, { paddingHorizontal: 0, paddingTop: 0 }]}>
            <View style={styles.discoverHeader}>
                <Text style={styles.discoverTitle}>Discover spots</Text>

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
            </View>

            <ScrollView style={styles.spotsList} contentContainerStyle={{ paddingBottom: 100 }}>
                {/* City Section */}
                <View style={styles.cityHeader}>
                    <View style={styles.cityHeaderLeft}>
                        <View style={styles.cityCheck}>
                            <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <Path d="M20 6L9 17l-5-5" />
                            </Svg>
                        </View>
                        <Text style={styles.cityName}>{selectedLocation?.name || 'Varanasi'}</Text>
                    </View>
                    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M6 9l6 6 6-6" />
                    </Svg>
                </View>

                {/* Spots List */}
                {spots.map((spot, idx) => {
                    const isChecked = selectedSpots.includes(spot.id);
                    return (
                        <TouchableOpacity key={spot.id} style={styles.spotRow} onPress={() => toggleSpot(spot.id)}>
                            <Text style={styles.spotNumber}>{idx + 1}.</Text>
                            <Image source={{ uri: spot.image }} style={styles.spotImage} />
                            <View style={styles.spotInfo}>
                                <Text style={styles.spotName} numberOfLines={1}>✨ {spot.name}</Text>
                                {spot.desc ? <Text style={styles.spotDesc} numberOfLines={2}>{spot.desc}</Text> : null}
                            </View>
                            <View style={[styles.spotCheck, isChecked && styles.spotCheckActive]}>
                                {isChecked && (
                                    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <Path d="M20 6L9 17l-5-5" />
                                    </Svg>
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Bottom Add Button */}
            <View style={styles.addSpotsBar}>
                <TouchableOpacity
                    style={styles.addSpotsButton}
                    onPress={() => {
                        onTripCreated?.({
                            numDays,
                            locationName: selectedLocation?.name || 'Varanasi'
                        });
                        ref.current?.close();
                    }}
                >
                    <Text style={styles.addSpotsText}>Add {selectedSpots.length > 0 ? selectedSpots.length : spots.length} spots</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

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
            onChange={(index) => {
                onChange(index);
                if (index === -1) {
                    setStep('home');
                    setSearchQuery('');
                    setDaysSelected(false);
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
        gap: 12,
        marginBottom: 32,
    },
    tagChip: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 10,
        paddingVertical: 12,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
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
        borderWidth: 2,
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
        marginBottom: 16,
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
        width: 28,
        height: 28,
        borderRadius: 14,
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
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
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
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        paddingTop: 12,
        backgroundColor: '#FFFFFF',
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
});

export default CreateTripSheet;
