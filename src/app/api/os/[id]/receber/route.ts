import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, imagensPrevistas, caixasPorTipo, TipoCaixa } from '@/lib/db';
import { registrarMovimento } from '@/lib/protocoloApi';

type Body = {
  acao: 'confirmar' | 'ajustar';
  tipo: TipoCaixa;
  tipo_documento?: string | null;
  qtd_conferida: number;
  divergencia?: string | null;
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const u = await getSession();
  if (!u) return NextResponse.json({ erro: 'auth' }, { status: 401 });
  if (u.perfil !== 'ADMIN' && u.perfil !== 'GESTOR')
    return NextResponse.json({ erro: 'proibido' }, { status: 403 });

  const osId = Number(params.id);
  if (!Number.isFinite(osId)) return NextResponse.json({ erro: 'id inválido' }, { status: 400 });

  const body = (await req.json()) as Body;
  if (!['confirmar', 'ajustar'].includes(body.acao))
    return NextResponse.json({ erro: 'acao inválida' }, { status: 400 });
  if (!['SIMPLES', 'DUPLA', 'PADRAO'].includes(body.tipo))
    return NextResponse.json({ erro: 'tipo inválido' }, { status: 400 });
  const qtd = Number(body.qtd_conferida);
  if (!Number.isFinite(qtd) || qtd < 0)
    return NextResponse.json({ erro: 'qtd_conferida inválida' }, { status: 400 });

  const d = db();
  const os = d.prepare(`SELECT id, status, qtd_documentada FROM ordens_servico WHERE id = ?`).get(osId) as
    | { id: number; status: string; qtd_documentada: number | null }
    | undefined;
  if (!os) return NextResponse.json({ erro: 'OS não encontrada' }, { status: 404 });
  if (os.status !== 'RECEBIDA_PENDENTE')
    return NextResponse.json({ erro: `OS já está em '${os.status}'` }, { status: 409 });

  const novoStatus = body.acao === 'confirmar' ? 'ABERTA' : 'RECEBIDA_PENDENTE';
  const prev = imagensPrevistas(body.tipo);
  const caixasEsperadas = caixasPorTipo(body.tipo);

  const tx = d.transaction(() => {
    d.prepare(`
      UPDATE ordens_servico
         SET tipo = ?, tipo_documento = ?, qtd_conferida = ?, qtd_caixas = ?,
             imagens_previstas = ?, divergencia = ?, status = ?,
             conferido_por = ?, conferido_em = datetime('now')
       WHERE id = ?
    `).run(
      body.tipo,
      body.tipo_documento ?? null,
      qtd,
      qtd,
      prev,
      body.divergencia ?? null,
      novoStatus,
      u.id,
      osId
    );

    if (body.acao === 'confirmar') {
      const atuais = d.prepare(`SELECT COUNT(*) AS n FROM caixas WHERE os_id = ?`).get(osId) as { n: number };
      if (atuais.n !== qtd) {
        d.prepare(`DELETE FROM caixas WHERE os_id = ?`).run(osId);
        const ins = d.prepare(`INSERT INTO caixas (os_id, codigo, protocolo_ref, imagens_previstas) VALUES (?,?,?,?)`);
        const ref = d.prepare(`SELECT protocolo_ref FROM ordens_servico WHERE id = ?`).get(osId) as { protocolo_ref: string | null };
        for (let i = 1; i <= qtd; i++) {
          ins.run(osId, `CX-${String(i).padStart(2, '0')}`, ref.protocolo_ref, prev / Math.max(1, caixasEsperadas));
        }
      }
    }
  });
  tx();

  const osAtual = d.prepare(`
    SELECT numero, cliente, protocolo_ref, tipo_documento, qtd_documentada, qtd_conferida, divergencia
      FROM ordens_servico WHERE id = ?
  `).get(osId) as any;

  const mov = await registrarMovimento({
    protocolo_ref: osAtual.protocolo_ref ?? null,
    tipo: body.acao === 'confirmar' ? 'RECEBIDO_PCP' : 'AJUSTE_DIVERGENCIA',
    os_numero: osAtual.numero,
    cliente_nome: osAtual.cliente,
    tipo_caixa: body.tipo,
    tipo_documento: osAtual.tipo_documento,
    qtd_documentada: osAtual.qtd_documentada,
    qtd_conferida: osAtual.qtd_conferida,
    divergencia: osAtual.divergencia,
    registrado_por: u.matricula,
  });

  return NextResponse.json({ ok: true, status: novoStatus, protocolo: mov });
}
