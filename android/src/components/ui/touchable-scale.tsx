import React from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface TouchableScaleProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
}

export function TouchableScale({
  children,
  style,
  pressedScale = 0.97,
  onPressIn,
  onPressOut,
  ...props
}: TouchableScaleProps) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const animateTo = React.useCallback(
    (value: number) => {
      Animated.spring(scale, {
        toValue: value,
        useNativeDriver: true,
        speed: 24,
        bounciness: 4,
      }).start();
    },
    [scale]
  );

  const handlePressIn = React.useCallback(
    (event: GestureResponderEvent) => {
      animateTo(pressedScale);
      onPressIn?.(event);
    },
    [animateTo, onPressIn, pressedScale]
  );

  const handlePressOut = React.useCallback(
    (event: GestureResponderEvent) => {
      animateTo(1);
      onPressOut?.(event);
    },
    [animateTo, onPressOut]
  );

  return (
    <AnimatedPressable
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
