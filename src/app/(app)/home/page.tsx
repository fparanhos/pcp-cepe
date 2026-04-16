import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { listarOSAtivas, totalPorEtapa } from '@/lib/metrics';
import { rotuloTipo } from '@/lib/db';

const CARDS = [
  { href: '/preparacao', etapa: 'PREPARACAO', label: 'Preparação', dica: 'Separar conjuntos e carimbar capas' },
  { href: '/captura',    etapa: 'CAPTURA',    label: 'Captura',    dica: 'Digitalizar imagens (faces)' },
  { href: '/inspecao',   etapa: 'INSPECAO',   label: 'Inspeção',   dica: 'Validar imagens capturadas' },
  { href: '/indexacao',  etapa: 'INDEXACAO',  label: 'Indexação',  dica: 'Indexar conjuntos de documentos' },
] as const;

export default async function Home() {
  const u = (await getSession())!;
  const oss = listarOSAtivas();
  const previstoTotal = oss.reduce((s, o) => s + o.imagens_previstas, 0);
  const totais = oss.reduce((acc, o) => {
    const t = totalPorEtapa(o.id);
    acc.PREPARACAO += t.PREPARACAO; acc.CAPTURA += t.CAPTURA;
    acc.INSPECAO   += t.INSPECAO;   acc.INDEXACAO += t.INDEXACAO;
    return acc;
  }, { PREPARACAO: 0, CAPTURA: 0, INSPECAO: 0, INDEXACAO: 0 });

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap gap-4 items-center">
        <div>
          <div className="text-xs uppercase text-black/50">Olá,</div>
          <h1 className="text-2xl font-bold text-cepe-green">{u.nome}</h1>
          <div className="text-sm text-black/60">Perfil: {u.perfil} · Matrícula {u.matricula}</div>
        </div>
        <div className="ml-auto grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <Kpi label="OS ativas" value={oss.length} />
          <Kpi label="Imagens previstas" value={previstoTotal} />
          <Kpi label="Capturadas" value={totais.CAPTURA} />
          <Kpi label="Inspecionadas" value={totais.INSPECAO} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CARDS.filter(c => u.etapas.includes(c.etapa)).map(c => (
          <Link key={c.href} href={c.href} className="card hover:shadow-md transition">
            <div className="text-cepe-green font-bold text-lg">{c.label}</div>
            <div className="text-sm text-black/60">{c.dica}</div>
          </Link>
        ))}
      </div>

      <section className="card">
        <h2 className="font-bold text-cepe-green mb-3">Ordens de Serviço ativas</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-black/60">
              <tr><th className="py-2">OS</th><th>Cliente</th><th>Tipo</th><th>Caixas</th><th>Previsto</th><th>Protocolo</th><th>Status</th></tr>
            </thead>
            <tbody>
              {oss.map(o => (
                <tr key={o.id} className="border-t border-black/5">
                  <td className="py-2 font-semibold">{o.numero}</td>
                  <td>{o.cliente}</td>
                  <td><span className="chip-beige">{rotuloTipo(o.tipo)}</span></td>
                  <td>{o.qtd_caixas}</td>
                  <td>{o.imagens_previstas}</td>
                  <td className="text-black/60">{o.protocolo_ref}</td>
                  <td><span className="chip-green">{o.status}</span></td>
                </tr>
              ))}
              {oss.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-black/50">Nenhuma OS ativa. Gestor pode sincronizar do Protocolo.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-cepe-cream/60 rounded-lg px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-black/60">{label}</div>
      <div className="text-xl font-bold text-cepe-green">{value}</div>
    </div>
  );
}
