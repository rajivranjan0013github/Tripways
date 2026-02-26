import React, { forwardRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AddSpotsSheet = forwardRef(({ onChange, tabBarHeight, animationConfigs }, ref) => {
    const insets = useSafeAreaInsets();
    const snapPoints = useMemo(() => ['65%'], []);

    const renderBackdrop = React.useCallback(
        (props) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.4}
            />
        ),
        []
    );

    return (
        <BottomSheet
            ref={ref}
            index={-1}
            snapPoints={snapPoints}
            enablePanDownToClose={true}
            backdropComponent={renderBackdrop}
            backgroundStyle={styles.addSpotsSheetBackground}
            handleIndicatorStyle={styles.sheetHandleIndicator}
            onChange={onChange}
            animationConfigs={animationConfigs}
        >
            <BottomSheetView style={[styles.addSpotsContent, { paddingBottom: insets.bottom + 20 }]}>
                <Text style={styles.addSpotsTitle}>Add Spots</Text>

                <TouchableOpacity style={styles.searchLocationBtn}>
                    <View style={styles.searchLocationIcon}>
                        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <Circle cx="12" cy="10" r="3" />
                        </Svg>
                    </View>
                    <View style={styles.searchLocationText}>
                        <Text style={styles.spotCardTitle}>Search Location</Text>
                        <Text style={styles.spotCardSubtitle}>Find on Google Maps</Text>
                    </View>
                </TouchableOpacity>

                <View style={styles.manualDividerContainer}>
                    <View style={styles.manualDividerLine} />
                    <Text style={styles.manualDividerText}>OR IMPORT FROM</Text>
                    <View style={styles.manualDividerLine} />
                </View>

                <View style={styles.spotsGrid}>
                    <TouchableOpacity style={styles.spotCard}>
                        <View style={styles.spotIconStack}>
                            <View style={[styles.miniAppIcon, { backgroundColor: '#000', zIndex: 2 }]}>
                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>d</Text>
                            </View>
                            <View style={[styles.miniAppIcon, { backgroundColor: '#fd2e62', marginLeft: 15, zIndex: 1 }]}>
                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>i</Text>
                            </View>
                        </View>
                        <Text style={styles.spotCardTitle}>Social Search</Text>
                        <Text style={styles.spotCardSubtitle}>Search TikTok & Instagram in-app</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.spotCard}>
                        <View style={[styles.spotIconContainer, { backgroundColor: '#f3f4f6' }]}>
                            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </Svg>
                        </View>
                        <Text style={styles.spotCardTitle}>Paste any URL</Text>
                        <Text style={styles.spotCardSubtitle}>Articles, blogs, TikTok, Instagram & more</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.spotCard}>
                        <View style={[styles.spotIconContainer, { backgroundColor: '#FFF7ED' }]}>
                            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <Path d="M14 2v6h6" />
                                <Path d="M8 13h8" />
                                <Path d="M8 17h8" />
                                <Path d="M10 9H8" />
                            </Svg>
                        </View>
                        <Text style={styles.spotCardTitle}>Notes</Text>
                        <Text style={styles.spotCardSubtitle}>Paste your list</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.spotCard}>
                        <View style={[styles.spotIconContainer, { backgroundColor: '#F0F9FF' }]}>
                            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <Circle cx="8.5" cy="8.5" r="1.5" />
                                <Path d="m21 15-5-5L5 21" />
                            </Svg>
                        </View>
                        <Text style={styles.spotCardTitle}>Screenshots</Text>
                        <Text style={styles.spotCardSubtitle}>Extract from Images</Text>
                    </TouchableOpacity>
                </View>
            </BottomSheetView>
        </BottomSheet>
    );
});

const styles = StyleSheet.create({
    addSpotsSheetBackground: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
    },
    addSpotsContent: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 20,
    },
    sheetHandleIndicator: {
        width: 40,
        height: 5,
        backgroundColor: '#E2E8F0',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 20,
    },
    addSpotsTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0F172A',
        textAlign: 'center',
        marginBottom: 24,
    },
    spotsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
    },
    spotCard: {
        width: (SCREEN_WIDTH - 52) / 2,
        backgroundColor: '#F8FAFC',
        borderRadius: 24,
        padding: 16,
        height: 160,
    },
    spotIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    spotIconStack: {
        flexDirection: 'row',
        marginBottom: 12,
        height: 44,
        alignItems: 'center',
    },
    miniAppIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    spotCardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 4,
    },
    spotCardSubtitle: {
        fontSize: 12,
        color: '#64748B',
        lineHeight: 16,
        fontWeight: '500',
    },
    manualDividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    manualDividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#F1F5F9',
    },
    manualDividerText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94A3B8',
        marginHorizontal: 12,
    },
    searchLocationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 24,
        padding: 16,
    },
    searchLocationIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#FFF1F2',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    searchLocationText: {
        flex: 1,
    },
});

export default AddSpotsSheet;
