/**
 * Bridge com o Sistema de Protocolo (CEPE DOC custodia-next).
 *
 * Lê `protocolo_recebimento` via webservice (action listarRecebimentosPendentes)
 * e gera Ordens de Serviço no banco local do PCP.
 *
 * Se PROTOCOLO_MODO != 'api', usa mock para dev.
 */
import { db, imagensPrevistas } from './db';

type CaixaProtocolo = {
  id_objeto: number | null;
  codigo_caixa: string | null;
};

type EntradaProtocolo = {
  protocolo: string;
  cliente: string | null;
  descricao: string | null;
  qtd_caixas: number;
  caixas: CaixaProtocolo[];
};

const MODO  = process.env.PROTOCOLO_MODO    ?? 'stub';
const WS    = process.env.CEPEDOC_WS_URL    ?? '';
const LOGIN = process.env.CEPEDOC_WS_LOGIN  ?? '';
const SENHA = process.env.CEPEDOC_WS_SENHA  ?? '';

async function lerProtocolo(): Promise<EntradaProtocolo[]> {
  if (MODO !== 'api') {
    const mock = (n: number): CaixaProtocolo[] =>
      Array.from({ length: n }, (_, i) => ({ id_objeto: null, codigo_caixa: `CX-${String(i + 1).padStart(2, '0')}` }));
    return [
      { protocolo: 'PRT-2026-00101', cliente: 'SEFAZ-PE',              descricao: 'Processos fiscais 2019',     qtd_caixas: 1, caixas: mock(1) },
      { protocolo: 'PRT-2026-00102', cliente: 'Tribunal de Contas',    descricao: 'Prestação de contas',        qtd_caixas: 2, caixas: mock(2) },
      { protocolo: 'PRT-2026-00103', cliente: 'Secretaria de Educação', descricao: 'Históricos escolares',      qtd_caixas: 3, caixas: mock(3) },
      { protocolo: 'PRT-2026-00104', cliente: 'SDS-PE',                descricao: 'Inquéritos 2020',            qtd_caixas: 2, caixas: mock(2) },
      { protocolo: 'PRT-2026-00105', cliente: 'Secretaria de Saúde',   descricao: 'Prontuários arquivo morto',  qtd_caixas: 4, caixas: mock(4) },
    ];
  }

  try {
    const r = await fetch(WS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'listarRecebimentosPendentes', login: LOGIN, senha: SENHA }),
    });
    const j = await r.json();
    if (!r.ok || !j.success) {
      console.error('[protocolo] falha ao ler recebimentos:', j.error || r.status);
      return [];
    }
    return (j.data as any[]).map(row => ({
      protocolo:  row.numero_recebimento,
      cliente:    row.cliente ?? null,
      descricao:  row.observacoes ?? null,
      qtd_caixas: Number(row.qtd_caixas) || 1,
      caixas: Array.isArray(row.caixas)
        ? row.caixas.map((c: any) => ({
            id_objeto:    c.id_objeto != null ? Number(c.id_objeto) : null,
            codigo_caixa: c.codigo_caixa ?? null,
          }))
        : [],
    }));
  } catch (e: any) {
    console.error('[protocolo] erro de rede:', e.message);
    return [];
  }
}

function tipoPorCaixas(qtd: number): 'SIMPLES' | 'DUPLA' | 'PADRAO' {
  if (qtd >= 3) return 'PADRAO';
  if (qtd === 2) return 'DUPLA';
  return 'SIMPLES';
}

export async function sincronizarDoProtocolo(): Promise<{ criadas: number; ignoradas: number }> {
  const entradas = await lerProtocolo();
  const d = db();
  const existe = d.prepare('SELECT 1 FROM ordens_servico WHERE protocolo_ref = ?');
  const insOS = d.prepare(`
    INSERT INTO ordens_servico (numero, cliente, descricao, tipo, qtd_caixas, qtd_documentada, imagens_previstas, status, protocolo_ref)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'RECEBIDA_PENDENTE', ?)
  `);
  const insCaixa = d.prepare(`
    INSERT INTO caixas (os_id, codigo, id_objeto, protocolo_ref, imagens_previstas, status)
    VALUES (?, ?, ?, ?, 800, 'AGUARDANDO_PREPARACAO')
  `);
  const countOS = d.prepare(`SELECT COUNT(*) AS n FROM ordens_servico`).get() as { n: number };
  let seq = countOS.n + 1;
  let criadas = 0, ignoradas = 0;

  const tx = d.transaction((rows: EntradaProtocolo[]) => {
    for (const e of rows) {
      if (existe.get(e.protocolo)) { ignoradas++; continue; }
      const qtd = Math.max(1, e.qtd_caixas || 1);
      const tipo = tipoPorCaixas(qtd);
      const prev = imagensPrevistas(tipo);
      const numero = `OS-${new Date().getFullYear()}-${String(seq++).padStart(5, '0')}`;
      const res = insOS.run(numero, e.cliente, e.descricao, tipo, qtd, qtd, prev, e.protocolo);
      const osId = Number(res.lastInsertRowid);
      const lista = e.caixas.length
        ? e.caixas
        : Array.from({ length: qtd }, (_, i) => ({ id_objeto: null, codigo_caixa: `CX-${String(i + 1).padStart(2, '0')}` }));
      for (const c of lista) {
        const codigo = c.id_objeto != null ? String(c.id_objeto) : (c.codigo_caixa || `CX-${String(osId).padStart(2, '0')}`);
        insCaixa.run(osId, codigo, c.id_objeto, e.protocolo);
      }
      criadas++;
    }
  });
  tx(entradas);
  return { criadas, ignoradas };
}
