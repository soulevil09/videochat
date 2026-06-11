import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { CreditsService } from './credits.service';

/** Payload do job `debit-call-credits`. */
interface DebitCallJobData {
  callId: string;
  maleUserId: string;
}

/** Retorno do processamento de um ciclo de débito. */
interface DebitCallJobResult {
  skipped: boolean;
  callEnded: boolean;
  amountDebited: number;
  newBalance: number;
}

/**
 * Processador da queue `call-credits`.
 * Apenas PROCESSA os jobs — o agendamento (a cada 60s) é responsabilidade
 * da sessão 06 (Daily.co Video).
 */
@Processor('call-credits')
export class CreditsProcessor extends WorkerHost {
  private readonly logger = new Logger(CreditsProcessor.name);

  constructor(private readonly creditsService: CreditsService) {
    super();
  }

  async process(job: Job<DebitCallJobData>): Promise<DebitCallJobResult> {
    const { callId, maleUserId } = job.data;

    // 1. Só debita se a call ainda estiver ativa.
    const isActive = await this.creditsService.isCallActive(callId);
    if (!isActive) {
      return {
        skipped: true,
        callEnded: false,
        amountDebited: 0,
        newBalance: 0,
      };
    }

    // 2. Executa o débito do ciclo.
    const result = await this.creditsService.debitCredits(maleUserId, callId);

    // 3. Se a call foi encerrada por saldo, o job não deve ser reagendado
    //    (o reagendamento é controlado externamente, pela sessão 06).
    return {
      skipped: false,
      callEnded: result.callEnded,
      amountDebited: result.amountDebited,
      newBalance: result.newBalance,
    };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<DebitCallJobData> | undefined, error: Error): void {
    const callId = job?.data?.callId ?? 'desconhecida';
    this.logger.error(
      `Falha ao processar débito da call ${callId}: ${error.message}`,
      error.stack,
    );
  }
}
