import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withRepeat, 
    withTiming, 
    withSequence,
    Easing,
    withSpring,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const TUTORIAL_STEPS = [
    {
        title: 'Build Your First Trip',
        description: 'Tap the + button to create a new itinerary and plan your next adventure.',
        target: 'create',
        arrowDir: 'down',
        emoji: '🗺️',
    },
    {
        title: 'Discover Amazing Spots',
        description: 'Search for any destination, cafe, or hidden gem to add to your bucket list.',
        target: 'search',
        arrowDir: 'up',
        emoji: '🔍',
    },
    {
        title: 'Import from Socials',
        description: 'Instantly extract places from Instagram Reels or TikTok videos you love.',
        target: 'import',
        arrowDir: 'down',
        emoji: '🎥',
    }
];

export default function CoachMarkTutorial({ visible, onDismiss, tabBarHeight, onStepChange }) {
    const insets = useSafeAreaInsets();
    const [currentStep, setCurrentStep] = useState(0);
    
    // Animations
    const opacity = useSharedValue(0);
    const contentScale = useSharedValue(0.9);
    const arrowBounce = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            opacity.value = withTiming(1, { duration: 400 });
            contentScale.value = withSpring(1, { damping: 15 });
            
            arrowBounce.value = withRepeat(
                withSequence(
                    withTiming(-12, { duration: 600, easing: Easing.bezier(0.33, 1, 0.68, 1) }),
                    withTiming(0, { duration: 600, easing: Easing.bezier(0.33, 1, 0.68, 1) })
                ),
                -1,
                true
            );
        } else {
            opacity.value = withTiming(0, { duration: 300 });
            contentScale.value = withTiming(0.9, { duration: 300 });
        }
    }, [visible]);

    // Reset step when becoming visible
    useEffect(() => {
        if (visible) {
            setCurrentStep(0);
        }
    }, [visible]);

    const handleNext = () => {
        if (currentStep < TUTORIAL_STEPS.length - 1) {
            const next = currentStep + 1;
            setCurrentStep(next);
            onStepChange?.(next);
        } else {
            onDismiss();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            const prev = currentStep - 1;
            setCurrentStep(prev);
            onStepChange?.(prev);
        }
    };

    const animatedOverlayStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const animatedContentStyle = useAnimatedStyle(() => ({
        transform: [{ scale: contentScale.value }],
        opacity: opacity.value,
    }));

    const animatedArrowStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: arrowBounce.value }],
    }));

    if (!visible && opacity.value === 0) return null;

    const step = TUTORIAL_STEPS[currentStep];
    const middleX = SCREEN_WIDTH / 2;
    
    // Position targets based on step
    let bubblePosition = {};
    let arrowPosition = {};

    const sheetTopY = SCREEN_HEIGHT * 0.4; // 60% snap point Y from top

    if (step.target === 'create') {
        bubblePosition = { bottom: tabBarHeight + 90 };
        arrowPosition = { bottom: tabBarHeight + 15, left: middleX - 25 };
    } else if (step.target === 'search') {
        bubblePosition = { top: sheetTopY + 120 };
        arrowPosition = { top: sheetTopY + 45, left: 35 }; // Point to search icon in sheet
    } else if (step.target === 'import') {
        bubblePosition = { top: sheetTopY + 160 };
        arrowPosition = { top: sheetTopY + 100, right: 30 }; // Point to Imported button in sheet
    }

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Animated.View style={[styles.overlay, animatedOverlayStyle]}>
                <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={() => {}} />
            </Animated.View>

            <Animated.View style={[styles.bubbleContainer, animatedContentStyle, bubblePosition]}>
                <View style={styles.bubble}>
                    <View style={styles.header}>
                        <View style={styles.emojiCircle}>
                            <Text style={{ fontSize: 24 }}>{step.emoji}</Text>
                        </View>
                        <View style={styles.headerText}>
                            <Text style={styles.stepIndicator}>Step {currentStep + 1} of {TUTORIAL_STEPS.length}</Text>
                            <Text style={styles.title}>{step.title}</Text>
                        </View>
                    </View>
                    
                    <Text style={styles.description}>{step.description}</Text>

                    <View style={styles.footer}>
                        {currentStep > 0 ? (
                            <TouchableOpacity style={styles.btnBack} onPress={handleBack}>
                                <Text style={styles.btnBackText}>Back</Text>
                            </TouchableOpacity>
                        ) : <View />}

                        <TouchableOpacity style={styles.btnNext} onPress={handleNext} activeOpacity={0.8}>
                            <LinearGradient
                                colors={['#8B5CF6', '#D946EF']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.btnNextGradient}
                            >
                                <Text style={styles.btnNextText}>
                                    {currentStep === TUTORIAL_STEPS.length - 1 ? 'Finish' : 'Next'}
                                </Text>
                                <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <Path d="m9 18 6-6-6-6" />
                                </Svg>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.View>

            {/* Floating Arrow */}
            <Animated.View style={[styles.arrowContainer, animatedArrowStyle, arrowPosition]}>
                <Svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    {step.arrowDir === 'down' ? (
                        <Path d="M12 5v14M19 12l-7 7-7-7" />
                    ) : (
                        <Path d="M12 19V5M5 12l7-7 7 7" />
                    )}
                </Svg>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        zIndex: 9998,
    },
    bubbleContainer: {
        position: 'absolute',
        width: SCREEN_WIDTH - 40,
        left: 20,
        zIndex: 9999,
    },
    bubble: {
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.4,
        shadowRadius: 30,
        elevation: 15,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 16,
    },
    emojiCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        flex: 1,
    },
    stepIndicator: {
        fontSize: 11,
        fontWeight: '800',
        color: '#8B5CF6',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -0.5,
    },
    description: {
        fontSize: 15,
        color: '#475569',
        lineHeight: 22,
        marginBottom: 24,
        fontWeight: '500',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    btnNext: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    btnNextGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 22,
        paddingVertical: 14,
        gap: 8,
    },
    btnNextText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
    btnBack: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    btnBackText: {
        color: '#94A3B8',
        fontSize: 15,
        fontWeight: '700',
    },
    arrowContainer: {
        position: 'absolute',
        width: 50,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
    }
});
