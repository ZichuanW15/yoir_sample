import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { api, userFacingError } from '@/src/api/client';
import { Service } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { Glyph } from '@/src/components/Glyph';
import { EmptySearchMark } from '@/src/components/Scenes';
import { Avatar, Card, Chip, ErrorBanner, Press, Tag } from '@/src/components/ui';
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
  const { session } = useAuth();
  const { openSheet } = useChrome();

  const [services, setServices] = useState<Service[]>([]);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ServiceFilters>(defaultFilters);
  const [panelOpen, setPanelOpen] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [holding, setHolding] = useState(true);
  const [error, setError] = useState('');
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
  const narrowed = activeFilterCount(filters);
  const active = narrowed > 0 || panelOpen;
  const filterBg = active ? colors.green : colors.white;
  const filterFg = active ? colors.white : colors.green;

  const greeting = session
    ? `Find your next step, ${session.user.name.split(' ')[0]}`
    : 'Find the counsellor for your next step';

  const update = <K extends keyof ServiceFilters>(key: K, value: ServiceFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const clearFilters = () => { setFilters(defaultFilters); setQuery(''); };

  return (
    <ScreenIn style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Image source={require('@/assets/images/yoir-wordmark.png')} style={styles.wordmark} resizeMode="contain" accessibilityLabel="Yoir" />
        {session ? (
          <Press onPress={openSheet} scaleTo={0.92} accessibilityLabel={`Account, ${session.user.name}`} style={styles.avatarRing}>
            <Avatar initials={initials(session.user.name)} size={42} />
          </Press>
        ) : (
          <Press onPress={() => router.push('/auth/login')} scaleTo={0.96} accessibilityLabel="Log in" style={styles.loginPill}>
            <Text style={styles.loginPillText}>Log in</Text>
          </Press>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, { paddingBottom: 32 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FadeUp delay={50} style={styles.intro}>
          <Text style={type.eyebrow}>Career marketplace</Text>
          <Text style={type.display34}>{greeting}</Text>
        </FadeUp>

        <FadeUp delay={120} style={styles.searchRow}>
          <View style={styles.searchField}>
            <Glyph name="search" size={18} color={colors.sub} />
            <TextInput
              accessibilityLabel="Search services or counsellors"
              value={query}
              onChangeText={setQuery}
              placeholder="Search services or counsellors"
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
            <FilterGroup label="Delivery">
              <Chip label="Any" selected={filters.modality === 'any'} onPress={() => update('modality', 'any')} />
              <Chip label="Online" selected={filters.modality === 'online'} onPress={() => update('modality', 'online')} />
              <Chip label="In person" selected={filters.modality === 'in_person'} onPress={() => update('modality', 'in_person')} />
            </FilterGroup>

            {states.length ? (
              <FilterGroup label="Location">
                <Chip label="Anywhere" selected={filters.state === 'any'} onPress={() => update('state', 'any')} />
                {states.map((state) => (
                  <Chip key={state} label={state} selected={filters.state === state} onPress={() => update('state', state)} />
                ))}
              </FilterGroup>
            ) : null}

            <FilterGroup label="Price">
              <Chip label="Any price" selected={filters.maxPriceMinor === null} onPress={() => update('maxPriceMinor', null)} />
              {priceOptions.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={filters.maxPriceMinor === option.value}
                  onPress={() => update('maxPriceMinor', option.value)}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Rating">
              <Chip label="Any rating" selected={filters.minRating === null} onPress={() => update('minRating', null)} />
              {ratingOptions.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={filters.minRating === option.value}
                  onPress={() => update('minRating', option.value)}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Sort by">
              {(Object.keys(sortLabels) as SortKey[]).map((key) => (
                <Chip key={key} label={sortLabels[key]} selected={filters.sort === key} onPress={() => update('sort', key)} />
              ))}
            </FilterGroup>

            <Press onPress={clearFilters} scaleTo={0.96} accessibilityLabel="Clear filters" style={styles.clearOutline}>
              <Text style={styles.clearOutlineText}>Clear filters</Text>
            </Press>
          </FadeUp>
        ) : null}

        <FadeUp delay={180} style={styles.resultRow}>
          <Text style={styles.resultCount}>{loading ? 'Loading services' : `${visible.length} of ${services.length} services`}</Text>
          <Text style={styles.sortLabel}>{sortLabels[filters.sort]}</Text>
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
              visible.map((service, index) => <ServiceRow key={service.id} service={service} index={index} />)
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
    </ScreenIn>
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

function ServiceRow({ service, index }: { service: Service; index: number }) {
  const { counsellor } = service;
  const verified = counsellor.verificationStatus === 'verified';
  const warm = index % 2 === 1;

  return (
    <FadeUp delay={Math.min(index, 5) * 60}>
      <Card
        accessibilityLabel={`${service.title} by ${counsellor.displayName}, ${money(service.priceMinor)}`}
        onPress={() => router.push({ pathname: '/services/[serviceId]', params: { serviceId: service.id } })}
      >
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
          </View>
          <Text style={styles.price}>{money(service.priceMinor)}</Text>
        </View>

        <Text style={type.display24}>{service.title}</Text>
        <Text numberOfLines={2} style={styles.cardBody}>{service.description}</Text>

        <View style={styles.cardFoot}>
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
  screen: { flex: 1, backgroundColor: colors.white },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingBottom: 6, paddingHorizontal: 22 },
  wordmark: { width: 66, height: 25 },
  avatarRing: { padding: 2, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.yellow, backgroundColor: colors.white },
  loginPill: { height: 40, paddingHorizontal: 18, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  loginPillText: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },

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
});
