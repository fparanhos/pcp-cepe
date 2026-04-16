/**
 * Cliente do webservice CEPE DOC (custodia-next).
 *
 * Formato de chamada: POST {CEPEDOC_WS_URL}
 *   { action, login, senha, ...params }
 *
 * Actions implementadas do lado CEPE DOC:
 *   - "registrarMovimentoPCP"   → grava em movimento_pcp
 *   - "criarProtocoloEntregaPCP" → gera protocolo_entrega + caixas
 *
 * Modos (env PROTOCOLO_MODO):
 *   - "stub" (default): loga e retorna ok, sem chamar rede. Útil em dev.
 *   - "api"           : chama CEPEDOC_WS_URL com CEPEDOC_WS_LOGIN/SENHA.
 */

export type MovimentoTipo =
  | 'RECEBIDO_PCP'
  | 'AJUSTE_DIVERGENCIA'
  | 'INICIO_PRODUCAO'
  | 'CONCLUIDA';

export type MovimentoPayload = {
  protocolo_ref?: string | null;
  tipo: MovimentoTipo;
  os_numero: string;
  cliente_nome?: string | null;
  id_cliente?: number | null;
  tipo_caixa?: 'SIMPLES' | 'DUPLA' | 'PADRAO' | null;
  tipo_documento?: string | null;
  qtd_documentada?: number | null;
  qtd_conferida?: number | null;
  divergencia?: string | null;
  registrado_por: string;
  observacao?: string | null;
};

export type EntregaPayload = {
  os_numero: string;
  protocolo_origem?: string | null;
  cliente_nome: string;
  id_cliente?: number | null;
  tipo_documento?: string | null;
  qtd_caixas: number;
  qtd_imagens: number;
  responsavel_entrega: string;
  receptor_nome: string;
  receptor_documento?: string | null;
  observacao?: string | null;
};

type Resp = {
  ok: boolean;
  id?: string | number;
  numero_protocolo?: string;
  id_protocolo?: number;
  erro?: string;
};

const MODO  = process.env.PROTOCOLO_MODO       ?? 'stub';
const URL_  = process.env.CEPEDOC_WS_URL       ?? '';
const LOGIN = process.env.CEPEDOC_WS_LOGIN     ?? '';
const SENHA = process.env.CEPEDOC_WS_SENHA     ?? '';

async function chamar(action: string, params: Record<string, unknown>): Promise<Resp> {
  if (MODO !== 'api') {
    console.log(`[cepedoc:stub] ${action}`, params);
    return { ok: true, id: `stub-${Date.now()}`, numero_protocolo: `PRT-STUB-${Date.now()}` };
  }
  if (!URL_)  return { ok: false, erro: 'CEPEDOC_WS_URL ausente' };
  if (!LOGIN) return { ok: false, erro: 'CEPEDOC_WS_LOGIN ausente' };
  try {
    const r = await fetch(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, login: LOGIN, senha: SENHA, ...params }),
    });
    const j = await r.json().catch(() => ({} as any));
    if (!r.ok || j.error) return { ok: false, erro: j.error || `HTTP ${r.status}` };
    return {
      ok: true,
      id: j.id ?? j.id_protocolo,
      numero_protocolo: j.numero_protocolo,
      id_protocolo: j.id_protocolo,
    };
  } catch (e: any) {
    return { ok: false, erro: e?.message || 'falha de rede' };
  }
}

export function registrarMovimento(p: MovimentoPayload) {
  return chamar('registrarMovimentoPCP', p);
}

export function criarEntrega(p: EntregaPayload) {
  return chamar('criarProtocoloEntregaPCP', p);
}
