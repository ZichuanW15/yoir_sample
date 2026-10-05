import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, userFacingError } from '@/src/api/client';
import { useAuth } from '@/src/auth/AuthContext';
import { Glyph } from '@/src/components/Glyph';
import { Avatar, Button, Card, ErrorBanner, Spinner, Tag } from '@/src/components/ui';
import { Answers, Direction, Professional, rankProfessionals } from '@/src/diagnosis/model';
import { readDiagnosis, writeDiagnosis } from '@/src/diagnosis/storage';
import { initials, modalityLabel, money } from '@/src/format';
import { colors, fonts, radius, type } from '@/src/theme';

/**
 * A person's diagnosis. Null answers mean they skipped it. `step` is set only while
 * it is unfinished, and is the question it resumes at.
 */
export interface DiagnosisRecord { answers: Answers | null; step?: number }

/** The answers of a finished diagnosis; null if it was skipped, left part-way or never taken. */
export const finishedAnswers = (record: DiagnosisRecord | null | undefined): Answers | null =>
  (record?.answers && record.step === undefined ? record.answers : null);

/**
 * This person's diagnosis: undefined while it is read, null if they have never
 * been through it — which is what sends a new job seeker into it.
 */
export function useDiagnosis() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const key = `yoir.diagnosis.${userId ?? 'guest'}`;
  // Tagged with its key, so a different person's record never shows while theirs loads.
  const [loaded, setLoaded] = useState<{ key: string; record: DiagnosisRecord | null } | null>(null);

  useEffect(() => {
    let live = true;
    // A guest has no diagnosis: nothing is ever stored for one, so nothing is read.
    if (!userId) return;
    void readDiagnosis(key).then((raw) => {
      if (!live) return;
      let record: DiagnosisRecord | null = null;
      try {
        record = raw ? (JSON.parse(raw) as DiagnosisRecord) : null;
      } catch {
        // Unreadable answers are treated as none: they take the diagnosis again.
      }
      setLoaded({ key, record });
    });
    return () => { live = false; };
  }, [key, userId]);

  const save = useCallback(async (next: DiagnosisRecord) => {
    setLoaded({ key, record: next });
    await writeDiagnosis(key, JSON.stringify(next));
  }, [key]);

  return { record: !userId ? null : loaded?.key === key ? loaded.record : undefined, save };
}

/** The main area to work on and the suggested next steps. */
export function DirectionCard({ direction }: { direction: Direction }) {
  return (
    <Card style={styles.direction}>
      <View style={styles.tag}><Tag label="Main area to work on" bg={colors.yellowTint} fg={colors.amberInk} /></View>
      <Text style={type.display24}>{direction.area}</Text>
      <Text style={type.body}>{direction.summary}</Text>
      <Text style={[type.label, styles.stepsLabel]}>Suggested next steps</Text>
      {direction.steps.map((step, index) => (
        <View key={step} style={styles.step}>
          <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View>
          <Text style={[type.bodySm, styles.stepText]}>{step}</Text>
        </View>
      ))}
    </Card>
  );
}

/** Career Professionals ranked against the direction; by rating when there is none. */
export function BestMatches({ direction, limit }: { direction: Direction | null; limit: number }) {
  const [professionals, setProfessionals] = useState<Professional[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [profiles, services] = await Promise.all([api.listCounsellors(), api.listServices()]);
      setProfessionals(profiles.map((profile) => ({
        profile, services: services.filter((service) => service.counsellor.id === profile.id),
      })));
      setError('');
    } catch (value) {
      setError(userFacingError(value));
    }
  }, []);
  useEffect(() => {
    const run = async () => { await load(); };
    void run();
  }, [load]);

  const ranked = useMemo(
    () => (professionals ? rankProfessionals(professionals, direction).slice(0, limit) : []),
    [professionals, direction, limit],
  );

  if (error) {
    return (
      <View style={styles.list}>
        <ErrorBanner message={error} />
        <Button label="Try again" tone="outline" height={48} onPress={() => { void load(); }} />
      </View>
    );
  }
  if (!professionals) return <View style={styles.loading}><Spinner size={26} color={colors.green} /></View>;
  if (ranked.length === 0) return <Text style={type.body}>No Career Professionals are listed yet. Check back soon.</Text>;

  return (
    <View style={styles.list}>
      {ranked.map(({ professional: { profile, services }, match }, index) => {
        const verified = profile.verificationStatus === 'verified';
        const from = services.length ? Math.min(...services.map((s) => s.priceMinor)) : null;
        return (
          <Card
            key={profile.id}
            accessibilityLabel={`${profile.displayName}, Career Professional`}
            onPress={() => router.push({ pathname: '/professionals/[counsellorId]', params: { counsellorId: profile.id } })}
            style={styles.professional}
          >
            {match ? (
              <View style={styles.tag}>
                <Tag
                  label={index === 0 ? 'Best match' : 'Good match'}
                  bg={index === 0 ? colors.yellowTint : colors.greenTint}
                  fg={index === 0 ? colors.amberInk : colors.green}
                  icon={index === 0 ? <Glyph name="sparkle" size={12} color={colors.amberInk} /> : undefined}
                />
              </View>
            ) : null}
            <View style={styles.who}>
              <Avatar initials={initials(profile.displayName)} photo={profile.photoUrl} size={52} bg={colors.greenTint} fg={colors.green} />
              <View style={styles.whoCopy}>
                <Text style={type.display20}>{profile.displayName}</Text>
                <View style={styles.proof}>
                  {verified ? <Glyph name="shieldCheck" size={13} color={colors.greenDeep} /> : null}
                  <Text style={styles.proofText}>
                    {[verified ? 'Verified' : 'New to Yoir',
                      profile.overallRating !== null ? `★ ${profile.overallRating.toFixed(1)} (${profile.reviewCount})` : null,
                    ].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </View>
            </View>
            {profile.introduction ? <Text style={type.bodySm} numberOfLines={3}>{profile.introduction}</Text> : null}
            {profile.expertise.length ? (
              <View style={styles.tags}>
                {profile.expertise.slice(0, 3).map((item) => <Tag key={item} label={item} bg={colors.greenTint} fg={colors.green} />)}
              </View>
            ) : null}
            <View style={styles.foot}>
              <Text style={styles.footText} numberOfLines={1}>
                {profile.languages.length ? `Speaks ${profile.languages.join(', ')}` : `${modalityLabel(profile.defaultModality)} sessions`}
              </Text>
              {from !== null ? <Text style={styles.price}>From {money(from)}</Text> : null}
              <Glyph name="chevronRight" size={16} color={colors.sub} />
            </View>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  direction: { gap: 12 },
  tag: { alignSelf: 'flex-start' },
  stepsLabel: { marginTop: 4 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNumber: {
    width: 26, height: 26, borderRadius: radius.pill, backgroundColor: colors.greenTint,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumberText: { fontFamily: fonts.extra, fontSize: 12, color: colors.green },
  stepText: { flex: 1, paddingTop: 3 },
  list: { gap: 12 },
  loading: { paddingVertical: 30, alignItems: 'center' },
  professional: { gap: 12 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  whoCopy: { flex: 1, gap: 3 },
  proof: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  proofText: { fontFamily: fonts.semi, fontSize: 12, color: colors.muted },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  foot: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.lineSoft,
  },
  footText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  price: { fontFamily: fonts.extra, fontSize: 15, color: colors.green },
});
