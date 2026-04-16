import { NextResponse } from 'next/server';
import { getSession, hashSenha } from '@/lib/auth';
import { db } from '@/lib/db';

async function requireAdmin() {
  const u = await getSession();
  if (!u || u.perfil !== 'ADMIN') return null;
  return u;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ erro: 'proibido' }, { status: 403 });
  const rows = db().prepare(`SELECT id, nome, matricula, perfil, etapas, ativo, criado_em FROM users ORDER BY nome`).all();
  return NextResponse.json({ users: rows });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ erro: 'proibido' }, { status: 403 });
  const b = await req.json();
  const nome = String(b.nome || '').trim();
  const matricula = String(b.matricula || '').trim();
  const senha = String(b.senha || '');
  const perfil = ['ADMIN','GESTOR','OPERADOR'].includes(b.perfil) ? b.perfil : 'OPERADOR';
  const etapas = Array.isArray(b.etapas) ? b.etapas.filter((x: string) =>
    ['PREPARACAO','CAPTURA','INSPECAO','INDEXACAO'].includes(x)).join(',') : '';
  if (!nome || !matricula || !senha) return NextResponse.json({ erro: 'dados' }, { status: 400 });
  try {
    const r = db().prepare(`INSERT INTO users (nome, matricula, senha_hash, perfil, etapas) VALUES (?,?,?,?,?)`)
      .run(nome, matricula, hashSenha(senha), perfil, etapas);
    return NextResponse.json({ ok: true, id: r.lastInsertRowid });
  } catch (e: any) {
    return NextResponse.json({ erro: 'duplicado_ou_invalido', detalhe: e.message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ erro: 'proibido' }, { status: 403 });
  const b = await req.json();
  const id = Number(b.id);
  if (!id) return NextResponse.json({ erro: 'id' }, { status: 400 });
  const sets: string[] = []; const args: any[] = [];
  if (typeof b.nome === 'string')     { sets.push('nome=?');    args.push(b.nome); }
  if (typeof b.perfil === 'string')   { sets.push('perfil=?');  args.push(b.perfil); }
  if (Array.isArray(b.etapas))        { sets.push('etapas=?');  args.push(b.etapas.join(',')); }
  if (typeof b.ativo === 'boolean')   { sets.push('ativo=?');   args.push(b.ativo ? 1 : 0); }
  if (typeof b.senha === 'string' && b.senha.length > 0) { sets.push('senha_hash=?'); args.push(hashSenha(b.senha)); }
  if (!sets.length) return NextResponse.json({ erro: 'vazio' }, { status: 400 });
  args.push(id);
  db().prepare(`UPDATE users SET ${sets.join(',')} WHERE id=?`).run(...args);
  return NextResponse.json({ ok: true });
}
