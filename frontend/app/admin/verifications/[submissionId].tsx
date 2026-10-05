import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { api, userFacingError } from '@/src/api/client';
import { VerificationSubmission } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { AdminShell, LoadFailed } from '@/src/admin/shell';
import { Glyph } from '@/src/components/Glyph';
import { Button, Card, ErrorBanner, Field, Press } from '@/src/components/ui';
import { fmtLong } from '@/src/format';
import { FadeUp } from '@/src/motion';
import { goBack } from '@/src/navigation';
import { colors, fonts, radius, type } from '@/src/theme';
import { VerificationTag } from '@/src/verification';

/**
 * US-58, US-33. One Career Professional's submission, and the decision on it.
 *
 * Nothing is sent without a second step: approving asks first, and a rejection
 * needs its reason, which is emailed so they know what to change. A decision
 * already made can be changed here after another look (US-33). The status shown
 * is the backend's: it changes only when the backend has stored the new one.
 */
export default function AdminVerificationScreen() {
  const { submissionId } = useLocalSearchParams<{ submissionId: string }>();
  const { session } = useAuth();
  const { flash, confirm } = useChrome();
  const [row, setRow] = useState<VerificationSubmission | null>();
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      // The backend lists submissions but does not serve one alone.
      const all = await api.listVerificationSubmissions('all', session.accessToken);
      setRow(all.find((entry) => entry.id === submissionId) ?? null);
      setLoadError('');
    } catch (value) {
      setLoadError(userFacingError(value));
    }
  }, [session, submissionId]);

  useEffect(() => {
    const run = async () => { await load(); };
    void run();
  }, [load]);

  const back = () => goBack('/admin/verifications');

  async function decide(decision: 'verified' | 'rejected') {
    if (!session || !row) return;
    if (decision === 'rejected' && !reason.trim()) {
      return setError('Say why, so the Career Professional knows what to change.');
    }
    if (decision === 'verified') {
      const sure = await confirm({
        title: `Approve ${row.counsellorName}?`,
        message: 'They will carry the verified mark across Yoir, and are told by email.',
        confirmLabel: 'Approve',
      });
      if (!sure) return;
    }
    setBusy(true);
    setError('');
    try {
      setRow(await api.decideVerification(row.id, decision, reason.trim(), session.accessToken));
      flash(decision === 'verified' ? `${row.counsellorName} is verified` : `${row.counsellorName} was rejected`);
      setRejecting(false);
      setReason('');
    } catch (value) {
      setError(userFacingError(value));
    } finally {
      setBusy(false);
    }
  }

  const decided = row ? row.status !== 'pending' : false;

  return (
    <AdminShell
      title={row?.counsellorName ?? 'Submission'}
      subtitle={row?.email}
      busy={row === undefined && !loadError}
      back={{ label: 'Verifications', onPress: back }}
    >
      {loadError ? <LoadFailed message={loadError} onRetry={() => { setLoadError(''); void load(); }} /> : null}
      {row === null ? <Text style={type.body}>This submission could not be found.</Text> : null}

      {row ? (
        <>
          <FadeUp>
            <Card pad={18} style={styles.card}>
              <View style={styles.statusRow}>
                <VerificationTag state={row.status} short />
                <Text style={styles.meta}>
                  Applied {fmtLong(row.submittedAt)}{row.decidedAt ? ` · decided ${fmtLong(row.decidedAt)}` : ''}
                </Text>
              </View>

              {row.linkedInUrl ? (
                <Press
                  accessibilityLabel="Open their LinkedIn profile"
                  style={styles.link}
                  onPress={() => { void Linking.openURL(row.linkedInUrl); }}
                >
                  <Glyph name="briefcase" size={16} color={colors.green} />
                  <Text style={styles.linkText} numberOfLines={1}>{row.linkedInUrl}</Text>
                  <Glyph name="chevronRight" size={14} color={colors.green} />
                </Press>
              ) : (
                <Text style={styles.missing}>No LinkedIn profile supplied, so there is nothing to check.</Text>
              )}

              {row.decisionReason ? (
                <View style={styles.previous}>
                  <Text style={type.groupLabel}>Reason given</Text>
                  <Text style={type.small}>{row.decisionReason}</Text>
                </View>
              ) : null}
            </Card>
          </FadeUp>

          {row.introduction || row.background || row.experience ? (
            <FadeUp delay={60}>
              <Card pad={18} style={styles.card}>
                <Prose label="Introduction" text={row.introduction} />
                <Prose label="Background" text={row.background} />
                <Prose label="Experience" text={row.experience} />
              </Card>
            </FadeUp>
          ) : null}

          <FadeUp delay={120}>
            <Card pad={18} style={styles.card}>
              <Text style={type.display24}>{decided ? 'Additional investigation' : 'Your decision'}</Text>
              <Text style={type.small}>
                {decided
                  ? 'Looked again? Record the new outcome. The Career Professional is told by email.'
                  : 'Open the LinkedIn profile first. The Career Professional is told by email either way.'}
              </Text>

              {error ? <ErrorBanner message={error} /> : null}

              {rejecting ? (
                <>
                  <Field
                    label="Why are you rejecting this?"
                    value={reason}
                    onChangeText={setReason}
                    placeholder="They will read this, so say what to change."
                    multiline
                  />
                  <Button label="Confirm rejection" busy={busy} onPress={() => { void decide('rejected'); }} style={styles.reject} />
                  <Button label="Cancel" tone="quiet" height={44} onPress={() => { setRejecting(false); setError(''); }} />
                </>
              ) : (
                <>
                  {row.status === 'verified' ? null : (
                    <Button
                      label={decided ? 'Mark as verified' : 'Approve'}
                      busy={busy}
                      icon={<Glyph name="shieldCheck" size={18} color={colors.white} />}
                      onPress={() => { void decide('verified'); }}
                    />
                  )}
                  {row.status === 'rejected' ? null : (
                    <Button
                      label={decided ? 'Mark as rejected' : 'Reject'}
                      tone="outline"
                      disabled={busy}
                      onPress={() => { setRejecting(true); setError(''); }}
                    />
                  )}
                  <Button
                    label={decided ? 'Keep this outcome' : 'Leave pending'}
                    tone="quiet"
                    height={44}
                    onPress={back}
                  />
                </>
              )}
            </Card>
          </FadeUp>
        </>
      ) : null}
    </AdminShell>
  );
}

function Prose({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <View style={styles.prose}>
      <Text style={type.groupLabel}>{label}</Text>
      <Text style={type.bodySm}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  meta: { fontFamily: fonts.sans, fontSize: 12, color: colors.sub },
  link: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 14, borderRadius: radius.md, backgroundColor: colors.field,
  },
  linkText: { flex: 1, fontFamily: fonts.semi, fontSize: 13, color: colors.green },
  missing: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.danger },
  previous: { padding: 12, borderRadius: radius.md, backgroundColor: colors.chip, gap: 4 },
  prose: { gap: 4 },
  reject: { backgroundColor: colors.danger },
});
