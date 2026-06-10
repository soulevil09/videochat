import { Module, Provider } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

const supabaseProvider: Provider = {
  provide: 'SUPABASE_CLIENT',
  useFactory: (): SupabaseClient => {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.',
      );
    }

    return createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  },
};

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, supabaseProvider],
  exports: [AuthService, supabaseProvider, PassportModule],
})
export class AuthModule {}
