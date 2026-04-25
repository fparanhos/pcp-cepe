'use client';
import { useEffect, useMemo, useState } from 'react';

type Caixa = { id: number; codigo: string; id_objeto: number | null; status: string; imagens_previstas: number };
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

function statusLabel(s: string) {
  if (s.startsWith('AGUARDANDO_')) return 'Aguardando';
  if (s.startsWith('EM_'))         return 'Em andamento';
  if (s === 'CONCLUIDA')           return 'Concluída';
  return s;
}

export default function EtapaApontamento({ etapa, titulo, unidade, descricao, exigeCaixa = true }: Props) {
  const [oss, setOss] = useState<OS[]>([]);
  const [osId, setOsId] = useState<number | null>(null);
  const [caixaId, setCaixaId] = useState<number | null>(null);
  const [qtd, setQtd] = useState<number>(1);
  const [obs, setObs] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null);
  const [hoje, setHoje] = useState<number | null>(null);
  const [minha, setMinha] = useState<number | null>(null);
  const [finalizando, setFinalizando] = useState(false);

  async function carregar() {
    const r = await fetch(`/api/os?etapa=${etapa}`); const j = await r.json();
    setOss(j.oss || []);
    setOsId(prev => {
      if (prev && j.oss?.some((o: OS) => o.id === prev)) return prev;
      return j.oss?.[0]?.id ?? null;
    });
  }
  useEffect(() => { carregar(); const t = setInterval(carregar, 8000); return () => clearInterval(t); }, []);
  const os = useMemo(() => oss.find(o => o.id === osId) || null, [oss, osId]);
  useEffect(() => {
    setCaixaId(prev => {
      if (prev && os?.caixas?.some(c => c.id === prev)) return prev;
      return os?.caixas?.[0]?.id ?? null;
    });
  }, [os?.id, os?.caixas?.length]);

  const caixaSel = useMemo(() => os?.caixas.find(c => c.id === caixaId) || null, [os, caixaId]);

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

  async function finalizarCaixa() {
    if (!caixaId) return;
    if (!confirm(`Finalizar caixa ${caixaSel?.codigo} nesta fase? Ela passa para a próxima.`)) return;
    setFinalizando(true); setMsg(null);
    const r = await fetch(`/api/caixas/${caixaId}/finalizar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etapa }),
    });
    const j = await r.json();
    setFinalizando(false);
    if (!r.ok) { setMsg({ tipo: 'err', texto: j.mensagem || 'Não foi possível finalizar.' }); return; }
    setMsg({ tipo: 'ok', texto: `Caixa enviada para próxima fase.` });
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
        {oss.length === 0 && (
          <div className="bg-cepe-cream/40 border border-cepe-beige rounded p-4 text-sm text-black/70">
            Nenhuma OS com caixas nesta fase agora.
          </div>
        )}
        <form onSubmit={enviar} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Ordem de Serviço</label>
            <select className="input" value={osId ?? ''} onChange={e => setOsId(Number(e.target.value))}>
              {oss.map(o => (
                <option key={o.id} value={o.id}>
                  {o.numero} — {o.cliente} ({o.caixas.length} caixa{o.caixas.length === 1 ? '' : 's'} nesta fase)
                </option>
              ))}
            </select>
          </div>
          {exigeCaixa && (
            <div className="sm:col-span-2">
              <label className="label">Caixa (objeto do protocolo)</label>
              <div className="flex gap-2">
                <select className="input flex-1" value={caixaId ?? ''} onChange={e => setCaixaId(Number(e.target.value))}>
                  {os?.caixas.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} · {statusLabel(c.status)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={finalizarCaixa}
                  disabled={!caixaId || finalizando}
                  className="px-4 py-2 rounded bg-cepe-green text-white text-sm disabled:opacity-50"
                  title="Marca esta caixa como concluída na fase atual e libera para a próxima"
                >
                  {finalizando ? 'Finalizando…' : 'Finalizar caixa'}
                </button>
              </div>
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
            <button className="btn-primary" disabled={!osId}>Registrar apontamento</button>
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
