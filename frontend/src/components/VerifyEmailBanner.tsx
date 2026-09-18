import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/auth/AuthContext';
import { Glyph } from '@/src/components/Glyph';
import { Press, Spinner } from '@/src/components/ui';
import { colors, fonts, radius } from '@/src/theme';

/**
 * Shown to a signed-in person whose address is not yet confirmed.
 *
 * It is a prompt, not a wall. An unconfirmed account can browse and sign in freely;
 * what it cannot do is book a session or publish a service, and this says so before
 * they find out by being refused halfway through one.
 */
export function VerifyEmailBanner({ what = 'book a session' }: { what?: string }) {
  const { session } = useAuth();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');

  if (!session || session.user.emailVerified) return null;

  async function resend() {
    if (!session) return;
    setState('sending');
    try {
      await api.requestEmailVerification(session.user.email);
    } finally {
      // Sent either way, as far as this banner is concerned: the endpoint answers
      // the same whatever happened, so promising more than that would be a lie.
      setState('sent');
    }
  }

  return (
    <View style={styles.box}>
      <Glyph name="shieldCheck" size={20} color={colors.amberInk} />
      <View style={styles.copy}>
        <Text style={styles.title}>Confirm your email to {what}</Text>
        <Text style={styles.body}>
          {state === 'sent'
            ? `We have sent a new link to ${session.user.email}. It lasts a day.`
            : `We sent a link to ${session.user.email}. Following it confirms your address.`}
        </Text>
      </View>
      {state === 'sent' ? null : (
        <Press accessibilityLabel="Send the confirmation email again" scaleTo={0.94} onPress={resend} style={styles.action}>
          {state === 'sending' ? <Spinner size={16} color={colors.amberInk} /> : <Text style={styles.actionLabel}>Resend</Text>}
        </Press>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: radius.lg, backgroundColor: colors.yellowTint,
  },
  copy: { flex: 1, gap: 3 },
  title: { fontFamily: fonts.bold, fontSize: 14, color: colors.amberDeep },
  body: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.amberInk },
  action: {
    paddingHorizontal: 14, height: 36, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white,
  },
  actionLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.amberInk },
});
