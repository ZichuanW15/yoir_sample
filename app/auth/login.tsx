import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { userFacingError } from '@/src/api/client';
import { useAuth } from '@/src/auth/AuthContext';
import { Button } from '@/src/components/Button';
import { FormField } from '@/src/components/FormField';
import { Notice } from '@/src/components/Notice';
import { Screen } from '@/src/components/Screen';
import { colors } from '@/src/theme';

export default function LoginScreen(){const{serviceId}=useLocalSearchParams<{serviceId?:string}>();const{login}=useAuth();const[email,setEmail]=useState('');const[password,setPassword]=useState('');const[error,setError]=useState('');const[loading,setLoading]=useState(false);async function submit(){if(!email.trim()||!password){setError('Enter your email and password.');return}setLoading(true);setError('');try{await login(email.trim(),password);if(serviceId){router.replace({pathname:'/services/[serviceId]/timeslots',params:{serviceId}})}else{router.replace('/marketplace')}}catch(value){setError(userFacingError(value))}finally{setLoading(false)}}return <Screen><View style={styles.hero}><Text style={styles.eyebrow}>WELCOME BACK</Text><Text style={styles.title}>Continue your career journey</Text><Text style={styles.body}>{serviceId?'Log in to choose a time and complete your booking.':'Log in to book services and manage your Yoir activity.'}</Text></View>{error?<Notice tone="error" message={error}/>:null}<FormField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email"/><FormField label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry autoComplete="current-password"/><Button label="Log in" onPress={submit} loading={loading}/><Text style={styles.center}>New to Yoir? <Link href={serviceId?{pathname:'/auth/register',params:{serviceId}}:'/auth/register'} style={styles.link}>Create an account</Link></Text></Screen>}
const styles=StyleSheet.create({hero:{gap:8,marginVertical:12},eyebrow:{fontSize:12,fontWeight:'800',letterSpacing:1.5,color:colors.primary},title:{fontSize:30,lineHeight:36,fontWeight:'800',color:colors.ink},body:{fontSize:16,lineHeight:24,color:colors.muted},center:{textAlign:'center',color:colors.muted},link:{color:colors.primary,fontWeight:'700'}});
