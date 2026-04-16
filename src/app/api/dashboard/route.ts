import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { dashboard } from '@/lib/metrics';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  const u = await getSession();
  if (!u || (u.perfil !== 'ADMIN' && u.perfil !== 'GESTOR'))
    return NextResponse.json({ erro: 'proibido' }, { status: 403 });
  const url = new URL(req.url);
  const de = url.searchParams.get('de') || undefined;
  const ate = url.searchParams.get('ate') || undefined;
  const userId = url.searchParams.get('user_id') ? Number(url.searchParams.get('user_id')) : undefined;
  const osId = url.searchParams.get('os_id') ? Number(url.searchParams.get('os_id')) : undefined;
  const data = dashboard({ de, ate, userId, osId });
  const users = db().prepare(`SELECT id, nome FROM users WHERE ativo=1 ORDER BY nome`).all();
  const oss = db().prepare(`SELECT id, numero, cliente FROM ordens_servico ORDER BY criado_em DESC`).all();
  return NextResponse.json({ ...data, users, oss });
}
