import { LinearGradient } from 'expo-linear-gradient';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { ReactElement, ReactNode, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { api, userFacingError } from '@/src/api/client';
import { Service } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { Glyph } from '@/src/components/Glyph';
import { VerifyEmailBanner } from '@/src/components/VerifyEmailBanner';
import { JobSeekerNav } from '@/src/components/JobSeekerNav';
import { TopBar } from '@/src/components/TopBar';
import { EmptySearchMark } from '@/src/components/Scenes';
import { Avatar, Card, Chip, ErrorBanner, Press, Tag } from '@/src/components/ui';
import { DesktopPage, PageHeader, useDesktop } from '@/src/desktop';
import { useDiagnosis } from '@/src/diagnosis/view';
import { initials, modalityLabel, money } from '@/src/format';
import {
  activeFilterCount, applyServiceFilters, availableStates, defaultFilters, priceOptions,
  ratingOptions, ServiceFilters, sortLabels, SortKey,
} from '@/src/marketplace/filters';
import { FadeUp, Pop, ScreenIn } from '@/src/motion';
import { colors, fonts, radius, type } from '@/src/theme';

/** The redesign holds the shimmer for a beat after every load so the list never snaps in. */
const SKELETON_MS = 900;

export default function MarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const { session } = useAuth();
  // US-13: a Job Seeker's Yoir Direction follows them here. Arriving from the
  // direction itself (`match`) puts the services that fit it first straight away.
  const { match } = useLocalSearchParams<{ match?: string }>();
  const { direction, criteria } = useDiagnosis();
  const [matchFirst, setMatchFirst] = useState(match === '1');

  const [services, setServices] = useState<Service[]>([]);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ServiceFilters>(defaultFilters);
  const [panelOpen, setPanelOpen] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [holding, setHolding] = useState(true);
  const [error, setError] = useState('');
  const [matchedServiceIds, setMatchedServiceIds] = useState<string[] | null>(null);
  const [matchError, setMatchError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => { if (live) setHolding(false); }, SKELETON_MS);
    api.listServices()
      .then((listed) => { if (live) setServices(listed); })
      .catch((value) => { if (live) setError(userFacingError(value)); })
      .finally(() => { if (live) setFetching(false); });
    return () => { live = false; clearTimeout(timer); };
  }, [attempt]);

  useEffect(() => {
    let live = true;
    if (!criteria) {
      return () => { live = false; };
    }
    if (!criteria.query) {
      void Promise.resolve().then(() => {
        if (live) {
          setMatchedServiceIds([]);
          setMatchError('');
        }
      });
      return () => { live = false; };
    }
    void api.listServices(criteria.query, criteria.modality)
      .then((matched) => {
        if (live) {
          setMatchedServiceIds(matched.map((service) => service.id));
          setMatchError('');
        }
      })
      .catch((value) => { if (live) setMatchError(userFacingError(value)); });
    return () => { live = false; };
  }, [criteria]);

  /** A retry re-arms the skeleton before asking for the catalogue again. */
  const reload = () => {
    setFetching(true);
    setHolding(true);
    setError('');
    setAttempt((n) => n + 1);
  };

  const loading = fetching || holding;

  // The search runs over the loaded catalogue, exactly as the prototype does: typing
  // narrows in place rather than firing a new request and a new skeleton.
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter((service) => `${service.title} ${service.counsellor.displayName}`.toLowerCase().includes(q));
  }, [services, query]);

  const states = useMemo(() => availableStates(searched), [searched]);
  const visible = useMemo(() => applyServiceFilters(searched, filters), [searched, filters]);
  const listed = useMemo(() => {
    if (!direction || !matchFirst || !matchedServiceIds) {
      return visible.map((service) => ({ service, match: false }));
    }
    const rank = new Map(matchedServiceIds.map((id, index) => [id, index]));
    return visible
      .map((service, index) => ({ service, index, rank: rank.get(service.id) }))
      .sort((a, b) => {
        if (a.rank !== undefined && b.rank !== undefined) return a.rank - b.rank;
        if (a.rank !== undefined) return -1;
        if (b.rank !== undefined) return 1;
        return a.index - b.index;
      })
      .map(({ service, rank: matchedRank }) => ({ service, match: matchedRank !== undefined }));
  }, [visible, direction, matchFirst, matchedServiceIds]);
  const fitting = listed.filter((entry) => entry.match).length;
  const narrowed = activeFilterCount(filters);
  const active = narrowed > 0 || panelOpen;
  const filterBg = active ? colors.green : colors.white;
  const filterFg = active ? colors.white : colors.green;

  const greeting = session
    ? `Find your next step, ${session.user.name.split(' ')[0]}`
    : 'Find the Career Professional for your next step';

  const update = <K extends keyof ServiceFilters>(key: K, value: ServiceFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const clearFilters = () => { setFilters(defaultFilters); setQuery(''); };

  // One set of filter controls: in the mobile panel behind the filter button, and
  // always open in its own column on desktop, where the chips are the design's smaller size.
  const FilterChip = desktop ? CompactChip : Chip;
  const filterGroups = (
    <>
      <FilterGroup label="Delivery">
        <FilterChip label="Any" selected={filters.modality === 'any'} onPress={() => update('modality', 'any')} />
        <FilterChip label="Online" selected={filters.modality === 'online'} onPress={() => update('modality', 'online')} />
        <FilterChip label="In person" selected={filters.modality === 'in_person'} onPress={() => update('modality', 'in_person')} />
      </FilterGroup>

      {states.length ? (
        <FilterGroup label="Location">
          <FilterChip label="Anywhere" selected={filters.state === 'any'} onPress={() => update('state', 'any')} />
          {states.map((state) => (
            <FilterChip key={state} label={state} selected={filters.state === state} onPress={() => update('state', state)} />
          ))}
        </FilterGroup>
      ) : null}

      <FilterGroup label="Price">
        <FilterChip label="Any price" selected={filters.maxPriceMinor === null} onPress={() => update('maxPriceMinor', null)} />
        {priceOptions.map((option) => (
          <FilterChip
            key={option.value}
            label={option.label}
            selected={filters.maxPriceMinor === option.value}
            onPress={() => update('maxPriceMinor', option.value)}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Rating">
        <FilterChip label="Any rating" selected={filters.minRating === null} onPress={() => update('minRating', null)} />
        {ratingOptions.map((option) => (
          <FilterChip
            key={option.value}
            label={option.label}
            selected={filters.minRating === option.value}
            onPress={() => update('minRating', option.value)}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Sort by">
        {(Object.keys(sortLabels) as SortKey[]).map((key) => (
          <FilterChip key={key} label={sortLabels[key]} selected={filters.sort === key} onPress={() => update('sort', key)} />
        ))}
      </FilterGroup>
    </>
  );

  if (desktop) {
    return (
      <DesktopPage>
        <PageHeader
          eyebrow="Explore"
          title={greeting}
          right={(
            <View style={styles.desktopSearch}>
              <Glyph name="search" size={18} color={colors.sub} />
              <TextInput
                accessibilityLabel="Search services or Career Professionals"
                value={query}
                onChangeText={setQuery}
                placeholder="Search services or people"
                placeholderTextColor={colors.sub}
                style={styles.searchInput}
              />
            </View>
          )}
        />

        <VerifyEmailBanner what="book a session" />

        <View style={styles.desktopRow}>
          <View style={[styles.panel, styles.desktopFilters]}>
            <View style={styles.desktopFiltersHead}>
              <Text style={styles.desktopFiltersTitle}>{narrowed ? `Filters · ${narrowed} applied` : 'Filters'}</Text>
              {narrowed || query.trim() ? (
                <Press onPress={clearFilters} scaleTo={0.96} accessibilityLabel="Clear filters">
                  <Text style={styles.desktopClear}>Clear</Text>
                </Press>
              ) : null}
            </View>
            {filterGroups}
          </View>

          <View style={styles.desktopResults}>
            {direction ? (
              <FadeUp delay={150} style={[styles.direction, styles.desktopDirection]}>
                <View style={styles.desktopDirectionCopy}>
                  <View style={styles.directionHead}>
                    <Glyph name="sparkle" size={14} color={colors.amberInk} />
                    <Text style={[type.eyebrow, styles.directionEyebrow]}>Your Yoir Direction</Text>
                  </View>
                  <Text style={styles.desktopDirectionArea}>{direction.area}</Text>
                  {matchFirst && !loading && !error && !fitting ? (
                    <Text style={styles.directionNote}>
                      No service listed here fits this direction yet, so the list is in its usual order.
                    </Text>
                  ) : null}
                </View>
                <Chip
                  label="Best matches first"
                  role="checkbox"
                  selected={matchFirst}
                  onPress={() => setMatchFirst((on) => !on)}
                />
                <Press
                  onPress={() => router.push({ pathname: '/job-seeker/diagnosis', params: { result: '1' } } as Href)}
                  accessibilityLabel="View my Yoir Direction"
                  style={styles.directionLink}
                >
                  <Text style={styles.directionLinkText}>View my direction</Text>
                  <Glyph name="chevronRight" size={13} color={colors.green} />
                </Press>
              </FadeUp>
            ) : null}
            {direction && matchError ? <ErrorBanner message={matchError} /> : null}

            <View style={styles.resultRow}>
              <Text style={styles.resultCount}>{loading ? 'Loading services' : `${visible.length} of ${services.length} services`}</Text>
              <Text style={styles.sortLabel}>{fitting ? 'Best for your direction' : sortLabels[filters.sort]}</Text>
            </View>

            {loading ? (
              <CardGrid min={330}>
                {[0, 150, 300, 450].map((delay) => <Shimmer key={delay} delay={delay} />)}
              </CardGrid>
            ) : error ? (
              <View style={styles.retry}>
                <ErrorBanner message={error} />
                <Press onPress={reload} scaleTo={0.96} accessibilityLabel="Try again" style={styles.clearOutline}>
                  <Text style={styles.clearOutlineText}>Try again</Text>
                </Press>
              </View>
            ) : visible.length ? (
              <CardGrid min={330}>
                {listed.map(({ service, match: fits }, index) => (
                  <ServiceRow key={service.id} service={service} index={index} fits={fits} desktop />
                ))}
              </CardGrid>
            ) : (
              <FadeUp duration={400} style={styles.empty}>
                <View style={styles.desktopEmptyMark}><Glyph name="search" size={28} color={colors.green} /></View>
                <Text style={styles.emptyTitle}>No services match your search.</Text>
                <Text style={styles.emptyBody}>Try a different keyword, or widen the filters you have applied.</Text>
                <Press onPress={clearFilters} scaleTo={0.96} accessibilityLabel="Clear filters" style={styles.clearSoft}>
                  <Text style={styles.clearSoftText}>Clear filters</Text>
                </Press>
              </FadeUp>
            )}
          </View>
        </View>
      </DesktopPage>
    );
  }

  return (
    <ScreenIn style={styles.screen}>
      <TopBar />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, { paddingBottom: 32 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FadeUp delay={50} style={styles.intro}>
          <Text style={type.eyebrow}>Explore</Text>
          <Text style={type.display34}>{greeting}</Text>
        </FadeUp>

        <VerifyEmailBanner what="book a session" />

        <FadeUp delay={120} style={styles.searchRow}>
          <View style={styles.searchField}>
            <Glyph name="search" size={18} color={colors.sub} />
            <TextInput
              accessibilityLabel="Search services or Career Professionals"
              value={query}
              onChangeText={setQuery}
              placeholder="Search services or people"
              placeholderTextColor={colors.sub}
              style={styles.searchInput}
            />
          </View>
          <Press
            onPress={() => setPanelOpen((open) => !open)}
            scaleTo={0.92}
            accessibilityLabel={panelOpen ? 'Hide filters' : `Show filters${narrowed > 0 ? `, ${narrowed} applied` : ''}`}
            accessibilityState={{ expanded: panelOpen }}
            style={[styles.filterButton, { backgroundColor: filterBg }]}
          >
            <FilterIcon fg={filterFg} bg={filterBg} />
            {narrowed > 0 ? (
              <Pop duration={300} style={styles.count}>
                <Text style={styles.countText}>{narrowed}</Text>
              </Pop>
            ) : null}
          </Press>
        </FadeUp>

        {panelOpen ? (
          <FadeUp duration={350} style={styles.panel}>
            {filterGroups}

            <Press onPress={clearFilters} scaleTo={0.96} accessibilityLabel="Clear filters" style={styles.clearOutline}>
              <Text style={styles.clearOutlineText}>Clear filters</Text>
            </Press>
          </FadeUp>
        ) : null}

        {direction ? (
          <FadeUp delay={150} style={styles.direction}>
            <View style={styles.directionHead}>
              <Glyph name="sparkle" size={14} color={colors.amberInk} />
              <Text style={[type.eyebrow, styles.directionEyebrow]}>Your Yoir Direction</Text>
            </View>
            <Text style={type.display24}>{direction.area}</Text>
            <View style={styles.directionFoot}>
              <Chip
                label="Best matches first"
                role="checkbox"
                selected={matchFirst}
                onPress={() => setMatchFirst((on) => !on)}
              />
              <Press
                onPress={() => router.push({ pathname: '/job-seeker/diagnosis', params: { result: '1' } } as Href)}
                accessibilityLabel="View my Yoir Direction"
                style={styles.directionLink}
              >
                <Text style={styles.directionLinkText}>View my direction</Text>
                <Glyph name="chevronRight" size={13} color={colors.green} />
              </Press>
            </View>
            {/* Nothing is claimed that was not done: with no service to put first, the list is as it was. */}
            {matchFirst && !loading && !error && !fitting ? (
              <Text style={styles.directionNote}>
                No service listed here fits this direction yet, so the list is in its usual order.
              </Text>
            ) : null}
            {matchError ? <ErrorBanner message={matchError} /> : null}
          </FadeUp>
        ) : null}

        <FadeUp delay={180} style={styles.resultRow}>
          <Text style={styles.resultCount}>{loading ? 'Loading services' : `${visible.length} of ${services.length} services`}</Text>
          <Text style={styles.sortLabel}>{fitting ? 'Best for your direction' : sortLabels[filters.sort]}</Text>
        </FadeUp>

        {loading ? (
          <View style={styles.list}>
            <Shimmer delay={0} />
            <Shimmer delay={150} />
            <Shimmer delay={300} />
          </View>
        ) : (
          <View style={styles.list}>
            {error ? (
              <View style={styles.retry}>
                <ErrorBanner message={error} />
                <Press onPress={reload} scaleTo={0.96} accessibilityLabel="Try again" style={styles.clearOutline}>
                  <Text style={styles.clearOutlineText}>Try again</Text>
                </Press>
              </View>
            ) : (
              listed.map(({ service, match: fits }, index) => (
                <ServiceRow key={service.id} service={service} index={index} fits={fits} />
              ))
            )}

            {!error && !visible.length ? (
              <FadeUp duration={400} style={styles.empty}>
                <EmptySearchMark />
                <Text style={styles.emptyTitle}>No services match your search.</Text>
                <Text style={styles.emptyBody}>Try a different keyword, or widen the filters you have applied.</Text>
                <Press onPress={clearFilters} scaleTo={0.96} accessibilityLabel="Clear filters" style={styles.clearSoft}>
                  <Text style={styles.clearSoftText}>Clear filters</Text>
                </Press>
              </FadeUp>
            ) : null}
          </View>
        )}
      </ScrollView>
      <JobSeekerNav />
    </ScreenIn>
  );
}

/** Desktop: the filter column's 34px chip, otherwise the same control as `Chip`. */
function CompactChip({ label, selected, onPress }: { label: string; selected: boolean; onPress(): void }) {
  return (
    <Press
      onPress={onPress}
      scaleTo={0.94}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      style={[styles.compactChip, { backgroundColor: selected ? colors.green : colors.white, borderColor: selected ? colors.green : colors.line }]}
    >
      <Text style={[styles.compactChipText, { color: selected ? colors.white : colors.muted }]}>{label}</Text>
    </Press>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={type.groupLabel}>{label}</Text>
      <View style={styles.groupChips}>{children}</View>
    </View>
  );
}

/**
 * Desktop: as many columns of at least `min` px as fit, the redesign's auto-fill grid.
 * Rows share a height, and a short last row keeps its cards at column width.
 */
function CardGrid({ min, gap = 18, children }: { min: number; gap?: number; children: ReactElement[] }) {
  const [width, setWidth] = useState(0);
  const columns = Math.max(1, Math.floor((width + gap) / (min + gap)));
  const rows: ReactElement[][] = [];
  for (let i = 0; i < children.length; i += columns) rows.push(children.slice(i, i + columns));
  return (
    <View style={{ gap }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {rows.map((row, r) => (
        <View key={r} style={[styles.gridRow, { gap }]}>
          {row.map((child, c) => <View key={child.key ?? c} style={styles.gridCell}>{child}</View>)}
          {Array.from({ length: columns - row.length }, (_, k) => <View key={`gap-${k}`} style={styles.gridCell} />)}
        </View>
      ))}
    </View>
  );
}

function ServiceRow({ service, index, fits, desktop = false }: { service: Service; index: number; fits: boolean; desktop?: boolean }) {
  const { counsellor } = service;
  const verified = counsellor.verificationStatus === 'verified';
  // The desktop grid reads as one set, so its cards share the green avatar.
  const warm = index % 2 === 1 && !desktop;

  return (
    <FadeUp delay={Math.min(index, 5) * 60} style={desktop && styles.gridCell}>
      <Card
        accessibilityLabel={`${service.title} by ${counsellor.displayName}, ${money(service.priceMinor)}`}
        onPress={() => router.push({ pathname: '/services/[serviceId]', params: { serviceId: service.id } })}
        style={desktop && styles.desktopCard}
      >
        {fits ? (
          <View style={styles.fits}>
            <Tag
              label="Fits your direction"
              bg={colors.yellowTint}
              fg={colors.amberInk}
              icon={<Glyph name="sparkle" size={12} color={colors.amberInk} />}
            />
          </View>
        ) : null}
        <View style={styles.cardHead}>
          <Avatar
            initials={initials(counsellor.displayName)}
            size={44}
            bg={warm ? colors.yellowTint : colors.greenTint}
            fg={warm ? colors.amberDeep : colors.ink}
          />
          <View style={styles.cardWho}>
            <Text style={styles.counsellorName}>{counsellor.displayName}</Text>
            <View style={styles.verifyRow}>
              {verified ? <Glyph name="shieldCheck" size={13} color={colors.greenDeep} /> : null}
              <Text style={[styles.verifyText, { color: verified ? colors.greenDeep : colors.amberInk }]}>
                {verified ? 'Verified' : 'Verification pending'}
              </Text>
            </View>
            <Text style={styles.professionalRating}>
              {counsellor.overallRating === null
                ? 'Career Professional · New'
                : `Career Professional · ★ ${counsellor.overallRating.toFixed(1)} (${counsellor.reviewCount})`}
            </Text>
          </View>
          <Text style={styles.price}>{money(service.priceMinor)}</Text>
        </View>

        <Text style={[type.display24, desktop && styles.desktopCardTitle]}>{service.title}</Text>
        <Text numberOfLines={2} style={styles.cardBody}>{service.description}</Text>

        <View style={[styles.cardFoot, desktop && styles.desktopCardFoot]}>
          <View style={styles.tags}>
            {service.modalities.map((modality) => <Tag key={modality} label={modalityLabel(modality)} />)}
            {service.location ? (
              <Tag
                label={`${service.location.cityOrRegion}, ${service.location.state}`}
                bg={colors.yellowTint}
                fg={colors.amberDeep}
              />
            ) : null}
          </View>
          <View style={styles.ratingRow}>
            <Star />
            <Text style={styles.ratingValue}>
              {service.averageRating !== null ? service.averageRating.toFixed(1) : 'New'}
            </Text>
            <Text style={styles.ratingCount}>({service.reviewCount})</Text>
          </View>
        </View>
      </Card>
    </FadeUp>
  );
}

/** The three-line filter mark: its dots are punched out in the button's own colour. */
function FilterIcon({ fg, bg }: { fg: string; bg: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Line x1={4} y1={7} x2={20} y2={7} stroke={fg} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={4} y1={12} x2={20} y2={12} stroke={fg} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={4} y1={17} x2={20} y2={17} stroke={fg} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={9} cy={7} r={2.2} fill={bg} stroke={fg} strokeWidth={1.8} />
      <Circle cx={15} cy={12} r={2.2} fill={bg} stroke={fg} strokeWidth={1.8} />
      <Circle cx={7.5} cy={17} r={2.2} fill={bg} stroke={fg} strokeWidth={1.8} />
    </Svg>
  );
}

function Star() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill={colors.amber} />
    </Svg>
  );
}

/** A 170px card-sized placeholder with the prototype's 1.4s highlight sweep. */
function Shimmer({ delay }: { delay: number }) {
  const [width, setWidth] = useState(0);
  const [t] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!width) return;
    const anim = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }),
    );
    const timer = setTimeout(() => anim.start(), delay);
    return () => { clearTimeout(timer); anim.stop(); };
  }, [t, width, delay]);

  return (
    <View style={styles.shimmer} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width ? (
        <Animated.View
          style={[
            styles.sweep,
            { width: width * 2, transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-width * 2, width * 2] }) }] },
          ]}
        >
          <LinearGradient
            colors={[colors.chip, colors.white, colors.chip]}
            locations={[0.25, 0.5, 0.75]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sweepFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },

  scroll: { flex: 1 },
  body: { paddingTop: 8, paddingHorizontal: 22, gap: 18 },
  intro: { gap: 8 },

  searchRow: { flexDirection: 'row', gap: 10 },
  searchField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, paddingHorizontal: 16,
    backgroundColor: colors.white, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line,
  },
  searchInput: { flex: 1, minWidth: 0, fontFamily: fonts.sans, fontSize: 15, color: colors.ink },
  filterButton: { width: 54, height: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  count: {
    position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, paddingHorizontal: 5,
    borderRadius: radius.pill, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center',
  },
  countText: { fontFamily: fonts.extra, fontSize: 11, color: colors.green },

  panel: { gap: 16, padding: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.xl },
  group: { gap: 9 },
  groupChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  clearOutline: { alignSelf: 'flex-start', height: 40, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  clearOutlineText: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },

  direction: { gap: 10, padding: 18, backgroundColor: colors.yellowTint, borderRadius: radius.xl },
  directionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  directionEyebrow: { color: colors.amberInk },
  directionFoot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 2 },
  directionLink: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 38 },
  directionLinkText: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },
  directionNote: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.amberDeep },
  fits: { alignSelf: 'flex-start' },

  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultCount: { fontFamily: fonts.sans, fontSize: 13, color: colors.sub },
  sortLabel: { fontFamily: fonts.semi, fontSize: 13, color: colors.muted },

  list: { gap: 14 },
  retry: { gap: 14 },
  shimmer: { height: 170, borderRadius: radius.xl, backgroundColor: colors.chip, overflow: 'hidden' },
  sweep: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  sweepFill: { flex: 1 },

  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardWho: { flex: 1, gap: 2 },
  counsellorName: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  verifyText: { fontFamily: fonts.semi, fontSize: 12 },
  professionalRating: { fontFamily: fonts.medium, fontSize: 11, color: colors.amberDeep },
  price: { fontFamily: fonts.extra, fontSize: 20, color: colors.green, letterSpacing: -0.3 },
  cardBody: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.muted },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  tags: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingValue: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  ratingCount: { fontFamily: fonts.medium, fontSize: 13, color: colors.sub },

  empty: { alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 20 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, textAlign: 'center' },
  emptyBody: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.muted, textAlign: 'center' },
  clearSoft: { height: 44, paddingHorizontal: 20, borderRadius: radius.pill, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
  clearSoftText: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },

  desktopSearch: {
    flexDirection: 'row', alignItems: 'center', gap: 10, width: 360, height: 50, paddingHorizontal: 18,
    backgroundColor: colors.white, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line,
  },
  compactChip: { height: 34, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  compactChipText: { fontFamily: fonts.semi, fontSize: 12 },
  desktopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  desktopFilters: { width: 240, gap: 18, padding: 20, borderRadius: 22 },
  desktopFiltersHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  desktopFiltersTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  desktopClear: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },
  desktopResults: { flex: 1, minWidth: 0, gap: 18 },
  desktopDirection: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18, paddingVertical: 18, paddingHorizontal: 22, borderRadius: 22 },
  desktopDirectionCopy: { flex: 1, minWidth: 220, gap: 4 },
  desktopDirectionArea: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 27, color: colors.ink },
  desktopEmptyMark: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
  gridRow: { flexDirection: 'row' },
  gridCell: { flex: 1, minWidth: 0 },
  desktopCard: { flex: 1, gap: 12, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: 22 },
  desktopCardTitle: { fontSize: 22, lineHeight: 26 },
  desktopCardFoot: { marginTop: 'auto' },
});
