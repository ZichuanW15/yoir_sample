import { DMSerifDisplay_400Regular, DMSerifDisplay_400Regular_Italic } from '@expo-google-fonts/dm-serif-display';
import {
  Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/src/auth/AuthContext';
import { ChromeProvider } from '@/src/chrome';
import { FloatingErrorProvider } from '@/src/floatingError';
import { PaymentConfigProvider, PaymentSheetHost } from '@/src/payments';
import { colors } from '@/src/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready] = useFonts({
    DMSerifDisplay_400Regular,
    DMSerifDisplay_400Regular_Italic,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => { if (ready) void SplashScreen.hideAsync(); }, [ready]);
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <FloatingErrorProvider>
        {/* Payment settings are fetched once, above the router, so the checkout
            screen never has to wait on them mid-journey. PaymentSheetHost supplies
            the Stripe publishable key; on web it is a pass-through. */}
        <PaymentConfigProvider>
          <PaymentSheetHost>
            <ChromeProvider>
              <View style={{ flex: 1, backgroundColor: colors.white }}>
                <StatusBar style="dark" />
                {/* Every screen draws its own chrome, exactly as the redesign does. */}
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.white }, animation: 'slide_from_right' }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="auth/welcome" />
                  <Stack.Screen name="auth/login" options={{ animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="auth/register" options={{ animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="marketplace/index" />
                  <Stack.Screen name="job-seeker/index" options={{ animation: 'fade' }} />
                  <Stack.Screen name="job-seeker/diagnosis" options={{ animation: 'fade' }} />
                  <Stack.Screen name="job-seeker/profile" />
                  <Stack.Screen name="settings/privacy" />
                  <Stack.Screen name="professionals/[counsellorId]" />
                  <Stack.Screen name="services/[serviceId]" />
                  <Stack.Screen name="services/[serviceId]/timeslots" />
                  <Stack.Screen name="bookings/checkout" />
                  <Stack.Screen name="bookings/confirmation" options={{ gestureEnabled: false }} />
                  <Stack.Screen name="bookings/[bookingId]/review" />
                  <Stack.Screen name="counsellor/index" />
                  <Stack.Screen name="counsellor/profile" />
                  <Stack.Screen name="counsellor/services/new" />
                  <Stack.Screen name="counsellor/availability" />
                  <Stack.Screen name="counsellor/payouts" />
                </Stack>
              </View>
            </ChromeProvider>
          </PaymentSheetHost>
        </PaymentConfigProvider>
        </FloatingErrorProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
