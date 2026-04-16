import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { criarEntrega } from '@/lib/protocoloApi';

type Body = {
  receptor_nome?: string | null;
  receptor_documento?: string | null;
  observacao?: string | null;
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const u = await getSession();
  if (!u) return NextResponse.json({ erro: 'auth' }, { status: 401 });
  if (u.perfil !== 'ADMIN' && u.perfil !== 'GESTOR')
    return NextResponse.json({ erro: 'proibido' }, { status: 403 });

  const osId = Number(params.id);
  if (!Number.isFinite(osId)) return NextResponse.json({ erro: 'id inválido' }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as Body;

  const d = db();
  const os = d.prepare(`
    SELECT numero, cliente, tipo_documento, qtd_caixas, protocolo_ref, status
      FROM ordens_servico WHERE id = ?
  `).get(osId) as any;
  if (!os) return NextResponse.json({ erro: 'OS não encontrada' }, { status: 404 });

  const imagens = (d.prepare(`
    SELECT COALESCE(SUM(quantidade),0) AS n FROM apontamentos WHERE os_id = ? AND etapa = 'INDEXACAO'
  `).get(osId) as { n: number }).n;

  const resp = await criarEntrega({
    os_numero: os.numero,
    protocolo_origem: os.protocolo_ref ?? null,
    cliente_nome: os.cliente ?? '',
    tipo_documento: os.tipo_documento ?? null,
    qtd_caixas: os.qtd_caixas,
    qtd_imagens: imagens,
    responsavel_entrega: u.matricula,
    receptor_nome: body.receptor_nome || 'Receptor do cliente',
    receptor_documento: body.receptor_documento ?? null,
    observacao: body.observacao ?? null,
  });

  if (!resp.ok) return NextResponse.json({ erro: resp.erro || 'falha protocolo' }, { status: 502 });

  d.prepare(`UPDATE ordens_servico SET status = 'CONCLUIDA' WHERE id = ?`).run(osId);
  return NextResponse.json({ ok: true, numero_protocolo: resp.numero_protocolo });
}
