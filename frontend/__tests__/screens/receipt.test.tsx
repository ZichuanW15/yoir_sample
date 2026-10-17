import { apiFailure, callsTo, deferred, jsonResponse, navigation, renderPublic, reply, routeParams } from '../public-screen-utils';
import { act, fireEvent, screen } from '@testing-library/react-native';
import ReceiptScreen from '@/app/bookings/receipt';
import { Receipt } from '@/src/api/types';
import { fmtLong, fmtTime } from '@/src/format';
import { sessionFixture } from '../fixtures';

const path = '/bookings/booking-receipt/receipt';
const receipt: Receipt = {
  receiptNumber: 'YOIR-2026-0042', issuedAt: '2026-08-27T00:00:00Z', isTaxInvoice: true,
  supplierName: 'Maya Chen Consulting', supplierAbn: '51824753556', buyerName: 'Alex Morgan',
  description: 'Career interview coaching', sessionStartsAt: '2026-08-30T01:30:00Z',
  totalMinor: 123456, gstMinor: 11223, currency: 'AUD', text: 'Server receipt',
};

beforeEach(() => {
  routeParams({ bookingId: 'booking-receipt' });
  reply('GET', path, jsonResponse(receipt));
});

describe('server-issued booking receipt', () => {
  test('renders supplier, buyer, invoice and exact cents from the authenticated API response', async () => {
    await renderPublic(<ReceiptScreen />, sessionFixture);
    expect(await screen.findByText(receipt.receiptNumber)).toBeOnTheScreen();
    for (const value of ['Tax invoice', receipt.supplierName, receipt.supplierAbn!, receipt.buyerName, receipt.description,
      'AUD $1,234.56', 'Includes GST of AUD $112.23.', `Issued ${fmtLong(receipt.issuedAt)}`,
      `${fmtLong(receipt.sessionStartsAt)} · ${fmtTime(receipt.sessionStartsAt)}`]) {
      expect(screen.getByText(value)).toBeOnTheScreen();
    }
    expect(callsTo('GET', path)).toHaveLength(1);
    expect(callsTo('GET', path)[0][1]?.headers).toEqual(expect.objectContaining({ Authorization: `Bearer ${sessionFixture.accessToken}` }));
  });

  test('does not fabricate a receipt while its API response is pending', async () => {
    const pending = deferred<Response>();
    reply('GET', path, pending.promise);
    await renderPublic(<ReceiptScreen />, sessionFixture);
    expect(screen.queryByText('Total paid')).toBeNull();
    expect(screen.queryByText(receipt.receiptNumber)).toBeNull();
    await act(async () => pending.resolve(jsonResponse(receipt)));
    expect(await screen.findByText(receipt.receiptNumber)).toBeOnTheScreen();
  });

  test('a non-tax receipt hides ABN and explains that no GST was charged', async () => {
    reply('GET', path, jsonResponse({ ...receipt, isTaxInvoice: false, totalMinor: 99, gstMinor: 0 }));
    await renderPublic(<ReceiptScreen />, sessionFixture);
    expect(await screen.findByText(receipt.receiptNumber)).toBeOnTheScreen();
    expect(screen.getByText('AUD $0.99')).toBeOnTheScreen();
    expect(screen.getByText('No GST has been charged on this supply.')).toBeOnTheScreen();
    expect(screen.queryByText('Tax invoice')).toBeNull();
    expect(screen.queryByText('ABN')).toBeNull();
    expect(screen.queryByText(receipt.supplierAbn!)).toBeNull();
  });

  test('a tax invoice without a supplier ABN omits an empty ABN row', async () => {
    reply('GET', path, jsonResponse({ ...receipt, supplierAbn: null, totalMinor: 0, gstMinor: 0 }));
    await renderPublic(<ReceiptScreen />, sessionFixture);
    expect(await screen.findByText('Tax invoice')).toBeOnTheScreen();
    expect(screen.getByText('AUD $0.00')).toBeOnTheScreen();
    expect(screen.queryByText('ABN')).toBeNull();
  });

  test.each([[403, 'This receipt is not available to your account.'], [404, 'Receipt not found.']])('HTTP %i never renders another booking receipt', async (status, message) => {
    reply('GET', path, apiFailure('UNAVAILABLE', message as string, status as number));
    await renderPublic(<ReceiptScreen />, sessionFixture);
    expect(await screen.findByText(message as string)).toBeOnTheScreen();
    expect(screen.queryByText('Total paid')).toBeNull();
    expect(screen.queryByText(receipt.supplierName)).toBeNull();
  });

  test('a network error renders a recoverable explanation without payment facts', async () => {
    reply('GET', path, new TypeError('offline'));
    await renderPublic(<ReceiptScreen />, sessionFixture);
    expect(await screen.findByText('We could not reach Yoir. Check your connection and try again.')).toBeOnTheScreen();
    expect(screen.queryByText('Total paid')).toBeNull();
  });

  test('guest access does not request or expose receipt data', async () => {
    await renderPublic(<ReceiptScreen />);
    expect(callsTo('GET', path)).toHaveLength(0);
    expect(screen.queryByText(receipt.receiptNumber)).toBeNull();
  });

  test('missing booking ID does not request an unrelated receipt', async () => {
    routeParams({});
    await renderPublic(<ReceiptScreen />, sessionFixture);
    expect(callsTo('GET', path)).toHaveLength(0);
    expect(screen.queryByText('Total paid')).toBeNull();
  });

  test.each([true, false])('Back respects history availability = %s', async (hasHistory) => {
    navigation.canGoBack.mockReturnValue(hasHistory);
    await renderPublic(<ReceiptScreen />, sessionFixture);
    await screen.findByText(receipt.receiptNumber);
    fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
    if (hasHistory) expect(navigation.back).toHaveBeenCalledTimes(1);
    else expect(navigation.replace).toHaveBeenCalledWith('/bookings');
  });
});
