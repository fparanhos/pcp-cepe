'use client';
import { useEffect, useState } from 'react';

type OS = {
  id: number;
  numero: string;
  cliente: string | null;
  descricao: string | null;
  tipo: 'SIMPLES' | 'DUPLA' | 'PADRAO';
  tipo_documento: string | null;
  qtd_caixas: number;
  qtd_documentada: number | null;
  qtd_conferida: number | null;
  divergencia: string | null;
  protocolo_ref: string | null;
  status: string;
};

const TIPOS: { v: 'SIMPLES' | 'DUPLA' | 'PADRAO'; rot: string }[] = [
  { v: 'SIMPLES', rot: 'Box' },
  { v: 'DUPLA', rot: 'Box Dupla' },
  { v: 'PADRAO', rot: 'Padrão' },
];

export default function RecebimentoClient() {
  const [oss, setOss] = useState<OS[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    const r = await fetch('/api/os/pendentes');
    const j = await r.json();
    setOss(j.oss || []);
    setLoading(false);
  }
  useEffect(() => { carregar(); }, []);

  async function sincronizar() {
    setMsg('Sincronizando Protocolo…');
    const r = await fetch('/api/os/sync', { method: 'POST' });
    const j = await r.json();
    setMsg(r.ok ? `Protocolo sincronizado — criadas: ${j.criadas}, ignoradas: ${j.ignoradas}` : `Erro: ${j.erro}`);
    carregar();
  }

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cepe-green">Recebimento de Caixas</h1>
          <p className="text-sm text-black/60">Identificar cliente, classificar, conferir e confirmar o recebimento.</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {msg && <span className="text-sm text-black/60">{msg}</span>}
          <button onClick={sincronizar} className="btn-ghost">Sincronizar Protocolo</button>
        </div>
      </div>

      {loading ? (
        <div className="card text-sm text-black/60">Carregando…</div>
      ) : oss.length === 0 ? (
        <div className="card text-sm text-black/60">Nenhuma OS pendente de recebimento.</div>
      ) : (
        oss.map(os => <Cartao key={os.id} os={os} onChange={carregar} />)
      )}
    </div>
  );
}

function Cartao({ os, onChange }: { os: OS; onChange: () => void }) {
  const [tipo, setTipo] = useState<OS['tipo']>(os.tipo);
  const [tipoDoc, setTipoDoc] = useState(os.tipo_documento ?? '');
  const [qtd, setQtd] = useState<number>(os.qtd_conferida ?? os.qtd_documentada ?? os.qtd_caixas ?? 0);
  const [obs, setObs] = useState(os.divergencia ?? '');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const doc = os.qtd_documentada ?? 0;
  const divergente = qtd !== doc;

  async function enviar(acao: 'confirmar' | 'ajustar') {
    setBusy(true); setErro(null);
    const r = await fetch(`/api/os/${os.id}/receber`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        acao,
        tipo,
        tipo_documento: tipoDoc || null,
        qtd_conferida: qtd,
        divergencia: obs || null,
      }),
    });
    setBusy(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); setErro(j.erro || 'erro'); return; }
    onChange();
  }

  return (
    <section className="card space-y-4">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-lg font-bold text-cepe-green">{os.numero}</h2>
        <span className="text-sm text-black/60">Protocolo: {os.protocolo_ref ?? '—'}</span>
        <span className="chip bg-amber-100 text-amber-800">Pendente</span>
      </header>

      <dl className="grid sm:grid-cols-3 gap-3 text-sm">
        <div><dt className="text-black/50">Cliente</dt><dd className="font-medium">{os.cliente ?? '—'}</dd></div>
        <div><dt className="text-black/50">Descrição</dt><dd className="font-medium">{os.descricao ?? '—'}</dd></div>
        <div><dt className="text-black/50">Qtd. documentada</dt><dd className="font-medium">{doc}</dd></div>
      </dl>

      <div className="grid sm:grid-cols-4 gap-3">
        <div>
          <label className="label">Tipo de caixa</label>
          <select className="input" value={tipo} onChange={e => setTipo(e.target.value as OS['tipo'])}>
            {TIPOS.map(t => <option key={t.v} value={t.v}>{t.rot}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tipo de documento</label>
          <input className="input" placeholder="ex.: processos, históricos…" value={tipoDoc} onChange={e => setTipoDoc(e.target.value)} />
        </div>
        <div>
          <label className="label">Qtd. conferida</label>
          <input className="input" type="number" min={0} value={qtd} onChange={e => setQtd(Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Observação / divergência</label>
          <input className="input" value={obs} onChange={e => setObs(e.target.value)} placeholder={divergente ? 'explique a divergência' : '—'} />
        </div>
      </div>

      {divergente && (
        <div className="text-sm text-amber-700">
          Quantidade conferida ({qtd}) difere da documentada ({doc}). Ajuste antes de confirmar ou registre divergência.
        </div>
      )}
      {erro && <div className="text-sm text-red-700">Erro: {erro}</div>}

      <div className="flex flex-wrap gap-2 justify-end">
        <button className="btn-ghost" disabled={busy} onClick={() => enviar('ajustar')}>Salvar ajuste (manter pendente)</button>
        <button className="btn-primary" disabled={busy || divergente} onClick={() => enviar('confirmar')}>
          Confirmar recebimento
        </button>
      </div>
    </section>
  );
}
