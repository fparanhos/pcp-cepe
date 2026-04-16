import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const u = await getSession();
  if (!u) return NextResponse.json({ erro: 'auth' }, { status: 401 });
  if (u.perfil !== 'ADMIN' && u.perfil !== 'GESTOR')
    return NextResponse.json({ erro: 'proibido' }, { status: 403 });

  const oss = db().prepare(`
    SELECT o.id, o.numero, o.cliente, o.tipo, o.tipo_documento,
           o.qtd_caixas, o.imagens_previstas, o.protocolo_ref, o.status, o.criado_em,
           COALESCE((SELECT SUM(quantidade) FROM apontamentos WHERE os_id = o.id AND etapa = 'INDEXACAO'), 0) AS qtd_imagens
      FROM ordens_servico o
     WHERE o.status IN ('ABERTA','EM_PRODUCAO','CONCLUIDA')
     ORDER BY o.criado_em DESC
  `).all();
  return NextResponse.json({ oss });
}
