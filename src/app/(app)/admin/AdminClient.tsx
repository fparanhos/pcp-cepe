'use client';
import { useEffect, useState } from 'react';

type U = { id: number; nome: string; matricula: string; perfil: string; etapas: string; ativo: number };
const ETAPAS = ['PREPARACAO','CAPTURA','INSPECAO','INDEXACAO'] as const;

export default function AdminClient() {
  const [users, setUsers] = useState<U[]>([]);
  const [form, setForm] = useState({ nome: '', matricula: '', senha: '', perfil: 'OPERADOR', etapas: [] as string[] });
  const [msg, setMsg] = useState<string | null>(null);
  const [sync, setSync] = useState<string | null>(null);

  async function carregar() {
    const r = await fetch('/api/users'); const j = await r.json(); setUsers(j.users || []);
  }
  useEffect(() => { carregar(); }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const r = await fetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!r.ok) { const j = await r.json(); setMsg(j.detalhe || j.erro); return; }
    setForm({ nome: '', matricula: '', senha: '', perfil: 'OPERADOR', etapas: [] });
    setMsg('Usuário criado.'); carregar();
  }

  async function alterar(u: U, patch: { perfil?: string; nome?: string; ativo?: boolean; senha?: string; etapas?: string[] }) {
    await fetch('/api/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, ...patch }),
    });
    carregar();
  }

  async function sincronizar() {
    setSync('Sincronizando…');
    const r = await fetch('/api/os/sync', { method: 'POST' });
    const j = await r.json();
    setSync(r.ok ? `OK — criadas: ${j.criadas}, ignoradas: ${j.ignoradas}` : `Erro: ${j.erro}`);
  }

  function toggleEtapa(list: string[], etapa: string): string[] {
    return list.includes(etapa) ? list.filter(x => x !== etapa) : [...list, etapa];
  }

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cepe-green">Administração</h1>
          <p className="text-sm text-black/60">Usuários e integração com Protocolo</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {sync && <span className="text-sm text-black/60">{sync}</span>}
          <button onClick={sincronizar} className="btn-ghost">Sincronizar Protocolo → OS</button>
        </div>
      </div>

      <section className="card">
        <h2 className="font-bold text-cepe-green mb-3">Novo usuário</h2>
        <form onSubmit={criar} className="grid sm:grid-cols-5 gap-3">
          <div><label className="label">Nome</label><input className="input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required /></div>
          <div><label className="label">Matrícula</label><input className="input" value={form.matricula} onChange={e => setForm({ ...form, matricula: e.target.value })} required /></div>
          <div><label className="label">Senha</label><input className="input" type="password" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} required /></div>
          <div>
            <label className="label">Perfil</label>
            <select className="input" value={form.perfil} onChange={e => setForm({ ...form, perfil: e.target.value })}>
              <option>OPERADOR</option><option>GESTOR</option><option>ADMIN</option>
            </select>
          </div>
          <div className="sm:col-span-5">
            <label className="label">Etapas permitidas</label>
            <div className="flex flex-wrap gap-2">
              {ETAPAS.map(et => (
                <label key={et} className={`chip cursor-pointer ${form.etapas.includes(et) ? 'bg-cepe-green text-white' : 'bg-black/5 text-black/70'}`}>
                  <input type="checkbox" className="hidden" checked={form.etapas.includes(et)}
                         onChange={() => setForm({ ...form, etapas: toggleEtapa(form.etapas, et) })} />
                  {et}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-5 flex items-center gap-3">
            <button className="btn-primary">Criar usuário</button>
            {msg && <span className="text-sm">{msg}</span>}
          </div>
        </form>
      </section>

      <section className="card">
        <h2 className="font-bold text-cepe-green mb-3">Usuários</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-black/60"><tr>
              <th className="py-2">Nome</th><th>Matrícula</th><th>Perfil</th><th>Etapas</th><th>Ativo</th><th>Ações</th>
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t border-black/5 align-top">
                  <td className="py-2">{u.nome}</td>
                  <td>{u.matricula}</td>
                  <td>
                    <select className="input !py-1" defaultValue={u.perfil}
                            onChange={e => alterar(u, { perfil: e.target.value })}>
                      <option>OPERADOR</option><option>GESTOR</option><option>ADMIN</option>
                    </select>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {ETAPAS.map(et => {
                        const lista = u.etapas.split(',').filter(Boolean);
                        const on = lista.includes(et);
                        return (
                          <button key={et} type="button" onClick={() => alterar(u, { etapas: toggleEtapa(lista, et) })}
                                  className={`chip ${on ? 'bg-cepe-green text-white' : 'bg-black/5 text-black/60'}`}>{et}</button>
                        );
                      })}
                    </div>
                  </td>
                  <td>
                    <input type="checkbox" defaultChecked={!!u.ativo}
                           onChange={e => alterar(u, { ativo: e.target.checked })} />
                  </td>
                  <td>
                    <ResetSenha onSave={(s) => alterar(u, { senha: s })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ResetSenha({ onSave }: { onSave: (senha: string) => void }) {
  const [v, setV] = useState('');
  return (
    <div className="flex gap-2">
      <input className="input !py-1 !w-28" placeholder="nova senha" value={v} onChange={e => setV(e.target.value)} />
      <button className="btn-ghost !py-1 !px-2 text-xs" disabled={v.length < 4} onClick={() => { onSave(v); setV(''); }}>Salvar</button>
    </div>
  );
}
