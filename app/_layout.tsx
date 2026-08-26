import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/src/auth/AuthContext';
import { colors } from '@/src/theme';

export default function RootLayout(){return <SafeAreaProvider><AuthProvider><StatusBar style="dark"/><Stack screenOptions={{headerShadowVisible:false,headerStyle:{backgroundColor:colors.background},headerTintColor:colors.ink,headerTitleStyle:{fontWeight:'700'}}}><Stack.Screen name="index" options={{headerShown:false}}/><Stack.Screen name="marketplace/index" options={{headerShown:false}}/><Stack.Screen name="services/[serviceId]" options={{title:'Service details'}}/><Stack.Screen name="auth/login" options={{title:'Log in',presentation:'modal'}}/><Stack.Screen name="auth/register" options={{title:'Create account',presentation:'modal'}}/></Stack></AuthProvider></SafeAreaProvider>}
