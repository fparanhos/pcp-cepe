import { NextResponse } from 'next/server';
import { getSession, Etapa } from '@/lib/auth';
import { db } from '@/lib/db';
import { produtividadeOperador, totalPorEtapa } from '@/lib/metrics';

const ETAPAS = ['PREPARACAO','CAPTURA','INSPECAO','INDEXACAO'] as const;

export async function POST(req: Request) {
  const u = await getSession();
  if (!u) return NextResponse.json({ erro: 'auth' }, { status: 401 });
  const body = await req.json();
  const etapa = String(body.etapa || '').toUpperCase() as Etapa;
  const osId = Number(body.os_id);
  const caixaId = body.caixa_id ? Number(body.caixa_id) : null;
  const qtd = Number(body.quantidade);
  const obs = body.observacao ? String(body.observacao).slice(0, 500) : null;

  if (!ETAPAS.includes(etapa as any)) return NextResponse.json({ erro: 'etapa' }, { status: 400 });
  if (!osId || !qtd || qtd <= 0) return NextResponse.json({ erro: 'dados' }, { status: 400 });
  if (!u.etapas.includes(etapa)) return NextResponse.json({ erro: 'sem_permissao_etapa' }, { status: 403 });

  const d = db();
  const os = d.prepare(`SELECT id, imagens_previstas, status FROM ordens_servico WHERE id=?`).get(osId) as any;
  if (!os) return NextResponse.json({ erro: 'os' }, { status: 404 });
  if (os.status === 'CONCLUIDA' || os.status === 'CANCELADA')
    return NextResponse.json({ erro: 'os_fechada' }, { status: 400 });

  // Regra: Inspeção ≤ Imagens previstas na OS
  if (etapa === 'INSPECAO') {
    const atuais = totalPorEtapa(osId).INSPECAO;
    if (atuais + qtd > os.imagens_previstas) {
      return NextResponse.json({
        erro: 'excede_previsto',
        mensagem: `Inspeção excederia o previsto (${os.imagens_previstas}). Já inspecionadas: ${atuais}.`
      }, { status: 400 });
    }
  }

  d.prepare(`INSERT INTO apontamentos (user_id, os_id, caixa_id, etapa, quantidade, observacao) VALUES (?,?,?,?,?,?)`)
   .run(u.id, osId, caixaId, etapa, qtd, obs);

  // Marca OS em produção ao receber primeiro apontamento
  if (os.status === 'ABERTA') d.prepare(`UPDATE ordens_servico SET status='EM_PRODUCAO' WHERE id=?`).run(osId);

  return NextResponse.json({
    ok: true,
    produtividade: produtividadeOperador(u.id, etapa, osId),
    totais: totalPorEtapa(osId),
  });
}
