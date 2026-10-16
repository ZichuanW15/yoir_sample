import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, ApiError, userFacingError } from '@/src/api/client';
import {
  CounsellorProfile,
  DiagnosisDirection,
  DiagnosisMarketplaceCriteria,
  DiagnosisQuestionnaire,
  DiagnosisRecord,
  DiagnosisStepId,
  Service,
} from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { Glyph } from '@/src/components/Glyph';
import { Avatar, Button, Card, ErrorBanner, Spinner, Tag } from '@/src/components/ui';
import { initials, modalityLabel, money } from '@/src/format';
import { colors, fonts, radius, type } from '@/src/theme';

interface DiagnosisState {
  accountId: string | null;
  questionnaire: DiagnosisQuestionnaire | null;
  record: DiagnosisRecord | null;
  direction: DiagnosisDirection | null;
  criteria: DiagnosisMarketplaceCriteria | null;
}

const emptyState: DiagnosisState = {
  accountId: null,
  questionnaire: null,
  record: null,
  direction: null,
  criteria: null,
};

/**
 * The signed-in Job Seeker's server-backed diagnosis.
 *
 * The backend owns the questionnaire, saved progress and direction rules. This hook
 * deliberately keeps no device copy, so reopening on another device returns the
 * same confirmed revision instead of running a second set of client-side rules.
 */
export function useDiagnosis() {
  const { session } = useAuth();
  const token = session?.user.role === 'job_seeker' ? session.accessToken : null;
  const accountId = session?.user.role === 'job_seeker' ? session.user.id : null;
  const activeToken = useRef(token);
  const [state, setState] = useState<DiagnosisState>(emptyState);
  const [loading, setLoading] = useState(Boolean(token));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    activeToken.current = token;
    return () => {
      if (activeToken.current === token) activeToken.current = null;
    };
  }, [token]);

  const loadResult = useCallback(async (record: DiagnosisRecord, accessToken: string) => {
    if (activeToken.current !== accessToken) return;
    if (record.status !== 'answers_complete') {
      setState((current) => ({ ...current, direction: null, criteria: null }));
      return;
    }
    const [direction, criteria] = await Promise.all([
      api.getDiagnosisDirection(record.id, accessToken),
      api.getDiagnosisMarketplaceCriteria(record.id, accessToken),
    ]);
    if (activeToken.current !== accessToken) return;
    setState((current) => ({ ...current, direction, criteria }));
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const questionnaire = await api.getDiagnosisQuestionnaire(token);
      if (activeToken.current !== token) return;
      let record: DiagnosisRecord | null = null;
      try {
        record = await api.getOwnDiagnosis(token);
      } catch (cause) {
        if (!(cause instanceof ApiError) || cause.status !== 404) throw cause;
      }
      if (activeToken.current !== token) return;
      setState({ accountId, questionnaire, record, direction: null, criteria: null });
      if (record?.status === 'answers_complete') await loadResult(record, token);
    } catch (cause) {
      if (activeToken.current === token) setError(userFacingError(cause));
    } finally {
      if (activeToken.current === token) setLoading(false);
    }
  }, [accountId, loadResult, token]);

  useEffect(() => {
    if (token) void Promise.resolve().then(refresh);
  }, [refresh, token]);

  const start = useCallback(async (): Promise<DiagnosisRecord> => {
    if (!token || !state.questionnaire) throw new Error('Diagnosis is not ready.');
    setSaving(true);
    setError('');
    try {
      const record = await api.startDiagnosis(state.questionnaire.version, token);
      if (activeToken.current !== token) return record;
      setState((current) => ({ ...current, record }));
      return record;
    } catch (cause) {
      if (activeToken.current === token) setError(userFacingError(cause));
      throw cause;
    } finally {
      if (activeToken.current === token) setSaving(false);
    }
  }, [state.questionnaire, token]);

  const saveStep = useCallback(async (
    stepId: DiagnosisStepId,
    value: string | string[],
    other?: string | null,
  ): Promise<DiagnosisRecord> => {
    const record = state.record;
    if (!token || !record) throw new Error('Diagnosis has not started.');
    setSaving(true);
    setError('');
    try {
      const next = await api.saveDiagnosisStep(
        record.id,
        stepId,
        {
          questionnaireVersion: record.questionnaireVersion,
          expectedRevision: record.revision,
          value,
          other,
        },
        token,
      );
      if (activeToken.current !== token) return next;
      setState((current) => ({ ...current, record: next, direction: null, criteria: null }));
      if (next.status === 'answers_complete' && stepId === 'barriers') {
        try {
          await loadResult(next, token);
        } catch (cause) {
          // The answer is already confirmed. Move to the result screen and let its
          // retry recover the derived result instead of submitting this step twice.
          if (activeToken.current === token) setError(userFacingError(cause));
        }
      }
      return next;
    } catch (cause) {
      if (activeToken.current === token) {
        setError(userFacingError(cause));
        if (cause instanceof ApiError && cause.status === 409) await refresh();
      }
      throw cause;
    } finally {
      if (activeToken.current === token) setSaving(false);
    }
  }, [loadResult, refresh, state.record, token]);

  return {
    ...(token && state.accountId === accountId ? state : emptyState),
    loading: token ? (state.accountId !== accountId || loading) : false,
    saving: token ? saving : false,
    error: token ? error : '',
    refresh,
    start,
    saveStep,
  };
}

export function DirectionCard({ direction }: { direction: DiagnosisDirection }) {
  return (
    <Card style={styles.direction}>
      <View style={styles.tag}><Tag label="Main area to work on" bg={colors.yellowTint} fg={colors.amberInk} /></View>
      <Text style={type.display24}>{direction.area}</Text>
      <Text style={type.body}>{direction.summary}</Text>
      <Text style={[type.label, styles.stepsLabel]}>Suggested next steps</Text>
      {direction.suggestedSteps.map((step, index) => (
        <View key={step} style={styles.step}>
          <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View>
          <Text style={[type.bodySm, styles.stepText]}>{step}</Text>
        </View>
      ))}
    </Card>
  );
}

interface Professional { profile: CounsellorProfile; services: Service[] }

/** Career Professionals selected by the backend's diagnosis criteria. */
export function BestMatches({
  criteria, limit,
}: {
  criteria: DiagnosisMarketplaceCriteria | null;
  limit: number;
}) {
  const [professionals, setProfessionals] = useState<Professional[] | null>(null);
  const [error, setError] = useState('');
  const query = criteria?.query ?? '';
  const modality = criteria?.modality ?? null;

  const load = useCallback(async () => {
    try {
      const [profiles, services] = await Promise.all([
        api.listCounsellors(query),
        api.listServices(query, modality),
      ]);
      setProfessionals(profiles.map((profile) => ({
        profile,
        services: services.filter((service) => service.counsellor.id === profile.id),
      })));
      setError('');
    } catch (value) {
      setError(userFacingError(value));
    }
  }, [modality, query]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  if (error) {
    return (
      <View style={styles.list}>
        <ErrorBanner message={error} />
        <Button label="Try again" tone="outline" height={48} onPress={() => { void load(); }} />
      </View>
    );
  }
  if (!professionals) return <View style={styles.loading}><Spinner size={26} color={colors.green} /></View>;
  if (professionals.length === 0) {
    return (
      <Text style={type.body}>
        {criteria
          ? 'No Career Professionals currently match this direction. Explore all services or check back soon.'
          : 'No Career Professionals are listed yet. Check back soon.'}
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {professionals.slice(0, limit).map(({ profile, services }, index) => {
        const verified = profile.verificationStatus === 'verified';
        const from = services.length ? Math.min(...services.map((s) => s.priceMinor)) : null;
        return (
          <Card
            key={profile.id}
            accessibilityLabel={`${profile.displayName}, Career Professional`}
            onPress={() => router.push({ pathname: '/professionals/[counsellorId]', params: { counsellorId: profile.id } })}
            style={styles.professional}
          >
            {criteria ? (
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
