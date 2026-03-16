import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import BootSplash from 'react-native-bootsplash';

export const AnimatedSplash = ({ onAnimationEnd }) => {
  const [isAnimationTriggered, setIsAnimationTriggered] = useState(false);
  
  // Reanimated shared values for our custom animation
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  // useHideAnimation hooks into the native bootsplash layout
  const { container, logo } = BootSplash.useHideAnimation({
    manifest: require('../../assets/bootsplash/manifest.json'),
    logo: require('../../assets/bootsplash/logo.png'),
    statusBarTranslucent: true,
    navigationBarTranslucent: false,

    animate: () => {
      // This animate callback is triggered when we call BootSplash.hide() 
      // in our AppNavigator. We can define our custom reanimated transitions here!
      if (isAnimationTriggered) return;
      setIsAnimationTriggered(true);

      // Example Animation: Slight bounce or scale up, then fade out
      scale.value = withTiming(1.2, { duration: 600 });
      opacity.value = withDelay(
        400,
        withTiming(0, { duration: 500 }, () => {
          // Tell the parent component to unmount this screen
          runOnJS(onAnimationEnd)();
        })
      );
    },
  });

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    backgroundColor: container.style.backgroundColor, // keep the same blue color
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View {...container} style={[container.style, containerStyle]}>
      {/* You can add custom text or other views here before fading out */}
      <Animated.Image {...logo} style={[logo.style, logoStyle]} />
    </Animated.View>
  );
};

export default AnimatedSplash;
