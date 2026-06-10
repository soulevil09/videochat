import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import { GenderType, RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/**
 * Espelha o ENUM PostgreSQL `availability_status_type`.
 */
export type AvailabilityStatus = 'available' | 'busy' | 'offline';

/**
 * Registro completo da tabela `users`. Uso interno (guard/strategy/service).
 */
export interface UserRecord {
  id: string;
  email: string;
  name: string;
  birth_date: string;
  gender: GenderType;
  avatar_url: string | null;
  is_approved: boolean;
  is_banned: boolean;
  stripe_account_id: string | null;
  availability_status: AvailabilityStatus;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Versão segura do usuário, exposta nas respostas da API.
 * Nunca inclui: `deleted_at`, `is_banned`, `is_approved`, `stripe_account_id`.
 */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  birth_date: string;
  gender: GenderType;
  avatar_url: string | null;
  availability_status: AvailabilityStatus;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  access_token: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    // 0. Valida idade mínima de 18 anos antes de qualquer escrita.
    if (!this.isAtLeast18(dto.birth_date)) {
      throw new BadRequestException('Idade mínima de 18 anos');
    }

    // 1. Cria o usuário no Supabase Auth (Admin API).
    const { data: authData, error: authError } =
      await this.supabase.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      if (this.isDuplicateEmailError(authError?.message)) {
        throw new ConflictException('E-mail já cadastrado.');
      }
      throw new InternalServerErrorException(
        'Falha ao criar usuário na autenticação.',
      );
    }

    const userId = authData.user.id;

    // 2. Insere o registro na tabela `users` com o mesmo UUID do Auth.
    const { data: inserted, error: insertError } = await this.supabase
      .from('users')
      .insert({
        id: userId,
        email: dto.email,
        name: dto.name,
        gender: dto.gender,
        birth_date: dto.birth_date,
      })
      .select('*')
      .single();

    if (insertError || !inserted) {
      // Rollback manual: remove o usuário recém-criado no Auth.
      await this.supabase.auth.admin.deleteUser(userId);
      throw new InternalServerErrorException('Falha ao registrar usuário.');
    }

    let userRecord = inserted as UserRecord;

    // 3. Homens são aprovados imediatamente; mulheres permanecem pendentes.
    if (dto.gender === GenderType.MALE) {
      const { data: updated, error: updateError } = await this.supabase
        .from('users')
        .update({ is_approved: true })
        .eq('id', userId)
        .select('*')
        .single();

      if (updateError || !updated) {
        throw new InternalServerErrorException('Falha ao aprovar usuário.');
      }

      userRecord = updated as UserRecord;
    }

    return this.toPublicUser(userRecord);
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const user = await this.findUserById(data.user.id);

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    if (user.is_banned) {
      throw new ForbiddenException('Conta suspensa.');
    }

    if (user.deleted_at !== null) {
      throw new ForbiddenException('Conta desativada.');
    }

    if (!user.is_approved && user.gender === GenderType.FEMALE) {
      throw new ForbiddenException('Conta aguardando aprovação.');
    }

    return {
      access_token: data.session.access_token,
      user: this.toPublicUser(user),
    };
  }

  async logout(accessToken: string): Promise<void> {
    const { error } = await this.supabase.auth.admin.signOut(accessToken);

    if (error) {
      throw new InternalServerErrorException('Falha ao encerrar a sessão.');
    }
  }

  getMe(user: UserRecord): PublicUser {
    return this.toPublicUser(user);
  }

  async deactivate(userId: string, accessToken: string): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      throw new InternalServerErrorException('Falha ao desativar a conta.');
    }

    // Revoga a sessão ativa no Supabase Auth.
    await this.supabase.auth.admin.signOut(accessToken);
  }

  private isAtLeast18(birthDate: string): boolean {
    const birth = new Date(birthDate);
    if (Number.isNaN(birth.getTime())) {
      return false;
    }

    const now = new Date();
    const eighteenthBirthday = new Date(
      birth.getFullYear() + 18,
      birth.getMonth(),
      birth.getDate(),
    );

    return eighteenthBirthday.getTime() <= now.getTime();
  }

  private async findUserById(id: string): Promise<UserRecord | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as UserRecord;
  }

  private toPublicUser(user: UserRecord): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      birth_date: user.birth_date,
      gender: user.gender,
      avatar_url: user.avatar_url,
      availability_status: user.availability_status,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  private isDuplicateEmailError(message: string | undefined): boolean {
    if (!message) {
      return false;
    }
    const normalized = message.toLowerCase();
    return (
      normalized.includes('already') || normalized.includes('registered')
    );
  }
}
