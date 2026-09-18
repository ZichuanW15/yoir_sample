import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { api, userFacingError } from '@/src/api/client';
import { VerificationSubmission } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { AdminShell } from '@/src/admin/shell';
import { Glyph } from '@/src/components/Glyph';
import { Button, Card, Chip, ErrorBanner, Field, Press, Tag } from '@/src/components/ui';
import { fmtLong, initials } from '@/src/format';
import { FadeUp } from '@/src/motion';
import { colors, fonts, type } from '@/src/theme';

type Filter = 'pending' | 'verified' | 'rejected' | 'all';

const filters: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'Waiting' },
  { value: 'verified', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'Everyone' },
];

const statusTone: Record<string, { bg: string; fg: string }> = {
  pending: { bg: colors.yellowTint, fg: colors.amberInk },
  verified: { bg: colors.greenTint, fg: colors.greenDeep },
  rejected: { bg: colors.dangerBg, fg: colors.dangerInk },
};

/**
 * US-32, US-58. The review queue.
 *
 * A rejection cannot be sent without a reason: it is emailed to the counsellor, and
 * one without it is a dead end — they cannot tell what to change, so they either
 * give up or resubmit the same profile.
 */
export default function AdminVerificationsScreen() {
  const { session } = useAuth();
  const { flash } = useChrome();
  const [filter, setFilter] = useState<Filter>('pending');
  const [rows, setRows] = useState<VerificationSubmission[] | null>(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setRows(await api.listVerificationSubmissions(filter, session.accessToken));
      setError('');
    } catch (value) {
      setError(userFacingError(value));
      setRows([]);
    }
  }, [session, filter]);

  useEffect(() => {
    const run = async () => { await load(); };
    void run();
  }, [load]);

  async function decide(row: VerificationSubmission, decision: 'verified' | 'rejected') {
    if (!session) return;
    if (decision === 'rejected' && !reason.trim()) {
      setError('Say why, so the counsellor knows what to change.');
      setOpenId(row.id);
      return;
    }
    setBusy(row.id);
    setError('');
    try {
      await api.decideVerification(row.id, decision, reason.trim(), session.accessToken);
      flash(decision === 'verified' ? `${row.counsellorName} is verified` : `${row.counsellorName} was rejected`);
      setReason('');
      setOpenId('');
      await load();
    } catch (value) {
      setError(userFacingError(value));
    } finally {
      setBusy('');
    }
  }

  return (
    <AdminShell
      title="Verifications"
      subtitle="Oldest first, so whoever has waited longest is at the top."
      busy={rows === null}
    >
      <View style={styles.filters}>
        {filters.map((entry) => (
          <Chip
            key={entry.value}
            label={entry.label}
            selected={filter === entry.value}
            onPress={() => { setFilter(entry.value); setRows(null); }}
          />
        ))}
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {rows && rows.length === 0 ? (
        <FadeUp delay={100} style={styles.empty}>
          <Glyph name="check" size={26} color={colors.greenDeep} />
          <Text style={type.body}>
            {filter === 'pending' ? 'Nobody is waiting on a decision.' : 'Nothing here.'}
          </Text>
        </FadeUp>
      ) : null}

      {(rows ?? []).map((row, index) => {
        const tone = statusTone[row.status] ?? statusTone.pending;
        const open = openId === row.id;
        return (
          <FadeUp key={row.id} delay={80 + index * 40}>
            <Card pad={18} style={styles.card}>
              <View style={styles.head}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{initials(row.counsellorName)}</Text></View>
                <View style={styles.headCopy}>
                  <Text style={styles.name}>{row.counsellorName}</Text>
                  <Text style={type.small}>{row.email}</Text>
                </View>
                <Tag label={row.status} bg={tone.bg} fg={tone.fg} />
              </View>

              <Text style={styles.meta}>Applied {fmtLong(row.submittedAt)}</Text>

              {row.linkedInUrl ? (
                <Press
                  accessibilityLabel="Open their LinkedIn profile"
                  scaleTo={0.97}
                  style={styles.link}
                  onPress={() => { void Linking.openURL(row.linkedInUrl); }}
                >
                  <Glyph name="briefcase" size={16} color={colors.green} />
                  <Text style={styles.linkText} numberOfLines={1}>{row.linkedInUrl}</Text>
                  <Glyph name="chevronRight" size={14} color={colors.green} />
                </Press>
              ) : (
                <Text style={styles.missing}>No LinkedIn profile supplied — there is nothing to check.</Text>
              )}

              {row.introduction ? <Text style={styles.prose}>{row.introduction}</Text> : null}
              {row.background ? <Text style={styles.prose}>{row.background}</Text> : null}
              {row.experience ? <Text style={styles.prose}>{row.experience}</Text> : null}

              {row.decisionReason ? (
                <View style={styles.previous}>
                  <Text style={styles.previousLabel}>Last decision</Text>
                  <Text style={styles.previousText}>{row.decisionReason}</Text>
                </View>
              ) : null}

              {row.status === 'pending' ? (
                <>
                  {open ? (
                    <Field
                      label="Why are you rejecting this?"
                      value={reason}
                      onChangeText={setReason}
                      placeholder="They will read this, so say what to change."
                      multiline
                    />
                  ) : null}
                  <View style={styles.actions}>
                    <Button
                      label="Approve"
                      height={44}
                      labelSize={14}
                      style={styles.action}
                      busy={busy === row.id}
                      onPress={() => decide(row, 'verified')}
                    />
                    <Button
                      label={open ? 'Confirm rejection' : 'Reject'}
                      tone={open ? 'danger' : 'outline'}
                      height={44}
                      labelSize={14}
                      style={styles.action}
                      busy={busy === row.id}
                      onPress={() => (open ? decide(row, 'rejected') : (setOpenId(row.id), setReason('')))}
                    />
                  </View>
                </>
              ) : null}
            </Card>
          </FadeUp>
        );
      })}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 16, backgroundColor: colors.greenTint,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },
  headCopy: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  meta: { fontFamily: fonts.sans, fontSize: 12, color: colors.sub },
  link: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 16, backgroundColor: colors.field,
  },
  linkText: { flex: 1, fontFamily: fonts.semi, fontSize: 12, color: colors.green },
  missing: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.danger },
  prose: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.muted },
  previous: { padding: 12, borderRadius: 16, backgroundColor: colors.chip, gap: 3 },
  previousLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.sub, textTransform: 'uppercase', letterSpacing: 1 },
  previousText: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.muted },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 40 },
});
