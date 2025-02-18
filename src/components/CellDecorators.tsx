import React from "react";
import Animated, {
  interpolate,
  interpolateNode,
  multiply,
} from "react-native-reanimated";
import { useNode } from "../hooks/useNode";
export { useOnCellActiveAnimation } from "../hooks/useOnCellActiveAnimation";
import { useOnCellActiveAnimation } from "../hooks/useOnCellActiveAnimation";

type ScaleProps = {
  activeScale?: number;
  children: React.ReactNode;
};

// support older versions of Reanimated v1 by using the old interpolate function
// if interpolateNode not available.
const interpolateFn = ((interpolateNode ||
  interpolate) as unknown) as typeof interpolateNode;

export const ScaleDecorator = ({ activeScale = 1.1, children }: ScaleProps) => {
  const { isActive, onActiveAnim } = useOnCellActiveAnimation({
    animationConfig: { mass: 0.1, restDisplacementThreshold: 0.0001 },
  });

  const animScale = useNode(
    interpolateFn(onActiveAnim, {
      inputRange: [0, 1],
      outputRange: [1, activeScale],
    })
  );

  const scale = isActive ? animScale : 1;
  return (
    <Animated.View
      style={{ transform: [{ scaleX: scale }, { scaleY: scale }] }}
    >
      {children}
    </Animated.View>
  );
};

type ShadowProps = {
  children: React.ReactNode;
  elevation?: number;
  radius?: number;
  color?: string;
  opacity?: number;
};

export const ShadowDecorator = ({
  elevation = 10,
  color = "black",
  opacity = 0.25,
  radius = 5,
  children,
}: ShadowProps) => {
  const { isActive, onActiveAnim } = useOnCellActiveAnimation();
  const shadowOpacity = useNode(multiply(onActiveAnim, opacity));

  const style = {
    elevation: isActive ? elevation : 0,
    shadowRadius: isActive ? radius : 0,
    shadowColor: isActive ? color : "transparent",
    shadowOpacity: isActive ? shadowOpacity : 0,
  };

  return <Animated.View style={style}>{children}</Animated.View>;
};

type OpacityProps = {
  activeOpacity?: number;
  children: React.ReactNode;
};

export const OpacityDecorator = ({
  activeOpacity = 0.25,
  children,
}: OpacityProps) => {
  const { isActive, onActiveAnim } = useOnCellActiveAnimation();
  const opacity = useNode(
    interpolateFn(onActiveAnim, {
      inputRange: [0, 1],
      outputRange: [1, activeOpacity],
    })
  );

  const style = {
    opacity: isActive ? opacity : 1,
  };

  return <Animated.View style={style}>{children}</Animated.View>;
};
