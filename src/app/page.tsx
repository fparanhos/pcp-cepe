import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function Root() {
  const u = await getSession();
  if (!u) redirect('/login');
  redirect('/home');
}
