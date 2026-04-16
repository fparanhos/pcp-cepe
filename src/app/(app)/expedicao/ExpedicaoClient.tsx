'use client';
import { useEffect, useState } from 'react';

type OS = {
  id: number;
  numero: string;
  cliente: string | null;
  tipo: 'SIMPLES' | 'DUPLA' | 'PADRAO';
  tipo_documento: string | null;
  qtd_caixas: number;
  imagens_previstas: number;
  qtd_imagens: number;
  protocolo_ref: string | null;
  status: string;
};

const ROT: Record<string, string> = { SIMPLES: 'Box', DUPLA: 'Box Dupla', PADRAO: 'Padrão' };

export default function ExpedicaoClient() {
  const [oss, setOss] = useState<OS[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<Record<number, string>>({});

  async function carregar() {
    setLoading(true);
    const r = await fetch('/api/os/prontas');
    const j = await r.json();
    setOss(j.oss || []);
    setLoading(false);
  }
  useEffect(() => { carregar(); }, []);

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold text-cepe-green">Expedição / Entrega ao Cliente</h1>
        <p className="text-sm text-black/60">
          Gera um protocolo de entrega no CEPE DOC e marca a OS como concluída.
        </p>
      </div>

      {loading ? (
        <div className="card text-sm text-black/60">Carregando…</div>
      ) : oss.length === 0 ? (
        <div className="card text-sm text-black/60">Nenhuma OS disponível para expedição.</div>
      ) : (
        oss.map(os => (
          <Cartao key={os.id} os={os} msg={result[os.id]} onDone={(m) => { setResult(s => ({ ...s, [os.id]: m })); carregar(); }} />
        ))
      )}
    </div>
  );
}

function Cartao({ os, msg, onDone }: { os: OS; msg?: string; onDone: (m: string) => void }) {
  const [receptor, setReceptor] = useState('');
  const [doc, setDoc] = useState('');
  const [obs, setObs] = useState('');
  const [busy, setBusy] = useState(false);
  const concluida = os.status === 'CONCLUIDA';

  async function entregar() {
    setBusy(true);
    const r = await fetch(`/api/os/${os.id}/entregar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receptor_nome: receptor || null,
        receptor_documento: doc || null,
        observacao: obs || null,
      }),
    });
    const j = await r.json();
    setBusy(false);
    onDone(r.ok
      ? `Entrega registrada no Protocolo: ${j.numero_protocolo ?? '—'}`
      : `Erro: ${j.erro}`);
  }

  return (
    <section className="card space-y-3">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-lg font-bold text-cepe-green">{os.numero}</h2>
        <span className="text-sm text-black/60">Protocolo origem: {os.protocolo_ref ?? '—'}</span>
        <span className={`chip ${concluida ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>{os.status}</span>
        <span className="chip-beige">{ROT[os.tipo]}</span>
      </header>

      <dl className="grid sm:grid-cols-4 gap-3 text-sm">
        <div><dt className="text-black/50">Cliente</dt><dd className="font-medium">{os.cliente ?? '—'}</dd></div>
        <div><dt className="text-black/50">Tipo doc.</dt><dd className="font-medium">{os.tipo_documento ?? '—'}</dd></div>
        <div><dt className="text-black/50">Caixas</dt><dd className="font-medium">{os.qtd_caixas}</dd></div>
        <div><dt className="text-black/50">Imagens indexadas</dt><dd className="font-medium">{os.qtd_imagens} / {os.imagens_previstas}</dd></div>
      </dl>

      {!concluida && (
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Receptor (nome)</label>
            <input className="input" value={receptor} onChange={e => setReceptor(e.target.value)} placeholder="quem recebe no cliente" />
          </div>
          <div>
            <label className="label">Documento do receptor</label>
            <input className="input" value={doc} onChange={e => setDoc(e.target.value)} placeholder="RG/CPF (opcional)" />
          </div>
          <div>
            <label className="label">Observação</label>
            <input className="input" value={obs} onChange={e => setObs(e.target.value)} />
          </div>
        </div>
      )}

      {msg && <div className="text-sm text-black/70">{msg}</div>}

      {!concluida && (
        <div className="flex justify-end">
          <button className="btn-primary" disabled={busy} onClick={entregar}>
            Gerar protocolo de entrega
          </button>
        </div>
      )}
    </section>
  );
}
