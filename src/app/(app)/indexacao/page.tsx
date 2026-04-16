import EtapaApontamento from '@/components/EtapaApontamento';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Page() {
  const u = (await getSession())!;
  if (!u.etapas.includes('INDEXACAO')) redirect('/home');
  return <EtapaApontamento
    etapa="INDEXACAO" titulo="Indexação"
    unidade="documentos"
    descricao="Indexe os conjuntos de documentos (agrupados na Preparação) pertencentes ao mesmo processo." />;
}
