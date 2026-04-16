/**
 * Bridge com o Sistema de Protocolo existente.
 *
 * Estratégia: lê DIRETAMENTE o banco do Protocolo (somente leitura) e gera
 * Ordens de Serviço no banco do PCP. Se PROTOCOLO_DB_PATH não estiver
 * configurado, usa um mock para permitir demo/desenvolvimento.
 *
 * Ajuste o nome da tabela e colunas conforme o esquema real do Protocolo.
 */
import Database from 'better-sqlite3';
import { db, imagensPrevistas, caixasPorTipo } from './db';

type EntradaProtocolo = {
  protocolo: string;
  cliente: string | null;
  descricao: string | null;
  qtd_caixas: number;
};

function lerProtocolo(): EntradaProtocolo[] {
  const dbPath = process.env.PROTOCOLO_DB_PATH;
  if (!dbPath) {
    // Mock p/ demo
    return [
      { protocolo: 'PRT-2026-00101', cliente: 'SEFAZ-PE',      descricao: 'Processos fiscais 2019', qtd_caixas: 1 },
      { protocolo: 'PRT-2026-00102', cliente: 'Tribunal de Contas', descricao: 'Prestação de contas', qtd_caixas: 2 },
      { protocolo: 'PRT-2026-00103', cliente: 'Secretaria de Educação', descricao: 'Históricos escolares', qtd_caixas: 3 },
      { protocolo: 'PRT-2026-00104', cliente: 'SDS-PE',        descricao: 'Inquéritos 2020',        qtd_caixas: 2 },
      { protocolo: 'PRT-2026-00105', cliente: 'Secretaria de Saúde', descricao: 'Prontuários arquivo morto', qtd_caixas: 4 },
    ];
  }
  const p = new Database(dbPath, { readonly: true, fileMustExist: true });
  // ⚠️ Ajuste ao schema real do Protocolo:
  const rows = p.prepare(`
    SELECT numero_protocolo AS protocolo, cliente, descricao, qtd_caixas
      FROM protocolos_entrada
     WHERE status = 'RECEBIDO'
  `).all() as EntradaProtocolo[];
  p.close();
  return rows;
}

function tipoPorCaixas(qtd: number): 'SIMPLES' | 'DUPLA' | 'PADRAO' {
  if (qtd >= 3) return 'PADRAO';
  if (qtd === 2) return 'DUPLA';
  return 'SIMPLES';
}

export function sincronizarDoProtocolo(): { criadas: number; ignoradas: number } {
  const d = db();
  const existe = d.prepare('SELECT 1 FROM ordens_servico WHERE protocolo_ref = ?');
  const insOS = d.prepare(`
    INSERT INTO ordens_servico (numero, cliente, descricao, tipo, qtd_caixas, qtd_documentada, imagens_previstas, status, protocolo_ref)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'RECEBIDA_PENDENTE', ?)
  `);
  const insCaixa = d.prepare(`INSERT INTO caixas (os_id, codigo, protocolo_ref, imagens_previstas) VALUES (?, ?, ?, 800)`);
  const countOS = d.prepare(`SELECT COUNT(*) AS n FROM ordens_servico`).get() as { n: number };
  let seq = countOS.n + 1;
  let criadas = 0, ignoradas = 0;

  const tx = d.transaction((entradas: EntradaProtocolo[]) => {
    for (const e of entradas) {
      if (existe.get(e.protocolo)) { ignoradas++; continue; }
      const qtd = Math.max(1, e.qtd_caixas || 1);
      const tipo = tipoPorCaixas(qtd);
      const prev = imagensPrevistas(tipo);
      const caixas = caixasPorTipo(tipo);
      const numero = `OS-${new Date().getFullYear()}-${String(seq++).padStart(5, '0')}`;
      const res = insOS.run(numero, e.cliente, e.descricao, tipo, caixas, qtd, prev, e.protocolo);
      const osId = Number(res.lastInsertRowid);
      for (let i = 1; i <= caixas; i++) {
        insCaixa.run(osId, `CX-${String(i).padStart(2, '0')}`, e.protocolo);
      }
      criadas++;
    }
  });
  tx(lerProtocolo());
  return { criadas, ignoradas };
}
