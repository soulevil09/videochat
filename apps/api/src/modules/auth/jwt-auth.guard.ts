import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { UserRecord } from './auth.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = UserRecord>(
    err: unknown,
    user: UserRecord | false | null,
  ): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }

    if (user.is_banned) {
      throw new ForbiddenException('Conta suspensa.');
    }

    if (user.deleted_at !== null) {
      throw new ForbiddenException('Conta desativada.');
    }

    return user as TUser;
  }
}
