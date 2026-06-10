# VideoChat Platform — Master Context

> ⚠️ Este arquivo é o contexto permanente do projeto e é lido automaticamente pelo Claude Code.
> Atualize a seção "Status do Projeto" ao fim de cada sessão.
> Nunca remova seções — apenas expanda.

---

## Stack

### Backend
- Runtime: Node.js 20
- Framework: NestJS (TypeScript strict — sem `any`)
- Banco: Supabase (PostgreSQL) — SQL puro, sem ORM
- Cache/Filas: Upstash Redis + BullMQ
- Pagamentos: Stripe + Stripe Connect
- Realtime: Supabase Realtime (WebSockets)
- Video: Daily.co SDK

### Frontend
- Framework: Next.js 14 (App Router)
- Estilo: TailwindCSS + shadcn/ui
- Estado global: Zustand
- Realtime client: Supabase JS SDK

### Infra
- Deploy API: Railway
- Deploy Web: Vercel
- Monorepo: Turborepo + pnpm workspaces

---

## Estrutura de Pastas

```
videochat/
├── CLAUDE.md
├── .claude/
│   ├── sessions/
│   │   ├── 01_db_schema.md
│   │   ├── 02_auth_contas.md
│   │   ├── 03_credits.md
│   │   ├── 04_stripe.md
│   │   ├── 05_matching.md
│   │   ├── 06_video.md
│   │   ├── 07_realtime_chat.md
│   │   ├── 08_friendship.md
│   │   ├── 09_female_dashboard.md
│   │   ├── 10_frontend.md
│   │   └── bugs/
│   └── decisions/
│
├── apps/
│   ├── web/
│   │   ├── app/                    # App Router pages
│   │   ├── components/
│   │   └── lib/
│   │       └── api/                # todas as chamadas à API ficam aqui
│   └── api/
│       └── src/
│           ├── modules/
│           │   ├── auth/
│           │   ├── credits/
│           │   ├── matching/
│           │   ├── video/
│           │   ├── chat/
│           │   ├── friendship/
│           │   └── payouts/
│           └── shared/
│               ├── guards/
│               ├── pipes/
│               ├── decorators/
│               └── types/
│
├── packages/
│   └── shared/
│       └── src/
│           └── types/              # tipos TypeScript compartilhados entre web e api
│
└── supabase/
    └── migrations/                 # 001_nome.sql, 002_nome.sql ...
```

---

## Convenções de Código

### Geral
- TypeScript strict em todo o projeto — sem `any`, sem `as unknown`
- Nunca expor variáveis de ambiente no frontend
- Imports absolutos com path aliases (`@/modules/auth`)
- Barrel exports obrigatórios (`index.ts` por módulo)
- Nomenclatura de arquivos: `kebab-case` para arquivos, `PascalCase` para classes

### Backend (NestJS)
- Toda rota autenticada usa `JwtAuthGuard`
- Padrão obrigatório: Controller → Service → Repository (sem lógica no controller)
- DTOs com `class-validator` em toda entrada de dados
- Erros lançados como `HttpException` com mensagens em português
- Nunca usar `DELETE` real no banco — sempre soft delete via `deleted_at`
- Respostas de sucesso sempre tipadas (nunca retornar `any`)

### Frontend (Next.js)
- Server Components por padrão — Client Components só quando necessário (`"use client"`)
- Chamadas à API sempre via `apps/web/lib/api/` — nunca fetch direto nos componentes
- Variáveis de ambiente públicas somente com prefixo `NEXT_PUBLIC_`
- Nunca armazenar tokens em `localStorage` — usar cookies httpOnly

### Banco de Dados
- PKs: UUID com `gen_random_uuid()` — nunca SERIAL
- Toda tabela tem `created_at TIMESTAMPTZ DEFAULT now()` e `updated_at TIMESTAMPTZ DEFAULT now()`
- Exceção: tabelas imutáveis (ex: `credit_ledger`) não têm `updated_at`
- Toda FK tem índice explícito
- Enums como tipos PostgreSQL (`CREATE TYPE`)
- RLS habilitado em todas as tabelas — policies definidas por sessão
- Comentários `COMMENT ON TABLE` / `COMMENT ON COLUMN` nas colunas menos óbvias

### Migrations
- Nomenclatura: `001_initial_schema.sql`, `002_nome.sql` (sequencial)
- Nunca alterar uma migration já aplicada — criar nova migration para correções
- Toda migration deve ser idempotente quando possível

---

## Regras de Negócio Globais

- Usuários têm `gender`: `male` | `female`
- A plataforma conecta exatamente 1 homem ↔ 1 mulher por call
- Créditos são a moeda interna — homens compram, mulheres recebem repasses em BRL
- `credit_ledger` é imutável — nunca UPDATE ou DELETE nessa tabela
- Período antifraude: 7 dias após a call antes de liberar repasse para mulher
- Mulheres precisam de aprovação (`is_approved = true`) antes de entrar na fila
- Débito de créditos: a cada 60s via BullMQ, entre 25–40 créditos por ciclo
- Se saldo < 25 créditos → encerrar call automaticamente e notificar via WebSocket
- Máximo de 3 sessões ativas por usuário (validado no backend, não constraint no banco)
- Idade mínima: 18 anos (validado no backend via `birth_date`, não constraint no banco)

---

## Contratos de API

| Método | Rota | Auth | Módulo | Status |
|----|----|----|----|----|
| POST | /auth/register | ❌ | Auth | ✅ |
| POST | /auth/login | ❌ | Auth | ✅ |
| POST | /auth/logout | ✅ | Auth | ✅ |
| GET | /auth/me | ✅ | Auth | ✅ |
| GET | /credits/balance | ✅ | Credits | ⏳ |
| POST | /credits/purchase | ✅ | Credits | ⏳ |
| POST | /stripe/webhook | ❌ | Stripe | ⏳ |
| POST | /matching/join-queue | ✅ | Matching | ⏳ |
| DELETE | /matching/leave-queue | ✅ | Matching | ⏳ |
| WS | /video/room/:roomId | ✅ | Video | ⏳ |
| WS | /chat/:roomId | ✅ | Chat | ⏳ |
| GET | /friendships | ✅ | Friendship | ⏳ |
| POST | /friendships/request | ✅ | Friendship | ⏳ |
| PATCH | /friendships/:id | ✅ | Friendship | ⏳ |
| GET | /payouts | ✅ | Payouts | ⏳ |
| POST | /payouts/request | ✅ | Payouts | ⏳ |

> Atualize o Status: ⏳ Pendente | 🔄 Em progresso | ✅ Concluído

---

## Decisões Técnicas Registradas

| # | Decisão | Motivo | Sessão |
|---|----|----|----|
| 001 | Monorepo com Turborepo + pnpm | Compartilhar tipos entre web e api sem duplicação | Setup |
| 002 | Auth via Supabase Auth (JWT) | Evitar reinventar auth seguro; integração nativa com RLS | 02 |
| 003 | credit_ledger imutável com eventos | Auditoria financeira + rastreabilidade antifraude | 01 |
| 004 | BullMQ para débito de créditos | Garantia de execução, retry automático, delay preciso | 03 |
| 005 | Redis FIFO por gênero para matching | Simplicidade, baixa latência, fácil de depurar | 05 |
| 006 | Stripe Connect Standard para mulheres | Mulheres têm conta própria; Stripe gerencia KYC | 04 |

> Adicione novas linhas aqui ao fim de cada sessão que gerar uma decisão técnica relevante.

---

## Schema do Banco — Resumo (versão atual)

> Atualize após cada migration. Mantenha resumo — não o SQL completo.
> SQL completo está em `supabase/migrations/`.

### Enums criados
- `gender_type`: `male`, `female`
- `availability_status_type`: `available`, `busy`, `offline`
- `credit_ledger_type`: `purchase`, `debit_call`, `refund`, `bonus`
- `transaction_status_type`: `pending`, `completed`, `failed`, `refunded`
- `call_status_type`: `pending`, `active`, `ended`, `failed`
- `call_end_reason_type`: `completed`, `no_balance`, `disconnection`, `reported`, `timeout`, `rejected`
- `payout_status_type`: `pending`, `released`, `requested`, `processing`, `completed`, `failed`
- `friendship_status_type`: `pending`, `accepted`, `rejected`, `blocked`
- `report_status_type`: `pending`, `reviewed`, `dismissed`

### Tabelas existentes
Tabela	Descrição	Observações
users	Usuários da plataforma	soft delete via deleted_at, birth_date obrigatório, gender_type
user_sessions	Sessões ativas	máx 3 por usuário (regra no backend)
credit_packages	Pacotes de créditos para venda	is_active flag
transactions	Compras via Stripe	FK → users, credit_packages
credit_ledger	Livro-caixa imutável	sem updated_at, RULE PostgreSQL bloqueia UPDATE e DELETE (credit_ledger_no_update, credit_ledger_no_delete)
calls	Sessões de videochamada	UNIQUE em daily_room_name
payouts	Repasses financeiros para mulheres	available_at = call encerrada + 7 dias
call_messages	Mensagens durante call	imutável, sem updated_at
friendships	Solicitações de amizade	UNIQUE(requester_id, addressee_id)
direct_messages	Mensagens diretas entre amigos	imutável, sem updated_at
call_ratings	Avaliação da call	UNIQUE em call_id
reports	Denúncias de usuários	FK opcional para calls
---

## Status do Projeto

### ✅ Concluído
- [x] Sessão 01 — DB Schema completo (`supabase/migrations/001_initial_schema.sql`)
- [x] Sessão 02 — Auth & Accounts (`apps/api/src/modules/auth/`)

### 🔄 Em progresso

### ⏳ Pendente
- [ ] Sessão 03 — Credits System (`modules/credits/`)
- [ ] Sessão 04 — Stripe Integration (`modules/stripe/`)
- [ ] Sessão 05 — Matching Engine (`modules/matching/`)
- [ ] Sessão 06 — Daily.co Video (`modules/video/`)
- [ ] Sessão 07 — Realtime Chat (`modules/chat/`)
- [ ] Sessão 08 — Friendship System (`modules/friendship/`)
- [ ] Sessão 09 — Female Dashboard (`modules/payouts/`)
- [ ] Sessão 10 — Frontend (`apps/web/`)

---

## Mapa de Dependências Entre Sessões

```
01. DB Schema ────┐
02. Auth & Accounts        (depende de: 01) ────┤
03. Credits System         (depende de: 01, 02) ────┤
04. Stripe Integration     (depende de: 03) ────┤  Core
05. Matching Engine        (depende de: 01, 02) ────┤
06. Daily.co Video         (depende de: 05) ────┤
07. Realtime Chat          (depende de: 06) ────┘

08. Friendship System      (depende de: 02)
09. Female Dashboard       (depende de: 04)
10. Frontend               (depende de: tudo — começa parcial após 06)
```

> Nunca iniciar uma sessão sem que suas dependências estejam marcadas como ✅.

---

## Ambiente Local

```bash
# Instalar dependências
pnpm install

# Iniciar tudo (api + web)
pnpm dev

# Só API
pnpm --filter api dev

# Só Web
pnpm --filter web dev

# Checar TypeScript (sem emitir arquivos)
pnpm tsc --noEmit

# Rodar migrations no Supabase
supabase db push

# Rodar migrations localmente
supabase start
supabase db reset
```

---

## Variáveis de Ambiente

> Nunca commitar valores reais. Manter `.env.example` atualizado em cada app.

### `apps/api/.env`
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
DAILY_API_KEY=
JWT_SECRET=
```

### `apps/web/.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
```

---

## Regras Anti-Alucinação (para o dev — leia antes de cada sessão)

- ✅ Sempre referenciar arquivos existentes com `@caminho/arquivo` em vez de copiar o código
- ✅ Pedir arquivos completos — nunca trechos
- ✅ Máximo de 15–20 trocas por conversa — se passar disso, fechar e abrir nova
- ✅ Se o Claude inventar uma função que não existe: corrigir com `"essa função não existe, use @caminho/arquivo.ts"`
- ✅ Atualizar este arquivo ao fim de cada sessão antes de abrir a próxima
- ❌ Nunca pedir múltiplos módulos numa mesma sessão
- ❌ Nunca deixar o Claude decidir arquitetura sozinho sem restrições explícitas
- ❌ Nunca aprovar comandos em lote — revisar um a um

---

## Lições Aprendidas

| Sessão | Problema | Solução |
|----|----|----|
| 01 | RULE de imutabilidade do `credit_ledger` não foi gerada pelo Claude Code | Sempre validar com `SELECT rulename FROM pg_rules WHERE tablename = 'credit_ledger'` após Sessão 01 |
| 01 | `supabase db reset` retorna 22 ENUMs (não 9) | Normal — inclui ENUMs internos do Supabase/auth. Filtrar pelos 9 do projeto via nome |
| 01 | Claude Code pode omitir constraints críticas sem avisar | Sempre rodar o checklist completo de validação antes de sinalizar sessão como ✅ |
| 02 | Arquivos salvos com encoding Windows em vez de UTF-8 | Rodar `chcp 65001` antes da sessão e salvar todos os arquivos como UTF-8 no VS Code |
| 02 | `birth_date NOT NULL` não estava no RegisterDto original | Sempre revisar colunas NOT NULL sem default antes de executar a sessão |
| 02 | Caminhos no .md apontavam para `backend/src/` em vez de `apps/api/src/modules/` | Validar caminhos no .md antes de executar qualquer sessão |
| 02 | `credit_balance` referenciado no .md mas coluna não existe em `users` | Saldo de créditos vive exclusivamente em `credit_ledger` — nunca em `users` |