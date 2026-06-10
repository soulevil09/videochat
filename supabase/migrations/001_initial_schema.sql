-- =============================================================================
-- 001_initial_schema.sql
-- Schema inicial completo da plataforma VideoChat
-- =============================================================================


-- =============================================================================
-- 1. EXTENSÕES
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================================
-- 2. ENUMS
-- =============================================================================

CREATE TYPE gender_type AS ENUM (
    'male',
    'female'
);

CREATE TYPE availability_status_type AS ENUM (
    'available',
    'busy',
    'offline'
);

CREATE TYPE credit_ledger_type AS ENUM (
    'purchase',
    'debit_call',
    'refund',
    'bonus'
);

CREATE TYPE transaction_status_type AS ENUM (
    'pending',
    'completed',
    'failed',
    'refunded'
);

CREATE TYPE call_status_type AS ENUM (
    'pending',
    'active',
    'ended',
    'failed'
);

CREATE TYPE call_end_reason_type AS ENUM (
    'completed',
    'no_balance',
    'disconnection',
    'reported',
    'timeout',
    'rejected'
);

CREATE TYPE payout_status_type AS ENUM (
    'pending',
    'released',
    'requested',
    'processing',
    'completed',
    'failed'
);

CREATE TYPE friendship_status_type AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'blocked'
);

CREATE TYPE report_status_type AS ENUM (
    'pending',
    'reviewed',
    'dismissed'
);


-- =============================================================================
-- 3. TABELAS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email               TEXT        NOT NULL UNIQUE,
    name                TEXT        NOT NULL,
    birth_date          DATE        NOT NULL,
    gender              gender_type NOT NULL,
    avatar_url          TEXT        NULL,
    is_approved         BOOLEAN     NOT NULL DEFAULT false,
    is_banned           BOOLEAN     NOT NULL DEFAULT false,
    stripe_account_id   TEXT        NULL,
    availability_status availability_status_type NOT NULL DEFAULT 'offline',
    deleted_at          TIMESTAMPTZ NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- user_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE user_sessions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id),
    token_hash  TEXT        NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- credit_packages
-- ---------------------------------------------------------------------------
CREATE TABLE credit_packages (
    id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT           NOT NULL,
    price_brl      NUMERIC(10,2)  NOT NULL,
    credits_amount INTEGER        NOT NULL,
    is_active      BOOLEAN        NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
CREATE TABLE transactions (
    id                       UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID                    NOT NULL REFERENCES users(id),
    credit_package_id        UUID                    NULL REFERENCES credit_packages(id),
    stripe_payment_intent_id TEXT                    NOT NULL UNIQUE,
    amount_brl               NUMERIC(10,2)           NOT NULL,
    stripe_fee_brl           NUMERIC(10,2)           NOT NULL,
    net_amount_brl           NUMERIC(10,2)           NOT NULL,
    status                   transaction_status_type NOT NULL DEFAULT 'pending',
    created_at               TIMESTAMPTZ             NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ             NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- credit_ledger  (IMUTÁVEL — sem updated_at)
-- ---------------------------------------------------------------------------
CREATE TABLE credit_ledger (
    id           UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID               NOT NULL REFERENCES users(id),
    type         credit_ledger_type NOT NULL,
    amount       INTEGER            NOT NULL,
    reference_id UUID               NULL,
    created_at   TIMESTAMPTZ        NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- calls
-- ---------------------------------------------------------------------------
CREATE TABLE calls (
    id               UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
    male_user_id     UUID                 NOT NULL REFERENCES users(id),
    female_user_id   UUID                 NOT NULL REFERENCES users(id),
    daily_room_name  TEXT                 NOT NULL,
    daily_room_url   TEXT                 NOT NULL,
    started_at       TIMESTAMPTZ          NULL,
    ended_at         TIMESTAMPTZ          NULL,
    duration_seconds INTEGER              NULL,
    credits_charged  INTEGER              NULL,
    status           call_status_type     NOT NULL DEFAULT 'pending',
    end_reason       call_end_reason_type NULL,
    created_at       TIMESTAMPTZ          NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ          NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- payouts
-- ---------------------------------------------------------------------------
CREATE TABLE payouts (
    id                 UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
    female_user_id     UUID               NOT NULL REFERENCES users(id),
    call_id            UUID               NULL REFERENCES calls(id),
    amount_brl         NUMERIC(10,2)      NOT NULL,
    status             payout_status_type NOT NULL DEFAULT 'pending',
    released_at        TIMESTAMPTZ        NULL,
    stripe_transfer_id TEXT               NULL,
    is_blocked         BOOLEAN            NOT NULL DEFAULT false,
    created_at         TIMESTAMPTZ        NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ        NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- call_messages  (sem updated_at — mensagens não são editadas)
-- ---------------------------------------------------------------------------
CREATE TABLE call_messages (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id    UUID        NOT NULL REFERENCES calls(id),
    sender_id  UUID        NOT NULL REFERENCES users(id),
    content    TEXT        NOT NULL,
    is_deleted BOOLEAN     NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- friendships
-- ---------------------------------------------------------------------------
CREATE TABLE friendships (
    id           UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID                   NOT NULL REFERENCES users(id),
    addressee_id UUID                   NOT NULL REFERENCES users(id),
    status       friendship_status_type NOT NULL DEFAULT 'pending',
    expires_at   TIMESTAMPTZ            NULL,
    created_at   TIMESTAMPTZ            NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ            NOT NULL DEFAULT now(),

    CONSTRAINT friendships_unique UNIQUE (requester_id, addressee_id)
);

-- ---------------------------------------------------------------------------
-- direct_messages  (sem updated_at — mensagens não são editadas)
-- ---------------------------------------------------------------------------
CREATE TABLE direct_messages (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    friendship_id UUID        NOT NULL REFERENCES friendships(id),
    sender_id     UUID        NOT NULL REFERENCES users(id),
    content       TEXT        NOT NULL,
    is_deleted    BOOLEAN     NOT NULL DEFAULT false,
    deleted_at    TIMESTAMPTZ NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- call_ratings
-- ---------------------------------------------------------------------------
CREATE TABLE call_ratings (
    id            UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id       UUID     NOT NULL UNIQUE REFERENCES calls(id),
    rater_id      UUID     NOT NULL REFERENCES users(id),
    rated_user_id UUID     NOT NULL REFERENCES users(id),
    rating        SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
CREATE TABLE reports (
    id               UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id      UUID                NOT NULL REFERENCES users(id),
    reported_user_id UUID                NOT NULL REFERENCES users(id),
    call_id          UUID                NULL REFERENCES calls(id),
    reason           TEXT                NOT NULL,
    status           report_status_type  NOT NULL DEFAULT 'pending',
    created_at       TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ         NOT NULL DEFAULT now()
);


-- =============================================================================
-- 4. FUNÇÃO E TRIGGER GLOBAL DE updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_credit_packages_updated_at
    BEFORE UPDATE ON credit_packages
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_calls_updated_at
    BEFORE UPDATE ON calls
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_payouts_updated_at
    BEFORE UPDATE ON payouts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_friendships_updated_at
    BEFORE UPDATE ON friendships
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 5. ÍNDICES
-- =============================================================================

-- users
CREATE INDEX idx_users_email              ON users(email);
CREATE INDEX idx_users_gender             ON users(gender);
CREATE INDEX idx_users_availability_status ON users(availability_status);
CREATE INDEX idx_users_is_approved        ON users(is_approved);
CREATE INDEX idx_users_is_banned          ON users(is_banned);
CREATE INDEX idx_users_deleted_at         ON users(deleted_at);

-- user_sessions
CREATE INDEX idx_user_sessions_user_id    ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- credit_packages
CREATE INDEX idx_credit_packages_is_active ON credit_packages(is_active);

-- transactions
CREATE INDEX idx_transactions_user_id           ON transactions(user_id);
CREATE INDEX idx_transactions_credit_package_id ON transactions(credit_package_id);
CREATE INDEX idx_transactions_status            ON transactions(status);

-- credit_ledger
CREATE INDEX idx_credit_ledger_user_id      ON credit_ledger(user_id);
CREATE INDEX idx_credit_ledger_type         ON credit_ledger(type);
CREATE INDEX idx_credit_ledger_reference_id ON credit_ledger(reference_id);

-- calls
CREATE INDEX idx_calls_male_user_id   ON calls(male_user_id);
CREATE INDEX idx_calls_female_user_id ON calls(female_user_id);
CREATE INDEX idx_calls_status         ON calls(status);
CREATE INDEX idx_calls_daily_room_name ON calls(daily_room_name);

-- payouts
CREATE INDEX idx_payouts_female_user_id ON payouts(female_user_id);
CREATE INDEX idx_payouts_call_id        ON payouts(call_id);
CREATE INDEX idx_payouts_status         ON payouts(status);
CREATE INDEX idx_payouts_is_blocked     ON payouts(is_blocked);

-- call_messages
CREATE INDEX idx_call_messages_call_id   ON call_messages(call_id);
CREATE INDEX idx_call_messages_sender_id ON call_messages(sender_id);

-- friendships
CREATE INDEX idx_friendships_requester_id ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee_id ON friendships(addressee_id);
CREATE INDEX idx_friendships_status       ON friendships(status);

-- direct_messages
CREATE INDEX idx_direct_messages_friendship_id ON direct_messages(friendship_id);
CREATE INDEX idx_direct_messages_sender_id     ON direct_messages(sender_id);

-- call_ratings
CREATE INDEX idx_call_ratings_rater_id      ON call_ratings(rater_id);
CREATE INDEX idx_call_ratings_rated_user_id ON call_ratings(rated_user_id);

-- reports
CREATE INDEX idx_reports_reporter_id      ON reports(reporter_id);
CREATE INDEX idx_reports_reported_user_id ON reports(reported_user_id);
CREATE INDEX idx_reports_call_id          ON reports(call_id);
CREATE INDEX idx_reports_status           ON reports(status);


-- =============================================================================
-- 6. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger   ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships     ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_ratings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports         ENABLE ROW LEVEL SECURITY;

-- TODO: Definir policies de RLS na sessão correspondente a cada módulo.

-- =============================================================================
-- 6.1 IMUTABILIDADE DO CREDIT_LEDGER
-- =============================================================================

CREATE OR REPLACE RULE credit_ledger_no_update AS
    ON UPDATE TO credit_ledger DO INSTEAD NOTHING;

CREATE OR REPLACE RULE credit_ledger_no_delete AS
    ON DELETE TO credit_ledger DO INSTEAD NOTHING;

-- =============================================================================
-- 7. COMENTÁRIOS DE DOCUMENTAÇÃO
-- =============================================================================

-- users
COMMENT ON TABLE  users                    IS 'Usuários da plataforma (homens e mulheres).';
COMMENT ON COLUMN users.is_approved        IS 'Relevante para mulheres: controla acesso à fila de matching. Homens são aprovados automaticamente no backend.';
COMMENT ON COLUMN users.is_banned          IS 'Banimento manual pelo admin. Impede login e uso da plataforma.';
COMMENT ON COLUMN users.stripe_account_id  IS 'ID da conta Stripe Connect da mulher para receber repasses.';
COMMENT ON COLUMN users.availability_status IS 'Estado de disponibilidade em tempo real, atualizado via WebSocket.';
COMMENT ON COLUMN users.deleted_at         IS 'Soft delete: usuário removido não é deletado do banco.';

-- user_sessions
COMMENT ON TABLE  user_sessions            IS 'Sessões ativas de usuários. Máximo de 3 por usuário (regra aplicada no backend).';
COMMENT ON COLUMN user_sessions.token_hash IS 'Hash do JWT ou token de sessão. Nunca armazenar o token em texto claro.';

-- credit_packages
COMMENT ON TABLE  credit_packages          IS 'Pacotes de créditos configuráveis pelo admin. Apenas is_active = true são exibidos.';

-- credit_ledger
COMMENT ON TABLE  credit_ledger            IS 'Livro-caixa imutável de créditos. Nunca executar UPDATE ou DELETE nesta tabela.';
COMMENT ON COLUMN credit_ledger.amount     IS 'Positivo = crédito adicionado. Negativo = débito.';
COMMENT ON COLUMN credit_ledger.reference_id IS 'Aponta para call_id (debit_call) ou transaction_id (purchase/refund) conforme o type.';

-- transactions
COMMENT ON TABLE  transactions             IS 'Compras de créditos via Stripe. Cada transação corresponde a um PaymentIntent.';

-- calls
COMMENT ON TABLE  calls                    IS 'Sessões de videochamada entre um homem e uma mulher.';
COMMENT ON COLUMN calls.daily_room_name    IS 'Identificador único da sala no Daily.co.';
COMMENT ON COLUMN calls.credits_charged    IS 'Total de créditos debitados do homem durante a call.';
COMMENT ON COLUMN calls.end_reason         IS 'Motivo de encerramento da call. NULL enquanto a call está ativa.';

-- payouts
COMMENT ON TABLE  payouts                  IS 'Repasses financeiros para mulheres após período antifraude de 7 dias.';
COMMENT ON COLUMN payouts.released_at      IS 'Data em que os 7 dias antifraude expiraram e o repasse foi liberado para saque.';
COMMENT ON COLUMN payouts.is_blocked       IS 'Bloqueio manual pelo admin, independente do status.';

-- call_messages
COMMENT ON TABLE  call_messages            IS 'Mensagens de chat enviadas durante uma videochamada. Imutável após criação.';
COMMENT ON COLUMN call_messages.is_deleted IS 'Soft delete: conteúdo pode ser preservado para fins de moderação.';

-- friendships
COMMENT ON TABLE  friendships              IS 'Solicitações e relações de amizade entre usuários. Um registro representa os dois lados.';
COMMENT ON COLUMN friendships.expires_at   IS '7 dias após a solicitação para solicitações não respondidas.';

-- direct_messages
COMMENT ON TABLE  direct_messages          IS 'Mensagens diretas entre amigos. Requer friendship.status = accepted (validado no backend).';

-- call_ratings
COMMENT ON TABLE  call_ratings             IS 'Avaliação da call. UNIQUE em call_id garante no máximo uma avaliação por call.';

-- reports
COMMENT ON TABLE  reports                  IS 'Denúncias de usuários. Podem estar vinculadas a uma call específica.';
