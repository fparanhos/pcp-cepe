import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const u = await getSession();
  if (!u) return NextResponse.json({ erro: 'auth' }, { status: 401 });
  if (u.perfil !== 'ADMIN' && u.perfil !== 'GESTOR')
    return NextResponse.json({ erro: 'proibido' }, { status: 403 });

  const oss = db().prepare(`
    SELECT id, numero, cliente, descricao, tipo, tipo_documento,
           qtd_caixas, qtd_documentada, qtd_conferida, divergencia,
           status, protocolo_ref, criado_em
      FROM ordens_servico
     WHERE status = 'RECEBIDA_PENDENTE'
     ORDER BY criado_em ASC
  `).all();
  return NextResponse.json({ oss });
}
