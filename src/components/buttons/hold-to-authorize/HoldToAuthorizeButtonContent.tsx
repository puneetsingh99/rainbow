import lang from 'i18n-js';
import React, {
  Fragment,
  PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, Keyboard } from 'react-native';
import {
  State as GestureHandlerState,
  HandlerStateChangeEvent,
  LongPressGestureHandler,
  TapGestureHandler,
} from 'react-native-gesture-handler';
import Animated, { EasingNode, timing, Value } from 'react-native-reanimated';
import Spinner from '../../Spinner';
import { ShimmerAnimation } from '../../animations';
import { Centered, InnerBorder } from '../../layout';
import BiometricButtonContent from '../BiometricButtonContent';
import HoldToAuthorizeButtonIcon from './HoldToAuthorizeButtonIcon';
import {
  BUTTON_HEIGHT,
  BUTTON_SCALE_DURATION_IN_MS,
  LONG_PRESS_DURATION_IN_MS,
  SMALL_BUTTON_HEIGHT,
  TINY_BUTTON_HEIGHT,
} from './constants';
import {
  getButtonDisabledBgColor,
  getButtonShadows,
} from './helpers/buttonStyleValues';
import { HoldToAuthorizeBaseProps } from './types/HoldToAuthorizeBaseProps';
import styled from '@rainbow-me/styled-components';
import { padding, position } from '@rainbow-me/styles';
import { haptics } from '@rainbow-me/utils';
import ShadowStack from 'react-native-shadow-stack';

const { divide, multiply, proc } = Animated;

const { ACTIVE, BEGAN, END, FAILED } = GestureHandlerState;

interface ButtonOptionParams {
  smallButton?: boolean;
  tinyButton?: boolean;
}

interface ContentProps extends ButtonOptionParams {
  height: number;
}

const Content = styled(Centered).attrs({
  grow: 0,
})(({ smallButton, height, tinyButton }: ContentProps) => ({
  ...position.coverAsObject,
  borderRadius: height,
  height: height,
  overflow: 'hidden',
  width: '100%',
  ...padding.object(smallButton || tinyButton ? 0 : 15),
}));

interface LabelProps extends ButtonOptionParams {
  // TODO: try fixing any
  theme: any;
}

const Label = styled(BiometricButtonContent).attrs(
  ({ smallButton, theme: { colors }, tinyButton }: LabelProps) => ({
    color: colors.whiteLabel,
    size: smallButton || tinyButton ? 'large' : 'larger',
    weight: 'heavy',
  })
)({
  bottom: 2,
});

const LoadingSpinner = styled(android ? Spinner : ActivityIndicator).attrs(
  // TODO: try fixing any
  ({ theme: { colors } }: { theme: any }) => ({
    color: colors.whiteLabel,
    size: 31,
  })
)({
  left: 15,
  position: 'absolute',
});

const animate = (
  value: Animated.Node<number>,
  {
    duration = BUTTON_SCALE_DURATION_IN_MS,
    toValue,
  }: {
    duration?: number | Animated.Node<number>;
    toValue: number | Animated.Node<number>;
  }
) =>
  timing(value, {
    duration,
    easing: EasingNode.inOut(EasingNode.ease),
    toValue,
  });

const calculateReverseDuration = proc(
  (longPressProgress: Animated.Node<number>) =>
    multiply(divide(longPressProgress, 100), LONG_PRESS_DURATION_IN_MS)
);

type Props = PropsWithChildren<HoldToAuthorizeBaseProps>;

function HoldToAuthorizeButtonContent2({
  backgroundColor,
  colors,
  children,
  deviceDimensions,
  disabled = false,
  disabledBackgroundColor,
  enableLongPress,
  hideInnerBorder,
  label,
  parentHorizontalPadding,
  shadows,
  showBiometryIcon,
  smallButton,
  style,
  testID,
  tinyButton,
  isAuthorizing: isAuthorizingProp,
  theme = 'light',
  onLongPress,
  ...props
}: Props) {
  const [isAuthorizingState, setIsAuthorizing] = useState(false);
  const longPressProgress = useRef(new Value(0));
  const buttonScale = useRef(new Value(1));

  const onFinishAuthorizing = useCallback(() => {
    if (!disabled) {
      animate(longPressProgress.current, {
        duration: calculateReverseDuration(longPressProgress.current),
        toValue: 0,
      }).start(() => setIsAuthorizing(false));
    }
  }, [disabled]);

  useEffect(() => {
    if (isAuthorizingState && !isAuthorizingProp) {
      onFinishAuthorizing();
    }
  }, [isAuthorizingState, isAuthorizingProp, onFinishAuthorizing]);

  const isAuthorizing = isAuthorizingProp || isAuthorizingState;

  const bgColor = disabled
    ? disabledBackgroundColor || getButtonDisabledBgColor(colors)[theme]
    : backgroundColor || colors.appleBlue;

  const height = tinyButton
    ? TINY_BUTTON_HEIGHT
    : smallButton
    ? SMALL_BUTTON_HEIGHT
    : BUTTON_HEIGHT;

  const width = deviceDimensions.width - parentHorizontalPadding * 2;

  const handlePress = () => {
    if (!isAuthorizingState && onLongPress) {
      onLongPress();
    }
  };

  const onLongPressChange = ({
    nativeEvent: { state },
  }: HandlerStateChangeEvent) => {
    if (state === ACTIVE && !disabled) {
      haptics.notificationSuccess();
      Keyboard.dismiss();

      animate(buttonScale.current, {
        toValue: 1,
      }).start(() => setIsAuthorizing(true));

      handlePress();
    }
  };

  const onTapChange = ({ nativeEvent: { state } }: HandlerStateChangeEvent) => {
    if (disabled) {
      if (state === END) {
        haptics.notificationWarning();
        animate(buttonScale.current, { toValue: 1.02 }).start(() => {
          animate(buttonScale.current, { toValue: 1 }).start();
        });
      }
    } else {
      if (state === ACTIVE) {
        if (!enableLongPress) {
          handlePress();
        }
      } else if (state === BEGAN) {
        animate(buttonScale.current, { toValue: 0.97 }).start();
        if (enableLongPress) {
          animate(longPressProgress.current, {
            duration: LONG_PRESS_DURATION_IN_MS,
            toValue: 100,
          }).start();
        }
      } else if (state === END || state === FAILED) {
        animate(buttonScale.current, { toValue: 1 }).start();
        if (enableLongPress) {
          animate(longPressProgress.current, {
            duration: calculateReverseDuration(longPressProgress.current),
            toValue: 0,
          }).start();
        }
      }
    }
  };

  return (
    <TapGestureHandler onHandlerStateChange={onTapChange}>
      <LongPressGestureHandler
        enabled={enableLongPress}
        minDurationMs={LONG_PRESS_DURATION_IN_MS}
        onHandlerStateChange={onLongPressChange}
      >
        <Animated.View
          {...props}
          style={[style, { transform: [{ scale: buttonScale.current }] }]}
        >
          {/* Ignoring due to obscure JS error from ShadowStack */}
          {/* @ts-ignore */}
          <ShadowStack
            backgroundColor={bgColor}
            borderRadius={height}
            height={height}
            shadows={
              shadows ||
              getButtonShadows(colors)[disabled ? 'disabled' : 'default']
            }
            width={width}
          >
            <Content
              backgroundColor={bgColor}
              height={height}
              smallButton={smallButton}
              tinyButton={tinyButton}
            >
              {children ?? (
                <Fragment>
                  {!android && !disabled && (
                    <HoldToAuthorizeButtonIcon
                      animatedValue={longPressProgress.current}
                    />
                  )}
                  {android && isAuthorizing && <LoadingSpinner />}
                  <Label
                    label={
                      isAuthorizing
                        ? lang.t('button.hold_to_authorize.authorizing')
                        : label
                    }
                    showIcon={showBiometryIcon && !isAuthorizing}
                    smallButton={smallButton}
                    testID={testID}
                    tinyButton={tinyButton}
                  />
                </Fragment>
              )}
              <ShimmerAnimation
                color={colors.whiteLabel}
                enabled={!disabled}
                width={width}
              />
              {!hideInnerBorder && <InnerBorder radius={height} />}
            </Content>
          </ShadowStack>
        </Animated.View>
      </LongPressGestureHandler>
    </TapGestureHandler>
  );
}

export default HoldToAuthorizeButtonContent2;
