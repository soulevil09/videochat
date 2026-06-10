import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsString,
  MinLength,
} from 'class-validator';

/**
 * Espelha o ENUM PostgreSQL `gender_type` (`male` | `female`).
 */
export enum GenderType {
  MALE = 'male',
  FEMALE = 'female',
}

export class RegisterDto {
  @IsEmail({}, { message: 'E-mail inválido.' })
  email!: string;

  @IsString({ message: 'A senha deve ser um texto.' })
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  password!: string;

  @IsString({ message: 'O nome deve ser um texto.' })
  @MinLength(2, { message: 'O nome deve ter no mínimo 2 caracteres.' })
  name!: string;

  @IsEnum(GenderType, { message: "Gênero deve ser 'male' ou 'female'." })
  gender!: GenderType;

  /**
   * Data de nascimento no formato ISO `yyyy-MM-dd`.
   * Idade mínima de 18 anos validada no backend (AuthService).
   */
  @IsDateString(
    {},
    { message: 'Data de nascimento inválida (use o formato yyyy-MM-dd).' },
  )
  birth_date!: string;
}
