import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Dimensions,
    Platform,
} from 'react-native';
import Svg, {
    Path,
    Defs,
    LinearGradient,
    Stop,
    G,
    Rect,
} from 'react-native-svg';

const { width, height } = Dimensions.get('window');

// Procedural, highly-detailed realistic silhouette of a palm tree
// Generates hundreds of leaflets along sweeping fronds to perfectly match the photo-realism of the image.
const RealisticPalmTree = ({ x, y, scale, rotation = 0 }) => {
    const paths = useMemo(() => {
        const frondElements = [];
        const frondAngles = [
            -70, -45, -20, 0, 25, 45, 65, 85, 110, 135, 160, 190, 215, 235, 250
        ];

        frondAngles.forEach((angle, idx) => {
            // Frond length based on position
            const len = 140 + Math.random() * 40 - Math.abs(angle - 90) * 0.4;
            const rad = (angle * Math.PI) / 180;
            const droop = 0.5 + Math.random() * 0.5;

            // Sub-branches (leaflets)
            const leafletCount = 35;

            for (let i = 0; i < leafletCount; i++) {
                const t = i / leafletCount;
                if (t < 0.1) continue; // no leaves at very base

                // Quadratic bezier for the main stem
                const stemX = len * t * Math.cos(rad);
                const stemY = len * t * Math.sin(rad) + len * droop * t * t;

                const leafLen = (50 * (1 - t) + 10) * (0.8 + Math.random() * 0.4);

                // Leaflet 1 (hanging down/right)
                const l1Angle = rad + 0.4 + (Math.random() * 0.2);
                const l1dx = leafLen * Math.cos(l1Angle);
                const l1dy = leafLen * Math.sin(l1Angle) + (leafLen * 0.8);

                // Leaflet 2 (hanging down/left)
                const l2Angle = rad - 0.4 - (Math.random() * 0.2);
                const l2dx = leafLen * Math.cos(l2Angle);
                const l2dy = leafLen * Math.sin(l2Angle) + (leafLen * 0.8);

                const pathData = `M ${Math.round(stemX)} ${Math.round(stemY)} Q ${Math.round(stemX + l1dx * 0.5)} ${Math.round(stemY + l1dy * 0.5)} ${Math.round(stemX + l1dx)} ${Math.round(stemY + l1dy)} M ${Math.round(stemX)} ${Math.round(stemY)} Q ${Math.round(stemX + l2dx * 0.5)} ${Math.round(stemY + l2dy * 0.5)} ${Math.round(stemX + l2dx)} ${Math.round(stemY + l2dy)}`;

                frondElements.push(
                    <Path
                        key={`${angle}-${i}`}
                        d={pathData}
                        stroke="#3F4A5E"
                        strokeWidth={1.5 - t * 0.8}
                        fill="none"
                        strokeLinecap="round"
                    />
                );
            }

            // Draw main stem curve
            frondElements.push(
                <Path
                    key={`stem-${angle}`}
                    d={`M 0 0 Q ${Math.round(len * 0.5 * Math.cos(rad))} ${Math.round(len * 0.5 * Math.sin(rad))} ${Math.round(len * Math.cos(rad))} ${Math.round(len * Math.sin(rad) + len * droop)}`}
                    stroke="#3F4A5E"
                    strokeWidth={4 * (1 - (idx * 0.01))}
                    fill="none"
                />
            );
        });

        return frondElements;
    }, []);

    return (
        <G transform={`translate(${x}, ${y}) scale(${scale}) rotate(${rotation})`}>
            {/* Trunk */}
            <Path
                d="M 12 0 C 18 -60 12 -180 -18 -320 C -2 -180 12 -60 22 0 Z"
                fill="#3F4A5E"
            />
            {/* The hyper-realistic leafy canopy */}
            <G transform="translate(-16, -310)">
                {paths}
            </G>
        </G>
    );
};

const ExactBackground = () => (
    <View style={StyleSheet.absoluteFill}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <Defs>
                <LinearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#35B5FE" />
                    <Stop offset="0.6" stopColor="#A2DCF6" />
                    <Stop offset="1" stopColor="#D5EDF6" />
                </LinearGradient>
            </Defs>

            {/* Base Sky */}
            <Rect x="0" y="0" width={width} height={height} fill="url(#skyGrad)" />

            {/* Wavy line crossing the background */}
            <Path
                d={`M -10 ${height * 0.58} C ${width * 0.25} ${height * 0.5}, ${width * 0.35} ${height * 0.38}, ${width * 0.6} ${height * 0.35} C ${width * 0.75} ${height * 0.33}, ${width * 0.85} ${height * 0.25}, ${width + 10} ${height * 0.24}`}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={1.5}
            />

            {/* Cloud / Sand left shape */}
            <Path
                d={`M 0 ${height * 0.59} C ${width * 0.2} ${height * 0.6}, ${width * 0.2} ${height * 0.7}, ${width * 0.2} ${height * 0.75} C ${width * 0.2} ${height * 0.85}, ${width * 0.65} ${height * 0.8}, ${width * 0.75} ${height * 0.82} L ${width * 0.8} ${height} L 0 ${height} Z`}
                fill="#F3F8FA"
            />

            {/* Bright blue water left */}
            <Path
                d={`M 0 ${height * 0.845} Q ${width * 0.25} ${height * 0.845} ${width * 0.45} ${height * 0.89} L ${width * 0.45} ${height} L 0 ${height} Z`}
                fill="#2BB3FE"
            />

            {/* Dark Navy Hill Right */}
            <Path
                d={`M -20 ${height * 0.91} C ${width * 0.25} ${height * 0.9}, ${width * 0.55} ${height * 0.85}, ${width + 10} ${height * 0.78} L ${width + 10} ${height} L -20 ${height} Z`}
                fill="#3F4A5E"
            />

            {/* High Definition Procedural Trees placed accurately */}
            <RealisticPalmTree x={width * 0.9} y={height * 0.65} scale={0.8} rotation={-8} />
            <RealisticPalmTree x={width * 0.82} y={height * 0.88} scale={1.1} rotation={-5} />
            <RealisticPalmTree x={width * 0.94} y={height * 1.05} scale={0.7} rotation={-12} />
        </Svg>
    </View>
);

const LoginScreen = ({ navigation }) => {
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            <ExactBackground />

            <View style={styles.overlay}>
                <View style={styles.textContainer}>
                    <Text style={styles.helloText}>Hello</Text>
                    <View style={styles.travelersRow}>
                        <Text style={styles.travelersText}>Travelers</Text>
                        <View style={styles.dot} />
                    </View>
                    <Text style={styles.subtitleText}>Let’s take a trip with us</Text>
                </View>

                <View style={styles.buttonsContainer}>
                    <TouchableOpacity
                        style={styles.btnCreate}
                        activeOpacity={0.9}
                        onPress={() => navigation.navigate('Home')}
                    >
                        <Text style={styles.btnCreateText}>Create an account</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.btnLogin}
                        activeOpacity={0.9}
                        onPress={() => navigation.navigate('Home')}
                    >
                        <Text style={styles.btnLoginText}>Login</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#35B5FE' },
    overlay: {
        flex: 1,
        justifyContent: 'space-between',
        paddingTop: height * 0.13,
        paddingBottom: height * 0.08,
    },
    textContainer: { paddingHorizontal: 40 },
    helloText: {
        fontSize: 48,
        color: '#FFFFFF',
        fontWeight: '400',
        marginBottom: -6,
        letterSpacing: 0.5,
    },
    travelersRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    travelersText: {
        fontSize: 68,
        fontWeight: '800',
        color: '#3F4A5E',
        letterSpacing: -1,
    },
    dot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#FFFFFF',
        marginLeft: 4,
        alignSelf: 'flex-end',
        marginBottom: 16,
    },
    subtitleText: {
        fontSize: 18,
        fontWeight: '500',
        color: '#3F4A5E',
        marginTop: 6,
        letterSpacing: 0.3,
        paddingLeft: 4,
    },
    buttonsContainer: {
        paddingHorizontal: 40,
        gap: 16,
        width: '100%',
        alignItems: 'center',
    },
    btnCreate: {
        width: '85%',
        backgroundColor: '#00BEE0',
        paddingVertical: 18,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnCreateText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    btnLogin: {
        width: '85%',
        backgroundColor: '#EAECEF',
        paddingVertical: 18,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnLoginText: {
        color: '#3F4A5E',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
});

export default LoginScreen;
