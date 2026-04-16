import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { db } from './db';

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-secret-pcp-cepe-change-me');
const COOKIE = 'pcp_session';

export type Perfil = 'ADMIN' | 'GESTOR' | 'OPERADOR';
export type Etapa = 'PREPARACAO' | 'CAPTURA' | 'INSPECAO' | 'INDEXACAO';

export type SessionUser = {
  id: number;
  nome: string;
  matricula: string;
  perfil: Perfil;
  etapas: Etapa[];
};

export async function signSession(u: SessionUser) {
  const token = await new SignJWT({ ...u })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(SECRET);
  cookies().set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const c = cookies().get(COOKIE)?.value;
  if (!c) return null;
  try {
    const { payload } = await jwtVerify(c, SECRET);
    return {
      id: payload.id as number,
      nome: payload.nome as string,
      matricula: payload.matricula as string,
      perfil: payload.perfil as Perfil,
      etapas: payload.etapas as Etapa[],
    };
  } catch { return null; }
}

export function clearSession() { cookies().delete(COOKIE); }

export function autenticar(matricula: string, senha: string): SessionUser | null {
  const row = db().prepare(`SELECT * FROM users WHERE matricula = ? AND ativo = 1`).get(matricula) as any;
  if (!row) return null;
  if (!bcrypt.compareSync(senha, row.senha_hash)) return null;
  return {
    id: row.id, nome: row.nome, matricula: row.matricula,
    perfil: row.perfil,
    etapas: (row.etapas as string).split(',').filter(Boolean) as Etapa[],
  };
}

export function hashSenha(s: string) { return bcrypt.hashSync(s, 10); }
