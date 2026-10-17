import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { goBack } from '@/src/navigation';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import { api, userFacingError } from '@/src/api/client';
import { Service } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { Button, ErrorBanner, IconButton, Spinner } from '@/src/components/ui';
import ServiceForm from '@/src/counsellor/ServiceForm';
import { DesktopPage, PageHeader, useDesktop } from '@/src/desktop';
import { ScreenIn } from '@/src/motion';
import { colors, fonts } from '@/src/theme';

/**
 * Edit opens the same form a counsellor sees when creating a service, filled in with
 * what they already published. There is no "get one own service" route, so the
 * counsellor's own list is read and the id is matched in memory.
 */
export default function EditServiceScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();

  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!session || !serviceId) return;
    let live = true;
    api.listOwnServices(session.user.id, session.accessToken)
      .then((services) => {
        if (!live) return;
        const found = services.find((item) => item.id === serviceId);
        if (!found) { setLoadError('This service is no longer available.'); return; }
        setService(found);
      })
      .catch((cause) => { if (live) setLoadError(userFacingError(cause)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [session, serviceId]);

  if (!session || session.user.role !== 'counsellor') return <Redirect href="/" />;

  if (loading) {
    return (
      <ScreenIn style={[s.centered, desktop && s.desktopCanvas]}>
        <Spinner color={colors.green} />
      </ScreenIn>
    );
  }

  if ((loadError || !service) && desktop) {
    return (
      <DesktopPage>
        <PageHeader eyebrow="Edit service" title="Update your listing" />
        <View style={s.desktopBody}>
          <ErrorBanner message={loadError || 'This service is no longer available.'} />
          <Button label="Back to workspace" tone="outline" height={50} labelSize={15} onPress={() => router.replace('/counsellor')} style={s.desktopButton} />
        </View>
      </DesktopPage>
    );
  }

  if (loadError || !service) {
    return (
      <ScreenIn style={s.screen}>
        <View style={[s.topBar, { paddingTop: insets.top + 10 }]}>
          <IconButton onPress={() => goBack('/counsellor')} tone="white" label="Back">
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Polyline points="14.5,5 7.5,12 14.5,19" fill="none" stroke={colors.green} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </IconButton>
          <Text style={s.topTitle}>Edit service</Text>
          <View style={s.topSpacer} />
        </View>
        <View style={s.body}>
          <ErrorBanner message={loadError || 'This service is no longer available.'} />
          <Button label="Back to workspace" tone="outline" onPress={() => router.replace('/counsellor')} />
        </View>
      </ScreenIn>
    );
  }

  return <ServiceForm counsellorId={session.user.id} accessToken={session.accessToken} service={service} />;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  centered: { flex: 1, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  topTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  topSpacer: { width: 44 },
  body: { paddingHorizontal: 22, paddingTop: 6, gap: 16 },

  desktopCanvas: { backgroundColor: colors.canvas },
  desktopBody: { maxWidth: 520, gap: 16 },
  desktopButton: { alignSelf: 'flex-start', paddingHorizontal: 24 },
});
