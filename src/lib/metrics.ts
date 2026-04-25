import { db, statusAptosParaEtapa } from './db';

export type Etapa = 'PREPARACAO' | 'CAPTURA' | 'INSPECAO' | 'INDEXACAO';

export function listarOSAtivas() {
  return db().prepare(`
    SELECT id, numero, cliente, tipo, qtd_caixas, imagens_previstas, status, protocolo_ref, criado_em
      FROM ordens_servico
     WHERE status IN ('ABERTA','EM_PRODUCAO')
     ORDER BY criado_em DESC
  `).all() as any[];
}

export function listarCaixas(osId: number) {
  return db().prepare(`
    SELECT id, codigo, id_objeto, status, imagens_previstas
      FROM caixas WHERE os_id=? ORDER BY id
  `).all(osId) as any[];
}

export function listarCaixasParaEtapa(osId: number, etapa: Etapa) {
  const aptos = statusAptosParaEtapa(etapa);
  const placeholders = aptos.map(() => '?').join(',');
  return db().prepare(`
    SELECT id, codigo, id_objeto, status, imagens_previstas
      FROM caixas
     WHERE os_id=? AND status IN (${placeholders})
     ORDER BY id
  `).all(osId, ...aptos) as any[];
}

/** Lista OSs que têm pelo menos uma caixa apta para a etapa. */
export function listarOSComCaixasNaEtapa(etapa: Etapa) {
  const aptos = statusAptosParaEtapa(etapa);
  const placeholders = aptos.map(() => '?').join(',');
  return db().prepare(`
    SELECT o.id, o.numero, o.cliente, o.tipo, o.qtd_caixas, o.imagens_previstas, o.status, o.protocolo_ref, o.criado_em
      FROM ordens_servico o
     WHERE EXISTS (SELECT 1 FROM caixas c WHERE c.os_id=o.id AND c.status IN (${placeholders}))
     ORDER BY o.criado_em DESC
  `).all(...aptos) as any[];
}

export function totalPorEtapa(osId: number) {
  const rows = db().prepare(`
    SELECT etapa, COALESCE(SUM(quantidade),0) AS total
      FROM apontamentos WHERE os_id=? GROUP BY etapa
  `).all(osId) as { etapa: Etapa; total: number }[];
  const out: Record<Etapa, number> = { PREPARACAO: 0, CAPTURA: 0, INSPECAO: 0, INDEXACAO: 0 };
  rows.forEach(r => (out[r.etapa] = r.total));
  return out;
}

export function produtividadeOperador(userId: number, etapa: Etapa, osId?: number) {
  const hoje = db().prepare(`
    SELECT COALESCE(SUM(quantidade),0) AS n FROM apontamentos
     WHERE user_id=? AND etapa=? AND date(registrado_em)=date('now','localtime') ${osId ? 'AND os_id=?' : ''}
  `).get(userId, etapa, ...(osId ? [osId] : [])) as { n: number };
  const total = db().prepare(`
    SELECT COALESCE(SUM(quantidade),0) AS n FROM apontamentos
     WHERE user_id=? AND etapa=? ${osId ? 'AND os_id=?' : ''}
  `).get(userId, etapa, ...(osId ? [osId] : [])) as { n: number };
  return { hoje: hoje.n, total: total.n };
}

export function dashboard(params: { de?: string; ate?: string; userId?: number; osId?: number }) {
  const d = db();
  const clauses: string[] = [];
  const args: any[] = [];
  if (params.de)     { clauses.push('date(a.registrado_em) >= date(?)'); args.push(params.de); }
  if (params.ate)    { clauses.push('date(a.registrado_em) <= date(?)'); args.push(params.ate); }
  if (params.userId) { clauses.push('a.user_id = ?');                    args.push(params.userId); }
  if (params.osId)   { clauses.push('a.os_id = ?');                      args.push(params.osId); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';

  const porEtapa = d.prepare(`
    SELECT etapa, COALESCE(SUM(quantidade),0) AS total
      FROM apontamentos a ${where}
     GROUP BY etapa
  `).all(...args) as { etapa: Etapa; total: number }[];

  const porFuncionario = d.prepare(`
    SELECT u.id, u.nome, u.matricula,
           COALESCE(SUM(CASE WHEN etapa='PREPARACAO' THEN quantidade END),0) AS preparacao,
           COALESCE(SUM(CASE WHEN etapa='CAPTURA'    THEN quantidade END),0) AS captura,
           COALESCE(SUM(CASE WHEN etapa='INSPECAO'   THEN quantidade END),0) AS inspecao,
           COALESCE(SUM(CASE WHEN etapa='INDEXACAO'  THEN quantidade END),0) AS indexacao,
           COALESCE(SUM(quantidade),0) AS total
      FROM apontamentos a
      JOIN users u ON u.id = a.user_id
      ${where}
     GROUP BY u.id
     ORDER BY total DESC
  `).all(...args) as any[];

  const porOS = d.prepare(`
    SELECT o.id, o.numero, o.cliente, o.tipo, o.imagens_previstas,
           COALESCE(SUM(CASE WHEN etapa='CAPTURA'  THEN quantidade END),0) AS capturadas,
           COALESCE(SUM(CASE WHEN etapa='INSPECAO' THEN quantidade END),0) AS inspecionadas,
           COALESCE(SUM(CASE WHEN etapa='INDEXACAO' THEN quantidade END),0) AS indexadas,
           COALESCE(SUM(CASE WHEN etapa='PREPARACAO' THEN quantidade END),0) AS preparadas
      FROM ordens_servico o
      LEFT JOIN apontamentos a ON a.os_id = o.id
      ${where.replace(/a\./g,'a.')}
     GROUP BY o.id
     ORDER BY o.criado_em DESC
  `).all(...args) as any[];

  const porDia = d.prepare(`
    SELECT date(a.registrado_em) AS dia, etapa, COALESCE(SUM(quantidade),0) AS total
      FROM apontamentos a ${where}
     GROUP BY dia, etapa
     ORDER BY dia
  `).all(...args) as any[];

  const totalGeral = porEtapa.reduce((s, r) => s + r.total, 0);
  return { porEtapa, porFuncionario, porOS, porDia, totalGeral };
}
