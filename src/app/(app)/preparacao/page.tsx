import EtapaApontamento from '@/components/EtapaApontamento';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Page() {
  const u = (await getSession())!;
  if (!u.etapas.includes('PREPARACAO')) redirect('/home');
  return <EtapaApontamento
    etapa="PREPARACAO" titulo="Preparação"
    unidade="conjuntos"
    descricao="Separe os conjuntos de documentos e carimbe capa do processo e anexos para identificação nas etapas seguintes." />;
}
