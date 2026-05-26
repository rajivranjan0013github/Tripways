import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, ImageBackground, Text } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedProps, 
  withTiming, 
  withDelay,
  Easing, 
  useAnimatedStyle,
  withSpring,
  runOnJS
} from 'react-native-reanimated';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const { width } = Dimensions.get('screen');

const MAP_W = width; // Slightly reduced width based on feedback
const MAP_H = 460;

const routeLocations = [
  { id: '1', name: 'Eiffel Tower', label: 'START', x: MAP_W * 0.22, y: 410, labelOffsetX: 40 },
  { id: '2', name: 'Louvre Museum', label: 'CULTURE', x: MAP_W * 0.78, y: 320 },
  { id: '3', name: 'Notre-Dame', label: 'HISTORIC', x: MAP_W * 0.3, y: 220 },
  { id: '4', name: 'Montmartre', label: 'SCENIC', x: MAP_W * 0.82, y: 120 },
  { id: '5', name: 'Arc de Triomphe', label: 'DESTINATION', x: MAP_W * 0.45, y: 40 },
];

const generateSmoothSpline = (points) => {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  const tension = 0.85;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i === 0 ? points[0] : points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i === points.length - 2 ? points[i + 1] : points[i + 2];
    
    const cp1x = p1.x + (p2.x - p0.x) * tension / 3;
    const cp1y = p1.y + (p2.y - p0.y) * tension / 3;
    const cp2x = p2.x - (p3.x - p1.x) * tension / 3;
    const cp2y = p2.y - (p3.y - p1.y) * tension / 3;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
};
const fullPath = generateSmoothSpline(routeLocations);
const PATH_LENGTH = 1500; // Estimated max length for this spline

export default function AnimatedRouteMap({ isVisible }) {
  const pathProgress = useSharedValue(0); // 0 to 1
  const [activeNodeIndex, setActiveNodeIndex] = useState(-1);

  // We play the animation when isVisible becomes true
  useEffect(() => {
    if (isVisible) {
      pathProgress.value = 0;
      setActiveNodeIndex(-1);
      pathProgress.value = withDelay(500, withTiming(1, {
        duration: 3500, 
        easing: Easing.inOut(Easing.ease)
      }));
    } else {
      pathProgress.value = 0;
      setActiveNodeIndex(-1);
    }
  }, [isVisible, pathProgress]);

  useAnimatedProps(() => {
    const progress = pathProgress.value;
    // Slight offset to trigger nodes earlier or later if desired.
    // 5 nodes, so each spans 1/5th approx.
    const threshold = 1 / Math.max(1, (routeLocations.length - 1));
    const newNodeIndex = Math.floor(progress / threshold);
    
    // We only want to trigger state change if index moves forward and is valid
    if (newNodeIndex !== activeNodeIndex && newNodeIndex < routeLocations.length && progress > 0) {
      runOnJS(setActiveNodeIndex)(newNodeIndex);
    }
    return {};
  });

  const animatedPathProps = useAnimatedProps(() => ({
    strokeDashoffset: PATH_LENGTH - (PATH_LENGTH * pathProgress.value)
  }));


  return (
    <View style={styles.container}>
      <View style={styles.worldWrapper}>
          <Svg width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={styles.svg}>
              <Defs>
                        <SvgLinearGradient id="natureGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#1E3A8A" />
                            <Stop offset="50%" stopColor="#2563EB" />
                            <Stop offset="100%" stopColor="#60A5FA" />
                        </SvgLinearGradient>
                    </Defs>

                    {/* Road Shadows and Outer */}
                    <Path d={fullPath} stroke="#94a3b8" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" fill="none" transform="translate(0, 8)" opacity={0.8} />
                    <Path d={fullPath} stroke="#e2e8f0" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    
                    {/* Road Surface */}
                    <Path d={fullPath} stroke="#ffffff" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    
                    {/* Road Center Dashed Line */}
                    <Path d={fullPath} stroke="#94a3b8" strokeWidth="2" strokeDasharray="10 10" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.5} />

                    {/* Animated Trail */}
                    <AnimatedPath 
                        d={fullPath}
                        stroke="url(#natureGradient)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        strokeDasharray={PATH_LENGTH}
                        animatedProps={animatedPathProps}
                    />
                </Svg>

          {routeLocations.map((loc, index) => {
              const isActive = activeNodeIndex >= index || (index === 0 && pathProgress.value > 0);
              return (
                 <Marker
                    key={loc.id}
                    loc={loc}
                    isActive={isActive}
                    isVisible={isVisible}
                    index={index}
                 />
              )
          })}
      </View>
      
    </View>
  );
}

const Marker = ({ loc, isActive, isVisible, index }) => {
    const scale = useSharedValue(0.4);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (!isVisible) {
            scale.value = 0.4;
            opacity.value = 0;
            return;
        }

        if (isActive) {
            scale.value = withSpring(1, { damping: 12, stiffness: 90 });
            opacity.value = withTiming(1, { duration: 400 });
        } else {
             // Let it be hidden until it's active
             scale.value = 0.4;
             opacity.value = 0;
        }
    }, [isActive, isVisible, scale, opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return (
        <Animated.View style={[styles.markerContainer, { left: loc.x - 80, top: loc.y - 70 }, animatedStyle]}>
            <View style={[styles.markerLabelCard, loc.labelOffsetX ? { transform: [{ translateX: loc.labelOffsetX }] } : null]}>
                <Text style={styles.markerName}>{loc.name}</Text>
                <Text style={styles.markerSubtitle}>{loc.label}</Text>
            </View>
            <View style={[styles.pinIcon, isActive ? styles.pinIconActive : styles.pinIconInactive]}>
                <View style={styles.pinIconInner} />
            </View>
            <View style={styles.pinStem} />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
  container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
  },
  worldWrapper: {
      width: MAP_W,
      height: MAP_H,
      transform: [
          { perspective: 800 },
          { rotateX: '55deg' },
          { scale: 1.15 },
          { translateY: -10 }
      ],
  },
  svg: {
      position: 'absolute',
      width: MAP_W,
      height: MAP_H,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
  },
  markerContainer: {
      position: 'absolute',
      width: 160,
      alignItems: 'center',
      justifyContent: 'flex-end',
      height: 70,
      transform: [{ rotateX: '-60deg' }],
  },
  markerLabelCard: {
      backgroundColor: 'rgba(255,255,255,0.95)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.5)',
      alignItems: 'center',
      marginBottom: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
  },
  markerName: {
      color: '#0f172a',
      fontSize: 13,
      fontWeight: '900',
      textTransform: 'uppercase',
  },
  markerSubtitle: {
      color: '#1D4ED8',
      fontSize: 10,
      fontWeight: 'bold',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginTop: 2,
  },
  pinIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
  },
  pinIconActive: {
      backgroundColor: '#1E40AF',
      borderColor: '#fff',
      shadowColor: '#1E40AF',
      shadowOpacity: 0.6,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 0 },
  },
  pinIconInactive: {
      backgroundColor: '#fff',
      borderColor: '#cbd5e1',
  },
  pinIconInner: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.9)',
  },
});
