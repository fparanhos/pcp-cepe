import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listarOSAtivas, listarCaixas, totalPorEtapa } from '@/lib/metrics';

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ erro: 'auth' }, { status: 401 });
  const oss = listarOSAtivas().map(o => ({ ...o, caixas: listarCaixas(o.id), totais: totalPorEtapa(o.id) }));
  return NextResponse.json({ oss });
}
