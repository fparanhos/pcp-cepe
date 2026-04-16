import { NextResponse } from 'next/server';
import { autenticar, signSession } from '@/lib/auth';

export async function POST(req: Request) {
  const { matricula, senha } = await req.json();
  if (!matricula || !senha) return NextResponse.json({ erro: 'dados' }, { status: 400 });
  const u = autenticar(String(matricula).trim(), String(senha));
  if (!u) return NextResponse.json({ erro: 'credenciais' }, { status: 401 });
  await signSession(u);
  return NextResponse.json({ ok: true, user: u });
}
