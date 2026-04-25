import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  listarOSAtivas, listarCaixas, totalPorEtapa,
  listarOSComCaixasNaEtapa, listarCaixasParaEtapa, Etapa,
} from '@/lib/metrics';

const ETAPAS: Etapa[] = ['PREPARACAO', 'CAPTURA', 'INSPECAO', 'INDEXACAO'];

export async function GET(req: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ erro: 'auth' }, { status: 401 });
  const etapaParam = req.nextUrl.searchParams.get('etapa')?.toUpperCase() as Etapa | null;
  const etapa = etapaParam && ETAPAS.includes(etapaParam) ? etapaParam : null;

  const baseList = etapa ? listarOSComCaixasNaEtapa(etapa) : listarOSAtivas();
  const oss = baseList.map(o => ({
    ...o,
    caixas: etapa ? listarCaixasParaEtapa(o.id, etapa) : listarCaixas(o.id),
    totais: totalPorEtapa(o.id),
  }));
  return NextResponse.json({ oss });
}
