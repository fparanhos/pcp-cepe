// Seed inicial (JS puro, independente do Next). Cria schema, admin e dados de demo.
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.PCP_DB_PATH || './data/pcp.db';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const d = new Database(DB_PATH);
d.pragma('journal_mode = WAL');
d.pragma('foreign_keys = ON');

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
  cliente TEXT, descricao TEXT,
  tipo TEXT NOT NULL CHECK(tipo IN ('SIMPLES','DUPLA','PADRAO')) DEFAULT 'SIMPLES',
  qtd_caixas INTEGER NOT NULL DEFAULT 1,
  imagens_previstas INTEGER NOT NULL DEFAULT 800,
  status TEXT NOT NULL CHECK(status IN ('ABERTA','EM_PRODUCAO','CONCLUIDA','CANCELADA')) DEFAULT 'ABERTA',
  protocolo_ref TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS caixas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  os_id INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL, protocolo_ref TEXT,
  imagens_previstas INTEGER NOT NULL DEFAULT 800,
  UNIQUE(os_id, codigo)
);
CREATE TABLE IF NOT EXISTS apontamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  os_id INTEGER NOT NULL REFERENCES ordens_servico(id),
  caixa_id INTEGER REFERENCES caixas(id),
  etapa TEXT NOT NULL CHECK(etapa IN ('PREPARACAO','CAPTURA','INSPECAO','INDEXACAO')),
  quantidade INTEGER NOT NULL CHECK(quantidade > 0),
  observacao TEXT,
  registrado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_apont_user  ON apontamentos(user_id);
CREATE INDEX IF NOT EXISTS idx_apont_os    ON apontamentos(os_id);
CREATE INDEX IF NOT EXISTS idx_apont_data  ON apontamentos(registrado_em);
CREATE INDEX IF NOT EXISTS idx_apont_etapa ON apontamentos(etapa);
`);

const usersSeed = [
  ['Administrador', 'admin',    'admin123',   'ADMIN',    'PREPARACAO,CAPTURA,INSPECAO,INDEXACAO'],
  ['Gestor CEPE',   'gestor',   'gestor123',  'GESTOR',   'PREPARACAO,CAPTURA,INSPECAO,INDEXACAO'],
  ['Ana Preparadora',  'ana',    'ana123',    'OPERADOR', 'PREPARACAO'],
  ['Bruno Scanner',    'bruno',  'bruno123',  'OPERADOR', 'CAPTURA'],
  ['Carla Inspetora',  'carla',  'carla123',  'OPERADOR', 'INSPECAO'],
  ['Diego Indexador',  'diego',  'diego123',  'OPERADOR', 'INDEXACAO'],
];
const insU = d.prepare(`INSERT OR IGNORE INTO users (nome, matricula, senha_hash, perfil, etapas) VALUES (?,?,?,?,?)`);
for (const [nome, m, s, p, e] of usersSeed) insU.run(nome, m, bcrypt.hashSync(s, 10), p, e);

const entradas = [
  { protocolo: 'PRT-2026-00101', cliente: 'SEFAZ-PE', descricao: 'Processos fiscais 2019', qtd_caixas: 1 },
  { protocolo: 'PRT-2026-00102', cliente: 'Tribunal de Contas', descricao: 'Prestação de contas', qtd_caixas: 2 },
  { protocolo: 'PRT-2026-00103', cliente: 'Secretaria de Educação', descricao: 'Históricos escolares', qtd_caixas: 3 },
];
const existe = d.prepare('SELECT 1 FROM ordens_servico WHERE protocolo_ref = ?');
const insOS = d.prepare(`INSERT INTO ordens_servico (numero, cliente, descricao, tipo, qtd_caixas, imagens_previstas, status, protocolo_ref) VALUES (?,?,?,?,?,?, 'ABERTA', ?)`);
const insCaixa = d.prepare(`INSERT INTO caixas (os_id, codigo, protocolo_ref, imagens_previstas) VALUES (?,?,?,800)`);
const base = d.prepare(`SELECT COUNT(*) AS n FROM ordens_servico`).get().n;
let seq = base + 1;
const tx = d.transaction(() => {
  for (const e of entradas) {
    if (existe.get(e.protocolo)) continue;
    const tipo = e.qtd_caixas >= 3 ? 'PADRAO' : e.qtd_caixas === 2 ? 'DUPLA' : 'SIMPLES';
    const prev = tipo === 'PADRAO' ? 2400 : tipo === 'DUPLA' ? 1600 : 800;
    const caixas = tipo === 'PADRAO' ? 3 : tipo === 'DUPLA' ? 2 : 1;
    const numero = `OS-${new Date().getFullYear()}-${String(seq++).padStart(5,'0')}`;
    const res = insOS.run(numero, e.cliente, e.descricao, tipo, caixas, prev, e.protocolo);
    for (let i=1; i<=caixas; i++) insCaixa.run(res.lastInsertRowid, `CX-${String(i).padStart(2,'0')}`, e.protocolo);
  }
});
tx();

console.log('Seed concluído.');
console.log('Usuários: admin/admin123, gestor/gestor123, ana/ana123, bruno/bruno123, carla/carla123, diego/diego123');
