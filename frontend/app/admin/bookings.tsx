import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, userFacingError } from '@/src/api/client';
import { AdminBooking } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { AdminShell } from '@/src/admin/shell';
import { Glyph } from '@/src/components/Glyph';
import { Card, ErrorBanner, Tag } from '@/src/components/ui';
import { fmtLong, fmtTime, modalityLabel, money } from '@/src/format';
import { FadeUp } from '@/src/motion';
import { colors, fonts, type } from '@/src/theme';

const statusTone: Record<string, { bg: string; fg: string }> = {
  confirmed: { bg: colors.greenTint, fg: colors.greenDeep },
  completed: { bg: colors.greenTint, fg: colors.greenDeep },
  paid_out: { bg: colors.greenTint, fg: colors.greenDeep },
  cancelled: { bg: colors.chip, fg: colors.muted },
  refunded: { bg: colors.yellowTint, fg: colors.amberInk },
};

export default function AdminBookingsScreen() {
  const { session } = useAuth();
  const [rows, setRows] = useState<AdminBooking[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setRows(await api.listAllBookings(session.accessToken));
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
    <AdminShell title="Bookings" subtitle="Every session on the platform, most recent first." busy={rows === null}>
      {error ? <ErrorBanner message={error} /> : null}
      {rows && rows.length === 0 ? <Text style={type.body}>Nothing has been booked yet.</Text> : null}

      {(rows ?? []).map((row, index) => {
        const tone = statusTone[row.status] ?? statusTone.cancelled;
        return (
          <FadeUp key={row.id} delay={50 + index * 25}>
            <Card pad={18} style={styles.card}>
              <View style={styles.head}>
                <Text style={styles.title}>{row.serviceTitle}</Text>
                <Tag label={row.status} bg={tone.bg} fg={tone.fg} />
              </View>

              <Text style={styles.parties}>
                {row.jobSeekerName} <Text style={styles.with}>with</Text> {row.counsellorName}
              </Text>

              <View style={styles.line}>
                <Glyph name="calendar" size={14} color={colors.muted} />
                <Text style={styles.lineText}>
                  {fmtLong(row.startsAt)} · {fmtTime(row.startsAt)} ({row.timezone})
                </Text>
              </View>
              <View style={styles.line}>
                <Glyph name={row.modality === 'online' ? 'video' : 'pin'} size={14} color={colors.muted} />
                <Text style={styles.lineText}>
                  {modalityLabel(row.modality)} · {money(row.amountMinor)}
                  {row.refundedMinor > 0 ? ` · ${money(row.refundedMinor)} refunded` : ''}
                </Text>
              </View>
            </Card>
          </FadeUp>
        );
      })}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  parties: { fontFamily: fonts.semi, fontSize: 13, color: colors.muted },
  with: { fontFamily: fonts.sans, color: colors.sub },
  line: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  lineText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
});
