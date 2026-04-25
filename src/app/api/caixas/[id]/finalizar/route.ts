import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, statusAptosParaEtapa, proximoStatusApos, Etapa } from '@/lib/db';

const ETAPAS: Etapa[] = ['PREPARACAO', 'CAPTURA', 'INSPECAO', 'INDEXACAO'];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const u = await getSession();
  if (!u) return NextResponse.json({ erro: 'auth' }, { status: 401 });

  const caixaId = Number(params.id);
  if (!Number.isFinite(caixaId)) return NextResponse.json({ erro: 'id inválido' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const etapa = String(body.etapa || '').toUpperCase() as Etapa;
  if (!ETAPAS.includes(etapa)) return NextResponse.json({ erro: 'etapa inválida' }, { status: 400 });
  if (!u.etapas.includes(etapa)) return NextResponse.json({ erro: 'sem_permissao_etapa' }, { status: 403 });

  const d = db();
  const caixa = d.prepare(`SELECT id, os_id, status FROM caixas WHERE id=?`).get(caixaId) as
    | { id: number; os_id: number; status: string } | undefined;
  if (!caixa) return NextResponse.json({ erro: 'caixa_nao_encontrada' }, { status: 404 });

  const aptos = statusAptosParaEtapa(etapa);
  if (!aptos.includes(caixa.status as any)) {
    return NextResponse.json({
      erro: 'caixa_fora_da_etapa',
      mensagem: `Caixa está em '${caixa.status}', não pode ser finalizada em ${etapa}.`,
    }, { status: 400 });
  }

  const proximo = proximoStatusApos(etapa);
  d.prepare(`UPDATE caixas SET status=? WHERE id=?`).run(proximo, caixaId);

  // Se todas as caixas da OS estiverem CONCLUIDA, marca OS como CONCLUIDA
  const pendentes = d.prepare(
    `SELECT COUNT(*) AS n FROM caixas WHERE os_id=? AND status<>'CONCLUIDA'`
  ).get(caixa.os_id) as { n: number };
  if (pendentes.n === 0) {
    d.prepare(`UPDATE ordens_servico SET status='CONCLUIDA' WHERE id=?`).run(caixa.os_id);
  }

  return NextResponse.json({ ok: true, novo_status: proximo, os_concluida: pendentes.n === 0 });
}
