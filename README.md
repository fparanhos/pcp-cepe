# PCP Cepe — Digitalização

PWA (Next.js 14 + TypeScript + Tailwind + SQLite) para Planejamento e Controle de Produção da digitalização de documentos, com paleta da marca **CEPE**.

## Fluxo

```
Protocolo (DB externo)  →  [Sincronizar] → Ordem de Serviço
     │                                         │
     └── caixas (1 / 2 / 3)                    │
                 │                             │
                 ▼                             ▼
       Preparação → Captura → Inspeção → Indexação
```

- **SIMPLES** = 1 caixa · **800** imagens previstas
- **DUPLA**   = 2 caixas · **1600** imagens previstas
- **PADRÃO**  = 3 caixas · **2400** imagens previstas
- A etapa **Inspeção** valida que o total não excede o previsto — resultado é a **produção real**.
- Várias pessoas podem apontar em cada etapa; apontamentos são **manuais**.

## Como rodar

```bash
cp .env.local.example .env.local     # ajuste AUTH_SECRET
npm install
npm run seed                         # cria DB, admin e dados de demo
npm run dev
# abra http://localhost:3000
```

Usuários de demo (matrícula / senha):
- `admin` / `admin123` — Administração + tudo
- `gestor` / `gestor123` — Dashboard + todas as etapas
- `ana`/`ana123` (Preparação), `bruno`/`bruno123` (Captura),
  `carla`/`carla123` (Inspeção), `diego`/`diego123` (Indexação)

## Integração com o Protocolo

Configure `PROTOCOLO_DB_PATH` no `.env.local` apontando para o SQLite do Protocolo existente (somente leitura). Ajuste a consulta em `src/lib/protocolo.ts` para o esquema real:

```sql
SELECT numero_protocolo AS protocolo, cliente, descricao, qtd_caixas
  FROM protocolos_entrada
 WHERE status = 'RECEBIDO';
```

Sem essa variável, o sistema usa um mock para demo. A sincronização é disparada em **Admin → Sincronizar Protocolo → OS**.

Se o Protocolo estiver em outro SGBD (SQL Server / Oracle / Postgres), substitua a implementação de `lerProtocolo()` pelo driver correspondente — a lógica de geração de OS permanece a mesma.

## PWA

- `public/manifest.webmanifest` + `public/sw.js`
- Instalável no celular/desktop; shell cacheado; POSTs **sempre** vão para a rede (apontamentos não são produzidos offline para evitar conflito de contagem).

## Paleta CEPE aplicada

| Uso | Cor | Hex |
|---|---|---|
| Primária (marca) | Verde CEPE | `#005F3B` |
| Secundária | Bege | `#C6A984` |
| Destaque suave | Creme | `#FFE5B4` |
| Fundo | Cinza claro | `#ECECEC` |
| Texto | Preto | `#000000` |

Definidas em `tailwind.config.ts` como `cepe.green`, `cepe.beige`, `cepe.cream`, `cepe.grey`.

## Estrutura

```
src/
  app/
    login/                  → tela de login
    (app)/                  → layout autenticado
      home/                 → painel inicial do operador
      preparacao|captura|inspecao|indexacao/  → apontamento por etapa
      admin/                → usuários + sync Protocolo (ADMIN)
      dashboard/            → painel gerencial (ADMIN/GESTOR)
    api/
      auth/login|logout
      os, os/sync
      apontamentos
      users
      dashboard
  components/Shell, Logo, EtapaApontamento
  lib/db, auth, protocolo, metrics
scripts/seed.mjs            → bootstrap do banco
public/manifest.webmanifest  sw.js  icons/
```

## Perfis e permissões

- **ADMIN** — tudo, inclusive CRUD de usuários e sincronização do Protocolo.
- **GESTOR** — Dashboard + operar etapas permitidas.
- **OPERADOR** — apenas as etapas marcadas em seu cadastro.

Cada usuário tem lista de **Etapas permitidas** (pode atuar em uma ou mais).

## Regras de negócio garantidas no backend

1. Apontamento rejeitado se usuário não tem a etapa.
2. Inspeção não excede **imagens previstas** da OS.
3. OS passa de ABERTA para EM_PRODUCAO ao receber primeiro apontamento.
4. Quantidade sempre > 0.
