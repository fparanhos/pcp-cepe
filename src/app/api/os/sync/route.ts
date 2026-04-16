import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sincronizarDoProtocolo } from '@/lib/protocolo';

export async function POST() {
  const u = await getSession();
  if (!u || (u.perfil !== 'ADMIN' && u.perfil !== 'GESTOR'))
    return NextResponse.json({ erro: 'proibido' }, { status: 403 });
  const r = await sincronizarDoProtocolo();
  return NextResponse.json(r);
}
