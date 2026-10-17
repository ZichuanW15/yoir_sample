import { apiMock, renderCounsellor, setupCounsellorMocks } from '../screens/counsellor-screen-utils';
import { screen } from '@testing-library/react-native';
import AdminBookings from '@/app/admin/bookings';
import { apiError } from '@/src/api/errors';
import { ownerSession } from '../screens/admin-screen-fixtures';

beforeEach(setupCounsellorMocks);

describe('Sprint 3 unresolved administration acceptance (advisory suite)', () => {
  test('[S3-ADMIN-BOOKINGS-EMPTY][QA-210] a failed booking read must not claim no sessions have been booked', async () => {
    apiMock.listAllBookings.mockRejectedValue(apiError(503, 'UNAVAILABLE', 'Bookings temporarily unavailable.'));
    await renderCounsellor(<AdminBookings />, ownerSession);
    expect(await screen.findByText('Bookings temporarily unavailable.')).toBeOnTheScreen();
    // Intended acceptance, deliberately retained as a failing defect assertion:
    // no successful response established whether the platform contains bookings.
    // Related to US-48 administration oversight; this is its adjacent Bookings view.
    expect(screen.queryByText('Nothing has been booked yet.')).toBeNull();
  });
});
