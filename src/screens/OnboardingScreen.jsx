import React, { useCallback, useRef, useState } from 'react';
import {
    Animated as RNAnimated,
    Dimensions,
    Image,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('screen');
const IMAGE_WIDTH = width;
const IMAGE_HEIGHT = width * (686 / 578);
const VISUAL_TOP = Math.max(
    Math.min(height * 0.28, height - IMAGE_HEIGHT - 90),
    180
);

const FONT_DISPLAY = Platform.select({
    ios: 'Plus Jakarta Sans',
    android: 'PlusJakartaSans-Regular',
    default: 'System',
});

const FONT_DISPLAY_BOLD = Platform.select({
    ios: 'Plus Jakarta Sans',
    android: 'PlusJakartaSans-Bold',
    default: 'System',
});

const FONT_DISPLAY_SEMIBOLD = Platform.select({
    ios: 'Plus Jakarta Sans',
    android: 'PlusJakartaSans-SemiBold',
    default: 'System',
});

const FONT_SERIF = Platform.select({
    ios: 'Cormorant Garamond',
    android: 'CormorantGaramond-SemiBold',
    default: 'serif',
});

const slides = [
    {
        id: 'save',
        tag: 'SAVE',
        headline: 'Share a travel video.\nSave every spot.',
        body: "Send Reels or TikToks to TripWays\nand we'll extract the places into\nyour travel map.",
        image: require('../assets/onboarding-plan.png'),
    },
    {
        id: 'plan',
        tag: 'PLAN',
        headline: 'Turn saved spots\ninto perfect trips',
        body: 'Build beautiful day-by-day routes\naround the places you already love.',
        image: require('../assets/onboarding-save.png'),
    },
];

const OnboardingScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const flatListRef = useRef(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 55 }).current;

    const onViewableItemsChanged = useCallback(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index ?? 0);
        }
    }, []);

    const handleContinue = useCallback(() => {
        if (currentIndex < slides.length - 1) {
            flatListRef.current?.scrollToIndex({
                index: currentIndex + 1,
                animated: true,
            });
            return;
        }

        navigation.replace('Login');
    }, [currentIndex, navigation]);

    const renderSlide = useCallback(({ item }) => (
        <View style={styles.slide}>
            <View style={styles.visualContainer} pointerEvents="none">
                <Image
                    source={item.image}
                    style={styles.visual}
                    resizeMode="contain"
                />
                <LinearGradient
                    colors={['#FFFFFF', 'rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0)']}
                    style={styles.topGradient}
                />
                <LinearGradient
                    colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.9)', '#FFFFFF']}
                    style={styles.bottomGradient}
                />
            </View>

            <View style={[styles.copyBlock, { paddingTop: Math.max(insets.top + 24, 60) }]}>
                <View style={styles.tagRow}>
                    <View style={styles.tagLine} />
                    <Text style={styles.tagText}>{item.tag}</Text>
                    <View style={styles.tagLine} />
                </View>

                <Text style={styles.headline}>{item.headline}</Text>
                <Text style={styles.body}>{item.body}</Text>
            </View>
        </View>
    ), [insets.top]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            <RNAnimated.FlatList
                ref={flatListRef}
                data={slides}
                renderItem={renderSlide}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                bounces={false}
                showsHorizontalScrollIndicator={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                style={styles.flatList}
            />

            <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom + 10, 26) }]}>
                <View style={styles.dotsRow}>
                    {slides.map((slide, index) => (
                        <View
                            key={slide.id}
                            style={[
                                styles.dot,
                                currentIndex === index ? styles.dotActive : styles.dotInactive,
                            ]}
                        />
                    ))}
                </View>

                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={handleContinue}
                    style={styles.continueButton}
                >
                    <Text style={styles.continueText}>
                        {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
                    </Text>
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
    flatList: {
        flex: 1,
    },
    slide: {
        width,
        height,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
    },
    copyBlock: {
        width: '100%',
        paddingHorizontal: 24,
        alignItems: 'center',
        zIndex: 2,
    },
    tagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        marginBottom: 10,
    },
    tagLine: {
        width: 38,
        height: 2,
        borderRadius: 1,
        backgroundColor: '#0F7CE8',
    },
    tagText: {
        color: '#117CE8',
        fontFamily: FONT_DISPLAY_BOLD,
        fontSize: 13,
        ...Platform.select({ ios: { fontWeight: '700' }, android: {} }),
    },
    headline: {
        color: '#07152C',
        fontFamily: FONT_SERIF,
        fontSize: Math.min(width * 0.09, 38),
        lineHeight: Math.min(width * 0.105, 44),
        ...Platform.select({ ios: { fontWeight: '600' }, android: {} }),
        textAlign: 'center',
        marginBottom: 10,
    },
    body: {
        color: '#657286',
        fontFamily: FONT_DISPLAY,
        fontSize: Math.min(width * 0.038, 16),
        lineHeight: Math.min(width * 0.058, 24),
        ...Platform.select({ ios: { fontWeight: '400' }, android: {} }),
        textAlign: 'center',
    },
    visualContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: VISUAL_TOP,
        height: IMAGE_HEIGHT,
    },
    visual: {
        width: '100%',
        height: '100%',
    },
    topGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
    },
    bottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
    },
    bottomContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 24,
        alignItems: 'center',
        gap: 16,
    },
    dotsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
    },
    dot: {
        height: 8,
        borderRadius: 4,
    },
    dotActive: {
        width: 22,
        backgroundColor: '#117CE8',
    },
    dotInactive: {
        width: 8,
        backgroundColor: '#C8D0D5',
    },
    continueButton: {
        width: '100%',
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000000',
        shadowColor: '#000000',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    continueText: {
        color: '#FFFFFF',
        fontFamily: FONT_DISPLAY_SEMIBOLD,
        fontSize: 17,
        ...Platform.select({ ios: { fontWeight: '600' }, android: {} }),
    },
});

export default OnboardingScreen;
