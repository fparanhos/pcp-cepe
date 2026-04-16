import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DashboardClient from './DashboardClient';

export default async function Page() {
  const u = await getSession();
  if (!u) redirect('/login');
  if (u.perfil !== 'ADMIN' && u.perfil !== 'GESTOR') redirect('/home');
  return <DashboardClient />;
}
