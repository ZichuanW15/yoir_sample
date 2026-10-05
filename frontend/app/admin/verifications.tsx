import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, userFacingError } from '@/src/api/client';
import { VerificationSubmission } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { AdminShell, LoadFailed } from '@/src/admin/shell';
import { Glyph } from '@/src/components/Glyph';
import { Card, Chip } from '@/src/components/ui';
import { fmtLong, initials } from '@/src/format';
import { FadeUp } from '@/src/motion';
import { colors, fonts, type } from '@/src/theme';
import { VerificationTag } from '@/src/verification';

type Filter = 'pending' | 'verified' | 'rejected' | 'all';

const filters: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'Waiting' },
  { value: 'verified', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'Everyone' },
];

/**
 * US-58. The review queue: who is waiting, and for how long. Opening a row is
 * where the profile is read and the decision made.
 */
export default function AdminVerificationsScreen() {
  const { session } = useAuth();
  const [filter, setFilter] = useState<Filter>('pending');
  const [rows, setRows] = useState<VerificationSubmission[] | null>(null);
  const [error, setError] = useState('');

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

  // On focus, not only on mount: coming back from a decision must show the queue without it.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

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

      {error ? <LoadFailed message={error} onRetry={() => { setRows(null); void load(); }} /> : null}

      {!error && rows && rows.length === 0 ? (
        <FadeUp delay={100} style={styles.empty}>
          <Glyph name="check" size={26} color={colors.greenDeep} />
          <Text style={type.body}>
            {filter === 'pending' ? 'Nobody is waiting on a decision.' : 'Nothing here.'}
          </Text>
        </FadeUp>
      ) : null}

      {(rows ?? []).map((row, index) => (
        <FadeUp key={row.id} delay={80 + Math.min(index, 8) * 40}>
          <Card
            pad={16}
            style={styles.card}
            accessibilityLabel={`Review ${row.counsellorName}`}
            onPress={() => router.push({ pathname: '/admin/verifications/[submissionId]', params: { submissionId: row.id } })}
          >
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials(row.counsellorName)}</Text></View>
            <View style={styles.copy}>
              <Text style={styles.name} numberOfLines={1}>{row.counsellorName}</Text>
              <Text style={type.small} numberOfLines={1}>{row.email}</Text>
              <Text style={styles.meta}>Applied {fmtLong(row.submittedAt)}</Text>
            </View>
            <VerificationTag state={row.status} short />
            <Glyph name="chevronRight" size={16} color={colors.mark} />
          </Card>
        </FadeUp>
      ))}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 16, backgroundColor: colors.greenTint,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },
  copy: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  meta: { fontFamily: fonts.sans, fontSize: 12, color: colors.sub },
  empty: { alignItems: 'center', gap: 10, paddingTop: 40 },
});
