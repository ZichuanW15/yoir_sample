import { Modality, Service } from '@/src/api/types';

export type SortKey = 'recommended' | 'price_asc' | 'price_desc' | 'rating_desc';

/** US-45 — the supported public search dimensions, applied over the listed services. */
export interface ServiceFilters {
  modality: Modality | 'any';
  state: string | 'any';
  maxPriceMinor: number | null;
  minRating: number | null;
  sort: SortKey;
}

export const defaultFilters: ServiceFilters = {
  modality: 'any', state: 'any', maxPriceMinor: null, minRating: null, sort: 'recommended',
};

export const sortLabels: Record<SortKey, string> = {
  recommended: 'Recommended',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  rating_desc: 'Highest rated',
};

export const priceOptions = [
  { label: 'Under $75', value: 7500 },
  { label: 'Under $120', value: 12000 },
  { label: 'Under $200', value: 20000 },
];

export const ratingOptions = [
  { label: '4.0+', value: 4 },
  { label: '4.5+', value: 4.5 },
];

/** How many narrowing filters the buyer has applied; sort order is not a narrowing filter. */
export const activeFilterCount = (filters: ServiceFilters) =>
  [filters.modality !== 'any', filters.state !== 'any', filters.maxPriceMinor !== null, filters.minRating !== null]
    .filter(Boolean).length;

/** The states offered as location filters are only those the current results cover. */
export const availableStates = (services: Service[]) =>
  [...new Set(services.map((service) => service.location?.state).filter((state): state is string => Boolean(state)))].sort();

const rank = (service: Service) =>
  (service.counsellor.verificationStatus === 'verified' ? 1000 : 0) + (service.averageRating ?? 0) * 10 + Math.min(service.reviewCount, 9) / 10;

export function applyServiceFilters(services: Service[], filters: ServiceFilters): Service[] {
  const matched = services.filter((service) => {
    if (filters.modality !== 'any' && !service.modalities.includes(filters.modality)) return false;
    if (filters.state !== 'any' && service.location?.state !== filters.state) return false;
    if (filters.maxPriceMinor !== null && service.priceMinor > filters.maxPriceMinor) return false;
    if (filters.minRating !== null && (service.averageRating ?? 0) < filters.minRating) return false;
    return true;
  });

  const sorted = [...matched];
  if (filters.sort === 'price_asc') sorted.sort((a, b) => a.priceMinor - b.priceMinor);
  else if (filters.sort === 'price_desc') sorted.sort((a, b) => b.priceMinor - a.priceMinor);
  else if (filters.sort === 'rating_desc') sorted.sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0));
  else sorted.sort((a, b) => rank(b) - rank(a));
  return sorted;
}
