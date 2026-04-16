import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import ExpedicaoClient from './ExpedicaoClient';

export default async function ExpedicaoPage() {
  const u = await getSession();
  if (!u) redirect('/login');
  if (u.perfil !== 'ADMIN' && u.perfil !== 'GESTOR') redirect('/home');
  return <ExpedicaoClient />;
}
