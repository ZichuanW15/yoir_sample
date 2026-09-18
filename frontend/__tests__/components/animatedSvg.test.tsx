import { render } from '@testing-library/react-native';
import { View } from 'react-native';
import { createAnimatedSvg } from '@/src/components/animatedSvg';

/**
 * react-native-web's Animated wrapper injects `collapsable={false}`, and
 * react-native-svg forwards unrecognised props onto the SVG element, where React
 * rejects a non-boolean DOM attribute given `false`. This pins the interception.
 */
describe('animated SVG primitives', () => {
  test('collapsable never reaches the wrapped SVG component', () => {
    const received: Record<string, unknown>[] = [];
    const Probe = (props: Record<string, unknown>) => {
      received.push(props);
      return <View />;
    };
    const Animated = createAnimatedSvg(Probe);

    render(<Animated collapsable={false} cx={4} cy={5} />);

    expect(received.length).toBeGreaterThan(0);
    for (const props of received) {
      expect(props).not.toHaveProperty('collapsable');
    }
    // Everything else still gets through, so the animation keeps working.
    expect(received[0]).toMatchObject({ cx: 4, cy: 5 });
  });

  test('an unwrapped component would have received it', () => {
    // Establishes that the prop really is passed down, so the test above is not
    // passing merely because nothing ever sets it.
    const received: Record<string, unknown>[] = [];
    const Probe = (props: Record<string, unknown>) => {
      received.push(props);
      return <View />;
    };

    render(<Probe collapsable={false} cx={4} />);

    expect(received[0]).toHaveProperty('collapsable', false);
  });
});
