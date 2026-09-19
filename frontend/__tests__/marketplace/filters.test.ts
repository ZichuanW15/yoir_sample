import { Service } from '@/src/api/types';
import {
  activeFilterCount,
  applyServiceFilters,
  availableStates,
  defaultFilters,
} from '@/src/marketplace/filters';
import { serviceFixture } from '../fixtures';

const service = (overrides: Partial<Service> & { id: string }): Service => ({
  ...serviceFixture,
  ...overrides,
  counsellor: { ...serviceFixture.counsellor, ...overrides.counsellor },
});

const online = service({ id: 'online', priceMinor: 9500, modalities: ['online'], averageRating: 4.9 });
const melbourne = service({
  id: 'melbourne',
  priceMinor: 7000,
  modalities: ['online', 'in_person'],
  location: { state: 'VIC', cityOrRegion: 'Melbourne' },
  averageRating: 4.2,
});
const sydney = service({
  id: 'sydney',
  priceMinor: 16500,
  modalities: ['in_person'],
  location: { state: 'NSW', cityOrRegion: 'Sydney' },
  averageRating: 4.6,
});
const unrated = service({
  id: 'unrated',
  priceMinor: 5000,
  modalities: ['online'],
  averageRating: null,
  reviewCount: 0,
  counsellor: { ...serviceFixture.counsellor, verificationStatus: 'pending' },
});
const catalogue = [online, melbourne, sydney, unrated];

const ids = (services: Service[]) => services.map((item) => item.id);

describe('marketplace filters', () => {
  test('returns every service in recommended order by default', () => {
    expect(ids(applyServiceFilters(catalogue, defaultFilters))).toEqual([
      'online',
      'sydney',
      'melbourne',
      'unrated',
    ]);
  });

  test('narrows by delivery method', () => {
    expect(ids(applyServiceFilters(catalogue, { ...defaultFilters, modality: 'in_person' }))).toEqual([
      'sydney',
      'melbourne',
    ]);
  });

  test('narrows by state', () => {
    expect(ids(applyServiceFilters(catalogue, { ...defaultFilters, state: 'VIC' }))).toEqual(['melbourne']);
  });

  test('narrows by maximum price', () => {
    expect(ids(applyServiceFilters(catalogue, { ...defaultFilters, maxPriceMinor: 7500 }))).toEqual([
      'melbourne',
      'unrated',
    ]);
  });

  test('narrows by minimum rating and excludes unrated services', () => {
    expect(ids(applyServiceFilters(catalogue, { ...defaultFilters, minRating: 4.5 }))).toEqual([
      'online',
      'sydney',
    ]);
  });

  test('sorts by price in both directions', () => {
    expect(ids(applyServiceFilters(catalogue, { ...defaultFilters, sort: 'price_asc' }))).toEqual([
      'unrated',
      'melbourne',
      'online',
      'sydney',
    ]);
    expect(ids(applyServiceFilters(catalogue, { ...defaultFilters, sort: 'price_desc' }))).toEqual([
      'sydney',
      'online',
      'melbourne',
      'unrated',
    ]);
  });

  test('sorts by rating with unrated services last', () => {
    expect(ids(applyServiceFilters(catalogue, { ...defaultFilters, sort: 'rating_desc' }))).toEqual([
      'online',
      'sydney',
      'melbourne',
      'unrated',
    ]);
  });

  test('combines narrowing filters', () => {
    expect(
      ids(applyServiceFilters(catalogue, { ...defaultFilters, modality: 'online', maxPriceMinor: 12000, minRating: 4 })),
    ).toEqual(['online', 'melbourne']);
  });

  test('counts only the narrowing filters, not the sort order', () => {
    expect(activeFilterCount(defaultFilters)).toBe(0);
    expect(activeFilterCount({ ...defaultFilters, sort: 'price_asc' })).toBe(0);
    expect(activeFilterCount({ ...defaultFilters, modality: 'online', state: 'VIC' })).toBe(2);
    expect(activeFilterCount({ ...defaultFilters, maxPriceMinor: 9000, minRating: 4 })).toBe(2);
  });

  test('offers only the states the current results cover', () => {
    expect(availableStates(catalogue)).toEqual(['NSW', 'VIC']);
    expect(availableStates([online])).toEqual([]);
  });
});
