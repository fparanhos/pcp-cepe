'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';

export default function LoginPage() {
  const [matricula, setM] = useState('');
  const [senha, setS] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setLoading(true);
    const r = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matricula, senha }),
    });
    setLoading(false);
    if (!r.ok) { setErro('Matrícula ou senha inválidas.'); return; }
    router.push('/');
    router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-cepe-grey">
      <form onSubmit={submit} className="card w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <Logo size={48} />
          <div>
            <div className="font-normal tracking-wide text-cepe-green text-lg leading-none">PCP Cepe</div>
            <div className="text-xs text-black/60">Digitalização de Documentos</div>
          </div>
        </div>
        <label className="label">Matrícula</label>
        <input className="input mb-3" value={matricula} onChange={(e) => setM(e.target.value)} autoFocus required />
        <label className="label">Senha</label>
        <input className="input mb-4" type="password" value={senha} onChange={(e) => setS(e.target.value)} required />
        {erro && <div className="text-sm text-red-600 mb-3">{erro}</div>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
        <p className="text-xs text-black/50 mt-4">Dica de demo: <b>admin / admin123</b></p>
      </form>
    </main>
  );
}
