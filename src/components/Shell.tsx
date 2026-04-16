'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from './Logo';

type U = { nome: string; matricula: string; perfil: 'ADMIN'|'GESTOR'|'OPERADOR'; etapas: string[] };

const NAV_OPER = [
  { href: '/preparacao', label: 'Preparação', etapa: 'PREPARACAO' },
  { href: '/captura',    label: 'Captura',    etapa: 'CAPTURA' },
  { href: '/inspecao',   label: 'Inspeção',   etapa: 'INSPECAO' },
  { href: '/indexacao',  label: 'Indexação',  etapa: 'INDEXACAO' },
];

export function Shell({ user, children }: { user: U; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const isGestor = user.perfil === 'ADMIN' || user.perfil === 'GESTOR';

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login'); router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-cepe-green text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Logo size={34} mono />
          <div className="leading-tight">
            <div className="font-normal tracking-wide">PCP Cepe</div>
            <div className="text-[11px] opacity-80">Digitalização</div>
          </div>
          <nav className="ml-6 flex flex-wrap gap-1 text-sm">
            <Link href="/" className={tab(path === '/')}>Início</Link>
            {isGestor && <Link href="/recebimento" className={tab(path.startsWith('/recebimento'))}>Recebimento</Link>}
            {NAV_OPER.filter(n => user.etapas.includes(n.etapa)).map(n => (
              <Link key={n.href} href={n.href} className={tab(path.startsWith(n.href))}>{n.label}</Link>
            ))}
            {isGestor && <Link href="/expedicao" className={tab(path.startsWith('/expedicao'))}>Expedição</Link>}
            {isGestor && <Link href="/dashboard" className={tab(path.startsWith('/dashboard'))}>Dashboard</Link>}
            {user.perfil === 'ADMIN' && <Link href="/admin" className={tab(path.startsWith('/admin'))}>Admin</Link>}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden sm:inline opacity-90">{user.nome} <span className="opacity-60">({user.perfil})</span></span>
            <button onClick={logout} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20">Sair</button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
      <footer className="text-center text-xs text-black/50 py-4">
        © {new Date().getFullYear()} CEPE — Companhia Editora de Pernambuco
      </footer>
    </div>
  );
}
function tab(active: boolean) {
  return `px-3 py-1.5 rounded-md ${active ? 'bg-white text-cepe-green font-semibold' : 'text-white/90 hover:bg-white/10'}`;
}
