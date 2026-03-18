import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Animated as RNAnimated } from 'react-native';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Dimensions,
    Image,
    TouchableOpacity,
    StatusBar,
    Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle, Defs, RadialGradient, Stop, Line } from 'react-native-svg';
import Video from 'react-native-video';

const { width, height } = Dimensions.get('screen');

// ──────────────────────────────────────────────────
// Slide Data
// ─────────────────────────────────────────────────

const slides = [
    {
        id: '1',
        image: require('../assets/onboarding1.png'),
        tag: 'DISCOVER THE WORLD',
        headline: 'Save every magical spot',
        body: 'Save your favorite places and hidden gems you find along the way to easily revisit them later.',
    },
    {
        id: '2',
        image: require('../assets/onboarding2.png'),
        tag: 'PLAN YOUR JOURNEY',
        headline: 'Create trips effortlessly',
        body: 'Organize your saved spots into trips with smart itineraries tailored to your travel style.',
    },
    {
        id: '3',
        type: 'video',
        tag: 'IMPORT IN SECONDS',
        headline: 'Share reels, save spots',
    },
];

// ──────────────────────────────────────────────────
// Slide UI Helpers
// ──────────────────────────────────────────────────

const HandyArrow = ({ width = 100, height = 30, color = '#60a5fa', style = {} }) => (
    <View style={style}>
        <Svg width={width} height={height} viewBox="0 0 207 64" fill="none">
            <Path
                d="M184.005 0.213186C182.621 0.77654 181.659 2.20837 181.659 3.71065C181.659 5.58849 182.409 6.41007 186.211 8.66349C188.557 10.0484 192.945 13.3111 193.109 13.8041C193.25 14.2031 190.622 14.3205 187.619 14.0388C183.559 13.6867 181.377 13.2877 177.388 12.161C171.006 10.4005 165.82 9.57892 161.009 9.57892C152.539 9.57892 146.367 12.4661 142.472 18.2639C139.563 22.6299 137.005 25.3528 135.503 25.7519C134.236 26.104 131.632 25.7519 126.516 24.5782C115.23 21.9727 110.936 21.5032 106.055 22.3717C98.3114 23.7097 92.6095 27.5123 85.8282 35.8218C80.4547 42.4177 78.9295 43.1219 70.6699 42.8402C63.0673 42.582 57.5061 41.8779 47.4397 39.9765C40.2594 38.5916 35.9184 38.3569 31.6948 39.0611C26.9079 39.8592 20.6663 42.4177 15.7856 45.5631C9.70821 49.5066 3.32578 55.7035 0.650786 60.3277C-0.405132 62.1351 -0.147018 63.567 1.21394 63.567C1.7067 63.567 2.62183 62.7923 5.81305 59.6235C11.6793 53.8022 15.6917 50.7742 21.3468 47.9104C25.6408 45.7274 29.841 44.5069 34.0882 44.1782C36.6458 43.9905 39.6493 44.4364 47.0642 46.103C57.9285 48.5208 64.2874 49.3423 72.899 49.3423C78.8591 49.3658 79.9385 49.2015 82.7308 47.7931C85.7578 46.2673 87.6349 44.5773 90.7558 40.6338C91.7413 39.3662 93.7358 37.1598 95.1672 35.7279C98.1003 32.7938 100.588 31.1272 103.615 30.0474C108.378 28.3104 112.32 28.4982 122.339 30.916C131.89 33.2163 134.588 33.5214 137.568 32.5825C140.994 31.5262 142.895 29.6484 147.611 22.6534C150.849 17.8884 153.243 16.7382 159.836 16.7617C163.027 16.7852 163.919 16.8791 167.11 17.5363C169.105 17.9588 172.578 18.8273 174.807 19.4611C177.036 20.0949 179.781 20.7756 180.908 20.9634C183.864 21.4563 189.918 21.8319 192.077 21.6441C193.837 21.4798 193.931 21.5033 193.743 21.9258C193.626 22.1605 193.274 23.0994 192.969 24.0148C191.842 27.1602 192.265 34.6716 193.626 35.3993C194.189 35.7044 194.376 35.4697 195.573 33.052C196.324 31.5028 198.06 28.9442 201.275 24.6017C203.809 21.1746 206.085 17.9588 206.367 17.4424C206.672 16.8321 206.86 16.034 206.86 15.2125C206.883 12.8182 205.71 11.4098 203.012 10.6118C201.909 10.2831 201.486 9.95452 199.539 7.91236C194.752 2.86565 186.985 -0.960467 184.005 0.213186Z"
                fill={color}
            />
        </Svg>
    </View>
);

// ──────────────────────────────────────────────────
// Font helpers
// ──────────────────────────────────────────────────

const FONT_DISPLAY = Platform.select({
    ios: 'Plus Jakarta Sans',
    android: 'PlusJakartaSans-Regular',
    default: 'System',
});
const FONT_DISPLAY_MEDIUM = Platform.select({
    ios: 'Plus Jakarta Sans',
    android: 'PlusJakartaSans-Medium',
    default: 'System',
});
const FONT_DISPLAY_SEMIBOLD = Platform.select({
    ios: 'Plus Jakarta Sans',
    android: 'PlusJakartaSans-SemiBold',
    default: 'System',
});
const FONT_DISPLAY_BOLD = Platform.select({
    ios: 'Plus Jakarta Sans',
    android: 'PlusJakartaSans-Bold',
    default: 'System',
});
const FONT_SERIF = Platform.select({
    ios: 'Cormorant Garamond',
    android: 'CormorantGaramond-SemiBoldItalic',
    default: 'System',
});

// ──────────────────────────────────────────────────
// Onboarding Screen
// ──────────────────────────────────────────────────

const OnboardingScreen = ({ navigation }) => {
    const flatListRef = useRef(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    // Animation values for 2-step sequence
    const socialShakeAnim = useRef(new RNAnimated.Value(0)).current;
    const appShakeAnim = useRef(new RNAnimated.Value(0)).current;

    // Pin glow animations for second slide
    const pinGlow1 = useRef(new RNAnimated.Value(0.4)).current;
    const pinGlow2 = useRef(new RNAnimated.Value(0.4)).current;
    const pinGlow3 = useRef(new RNAnimated.Value(0.4)).current;
    const pinGlow4 = useRef(new RNAnimated.Value(0.4)).current;

    useEffect(() => {
        const timeout = setTimeout(() => {
            // Step 1: Shake social icons (Insta + TikTok)
            const socialShake = RNAnimated.sequence([
                RNAnimated.timing(socialShakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
                RNAnimated.timing(socialShakeAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
                RNAnimated.timing(socialShakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
                RNAnimated.timing(socialShakeAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
                RNAnimated.timing(socialShakeAnim, { toValue: 0.5, duration: 50, useNativeDriver: true }),
                RNAnimated.timing(socialShakeAnim, { toValue: -0.5, duration: 50, useNativeDriver: true }),
                RNAnimated.timing(socialShakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
            ]);

            // Small pause between the two shakes
            const pause = RNAnimated.delay(300);

            // Step 2: Shake TripWays app icon
            const appShake = RNAnimated.sequence([
                RNAnimated.timing(appShakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
                RNAnimated.timing(appShakeAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
                RNAnimated.timing(appShakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
                RNAnimated.timing(appShakeAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
                RNAnimated.timing(appShakeAnim, { toValue: 0.5, duration: 50, useNativeDriver: true }),
                RNAnimated.timing(appShakeAnim, { toValue: -0.5, duration: 50, useNativeDriver: true }),
                RNAnimated.timing(appShakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
            ]);

            // Run in sequence: social shake → pause → app shake
            RNAnimated.sequence([socialShake, pause, appShake]).start();
        }, 600);
        return () => clearTimeout(timeout);
    }, [socialShakeAnim, appShakeAnim]);

    // Staggered pulsing glow for location pins
    useEffect(() => {
        const createPulse = (anim, delay) => {
            return setTimeout(() => {
                RNAnimated.loop(
                    RNAnimated.sequence([
                        RNAnimated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
                        RNAnimated.timing(anim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
                    ])
                ).start();
            }, delay);
        };
        const t1 = createPulse(pinGlow1, 0);
        const t2 = createPulse(pinGlow2, 300);
        const t3 = createPulse(pinGlow3, 600);
        const t4 = createPulse(pinGlow4, 900);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }, [pinGlow1, pinGlow2, pinGlow3, pinGlow4]);

    // Social icons shake style
    const socialShakeStyle = {
        transform: [{
            translateX: socialShakeAnim.interpolate({
                inputRange: [-1, 1],
                outputRange: [-3, 3],
            }),
        }],
    };

    // App icon shake style
    const appShakeStyle = {
        transform: [{
            translateX: appShakeAnim.interpolate({
                inputRange: [-1, 1],
                outputRange: [-3, 3],
            }),
        }],
    };

    const onViewableItemsChanged = useCallback(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index ?? 0);
        }
    }, []);

    const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    const goToLogin = useCallback(() => {
        navigation.replace('Login');
    }, [navigation]);

    const handleContinue = useCallback(() => {
        if (currentIndex < slides.length - 1) {
            flatListRef.current?.scrollToIndex({
                index: currentIndex + 1,
                animated: true,
            });
        } else {
            goToLogin();
        }
    }, [currentIndex, goToLogin]);

    // ── Location Pin Component ──
    const LocationPin = useCallback(({ size = 36, glowAnim }) => (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            {/* Glow circle behind pin */}
            <RNAnimated.View style={{
                position: 'absolute',
                width: size * 1.8,
                height: size * 1.8,
                borderRadius: size * 0.9,
                backgroundColor: 'rgba(255, 165, 70, 0.35)',
                opacity: glowAnim,
                transform: [{ scale: glowAnim.interpolate({ inputRange: [0.4, 1], outputRange: [0.8, 1.3] }) }],
            }} />
            <Svg width={size} height={size} viewBox="0 0 300 300" fill="none">
                <Path
                    d="M134 28 C180 28 240 65 236 116 C236 160 170 225 150 272 C120 225 54 160 54 117 C56 63 90 30 134 28 Z M142 95 C130 95 120 105 120 117 C120 129 130 139 142 139 C154 139 164 129 164 117 C164 105 154 95 142 95 Z"
                    fill="black"
                />
                <Path
                    d="M132 36 C175 33 212 65 208 108 C208 150 150 210 135 250 C120 210 62 150 62 112 C64 68 92 38 132 36 Z M135 76 C116 76 101 91 101 110 C101 129 116 144 135 144 C154 144 169 129 169 110 C169 91 154 76 135 76 Z"
                    fill="#FF6B6B"
                />
            </Svg>
        </View>
    ), []);

    // ── Trip Map Visual (for second slide) ──
    const TripMapVisual = useCallback(() => {
        // Pin positions relative to the container (percentage-based thinking, absolute offsets)
        const MAP_W = width * 0.85;
        const MAP_H = 200;
        const pins = [
            { x: MAP_W * 0.08, y: MAP_H * 0.75, size: 32, glow: pinGlow1 },
            { x: MAP_W * 0.35, y: MAP_H * 0.35, size: 36, glow: pinGlow2 },
            { x: MAP_W * 0.62, y: MAP_H * 0.55, size: 34, glow: pinGlow3 },
            { x: MAP_W * 0.85, y: MAP_H * 0.15, size: 32, glow: pinGlow4 },
        ];

        return (
            <View style={[styles.tripMapContainer, { width: MAP_W, height: MAP_H }]}>
                {/* Dotted path lines connecting pins */}
                <Svg width={MAP_W} height={MAP_H} style={{ position: 'absolute', top: 0, left: 0 }}>
                    {/* Path 1→2 */}
                    <Path
                        d={`M ${pins[0].x + 16} ${pins[0].y} Q ${(pins[0].x + pins[1].x) / 2} ${pins[0].y - 30} ${pins[1].x + 18} ${pins[1].y + 10}`}
                        stroke="rgba(255,255,255,0.7)"
                        strokeWidth={2}
                        strokeDasharray="6,5"
                        fill="none"
                    />
                    {/* Path 2→3 */}
                    <Path
                        d={`M ${pins[1].x + 18} ${pins[1].y + 10} Q ${(pins[1].x + pins[2].x) / 2 + 15} ${pins[1].y + 50} ${pins[2].x + 17} ${pins[2].y + 5}`}
                        stroke="rgba(255,255,255,0.7)"
                        strokeWidth={2}
                        strokeDasharray="6,5"
                        fill="none"
                    />
                    {/* Path 3→4 */}
                    <Path
                        d={`M ${pins[2].x + 17} ${pins[2].y + 5} Q ${(pins[2].x + pins[3].x) / 2} ${pins[2].y - 30} ${pins[3].x + 16} ${pins[3].y + 10}`}
                        stroke="rgba(255,255,255,0.7)"
                        strokeWidth={2}
                        strokeDasharray="6,5"
                        fill="none"
                    />
                </Svg>

                {/* Render each pin at its position */}
                {pins.map((pin, idx) => (
                    <View key={idx} style={{
                        position: 'absolute',
                        left: pin.x,
                        top: pin.y - pin.size,
                        alignItems: 'center',
                    }}>
                        <LocationPin size={pin.size} glowAnim={pin.glow} />
                    </View>
                ))}
            </View>
        );
    }, [pinGlow1, pinGlow2, pinGlow3, pinGlow4]);

    // ── VideoSlide component (separate to manage its own videoTime state) ──
    const VideoSlide = useCallback(({ tag, headline }) => {
        const [vTime, setVTime] = useState(0);
        const [isPausedForAnn, setIsPausedForAnn] = useState(true); // Start paused on first annotation
        const isPausedRef = useRef(true);
        const lastPausedAt = useRef(0); // Start with 0 as already paused
        const pauseTimer = useRef(null);

        // Pause points aligned exactly with annotation timestamp boundaries
        const PAUSE_POINTS = [0, 1.2, 4.0, 5.0, 7.0];
        const PAUSE_DURATION = 1800; // ms to hold on each annotation

        // Start with initial pause on mount (for the first "Find a reel" annotation)
        useEffect(() => {
            pauseTimer.current = setTimeout(() => {
                isPausedRef.current = false;
                setIsPausedForAnn(false);
            }, PAUSE_DURATION);
            return () => {
                if (pauseTimer.current) clearTimeout(pauseTimer.current);
            };
        }, []);

        const handleProgress = ({ currentTime }) => {
            setVTime(currentTime);

            // Reset tracking when video loops back to start
            if (currentTime < 0.3 && lastPausedAt.current > 0) {
                lastPausedAt.current = 0;
                isPausedRef.current = true;
                setIsPausedForAnn(true);
                pauseTimer.current = setTimeout(() => {
                    isPausedRef.current = false;
                    setIsPausedForAnn(false);
                }, PAUSE_DURATION);
                return;
            }

            // Check if we've hit a pause point (skip 0 since handled above)
            for (const point of PAUSE_POINTS) {
                if (point === 0) continue;
                if (
                    currentTime >= point &&
                    currentTime < point + 0.4 &&
                    lastPausedAt.current !== point &&
                    !isPausedRef.current
                ) {
                    lastPausedAt.current = point;
                    isPausedRef.current = true;
                    setIsPausedForAnn(true);

                    const duration = point === 7.0 ? 2200 : PAUSE_DURATION;
                    pauseTimer.current = setTimeout(() => {
                        isPausedRef.current = false;
                        setIsPausedForAnn(false);
                    }, duration);
                    break;
                }
            }
        };

        // Video is 9.3s, 720×1566
        // Frame analysis:
        //   0–1s:   IG reel playing, share icon visible at right side ~55% down
        //   1–2s:   IG share sheet, "Share to..." at bottom row ~85% down
        //   3–4s:   iOS share sheet, TripWays app icon at ~70% down
        //   5–6s:   TripWays app "Analyzing link..." center
        //   7–9.3s: Spots discovered & saved

        return (
            <View style={[styles.slide, styles.videoSlide]}>
                <LinearGradient
                    colors={['#0a0e1a', '#111827', '#0f172a']}
                    style={StyleSheet.absoluteFill}
                />

                {/* Compact header */}
                <View style={styles.videoTextOverlay}>
                    <View style={styles.tagRow}>
                        <View style={[styles.tagLine, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
                        <Text style={[styles.tagText, { color: '#60a5fa' }]}>{tag}</Text>
                        <View style={[styles.tagLine, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
                    </View>
                    <Text style={[styles.headline, { color: '#f8fafc' }]}>{headline}</Text>
                </View>

                {/* Full-width wrapper — annotations position relative to this */}
                <View style={styles.videoWrapper}>
                    {/* Centered video card */}
                    <View style={styles.videoCard}>
                        <Video
                            source={require('../assets/reels_demo.mp4')}
                            style={styles.demoVideo}
                            resizeMode="cover"
                            repeat={true}
                            muted={true}
                            playInBackground={false}
                            paused={currentIndex !== 2 || isPausedForAnn}
                            progressUpdateIntervalMillis={250}
                            onProgress={handleProgress}
                        />
                    </View>

                    {/* Subtle glow behind video */}
                    <View style={styles.videoGlow} />

                    {/* ── Annotations in the side margins ── */}

                    {/* 0–1.2s: Reel playing — left side, pointing at share icon area */}
                    {vTime >= 0 && vTime < 1.2 && (
                        <View style={styles.annLeft1}>
                            <Text style={styles.annLabel}>Find a reel{'\n'}you love ❤️</Text>
                            <HandyArrow
                                width={45}
                                height={14}
                                color="#ffffff"
                                style={{ transform: [{ rotate: '20deg' }], marginTop: 2 }}
                            />
                        </View>
                    )}

                    {/* 1.2–3s: Share sheet — right side, pointing at "Share to..." */}
                    {vTime >= 1.2 && vTime < 3.0 && (
                        <View style={styles.annRight1}>
                            <HandyArrow
                                width={75}
                                height={50}
                                color="#ffffff"
                                style={{ transform: [{ rotate: '160deg' }, { scaleY: -1 }], marginBottom: 2 }}
                            />
                            <Text style={[styles.annLabel, { color: '#ffffff' }]}>Tap{'\n'}"Share to..."</Text>
                        </View>
                    )}

                    {/* 3–5s: iOS share sheet — left side, pointing at TripWays icon */}
                    {vTime >= 4.0 && vTime < 5.0 && (
                        <View style={styles.annLeft2}>
                            <Text style={[styles.annLabel, { color: '#ffffffff' }]}>Select{'\n'}TripWays</Text>
                            <HandyArrow
                                width={60}
                                height={40}
                                color="#ffffffff"
                                style={{ transform: [{ rotate: '135deg' }], marginTop: 2 }}
                            />
                        </View>
                    )}

                    {/* 5–7s: Analyzing — right side */}
                    {vTime >= 5.0 && vTime < 7.0 && (
                        <View style={styles.annRight2}>
                            <Text style={[styles.annLabel, { color: '#ffffff' }]}>✨ analyzing video ...</Text>
                        </View>
                    )}

                    {/* 7–9.3s: Spots saved — left side */}
                    {vTime >= 7.0 && (
                        <View style={styles.annLeft3}>
                            <Text style={[styles.annLabel, { color: '#ffffff', fontSize: 14 }]}>Spots{'\n'}saved! ✓</Text>
                            <HandyArrow
                                width={40}
                                height={13}
                                color="#ffffff"
                                style={{ transform: [{ rotate: '20deg' }], marginTop: 2 }}
                            />
                        </View>
                    )}
                </View>
            </View>
        );
    }, [currentIndex]);

    // ── Render single slide ──
    const renderSlide = useCallback(({ item }) => {
        // Video slide (slide 3)
        if (item.type === 'video') {
            return <VideoSlide tag={item.tag} headline={item.headline} />;
        }

        // Image slides (slides 1 & 2)
        return (
            <View style={styles.slide}>
                {/* Full-screen background image */}
                <Image
                    source={item.image}
                    style={styles.heroImage}
                    resizeMode="cover"
                />

                {/* Light gradient overlay at top for text readability */}
                <LinearGradient
                    colors={[
                        'rgba(255,255,255,0.92)',
                        'rgba(255,255,255,0.8)',
                        'rgba(255,255,255,0.55)',
                        'rgba(255,255,255,0.2)',
                        'transparent',
                    ]}
                    locations={[0, 0.25, 0.5, 0.7, 1]}
                    style={styles.gradientOverlay}
                />

                {/* Text content overlaid on upper portion */}
                <View style={styles.textOverlay}>
                    {/* Tag */}
                    <View style={styles.tagRow}>
                        <View style={styles.tagLine} />
                        <Text style={styles.tagText}>{item.tag}</Text>
                        <View style={styles.tagLine} />
                    </View>

                    {/* Headline */}
                    <Text style={styles.headline}>{item.headline}</Text>

                    {/* Body */}
                    <Text style={styles.body}>{item.body}</Text>

                    {/* Social flow visual on the first slide only */}
                    {item.id === '1' && (
                        <View style={styles.socialFlowCard}>
                            <View style={styles.socialFlowContainer}>
                                {/* Left: Social media icons stacked — wrapped in shake animation */}
                                <RNAnimated.View style={socialShakeStyle}>
                                    <View style={styles.socialIconsStack}>
                                        <View style={[styles.socialIconShadow, { transform: [{ rotate: '-8deg' }] }]}>
                                            <Image
                                                source={require('../assets/insta.png')}
                                                style={styles.socialFlowIcon}
                                                resizeMode="contain"
                                            />
                                        </View>
                                        <View style={[styles.socialIconShadow, { transform: [{ rotate: '8deg' }] }]}>
                                            <Image
                                                source={require('../assets/tiktok.png')}
                                                style={styles.socialFlowIcon}
                                                resizeMode="contain"
                                            />
                                        </View>
                                    </View>
                                </RNAnimated.View>

                                {/* Center: Hand-drawn arrow */}
                                <View style={styles.arrowContainer}>
                                    <Svg width={140} height={43} viewBox="0 0 207 64" fill="none">
                                        <Path
                                            d="M184.005 0.213186C182.621 0.77654 181.659 2.20837 181.659 3.71065C181.659 5.58849 182.409 6.41007 186.211 8.66349C188.557 10.0484 192.945 13.3111 193.109 13.8041C193.25 14.2031 190.622 14.3205 187.619 14.0388C183.559 13.6867 181.377 13.2877 177.388 12.161C171.006 10.4005 165.82 9.57892 161.009 9.57892C152.539 9.57892 146.367 12.4661 142.472 18.2639C139.563 22.6299 137.005 25.3528 135.503 25.7519C134.236 26.104 131.632 25.7519 126.516 24.5782C115.23 21.9727 110.936 21.5032 106.055 22.3717C98.3114 23.7097 92.6095 27.5123 85.8282 35.8218C80.4547 42.4177 78.9295 43.1219 70.6699 42.8402C63.0673 42.582 57.5061 41.8779 47.4397 39.9765C40.2594 38.5916 35.9184 38.3569 31.6948 39.0611C26.9079 39.8592 20.6663 42.4177 15.7856 45.5631C9.70821 49.5066 3.32578 55.7035 0.650786 60.3277C-0.405132 62.1351 -0.147018 63.567 1.21394 63.567C1.7067 63.567 2.62183 62.7923 5.81305 59.6235C11.6793 53.8022 15.6917 50.7742 21.3468 47.9104C25.6408 45.7274 29.841 44.5069 34.0882 44.1782C36.6458 43.9905 39.6493 44.4364 47.0642 46.103C57.9285 48.5208 64.2874 49.3423 72.899 49.3423C78.8591 49.3658 79.9385 49.2015 82.7308 47.7931C85.7578 46.2673 87.6349 44.5773 90.7558 40.6338C91.7413 39.3662 93.7358 37.1598 95.1672 35.7279C98.1003 32.7938 100.588 31.1272 103.615 30.0474C108.378 28.3104 112.32 28.4982 122.339 30.916C131.89 33.2163 134.588 33.5214 137.568 32.5825C140.994 31.5262 142.895 29.6484 147.611 22.6534C150.849 17.8884 153.243 16.7382 159.836 16.7617C163.027 16.7852 163.919 16.8791 167.11 17.5363C169.105 17.9588 172.578 18.8273 174.807 19.4611C177.036 20.0949 179.781 20.7756 180.908 20.9634C183.864 21.4563 189.918 21.8319 192.077 21.6441C193.837 21.4798 193.931 21.5033 193.743 21.9258C193.626 22.1605 193.274 23.0994 192.969 24.0148C191.842 27.1602 192.265 34.6716 193.626 35.3993C194.189 35.7044 194.376 35.4697 195.573 33.052C196.324 31.5028 198.06 28.9442 201.275 24.6017C203.809 21.1746 206.085 17.9588 206.367 17.4424C206.672 16.8321 206.86 16.034 206.86 15.2125C206.883 12.8182 205.71 11.4098 203.012 10.6118C201.909 10.2831 201.486 9.95452 199.539 7.91236C194.752 2.86565 186.985 -0.960467 184.005 0.213186Z"
                                            fill="#1E293B"
                                        />
                                    </Svg>
                                </View>

                                {/* Right: TripWays app icon — wrapped in shake animation */}
                                <RNAnimated.View style={appShakeStyle}>
                                    <View style={styles.appIconShadow}>
                                        <Image
                                            source={require('../assets/app_icon.png')}
                                            style={styles.appFlowIcon}
                                            resizeMode="contain"
                                        />
                                    </View>
                                </RNAnimated.View>
                            </View>

                            {/* Labels beneath icons */}

                        </View>
                    )}


                </View>
            </View>
        );
    }, [currentIndex]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />



            {/* Swipeable slides */}
            <FlatList
                ref={flatListRef}
                data={slides}
                renderItem={renderSlide}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                bounces={false}
                style={styles.flatList}
            />

            {/* Bottom section: dots + button */}
            <View style={styles.bottomContainer}>
                {/* Pagination dots */}
                <View style={styles.dotsRow}>
                    {slides.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                currentIndex === index ? styles.dotActive : styles.dotInactive,
                            ]}
                        />
                    ))}
                </View>

                {/* Continue button */}
                <TouchableOpacity
                    onPress={handleContinue}
                    activeOpacity={0.9}
                    style={styles.continueButton}
                >
                    <LinearGradient
                        colors={['#3378c7', '#5a9aeb']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.continueGradient}
                    />
                    <Text style={styles.continueText}>
                        {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

// ──────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    flatList: {
        flex: 1,
    },
    slide: {
        width,
        height,
    },

    // ── Full-screen image ──
    heroImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
    },

    // ── Gradient overlay ──
    gradientOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: height * 0.5,
    },

    // ── Text overlay on upper portion ──
    textOverlay: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 100 : 80,
        left: 0,
        right: 0,
        paddingHorizontal: 28,
        alignItems: 'center',
    },

    // Tag
    tagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 14,
    },
    tagLine: {
        width: 28,
        height: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    tagText: {
        fontSize: 11,
        fontFamily: FONT_DISPLAY_BOLD,
        ...Platform.select({ ios: { fontWeight: '700' }, android: {} }),
        letterSpacing: 2.5,
        color: '#3378c7',
        textTransform: 'uppercase',
    },

    // Headline
    headline: {
        fontSize: 40,
        fontFamily: FONT_SERIF,
        ...Platform.select({ ios: { fontWeight: '600', fontStyle: 'italic' }, android: {} }),
        lineHeight: 46,
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 14,
    },

    // Body
    body: {
        fontSize: 15,
        fontFamily: FONT_DISPLAY,
        ...Platform.select({ ios: { fontWeight: '400' }, android: {} }),
        lineHeight: 23,
        color: '#475569',
        textAlign: 'center',
        paddingHorizontal: 4,
    },

    // ── Skip ──
    skipButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 56 : 44,
        right: 24,
        zIndex: 10,
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
    },
    skipText: {
        fontSize: 14,
        fontFamily: FONT_DISPLAY_SEMIBOLD,
        ...Platform.select({ ios: { fontWeight: '600' }, android: {} }),
        color: '#64748b',
    },

    // ── Bottom ──
    bottomContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === 'ios' ? 48 : 32,
        alignItems: 'center',
        gap: 24,
    },
    dotsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    dot: {
        borderRadius: 4,
    },
    dotActive: {
        width: 32,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#3378c7',
    },
    dotInactive: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
    },

    // Button
    continueButton: {
        width: '100%',
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
    },
    continueGradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        borderRadius: 16,
    },
    continueText: {
        fontSize: 18,
        fontFamily: FONT_DISPLAY_MEDIUM,
        ...Platform.select({ ios: { fontWeight: '500' }, android: {} }),
        color: '#FFFFFF',
    },
    // ── Social flow card (on first slide, below text) ──
    socialFlowCard: {
        marginTop: 28,
        alignItems: 'center',
    },
    socialFlowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    socialIconsStack: {
        alignItems: 'center',
        gap: 12,
    },
    socialIconShadow: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    socialFlowIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
    },
    arrowContainer: {
        paddingHorizontal: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    appIconShadow: {
        width: 72,
        height: 72,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    appFlowIcon: {
        width: 72,
        height: 72,
        borderRadius: 18,
    },
    flowLabelsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '85%',
        marginTop: 14,
    },
    flowLabel: {
        fontSize: 11,
        fontFamily: FONT_DISPLAY_MEDIUM,
        ...Platform.select({ ios: { fontWeight: '500' }, android: {} }),
        color: '#64748B',
        letterSpacing: 0.5,
    },

    // ── Trip map visual (second slide) ──
    tripMapCard: {
        marginTop: 28,
        alignItems: 'center',
    },
    tripMapContainer: {
        position: 'relative',
    },

    // ── Blended image (second slide) ──
    blendImageCard: {
        marginTop: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
    },
    blendImage: {
        width: width * 0.72,
        height: width * 0.55,
        borderRadius: 18,
        opacity: 0.92,
    },

    // ── Video slide (third slide) ──
    videoSlide: {
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    videoTextOverlay: {
        paddingTop: Platform.OS === 'ios' ? 80 : 60,
        paddingHorizontal: 28,
        alignItems: 'center',
    },
    videoWrapper: {
        width: width,
        marginTop: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    videoCard: {
        width: width * 0.58,
        height: width * 0.58 * (1566 / 720),
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.12)',
        zIndex: 2,
    },
    demoVideo: {
        width: '100%',
        height: '100%',
    },
    videoGlow: {
        position: 'absolute',
        width: width * 0.45,
        height: width * 0.45,
        borderRadius: width * 0.225,
        backgroundColor: 'rgba(96, 165, 250, 0.12)',
        top: '30%',
        zIndex: 1,
    },
    // ── Annotation positions (absolute, relative to full-width wrapper) ──
    annLeft1: {
        position: 'absolute',
        left: 8,
        top: '12%',
        width: width * 0.19,
        alignItems: 'center',
        zIndex: 10,
    },
    annRight1: {
        position: 'absolute',
        right: 8,
        top: '75%',
        width: width * 0.19,
        alignItems: 'center',
        zIndex: 10,
    },
    annLeft2: {
        position: 'absolute',
        right: 8,
        top: '50%',
        width: width * 0.19,
        alignItems: 'center',
        zIndex: 10,
    },
    annRight2: {
        position: 'absolute',
        right: 8,
        top: '25%',
        width: width * 0.19,
        alignItems: 'center',
        zIndex: 10,
    },
    annLeft3: {
        position: 'absolute',
        left: 8,
        top: '35%',
        width: width * 0.19,
        alignItems: 'center',
        zIndex: 10,
    },
    annLabel: {
        fontSize: 13,
        fontFamily: FONT_DISPLAY_MEDIUM,
        ...Platform.select({ ios: { fontWeight: '500' }, android: {} }),
        color: '#ffffff',
        textAlign: 'center',
        lineHeight: 17,
    },
});

export default OnboardingScreen;
