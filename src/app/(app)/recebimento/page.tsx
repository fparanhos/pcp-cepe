import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import RecebimentoClient from './RecebimentoClient';

export default async function RecebimentoPage() {
  const u = await getSession();
  if (!u) redirect('/login');
  if (u.perfil !== 'ADMIN' && u.perfil !== 'GESTOR') redirect('/home');
  return <RecebimentoClient />;
}
