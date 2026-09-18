import { ComponentType, forwardRef } from 'react';
import { Animated } from 'react-native';

/**
 * Animated SVG primitives that do not leak `collapsable` into the DOM.
 *
 * react-native-web's Animated wrapper injects `collapsable={false}` — a React
 * Native hint about flattening the view hierarchy, meaningless in a browser.
 * react-native-svg's web layer forwards props it does not recognise straight onto
 * the SVG element, so React sees a non-boolean DOM attribute given `false` and
 * warns. Dropping it between the two is the only place either library gives us.
 *
 * Native is unaffected: the prop is simply absent, and it was only ever an
 * optimisation hint.
 */
export function createAnimatedSvg<P extends object>(Component: ComponentType<P>) {
  const WithoutCollapsable = forwardRef<unknown, P & { collapsable?: boolean }>(
    function WithoutCollapsable({ collapsable: _dropped, ...rest }, ref) {
      const Rendered = Component as ComponentType<Record<string, unknown>>;
      return <Rendered ref={ref} {...(rest as Record<string, unknown>)} />;
    },
  );
  return Animated.createAnimatedComponent(WithoutCollapsable);
}
