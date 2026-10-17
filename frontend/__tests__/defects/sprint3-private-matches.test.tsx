import { callsTo, jsonResponse, renderPublic, reply } from '../public-screen-utils';
import { screen, waitFor } from '@testing-library/react-native';
import { Component, PropsWithChildren } from 'react';
import { Text } from 'react-native';
import { BestMatches } from '@/src/diagnosis/view';
import { diagnosisCriteria } from '../diagnosis-fixtures';
import profiles from '../privacy-profile-fixtures.json';

// These payloads were generated with the actual backend counsellor_profile_out
// mapper and the GET /counsellors exclude_none/exclude_unset serialization.
// Private keys are absent, rather than invented empty arrays in a full fixture.
// The boundary captures the product render error as an assertion failure, so the
// report records an executed defect rather than an unhandled runner failure.
class CaptureRenderError extends Component<PropsWithChildren, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() {
    return this.state.error
      ? <Text testID="match-render-error">{this.state.error}</Text>
      : this.props.children;
  }
}

describe('privacy-filtered diagnosis matches — QA-174/186', () => {
  test.each(['partial', 'restricted'] as const)('[S3-PRIVACY-MATCH-CRASH] %s API profiles render without accessing omitted private arrays', async (visibility) => {
    const profile = profiles[visibility];
    expect(profile).not.toHaveProperty('expertise');
    expect(profile).not.toHaveProperty('languages');
    reply('GET', '/counsellors', jsonResponse([profile]));
    reply('GET', '/services', jsonResponse([]));
    await renderPublic(<CaptureRenderError><BestMatches criteria={diagnosisCriteria} limit={3} /></CaptureRenderError>);
    await waitFor(() => {
      expect(callsTo('GET', '/counsellors')).toHaveLength(1);
      expect(callsTo('GET', '/services')).toHaveLength(1);
      // Wait for either the real card or the observed render failure.
      expect(screen.queryByTestId('match-render-error') ?? screen.queryByRole('button', {
        name: `${profile.displayName}, Career Professional`,
      })).not.toBeNull();
    });
    expect(screen.queryByTestId('match-render-error')?.props.children ?? null).toBeNull();
    expect(screen.getByRole('button', { name: `${profile.displayName}, Career Professional` })).toBeOnTheScreen();
    expect(screen.queryByText('Private coaching expertise')).toBeNull();
    expect(screen.queryByText('Private language')).toBeNull();
  });
});
