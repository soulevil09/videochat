import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConnectionOptions } from 'bullmq';

import { AuthModule } from '../auth/auth.module';
import { CreditsController } from './credits.controller';
import { CreditsProcessor } from './credits.processor';
import { CreditsService } from './credits.service';

const CALL_CREDITS_QUEUE = 'call-credits';

/**
 * Conexão Redis (Upstash) compartilhada pela queue e pelo worker.
 * BullMQ exige `maxRetriesPerRequest: null` para conexões de worker.
 */
function buildRedisConnection(): ConnectionOptions {
  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;

  if (!url || !token) {
    throw new Error(
      'UPSTASH_REDIS_URL e UPSTASH_REDIS_TOKEN são obrigatórios.',
    );
  }

  const parsed = new URL(url);

  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: token,
    tls: {},
    maxRetriesPerRequest: null,
  };
}

@Module({
  imports: [
    // AuthModule expõe o provider 'SUPABASE_CLIENT' e a estratégia JWT
    // (PassportModule) usadas, respectivamente, pelo service e pelo guard.
    AuthModule,
    BullModule.forRoot({ connection: buildRedisConnection() }),
    BullModule.registerQueue({ name: CALL_CREDITS_QUEUE }),
  ],
  controllers: [CreditsController],
  providers: [CreditsService, CreditsProcessor],
  exports: [CreditsService],
})
export class CreditsModule {}
