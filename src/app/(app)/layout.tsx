import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Shell } from '@/components/Shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await getSession();
  if (!u) redirect('/login');
  return <Shell user={u}>{children}</Shell>;
}
