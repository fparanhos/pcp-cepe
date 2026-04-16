import EtapaApontamento from '@/components/EtapaApontamento';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Page() {
  const u = (await getSession())!;
  if (!u.etapas.includes('CAPTURA')) redirect('/home');
  return <EtapaApontamento
    etapa="CAPTURA" titulo="Captura"
    unidade="imagens"
    descricao="Digitalize as imagens (faces). Previsão: 800 por caixa · 1600 em Dupla · 2400 em Padrão." />;
}
