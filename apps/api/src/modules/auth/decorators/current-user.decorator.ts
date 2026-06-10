import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { UserRecord } from '../auth.service';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserRecord => {
    const request = ctx.switchToHttp().getRequest<{ user: UserRecord }>();
    return request.user;
  },
);
