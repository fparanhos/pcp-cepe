import EtapaApontamento from '@/components/EtapaApontamento';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Page() {
  const u = (await getSession())!;
  if (!u.etapas.includes('INSPECAO')) redirect('/home');
  return <EtapaApontamento
    etapa="INSPECAO" titulo="Inspeção"
    unidade="imagens"
    descricao="Inspecione por imagem. O total inspecionado não pode exceder o previsto na OS — aponta a produção real." />;
}
