/** Historical parent-Issue probes for stricter frontend validation UX.
 * Not implemented in this revision; excluded from current implemented-feature QA.
 * No storage/relaunch/offline policy is inferred from these tests.
 */
import { apiFailure, callsTo, navigation, renderPublic, reply } from '../public-screen-utils';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Text, TextInput, View } from 'react-native';
import RegisterScreen from '@/app/auth/register';

const fieldLabels = ['Full name', 'Email', 'Password', 'Confirm password'];

function completeRegistration() {
  fireEvent.changeText(screen.getByLabelText('Full name'), 'QA Account');
  fireEvent.changeText(screen.getByLabelText('Email'), 'qa-account@example.com');
  fireEvent.changeText(screen.getByLabelText('Password'), 'correct-password');
  fireEvent.changeText(screen.getByLabelText('Confirm password'), 'correct-password');
}

/** Accept accessible error descriptions OR visible text in the field's own
 * group. A form-wide banner that cannot identify the offending field is not
 * field-associated feedback. No particular Field component or error copy is
 * required; stop the ancestor search before it contains another input.
 */
function hasAssociatedEnglishError(label: string, error: RegExp): boolean {
  const input = screen.getByLabelText(label);
  if (typeof input.props.accessibilityHint === 'string' && error.test(input.props.accessibilityHint)) return true;
  const ids = [input.props['aria-describedby'], input.props['aria-errormessage'], input.props.accessibilityDescribedBy]
    .flatMap(value => typeof value === 'string' ? value.split(/\s+/) : Array.isArray(value) ? value : []);
  for (const node of screen.UNSAFE_root.findAll(node => ids.includes(node.props.nativeID ?? node.props.id))) {
    if (within(node).queryAllByText(error).length) return true;
  }
  for (let group = input.parent; group; group = group.parent) {
    const labels = new Set(group.findAll(node => fieldLabels.includes(node.props.accessibilityLabel)).map(node => node.props.accessibilityLabel));
    if (labels.size > 1) break;
    if (within(group).queryAllByText(error).length) return true;
  }
  return false;
}

describe('field-error association assertion controls', () => {
  test('accepts English feedback in a field group without prescribing an error component', async () => {
    render(<View><View><TextInput accessibilityLabel="Email" /><Text>Enter a valid email.</Text></View><TextInput accessibilityLabel="Full name" /></View>);
    expect(hasAssociatedEnglishError('Email', /valid.*email/i)).toBe(true);
  });

  test('accepts an input accessibility hint as associated English feedback', async () => {
    render(<View><TextInput accessibilityLabel="Email" accessibilityHint="Enter a valid email." /><TextInput accessibilityLabel="Full name" /></View>);
    expect(hasAssociatedEnglishError('Email', /valid.*email/i)).toBe(true);
  });

  test('does not attribute a form-wide banner to every input', async () => {
    render(<View><Text>Complete all required fields.</Text><View><TextInput accessibilityLabel="Email" /></View><View><TextInput accessibilityLabel="Full name" /></View></View>);
    expect(hasAssociatedEnglishError('Email', /required/i)).toBe(false);
  });
});

describe('planned registration validation UX', () => {
  test.each(['not-an-email', 'name@'])('[QA-87][US01-AC2] malformed email %s sends no registration request', async (email) => {
    // A valid API error prevents an unconfigured-request exception from being
    // mistaken for the defect. The failing assertion is the forbidden HTTP call.
    reply('POST', '/auth/users', apiFailure('VALIDATION_ERROR', 'Email is invalid.', 400, { email: 'Enter a valid email.' }));
    await renderPublic(<RegisterScreen />);
    completeRegistration();
    fireEvent.changeText(screen.getByLabelText('Email'), email);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Create account' })));
    expect(callsTo('POST', '/auth/users')).toHaveLength(0);
    expect(hasAssociatedEnglishError('Email', /valid|email.*format/i)).toBe(true);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  test.each(fieldLabels)('[QA-87][US01-AC2] missing %s is identified at its own field', async (label) => {
    await renderPublic(<RegisterScreen />);
    completeRegistration();
    fireEvent.changeText(screen.getByLabelText(label), '');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(callsTo('POST', '/auth/users')).toHaveLength(0);
    expect({ field: label, associatedError: hasAssociatedEnglishError(label, /required|enter|provide|complete|empty|missing/i) })
      .toEqual({ field: label, associatedError: true });
  });

  test('[QA-87][US01-AC2] submitting an empty form identifies every missing field', async () => {
    await renderPublic(<RegisterScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(callsTo('POST', '/auth/users')).toHaveLength(0);
    expect(fieldLabels.filter(label => !hasAssociatedEnglishError(label, /required|enter|provide|complete|empty|missing/i))).toEqual([]);
  });

  test('[QA-87][US01-AC3] a mismatch is associated with password confirmation and sends no request', async () => {
    await renderPublic(<RegisterScreen />);
    completeRegistration();
    fireEvent.changeText(screen.getByLabelText('Confirm password'), 'different-password');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(callsTo('POST', '/auth/users')).toHaveLength(0);
    expect({ field: 'Confirm password', associatedError: hasAssociatedEnglishError('Confirm password', /match|same/i) })
      .toEqual({ field: 'Confirm password', associatedError: true });
  });

});
