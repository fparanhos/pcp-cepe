import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import AdminClient from './AdminClient';

export default async function AdminPage() {
  const u = await getSession();
  if (!u) redirect('/login');
  if (u.perfil !== 'ADMIN') redirect('/home');
  return <AdminClient />;
}
