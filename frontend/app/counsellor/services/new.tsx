import { Redirect } from 'expo-router';
import { useAuth } from '@/src/auth/AuthContext';
import ServiceForm from '@/src/counsellor/ServiceForm';

export default function NewServiceScreen() {
  const { session } = useAuth();
  if (!session || session.user.role !== 'counsellor') return <Redirect href="/" />;

  return <ServiceForm counsellorId={session.user.id} accessToken={session.accessToken} />;
}
