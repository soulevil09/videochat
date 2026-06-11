import { Controller, Get, UseGuards } from '@nestjs/common';

import { UserRecord } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreditPackage, CreditsService } from './credits.service';

interface BalanceResponse {
  balance: number;
}

@Controller('credits')
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  /**
   * GET /credits/balance — protegida.
   * Retorna o saldo calculado via SUM do `credit_ledger`.
   */
  @Get('balance')
  @UseGuards(JwtAuthGuard)
  async getBalance(
    @CurrentUser() user: UserRecord,
  ): Promise<BalanceResponse> {
    const balance = await this.creditsService.getBalance(user.id);
    return { balance };
  }

  /**
   * GET /credits/packages — pública.
   * Retorna apenas pacotes ativos, ordenados por preço crescente.
   */
  @Get('packages')
  getPackages(): Promise<CreditPackage[]> {
    return this.creditsService.listPackages();
  }
}
