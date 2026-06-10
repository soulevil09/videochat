import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SupabaseClient } from '@supabase/supabase-js';

import { UserRecord } from './auth.service';

interface JwtPayload {
  sub: string;
  email?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET não configurado.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<UserRecord> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', payload.sub)
      .maybeSingle();

    if (error || !data) {
      throw new UnauthorizedException('Token inválido ou usuário inexistente.');
    }

    return data as UserRecord;
  }
}
