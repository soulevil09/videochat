import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  AuthService,
  LoginResponse,
  PublicUser,
  UserRecord,
} from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

interface MessageResponse {
  message: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto): Promise<PublicUser> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Headers('authorization') authorization: string,
  ): Promise<MessageResponse> {
    await this.authService.logout(this.extractToken(authorization));
    return { message: 'Logout realizado com sucesso.' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: UserRecord): PublicUser {
    return this.authService.getMe(user);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async deactivate(
    @CurrentUser() user: UserRecord,
    @Headers('authorization') authorization: string,
  ): Promise<MessageResponse> {
    await this.authService.deactivate(
      user.id,
      this.extractToken(authorization),
    );
    return { message: 'Conta desativada com sucesso.' };
  }

  private extractToken(authorization: string): string {
    return authorization?.replace(/^Bearer\s+/i, '') ?? '';
  }
}
