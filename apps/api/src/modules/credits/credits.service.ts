import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Registro da tabela `credit_packages`.
 * `price_brl` é NUMERIC no banco — chega como string via PostgREST.
 */
export interface CreditPackage {
  id: string;
  name: string;
  price_brl: string;
  credits_amount: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Resultado de um ciclo de débito durante uma call ativa.
 */
export interface DebitResult {
  amountDebited: number;
  newBalance: number;
  callEnded: boolean;
}

/**
 * Saldo mínimo (em créditos) para manter uma call ativa.
 * Abaixo disso a call é encerrada por falta de saldo.
 */
const MIN_BALANCE_TO_CONTINUE = 25;

/** Faixa de débito por ciclo (inclusiva nas duas pontas). */
const MIN_DEBIT_PER_CYCLE = 25;
const MAX_DEBIT_PER_CYCLE = 40;

@Injectable()
export class CreditsService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Saldo do usuário — SEMPRE calculado via SUM do `credit_ledger`.
   * Nunca lido de uma coluna cache.
   */
  async getBalance(userId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('credit_ledger')
      .select('amount')
      .eq('user_id', userId);

    if (error) {
      throw new InternalServerErrorException(
        'Falha ao calcular o saldo de créditos.',
      );
    }

    const rows = (data ?? []) as Array<{ amount: number }>;
    return rows.reduce((sum, row) => sum + row.amount, 0);
  }

  /**
   * Lista apenas pacotes ativos, ordenados por preço crescente.
   */
  async listPackages(): Promise<CreditPackage[]> {
    const { data, error } = await this.supabase
      .from('credit_packages')
      .select('*')
      .eq('is_active', true)
      .order('price_brl', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(
        'Falha ao listar os pacotes de créditos.',
      );
    }

    return (data ?? []) as CreditPackage[];
  }

  /**
   * Adiciona créditos ao usuário (compra confirmada).
   * Método interno — chamado pela sessão 04 (Stripe webhook).
   * `transactionId` é obrigatório e vira o `reference_id` da entrada `purchase`.
   * Retorna o novo saldo total.
   */
  async addCredits(
    userId: string,
    amount: number,
    transactionId: string,
  ): Promise<number> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException(
        'O valor de créditos a adicionar deve ser um inteiro positivo.',
      );
    }

    if (!transactionId) {
      throw new BadRequestException(
        'reference_id (transaction_id) é obrigatório para créditos do tipo purchase.',
      );
    }

    const { error } = await this.supabase.from('credit_ledger').insert({
      user_id: userId,
      type: 'purchase',
      amount,
      reference_id: transactionId,
    });

    if (error) {
      throw new InternalServerErrorException('Falha ao adicionar créditos.');
    }

    return this.getBalance(userId);
  }

  /**
   * Debita um valor aleatório (25–40) referente a um ciclo de call ativa.
   * Método interno — chamado pelo processador BullMQ.
   * Se o saldo resultante ficar abaixo do mínimo, encerra a call no banco.
   */
  async debitCredits(userId: string, callId: string): Promise<DebitResult> {
    const amountDebited = this.randomDebitAmount();

    const { error: insertError } = await this.supabase
      .from('credit_ledger')
      .insert({
        user_id: userId,
        type: 'debit_call',
        amount: -amountDebited,
        reference_id: callId,
      });

    if (insertError) {
      throw new InternalServerErrorException('Falha ao debitar créditos.');
    }

    const newBalance = await this.getBalance(userId);

    if (newBalance >= MIN_BALANCE_TO_CONTINUE) {
      return { amountDebited, newBalance, callEnded: false };
    }

    // Saldo insuficiente: encerra a call e contabiliza o total debitado.
    const creditsCharged = await this.getCallTotalCharged(callId);

    const { error: updateError } = await this.supabase
      .from('calls')
      .update({
        status: 'ended',
        end_reason: 'no_balance',
        ended_at: new Date().toISOString(),
        credits_charged: creditsCharged,
      })
      .eq('id', callId);

    if (updateError) {
      throw new InternalServerErrorException(
        'Falha ao encerrar a call por saldo insuficiente.',
      );
    }

    return { amountDebited, newBalance, callEnded: true };
  }

  /**
   * Verifica se a call ainda está com `status = 'active'`.
   * Usado pelo processador antes de debitar.
   */
  async isCallActive(callId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('calls')
      .select('status')
      .eq('id', callId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        'Falha ao verificar o status da call.',
      );
    }

    if (!data) {
      return false;
    }

    return (data as { status: string }).status === 'active';
  }

  /**
   * Total (positivo) já debitado em uma call específica.
   */
  private async getCallTotalCharged(callId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('credit_ledger')
      .select('amount')
      .eq('reference_id', callId)
      .eq('type', 'debit_call');

    if (error) {
      throw new InternalServerErrorException(
        'Falha ao calcular o total debitado na call.',
      );
    }

    const rows = (data ?? []) as Array<{ amount: number }>;
    const sum = rows.reduce((acc, row) => acc + row.amount, 0);
    return Math.abs(sum);
  }

  /**
   * Inteiro aleatório entre MIN_DEBIT_PER_CYCLE e MAX_DEBIT_PER_CYCLE (inclusive).
   */
  private randomDebitAmount(): number {
    const span = MAX_DEBIT_PER_CYCLE - MIN_DEBIT_PER_CYCLE + 1;
    return Math.floor(Math.random() * span) + MIN_DEBIT_PER_CYCLE;
  }
}
