# Sessão 01 — DB Schema Completo

## Pré-condições
- Nenhuma tabela existe ainda. Este é o ponto de partida absoluto do projeto.

## Arquivo a criar
- `supabase/migrations/001_initial_schema.sql`

## Arquivos de referência
- Nenhum — esta é a sessão inicial.

---

## Objetivo desta sessão
Criar o schema completo do banco de dados PostgreSQL via Supabase com TODAS as tabelas
necessárias para os módulos listados abaixo.

O schema deve ser **definitivo** — futuras sessões não devem precisar recriar ou renomear
colunas, apenas adicionar o que for explicitamente deixado para depois.

---

## Tabelas a criar

- `users`
- `user_sessions`
- `credit_packages`
- `credit_ledger`
- `transactions`
- `calls`
- `payouts`
- `call_messages`
- `friendships`
- `direct_messages`
- `call_ratings`
- `reports`

---

## ENUMs — criar como tipos PostgreSQL (`CREATE TYPE`)

| Nome do tipo | Valores |
|---|---|
| `gender_type` | `male`, `female` |
| `availability_status_type` | `available`, `busy`, `offline` |
| `credit_ledger_type` | `purchase`, `debit_call`, `refund`, `bonus` |
| `transaction_status_type` | `pending`, `completed`, `failed`, `refunded` |
| `call_status_type` | `pending`, `active`, `ended`, `failed` |
| `call_end_reason_type` | `completed`, `no_balance`, `disconnection`, `reported`, `timeout`, `rejected` |
| `payout_status_type` | `pending`, `released`, `requested`, `processing`, `completed`, `failed` |
| `friendship_status_type` | `pending`, `accepted`, `rejected`, `blocked` |
| `report_status_type` | `pending`, `reviewed`, `dismissed` |

---

## Detalhes por tabela

### `users`
```
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
email             TEXT NOT NULL UNIQUE
name              TEXT NOT NULL
birth_date        DATE NOT NULL
gender            gender_type NOT NULL
avatar_url        TEXT NULL
is_approved       BOOLEAN NOT NULL DEFAULT false
is_banned         BOOLEAN NOT NULL DEFAULT false
stripe_account_id TEXT NULL
availability_status availability_status_type NOT NULL DEFAULT 'offline'
deleted_at        TIMESTAMPTZ NULL
created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
```
> `is_approved` é relevante para mulheres — controla acesso à fila de matching.
> `stripe_account_id` armazena o ID da conta Stripe Connect da mulher.
> Idade mínima de 18 anos é validada no backend via `birth_date`, não é constraint do banco.

---

### `user_sessions`
```
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id      UUID NOT NULL REFERENCES users(id)
token_hash   TEXT NOT NULL
expires_at   TIMESTAMPTZ NOT NULL
created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
```
> Máximo de 3 sessões ativas por usuário — regra aplicada no backend, não constraint no banco.
> Sem `updated_at` — sessões não são editadas.

---

### `credit_packages`
```
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
name           TEXT NOT NULL
price_brl      NUMERIC(10,2) NOT NULL
credits_amount INTEGER NOT NULL
is_active      BOOLEAN NOT NULL DEFAULT true
created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
```
> Pacotes configuráveis pelo admin. Apenas pacotes com `is_active = true` são exibidos.

---

### `credit_ledger`
```
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id      UUID NOT NULL REFERENCES users(id)
type         credit_ledger_type NOT NULL
amount       INTEGER NOT NULL
reference_id UUID NULL
created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
```
> ⚠️ TABELA IMUTÁVEL — nunca UPDATE ou DELETE nesta tabela.
> Sem `updated_at` propositalmente.
> `amount` positivo = crédito, negativo = débito.
> `reference_id` aponta para `call_id` ou `transaction_id` conforme o `type`.

---

### `transactions`
```
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id                  UUID NOT NULL REFERENCES users(id)
credit_package_id        UUID NULL REFERENCES credit_packages(id)
stripe_payment_intent_id TEXT NOT NULL UNIQUE
amount_brl               NUMERIC(10,2) NOT NULL
stripe_fee_brl           NUMERIC(10,2) NOT NULL
net_amount_brl           NUMERIC(10,2) NOT NULL
status                   transaction_status_type NOT NULL DEFAULT 'pending'
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
```

---

### `calls`
```
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
male_user_id     UUID NOT NULL REFERENCES users(id)
female_user_id   UUID NOT NULL REFERENCES users(id)
daily_room_name  TEXT NOT NULL
daily_room_url   TEXT NOT NULL
started_at       TIMESTAMPTZ NULL
ended_at         TIMESTAMPTZ NULL
duration_seconds INTEGER NULL
credits_charged  INTEGER NULL
status           call_status_type NOT NULL DEFAULT 'pending'
end_reason       call_end_reason_type NULL
created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
```

---

### `payouts`
```
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
female_user_id   UUID NOT NULL REFERENCES users(id)
call_id          UUID NULL REFERENCES calls(id)
amount_brl       NUMERIC(10,2) NOT NULL
status           payout_status_type NOT NULL DEFAULT 'pending'
released_at      TIMESTAMPTZ NULL
stripe_transfer_id TEXT NULL
is_blocked       BOOLEAN NOT NULL DEFAULT false
created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
```
> `released_at` = data em que os 7 dias antifraude expiraram e o repasse foi liberado.
> `is_blocked` = bloqueio manual pelo admin, independente do status.

---

### `call_messages`
```
id         UUID PRIMARY KEY DEFAULT gen_random_uuid()
call_id    UUID NOT NULL REFERENCES calls(id)
sender_id  UUID NOT NULL REFERENCES users(id)
content    TEXT NOT NULL
is_deleted BOOLEAN NOT NULL DEFAULT false
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```
> Sem `updated_at` — mensagens não são editadas.
> Soft delete via `is_deleted` (conteúdo pode ser preservado para moderação).

---

### `friendships`
```
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
requester_id  UUID NOT NULL REFERENCES users(id)
addressee_id  UUID NOT NULL REFERENCES users(id)
status        friendship_status_type NOT NULL DEFAULT 'pending'
expires_at    TIMESTAMPTZ NULL
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()

CONSTRAINT friendships_unique UNIQUE (requester_id, addressee_id)
```
> Um único registro representa os dois lados da relação.
> `expires_at` = 7 dias após a solicitação, para solicitações não respondidas.

---

### `direct_messages`
```
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
friendship_id UUID NOT NULL REFERENCES friendships(id)
sender_id     UUID NOT NULL REFERENCES users(id)
content       TEXT NOT NULL
is_deleted    BOOLEAN NOT NULL DEFAULT false
deleted_at    TIMESTAMPTZ NULL
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```
> Sem `updated_at` — mensagens não são editadas.
> DMs só existem entre usuários com `friendship.status = 'accepted'` (validado no backend).

---

### `call_ratings`
```
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
call_id       UUID NOT NULL UNIQUE REFERENCES calls(id)
rater_id      UUID NOT NULL REFERENCES users(id)
rated_user_id UUID NOT NULL REFERENCES users(id)
rating        SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5)
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```
> `call_id UNIQUE` garante no máximo uma avaliação por call.

---

### `reports`
```
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
reporter_id      UUID NOT NULL REFERENCES users(id)
reported_user_id UUID NOT NULL REFERENCES users(id)
call_id          UUID NULL REFERENCES calls(id)
reason           TEXT NOT NULL
status           report_status_type NOT NULL DEFAULT 'pending'
created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
```

---

## Restrições desta sessão

- ❌ Não usar `SERIAL` — apenas `UUID` com `gen_random_uuid()`
- ❌ Não criar tabelas fora das listadas acima sem perguntar
- ❌ Não usar TypeORM ou qualquer ORM — SQL puro
- ❌ Não criar policies de RLS — apenas habilitar RLS com TODO comentado
- ✅ Todos os enums como tipos PostgreSQL (`CREATE TYPE`)
- ✅ Trigger global de `updated_at` aplicado a todas as tabelas com esse campo
- ✅ Índices para todas as FKs, colunas de status e colunas de busca frequente
- ✅ `COMMENT ON TABLE` e `COMMENT ON COLUMN` nas tabelas e colunas menos óbvias
- ✅ RLS habilitado com `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`

---

## Estrutura esperada do arquivo SQL

O arquivo deve seguir exatamente esta ordem:

```
1. Extensões necessárias (ex: pgcrypto se necessário)
2. Criação dos ENUMs (na ordem da tabela acima)
3. Criação das tabelas (na ordem que respeite as FKs)
4. Função e trigger global de updated_at
5. Índices (FKs + status + colunas de busca frequente)
6. Habilitação de RLS em todas as tabelas (sem policies — deixar como TODO)
7. Comentários de documentação (COMMENT ON TABLE / COMMENT ON COLUMN)
```

---

## Entregável esperado

Um único arquivo completo: `supabase/migrations/001_initial_schema.sql`

Entregar o arquivo **completo** — não trechos, não "continue depois".

---

## Checklist de validação (executar após a sessão)

- [ ] Arquivo gerado em `supabase/migrations/001_initial_schema.sql`
- [ ] Todos os 9 ENUMs criados
- [ ] Todas as 12 tabelas criadas na ordem correta de FKs
- [ ] Trigger de `updated_at` aplicado a todas as tabelas com esse campo
- [ ] `credit_ledger` sem `updated_at`
- [ ] `call_messages` e `direct_messages` sem `updated_at`
- [ ] Índices criados para todas as FKs
- [ ] RLS habilitado em todas as tabelas
- [ ] SQL roda sem erros no Supabase (`supabase db reset`)
- [ ] CLAUDE.md atualizado: Sessão 01 marcada como ✅, enums e tabelas preenchidos
- [ ] Commit: `git commit -m "feat(db): add initial schema with all tables and enums"`