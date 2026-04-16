'use client';
import { useEffect, useMemo, useState } from 'react';

type Data = {
  porEtapa: { etapa: string; total: number }[];
  porFuncionario: any[]; porOS: any[]; porDia: any[];
  totalGeral: number; users: { id: number; nome: string }[]; oss: { id: number; numero: string; cliente: string }[];
};

function hoje() { return new Date().toISOString().slice(0, 10); }
function dMinus(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0,10); }

export default function DashboardClient() {
  const [de, setDe] = useState(dMinus(30));
  const [ate, setAte] = useState(hoje());
  const [userId, setUserId] = useState<number | ''>('');
  const [osId, setOsId] = useState<number | ''>('');
  const [data, setData] = useState<Data | null>(null);

  async function carregar() {
    const q = new URLSearchParams({ de, ate });
    if (userId) q.set('user_id', String(userId));
    if (osId) q.set('os_id', String(osId));
    const r = await fetch('/api/dashboard?' + q.toString());
    if (r.ok) setData(await r.json());
  }
  useEffect(() => { carregar(); }, [de, ate, userId, osId]);
  useEffect(() => { const t = setInterval(carregar, 10000); return () => clearInterval(t); }, [de, ate, userId, osId]);

  const etapa = useMemo(() => {
    const o: Record<string, number> = { PREPARACAO: 0, CAPTURA: 0, INSPECAO: 0, INDEXACAO: 0 };
    data?.porEtapa.forEach(r => (o[r.etapa] = r.total));
    return o;
  }, [data]);

  const diasChart = useMemo(() => {
    if (!data) return [];
    const mapa: Record<string, Record<string, number>> = {};
    data.porDia.forEach((r: any) => { mapa[r.dia] ||= {}; mapa[r.dia][r.etapa] = r.total; });
    return Object.entries(mapa).sort(([a],[b]) => a.localeCompare(b))
      .map(([dia, v]) => ({ dia, ...v, total: Object.values(v).reduce((s, x) => s + x, 0) }));
  }, [data]);

  const maxDia = Math.max(1, ...diasChart.map((d: any) => d.total));

  return (
    <div className="space-y-6">
      <div className="card grid sm:grid-cols-4 gap-3">
        <div><label className="label">De</label><input className="input" type="date" value={de} onChange={e => setDe(e.target.value)} /></div>
        <div><label className="label">Até</label><input className="input" type="date" value={ate} onChange={e => setAte(e.target.value)} /></div>
        <div>
          <label className="label">Funcionário</label>
          <select className="input" value={userId} onChange={e => setUserId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Todos</option>
            {data?.users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Ordem de Serviço</label>
          <select className="input" value={osId} onChange={e => setOsId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Todas</option>
            {data?.oss.map(o => <option key={o.id} value={o.id}>{o.numero} — {o.cliente}</option>)}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Total geral" value={data?.totalGeral ?? 0} big />
        <Kpi label="Preparação" value={etapa.PREPARACAO} />
        <Kpi label="Captura"    value={etapa.CAPTURA} />
        <Kpi label="Inspeção"   value={etapa.INSPECAO} />
        <Kpi label="Indexação"  value={etapa.INDEXACAO} />
      </div>

      <section className="card">
        <h2 className="font-bold text-cepe-green mb-3">Produção diária</h2>
        <div className="flex items-end gap-2 h-40">
          {diasChart.length === 0 && <div className="text-sm text-black/50">Sem dados no período.</div>}
          {diasChart.map((d: any) => (
            <div key={d.dia} className="flex flex-col items-center gap-1 flex-1">
              <div className="text-[10px] text-black/60">{d.total}</div>
              <div className="w-full bg-black/5 rounded relative" style={{ height: `${(d.total/maxDia)*100}%`, minHeight: 4 }}>
                <div className="absolute inset-0 bg-cepe-green rounded" />
              </div>
              <div className="text-[10px] text-black/60">{d.dia.slice(5)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="font-bold text-cepe-green mb-3">Produtividade por funcionário</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-black/60">
            <tr><th className="py-2">Funcionário</th><th>Prep.</th><th>Capt.</th><th>Insp.</th><th>Idx.</th><th>Total</th></tr>
          </thead>
          <tbody>
            {data?.porFuncionario.map((u: any) => (
              <tr key={u.id} className="border-t border-black/5">
                <td className="py-2">{u.nome} <span className="text-black/40 text-xs">({u.matricula})</span></td>
                <td>{u.preparacao}</td><td>{u.captura}</td><td>{u.inspecao}</td><td>{u.indexacao}</td>
                <td className="font-bold text-cepe-green">{u.total}</td>
              </tr>
            ))}
            {!data?.porFuncionario?.length && <tr><td colSpan={6} className="py-6 text-center text-black/50">Sem produção.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="font-bold text-cepe-green mb-3">Produção por Ordem de Serviço</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-black/60">
            <tr><th className="py-2">OS</th><th>Cliente</th><th>Tipo</th><th>Previsto</th><th>Prep.</th><th>Capt.</th><th>Insp.</th><th>Idx.</th><th>% Captura</th></tr>
          </thead>
          <tbody>
            {data?.porOS.map((o: any) => {
              const pct = o.imagens_previstas ? Math.min(100, Math.round((o.capturadas / o.imagens_previstas) * 100)) : 0;
              return (
                <tr key={o.id} className="border-t border-black/5">
                  <td className="py-2 font-semibold">{o.numero}</td>
                  <td>{o.cliente}</td><td><span className="chip-beige">{o.tipo === 'PADRAO' ? 'Padrão' : o.tipo === 'DUPLA' ? 'Box Dupla' : 'Box'}</span></td>
                  <td>{o.imagens_previstas}</td>
                  <td>{o.preparadas}</td><td>{o.capturadas}</td><td>{o.inspecionadas}</td><td>{o.indexadas}</td>
                  <td className="min-w-[120px]">
                    <div className="bar"><span style={{ width: `${pct}%` }} /></div>
                    <div className="text-[10px] text-black/60 text-right">{pct}%</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Kpi({ label, value, big = false }: { label: string; value: number; big?: boolean }) {
  return (
    <div className={`kpi ${big ? 'bg-cepe-green text-white' : ''}`}>
      <div className={`kpi-label ${big ? '!text-white/70' : ''}`}>{label}</div>
      <div className={`kpi-value ${big ? '!text-white' : ''}`}>{value}</div>
    </div>
  );
}
