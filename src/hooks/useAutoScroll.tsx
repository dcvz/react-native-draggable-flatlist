import { useRef } from "react";
import {
  abs,
  add,
  and,
  block,
  call,
  cond,
  eq,
  greaterOrEq,
  lessOrEq,
  max,
  not,
  onChange,
  or,
  set,
  sub,
  useCode,
  useValue,
} from "react-native-reanimated";
import { State as GestureState } from "react-native-gesture-handler";
import {
  DEFAULT_PROPS,
  SCROLL_POSITION_TOLERANCE,
  isReanimatedV2,
  isAndroid,
} from "../constants";
import { useNode } from "../hooks/useNode";
import { useProps } from "../context/PropsContext";
import { useAnimatedValues } from "../context/AnimatedValueContext";
import { useRefs } from "../context/RefContext";

export function useAutoScroll() {
  const { flatlistRef } = useRefs();
  const {
    autoscrollThreshold = DEFAULT_PROPS.autoscrollThreshold,
    autoscrollSpeed = DEFAULT_PROPS.autoscrollSpeed,
  } = useProps();

  const {
    scrollOffset,
    scrollViewSize,
    containerSize,
    hoverAnim,
    isDraggingCell,
    activeCellSize,
    panGestureState,
  } = useAnimatedValues();

  const isScrolledUp = useNode(
    lessOrEq(sub(scrollOffset, SCROLL_POSITION_TOLERANCE), 0)
  );
  const isScrolledDown = useNode(
    greaterOrEq(
      add(scrollOffset, containerSize, SCROLL_POSITION_TOLERANCE),
      scrollViewSize
    )
  );

  const distToTopEdge = useNode(max(0, hoverAnim));
  const distToBottomEdge = useNode(
    max(0, sub(containerSize, add(hoverAnim, activeCellSize)))
  );

  const isAtTopEdge = useNode(lessOrEq(distToTopEdge, autoscrollThreshold));
  const isAtBottomEdge = useNode(
    lessOrEq(distToBottomEdge, autoscrollThreshold!)
  );

  const isAtEdge = useNode(or(isAtBottomEdge, isAtTopEdge));
  const autoscrollParams = [
    distToTopEdge,
    distToBottomEdge,
    scrollOffset,
    isScrolledUp,
    isScrolledDown,
  ];

  const targetScrollOffset = useValue<number>(0);
  const resolveAutoscroll = useRef<(params: readonly number[]) => void>();

  const isAutoScrollInProgressNative = useValue<number>(0);

  const isAutoScrollInProgress = useRef({
    js: false,
    native: isAutoScrollInProgressNative,
  });

  const isDraggingCellJS = useRef(false);
  useCode(
    () =>
      block([
        onChange(
          isDraggingCell,
          call([isDraggingCell], ([v]) => {
            isDraggingCellJS.current = !!v;
          })
        ),
      ]),
    []
  );

  // Ensure that only 1 call to autoscroll is active at a time
  const autoscrollLooping = useRef(false);

  const onAutoscrollComplete = (params: readonly number[]) => {
    isAutoScrollInProgress.current.js = false;
    resolveAutoscroll.current?.(params);
  };

  const scrollToAsync = (offset: number): Promise<readonly number[]> =>
    new Promise((resolve) => {
      resolveAutoscroll.current = resolve;
      targetScrollOffset.setValue(offset);
      isAutoScrollInProgress.current.native.setValue(1);
      isAutoScrollInProgress.current.js = true;

      const flatlistNode: FlatList<T> | null =
        "scrollToOffset" in flatlistRef
          ? flatlistRef
          : "getNode" in flatlistRef
          ? //@ts-ignore backwards compat
            flatlistRef.getNode()
          : null;
      flatlistNode?.scrollToOffset?.({ offset });
    });

  const getScrollTargetOffset = (
    distFromTop: number,
    distFromBottom: number,
    scrollOffset: number,
    isScrolledUp: boolean,
    isScrolledDown: boolean
  ) => {
    if (isAutoScrollInProgress.current.js) return -1;
    const scrollUp = distFromTop < autoscrollThreshold!;
    const scrollDown = distFromBottom < autoscrollThreshold!;
    if (
      !(scrollUp || scrollDown) ||
      (scrollUp && isScrolledUp) ||
      (scrollDown && isScrolledDown)
    )
      return -1;
    const distFromEdge = scrollUp ? distFromTop : distFromBottom;
    const speedPct = 1 - distFromEdge / autoscrollThreshold!;
    // Android scroll speed seems much faster than ios
    const speed = isAndroid ? autoscrollSpeed / 10 : autoscrollSpeed;
    const offset = speedPct * speed;
    const targetOffset = scrollUp
      ? Math.max(0, scrollOffset - offset)
      : scrollOffset + offset;
    return targetOffset;
  };

  const autoscroll = async (params: readonly number[]) => {
    if (autoscrollLooping.current) {
      return;
    }
    autoscrollLooping.current = true;
    try {
      let shouldScroll = true;
      let curParams = params;
      while (shouldScroll) {
        const [
          distFromTop,
          distFromBottom,
          scrollOffset,
          isScrolledUp,
          isScrolledDown,
        ] = curParams;
        const targetOffset = getScrollTargetOffset(
          distFromTop,
          distFromBottom,
          scrollOffset,
          !!isScrolledUp,
          !!isScrolledDown
        );
        const scrollingUpAtTop = !!(
          isScrolledUp && targetOffset <= scrollOffset
        );
        const scrollingDownAtBottom = !!(
          isScrolledDown && targetOffset >= scrollOffset
        );
        shouldScroll =
          targetOffset >= 0 &&
          isDraggingCellJS.current &&
          !scrollingUpAtTop &&
          !scrollingDownAtBottom;

        if (shouldScroll) {
          try {
            curParams = await scrollToAsync(targetOffset);
          } catch (err) {}
        }
      }
    } finally {
      autoscrollLooping.current = false;
    }
  };

  const checkAutoscroll = useNode(
    cond(
      and(
        isAtEdge,
        not(and(isAtTopEdge, isScrolledUp)),
        not(and(isAtBottomEdge, isScrolledDown)),
        eq(panGestureState, GestureState.ACTIVE),
        not(isAutoScrollInProgress.current.native)
      ),
      call(autoscrollParams, autoscroll)
    )
  );

  useCode(() => checkAutoscroll, []);

  const onScrollNode = useNode(
    cond(
      and(
        isAutoScrollInProgress.current.native,
        or(
          // We've scrolled to where we want to be
          lessOrEq(
            abs(sub(targetScrollOffset, scrollOffset)),
            SCROLL_POSITION_TOLERANCE
          ),
          // We're at the start, but still want to scroll farther up
          and(isScrolledUp, lessOrEq(targetScrollOffset, scrollOffset)),
          // We're at the end, but still want to scroll further down
          and(isScrolledDown, greaterOrEq(targetScrollOffset, scrollOffset))
        )
      ),
      [
        // Finish scrolling
        set(isAutoScrollInProgress.current.native, 0),
        call(autoscrollParams, onAutoscrollComplete),
      ]
    )
  );

  return onScrollNode;
}
