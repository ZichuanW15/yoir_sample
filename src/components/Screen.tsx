import { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/src/theme';
export function Screen({children,footer}:PropsWithChildren<{footer?:ReactNode}>){return <SafeAreaView style={styles.safe} edges={['top','bottom']}><KeyboardAvoidingView style={styles.fill} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>{footer?<View style={styles.footer}>{footer}</View>:null}</KeyboardAvoidingView></SafeAreaView>}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.background},fill:{flex:1},content:{flexGrow:1,padding:20,gap:16},footer:{padding:20,paddingTop:12,borderTopWidth:1,borderTopColor:colors.border,backgroundColor:colors.surface}});
