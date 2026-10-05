import { Href, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, userFacingError } from '@/src/api/client';
import { AdminCounsellor, AdminJobSeeker } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { AdminShell, LoadFailed } from '@/src/admin/shell';
import { Glyph } from '@/src/components/Glyph';
import { Card, Chip, Tag } from '@/src/components/ui';
import { fmtDay, initials } from '@/src/format';
import { FadeUp } from '@/src/motion';
import { colors, fonts, type } from '@/src/theme';
import { VerificationTag } from '@/src/verification';

const currency = (minor: number) =>
  `$${(minor / 100).toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;

/**
 * US-71. Who has an account, read-only: Career Professionals or Job Seekers, each
 * with their role and where their account stands. A Career Professional's row
 * opens their verification (US-58).
 *
 * Which of the two is showing lives in the address (`role`), so the dashboard's
 * tiles can open either one and a reload stays where it was.
 */
export default function AdminUsersScreen() {
  const { session } = useAuth();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const seekers = role === 'job_seeker';
  const [people, setPeople] = useState<{ professionals: AdminCounsellor[]; jobSeekers: AdminJobSeeker[] } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const [professionals, jobSeekers] = await Promise.all([
        api.listAllCounsellors(session.accessToken),
        api.listAllJobSeekers(session.accessToken),
      ]);
      setPeople({ professionals, jobSeekers });
      setError('');
    } catch (value) {
      setError(userFacingError(value));
    }
  }, [session]);

  useEffect(() => {
    const run = async () => { await load(); };
    void run();
  }, [load]);

  const show = (next: 'counsellor' | 'job_seeker') => router.setParams({ role: next });

  return (
    <AdminShell
      title="Users"
      subtitle="Everyone with a Yoir account, newest first. Nothing here can be changed."
      busy={people === null && !error}
    >
      {error ? <LoadFailed message={error} onRetry={() => { setError(''); void load(); }} /> : null}

      {people ? (
        <>
          <View style={styles.roles}>
            <Chip
              label={`Career Professionals · ${people.professionals.length}`}
              selected={!seekers}
              onPress={() => show('counsellor')}
            />
            <Chip
              label={`Job Seekers · ${people.jobSeekers.length}`}
              selected={seekers}
              onPress={() => show('job_seeker')}
            />
          </View>

          {seekers
            ? people.jobSeekers.map((row, index) => <JobSeekerCard key={row.id} row={row} index={index} />)
            : people.professionals.map((row, index) => <ProfessionalCard key={row.id} row={row} index={index} />)}

          {(seekers ? people.jobSeekers : people.professionals).length === 0 ? (
            <Text style={type.body}>{seekers ? 'No Job Seekers yet.' : 'No Career Professionals yet.'}</Text>
          ) : null}
        </>
      ) : null}
    </AdminShell>
  );
}

function ProfessionalCard({ row, index }: { row: AdminCounsellor; index: number }) {
  // Verified but unpayable is the state worth spotting: everything they list
  // is unbookable, and nothing in the app tells them so.
  const blocked = row.verificationStatus === 'verified' && !row.payoutsEnabled;
  return (
    <FadeUp delay={60 + Math.min(index, 8) * 30}>
      <Card
        pad={18}
        style={styles.card}
        accessibilityLabel={`${row.name}, Career Professional. Open their verification`}
        onPress={() => router.push(`/admin/verifications/${encodeURIComponent(row.id)}` as Href)}
      >
        <Who name={row.name} email={row.email} opens />

        <View style={styles.tags}>
          <Tag label="Career Professional" />
          <VerificationTag state={row.verificationStatus} short />
        </View>

        <View style={styles.flags}>
          <Flag ok={row.emailVerified} label={row.emailVerified ? 'Email confirmed' : 'Email not confirmed'} />
          <Flag ok={row.payoutsEnabled} label={row.payoutsEnabled ? 'Payouts ready' : 'Payouts not set up'} />
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
}

function JobSeekerCard({ row, index }: { row: AdminJobSeeker; index: number }) {
  return (
    <FadeUp delay={60 + Math.min(index, 8) * 30}>
      <Card pad={18} style={styles.card}>
        <Who name={row.name} email={row.email} />

        <View style={styles.tags}>
          <Tag label="Job Seeker" />
          <Tag label={row.bookingCount === 1 ? '1 booking' : `${row.bookingCount} bookings`} bg={colors.greenTint} fg={colors.greenDeep} />
        </View>

        <View style={styles.flags}>
          <Flag ok={row.emailVerified} label={row.emailVerified ? 'Email confirmed' : 'Email not confirmed'} />
        </View>

        <Text style={styles.meta}>Joined {fmtDay(row.joinedAt)}</Text>
      </Card>
    </FadeUp>
  );
}

function Who({ name, email, opens }: { name: string; email: string; opens?: boolean }) {
  return (
    <View style={styles.head}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{initials(name)}</Text></View>
      <View style={styles.headCopy}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={type.small} numberOfLines={1}>{email}</Text>
      </View>
      {opens ? <Glyph name="chevronRight" size={16} color={colors.mark} /> : null}
    </View>
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
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 16, backgroundColor: colors.greenTint,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },
  headCopy: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
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
