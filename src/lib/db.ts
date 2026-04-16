import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.PCP_DB_PATH || './data/pcp.db';

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const d = new Database(DB_PATH);
  d.pragma('journal_mode = WAL');
  d.pragma('foreign_keys = ON');
  init(d);
  _db = d;
  return d;
}

function init(d: Database.Database) {
  d.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    matricula TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    perfil TEXT NOT NULL CHECK(perfil IN ('ADMIN','GESTOR','OPERADOR')) DEFAULT 'OPERADOR',
    etapas TEXT NOT NULL DEFAULT 'PREPARACAO,CAPTURA,INSPECAO,INDEXACAO',
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ordens_servico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT NOT NULL UNIQUE,
    cliente TEXT,
    descricao TEXT,
    tipo TEXT NOT NULL CHECK(tipo IN ('SIMPLES','DUPLA','PADRAO')) DEFAULT 'SIMPLES',
    tipo_documento TEXT,
    qtd_caixas INTEGER NOT NULL DEFAULT 1,
    qtd_documentada INTEGER,
    qtd_conferida INTEGER,
    divergencia TEXT,
    conferido_por INTEGER REFERENCES users(id),
    conferido_em TEXT,
    imagens_previstas INTEGER NOT NULL DEFAULT 800,
    status TEXT NOT NULL CHECK(status IN ('RECEBIDA_PENDENTE','ABERTA','EM_PRODUCAO','CONCLUIDA','CANCELADA')) DEFAULT 'RECEBIDA_PENDENTE',
    protocolo_ref TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS caixas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    os_id INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,
    protocolo_ref TEXT,
    imagens_previstas INTEGER NOT NULL DEFAULT 800,
    UNIQUE(os_id, codigo)
  );

  CREATE TABLE IF NOT EXISTS apontamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    os_id INTEGER NOT NULL REFERENCES ordens_servico(id),
    caixa_id INTEGER REFERENCES caixas(id),
    etapa TEXT NOT NULL CHECK(etapa IN ('PREPARACAO','CAPTURA','INSPECAO','INDEXACAO')),
    -- PREPARACAO: qtd de conjuntos/documentos carimbados
    -- CAPTURA:    qtd de imagens (faces) digitalizadas
    -- INSPECAO:   qtd de imagens inspecionadas
    -- INDEXACAO:  qtd de documentos indexados
    quantidade INTEGER NOT NULL CHECK(quantidade > 0),
    observacao TEXT,
    registrado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_apont_user   ON apontamentos(user_id);
  CREATE INDEX IF NOT EXISTS idx_apont_os     ON apontamentos(os_id);
  CREATE INDEX IF NOT EXISTS idx_apont_data   ON apontamentos(registrado_em);
  CREATE INDEX IF NOT EXISTS idx_apont_etapa  ON apontamentos(etapa);
  `);
  migrarOrdensServico(d);
  seedInicial(d);
}

function seedInicial(d: Database.Database) {
  const { n } = d.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  if (n > 0) return;
  const users: [string, string, string, 'ADMIN' | 'GESTOR' | 'OPERADOR', string][] = [
    ['Administrador',   'admin',  'admin123',   'ADMIN',    'PREPARACAO,CAPTURA,INSPECAO,INDEXACAO'],
    ['Gestor CEPE',     'gestor', 'gestor123',  'GESTOR',   'PREPARACAO,CAPTURA,INSPECAO,INDEXACAO'],
    ['Ana Preparadora', 'ana',    'ana123',     'OPERADOR', 'PREPARACAO'],
    ['Bruno Scanner',   'bruno',  'bruno123',   'OPERADOR', 'CAPTURA'],
    ['Carla Inspetora', 'carla',  'carla123',   'OPERADOR', 'INSPECAO'],
    ['Diego Indexador', 'diego',  'diego123',   'OPERADOR', 'INDEXACAO'],
  ];
  const ins = d.prepare(
    'INSERT INTO users (nome, matricula, senha_hash, perfil, etapas) VALUES (?,?,?,?,?)'
  );
  const tx = d.transaction(() => {
    for (const [nome, matricula, senha, perfil, etapas] of users) {
      ins.run(nome, matricula, bcrypt.hashSync(senha, 10), perfil, etapas);
    }
  });
  tx();
}

function colunaExiste(d: Database.Database, tabela: string, coluna: string): boolean {
  const rows = d.prepare(`PRAGMA table_info(${tabela})`).all() as { name: string }[];
  return rows.some(r => r.name === coluna);
}

function migrarOrdensServico(d: Database.Database) {
  const addCol = (nome: string, ddl: string) => {
    if (!colunaExiste(d, 'ordens_servico', nome)) d.exec(`ALTER TABLE ordens_servico ADD COLUMN ${ddl}`);
  };
  addCol('tipo_documento',   'tipo_documento TEXT');
  addCol('qtd_documentada',  'qtd_documentada INTEGER');
  addCol('qtd_conferida',    'qtd_conferida INTEGER');
  addCol('divergencia',      'divergencia TEXT');
  addCol('conferido_por',    'conferido_por INTEGER REFERENCES users(id)');
  addCol('conferido_em',     'conferido_em TEXT');

  // Relaxa o CHECK de status em bancos pré-existentes criando tabela nova quando necessário.
  const sqlAtual = (d.prepare(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='ordens_servico'`
  ).get() as { sql: string } | undefined)?.sql ?? '';
  if (!sqlAtual.includes('RECEBIDA_PENDENTE')) {
    d.exec('BEGIN');
    try {
      d.exec(`
        CREATE TABLE ordens_servico_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          numero TEXT NOT NULL UNIQUE,
          cliente TEXT,
          descricao TEXT,
          tipo TEXT NOT NULL CHECK(tipo IN ('SIMPLES','DUPLA','PADRAO')) DEFAULT 'SIMPLES',
          tipo_documento TEXT,
          qtd_caixas INTEGER NOT NULL DEFAULT 1,
          qtd_documentada INTEGER,
          qtd_conferida INTEGER,
          divergencia TEXT,
          conferido_por INTEGER REFERENCES users(id),
          conferido_em TEXT,
          imagens_previstas INTEGER NOT NULL DEFAULT 800,
          status TEXT NOT NULL CHECK(status IN ('RECEBIDA_PENDENTE','ABERTA','EM_PRODUCAO','CONCLUIDA','CANCELADA')) DEFAULT 'RECEBIDA_PENDENTE',
          protocolo_ref TEXT,
          criado_em TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO ordens_servico_new
          (id, numero, cliente, descricao, tipo, tipo_documento, qtd_caixas, qtd_documentada, qtd_conferida,
           divergencia, conferido_por, conferido_em, imagens_previstas, status, protocolo_ref, criado_em)
          SELECT id, numero, cliente, descricao, tipo, tipo_documento, qtd_caixas, qtd_documentada, qtd_conferida,
                 divergencia, conferido_por, conferido_em, imagens_previstas, status, protocolo_ref, criado_em
            FROM ordens_servico;
        DROP TABLE ordens_servico;
        ALTER TABLE ordens_servico_new RENAME TO ordens_servico;
      `);
      d.exec('COMMIT');
    } catch (e) {
      d.exec('ROLLBACK');
      throw e;
    }
  }
}

export const IMG_POR_CAIXA = 800;
export type TipoCaixa = 'SIMPLES' | 'DUPLA' | 'PADRAO';
export function imagensPrevistas(tipo: TipoCaixa): number {
  return tipo === 'PADRAO' ? 2400 : tipo === 'DUPLA' ? 1600 : 800;
}
export function caixasPorTipo(tipo: TipoCaixa): number {
  return tipo === 'PADRAO' ? 3 : tipo === 'DUPLA' ? 2 : 1;
}
export function rotuloTipo(tipo: TipoCaixa): string {
  return tipo === 'PADRAO' ? 'Padrão' : tipo === 'DUPLA' ? 'Box Dupla' : 'Box';
}
