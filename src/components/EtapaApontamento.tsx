'use client';
import { useEffect, useMemo, useState } from 'react';

type Caixa = { id: number; codigo: string; imagens_previstas: number };
type OS = {
  id: number; numero: string; cliente: string; tipo: string;
  qtd_caixas: number; imagens_previstas: number; status: string;
  caixas: Caixa[];
  totais: { PREPARACAO: number; CAPTURA: number; INSPECAO: number; INDEXACAO: number };
};

type Props = {
  etapa: 'PREPARACAO' | 'CAPTURA' | 'INSPECAO' | 'INDEXACAO';
  titulo: string;
  unidade: string;     // "imagens", "documentos", "conjuntos"
  descricao: string;
  exigeCaixa?: boolean;
};

export default function EtapaApontamento({ etapa, titulo, unidade, descricao, exigeCaixa = true }: Props) {
  const [oss, setOss] = useState<OS[]>([]);
  const [osId, setOsId] = useState<number | null>(null);
  const [caixaId, setCaixaId] = useState<number | null>(null);
  const [qtd, setQtd] = useState<number>(1);
  const [obs, setObs] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null);
  const [hoje, setHoje] = useState<number | null>(null);
  const [minha, setMinha] = useState<number | null>(null);

  async function carregar() {
    const r = await fetch('/api/os'); const j = await r.json();
    setOss(j.oss || []);
    if (!osId && j.oss?.[0]) setOsId(j.oss[0].id);
  }
  useEffect(() => { carregar(); const t = setInterval(carregar, 8000); return () => clearInterval(t); }, []);
  const os = useMemo(() => oss.find(o => o.id === osId) || null, [oss, osId]);
  useEffect(() => { setCaixaId(os?.caixas?.[0]?.id || null); }, [os?.id]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!osId) { setMsg({ tipo: 'err', texto: 'Selecione a Ordem de Serviço.' }); return; }
    if (exigeCaixa && !caixaId) { setMsg({ tipo: 'err', texto: 'Selecione a caixa.' }); return; }
    const r = await fetch('/api/apontamentos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etapa, os_id: osId, caixa_id: exigeCaixa ? caixaId : null, quantidade: qtd, observacao: obs || null }),
    });
    const j = await r.json();
    if (!r.ok) { setMsg({ tipo: 'err', texto: j.mensagem || 'Não foi possível registrar.' }); return; }
    setMsg({ tipo: 'ok', texto: `+${qtd} ${unidade} registradas.` });
    setHoje(j.produtividade?.hoje ?? null);
    setMinha(j.produtividade?.total ?? null);
    setQtd(1); setObs('');
    carregar();
  }

  const previsto = os?.imagens_previstas ?? 0;
  const realizado = os ? os.totais[etapa] : 0;
  const pct = previsto ? Math.min(100, Math.round((realizado / previsto) * 100)) : 0;

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <section className="md:col-span-2 card">
        <h1 className="text-2xl font-bold text-cepe-green">{titulo}</h1>
        <p className="text-sm text-black/60 mb-5">{descricao}</p>
        <form onSubmit={enviar} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Ordem de Serviço</label>
            <select className="input" value={osId ?? ''} onChange={e => setOsId(Number(e.target.value))}>
              {oss.map(o => (
                <option key={o.id} value={o.id}>
                  {o.numero} — {o.cliente} ({o.tipo} · {o.imagens_previstas} img)
                </option>
              ))}
            </select>
          </div>
          {exigeCaixa && (
            <div>
              <label className="label">Caixa</label>
              <select className="input" value={caixaId ?? ''} onChange={e => setCaixaId(Number(e.target.value))}>
                {os?.caixas.map(c => <option key={c.id} value={c.id}>{c.codigo}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Quantidade de {unidade}</label>
            <input className="input" type="number" min={1} value={qtd} onChange={e => setQtd(Math.max(1, Number(e.target.value) || 1))} required />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Observação (opcional)</label>
            <input className="input" value={obs} onChange={e => setObs(e.target.value)} maxLength={500} />
          </div>
          <div className="sm:col-span-2 flex gap-3 items-center">
            <button className="btn-primary">Registrar apontamento</button>
            {msg && <span className={`text-sm ${msg.tipo === 'ok' ? 'text-cepe-green' : 'text-red-600'}`}>{msg.texto}</span>}
          </div>
        </form>
      </section>

      <aside className="space-y-4">
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-black/50 mb-1">Progresso da OS</div>
          <div className="text-sm text-black/70 mb-2">
            {os ? `${os.numero} — ${realizado} / ${previsto} ${unidade}` : '—'}
          </div>
          <div className="bar"><span style={{ width: `${pct}%` }} /></div>
          <div className="text-right text-xs text-black/60 mt-1">{pct}%</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="kpi">
            <div className="kpi-label">Meu total hoje</div>
            <div className="kpi-value">{hoje ?? '—'}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Meu acumulado</div>
            <div className="kpi-value">{minha ?? '—'}</div>
          </div>
        </div>
        {os && (
          <div className="card text-sm">
            <div className="font-semibold mb-2 text-cepe-green">Totais da OS</div>
            <ul className="space-y-1">
              <li className="flex justify-between"><span>Preparação</span><b>{os.totais.PREPARACAO}</b></li>
              <li className="flex justify-between"><span>Captura</span><b>{os.totais.CAPTURA}</b></li>
              <li className="flex justify-between"><span>Inspeção</span><b>{os.totais.INSPECAO}</b></li>
              <li className="flex justify-between"><span>Indexação</span><b>{os.totais.INDEXACAO}</b></li>
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
