import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, userFacingError } from '@/src/api/client';
import { AdminCounsellor } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { AdminShell } from '@/src/admin/shell';
import { Glyph } from '@/src/components/Glyph';
import { Card, ErrorBanner, Tag } from '@/src/components/ui';
import { fmtDay, initials } from '@/src/format';
import { FadeUp } from '@/src/motion';
import { colors, fonts, type } from '@/src/theme';

const currency = (minor: number) =>
  `$${(minor / 100).toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;

const statusTone: Record<string, { bg: string; fg: string }> = {
  pending: { bg: colors.yellowTint, fg: colors.amberInk },
  verified: { bg: colors.greenTint, fg: colors.greenDeep },
  rejected: { bg: colors.dangerBg, fg: colors.dangerInk },
};

export default function AdminCounsellorsScreen() {
  const { session } = useAuth();
  const [rows, setRows] = useState<AdminCounsellor[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setRows(await api.listAllCounsellors(session.accessToken));
      setError('');
    } catch (value) {
      setError(userFacingError(value));
      setRows([]);
    }
  }, [session]);

  useEffect(() => {
    const run = async () => { await load(); };
    void run();
  }, [load]);

  return (
    <AdminShell title="Career Professionals" subtitle="Newest first, with what each has sold." busy={rows === null}>
      {error ? <ErrorBanner message={error} /> : null}
      {rows && rows.length === 0 ? <Text style={type.body}>No Career Professionals yet.</Text> : null}

      {(rows ?? []).map((row, index) => {
        const tone = statusTone[row.verificationStatus] ?? statusTone.pending;
        // Verified but unpayable is the state worth spotting: everything they list
        // is unbookable, and nothing in the app tells them so.
        const blocked = row.verificationStatus === 'verified' && !row.payoutsEnabled;
        return (
          <FadeUp key={row.id} delay={60 + index * 30}>
            <Card pad={18} style={styles.card}>
              <View style={styles.head}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{initials(row.name)}</Text></View>
                <View style={styles.headCopy}>
                  <Text style={styles.name}>{row.name}</Text>
                  <Text style={type.small}>{row.email}</Text>
                </View>
                <Tag label={row.verificationStatus} bg={tone.bg} fg={tone.fg} />
              </View>

              <View style={styles.flags}>
                <Flag ok={row.emailVerified} label="Email confirmed" />
                <Flag ok={row.payoutsEnabled} label="Payouts ready" />
              </View>

              {blocked ? (
                <Text style={styles.warn}>
                  Verified but cannot be paid, so nothing they list can be booked.
                </Text>
              ) : null}

              <View style={styles.figures}>
                <Figure label="Services" value={String(row.serviceCount)} />
                <Figure label="Bookings" value={String(row.bookingCount)} />
                <Figure label="Gross" value={currency(row.grossMinor)} />
                <Figure label="Earned" value={currency(row.payoutMinor)} />
              </View>

              <Text style={styles.meta}>Joined {fmtDay(row.joinedAt)}</Text>
            </Card>
          </FadeUp>
        );
      })}
    </AdminShell>
  );
}

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={styles.flag}>
      <Glyph name={ok ? 'check' : 'close'} size={14} color={ok ? colors.greenDeep : colors.danger} />
      <Text style={[styles.flagText, { color: ok ? colors.greenDeep : colors.danger }]}>{label}</Text>
    </View>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureValue}>{value}</Text>
      <Text style={styles.figureLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 16, backgroundColor: colors.greenTint,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },
  headCopy: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  flagText: { fontFamily: fonts.semi, fontSize: 12 },
  warn: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.amberInk },
  figures: { flexDirection: 'row', gap: 10 },
  figure: { flex: 1, padding: 10, borderRadius: 14, backgroundColor: colors.field, gap: 2 },
  figureValue: { fontFamily: fonts.extra, fontSize: 16, color: colors.ink },
  figureLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.sub },
  meta: { fontFamily: fonts.sans, fontSize: 12, color: colors.sub },
});
