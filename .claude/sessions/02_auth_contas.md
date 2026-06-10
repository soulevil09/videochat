# Sessão 02 — Auth & Contas

## Objetivo
Implementar o sistema completo de autenticação e gerenciamento de contas no backend NestJS,
usando Supabase Auth como provedor de identidade, JWT para proteção de rotas,
e integração com a tabela `users` do schema definido na sessão 01.

## Referências obrigatórias
@CLAUDE.md
@supabase/migrations/001_initial_schema.sql

## Contexto da stack
- Backend: NestJS + TypeScript strict, Node.js 20
- Auth provider: Supabase Auth (email/password)
- Token: JWT emitido pelo Supabase, validado no backend via JwtAuthGuard
- Banco: PostgreSQL via Supabase (tabela `users` já existe — NÃO recriar)
- Variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET

## Regras de negócio obrigatórias

### Registro
- Aceitar: `email`, `password`, `display_name`, `gender` (enum: `male` | `female`)
- Criar usuário no Supabase Auth via Admin API (`supabase.auth.admin.createUser`)
- Após criação no Auth, inserir registro na tabela `users` com o mesmo `id` (UUID do Supabase Auth)
- Campos obrigatórios no insert: `id`, `email`, `display_name`, `gender`
- Campos com default: `credit_balance = 0`, `availability_status = 'offline'`, `is_approved = false`, `is_banned = false`
- Mulheres (`gender = 'female'`) criadas com `is_approved = false` — aprovação manual pelo admin
- Homens (`gender = 'male'`) criados com `is_approved = true` automaticamente
- Se o insert em `users` falhar após criação no Auth: deletar o usuário do Supabase Auth (rollback manual)
- Nunca expor `password` em nenhuma resposta

### Login
- Autenticar via Supabase Auth (`supabase.auth.signInWithPassword`)
- Retornar: `access_token` (JWT do Supabase), `user` (dados da tabela `users`, sem campos sensíveis)
- Se `is_banned = true`: retornar 403 com mensagem "Conta suspensa"
- Se `is_approved = false` e `gender = 'female'`: retornar 403 com mensagem "Conta aguardando aprovação"
- Homens com `is_approved = true` podem logar normalmente

### Logout
- Revogar sessão no Supabase Auth via Admin API
- Rota autenticada (requer JWT válido)

### Perfil
- `GET /auth/me` — retorna dados do usuário autenticado da tabela `users`
- Rota autenticada (requer JWT válido)
- Nunca retornar: `deleted_at`, campos internos de controle de ban/aprovação para o próprio usuário

### Soft delete (desativar conta)
- `DELETE /auth/me` — não deleta o registro real
- Apenas define `deleted_at = now()` na tabela `users`
- Revoga sessão no Supabase Auth
- Usuário com `deleted_at IS NOT NULL` não consegue logar (verificar no login)

### JwtAuthGuard
- Validar o JWT do Supabase em toda rota autenticada
- Extrair `sub` (UUID do usuário) do payload JWT
- Buscar o usuário na tabela `users` pelo `id = sub`
- Rejeitar com 401 se: token inválido, expirado, ou usuário não encontrado
- Rejeitar com 403 se: `is_banned = true` ou `deleted_at IS NOT NULL`
- Injetar o objeto `user` no `request` para uso nos controllers

## Arquivos a gerar

Gere APENAS os seguintes arquivos — não crie nenhum outro:

backend/src/auth/auth.module.ts
backend/src/auth/auth.controller.ts
backend/src/auth/auth.service.ts
backend/src/auth/jwt.strategy.ts
backend/src/auth/jwt-auth.guard.ts
backend/src/auth/dto/register.dto.ts
backend/src/auth/dto/login.dto.ts
backend/src/auth/decorators/current-user.decorator.ts


## Instruções técnicas

1. TypeScript strict em todos os arquivos — sem `any` implícito
2. Usar `@supabase/supabase-js` com `createClient` usando `SUPABASE_SERVICE_ROLE_KEY` (nunca a anon key)
3. O `SupabaseClient` deve ser instanciado como provider no `AuthModule` e injetado via DI no `AuthService`
4. DTOs com `class-validator`: `@IsEmail`, `@IsString`, `@MinLength(8)` para password, `@IsEnum(GenderType)` para gender
5. `GenderType` enum TypeScript deve espelhar o ENUM PostgreSQL: `male | female`
6. Todas as respostas de erro devem usar as exceções do NestJS (`UnauthorizedException`, `ForbiddenException`, `ConflictException`, `InternalServerErrorException`)
7. `JwtAuthGuard` deve estender `AuthGuard('jwt')` do `@nestjs/passport`
8. `CurrentUser` decorator deve usar `createParamDecorator` para extrair o usuário do request
9. Não usar `bcrypt` — o hash de senha é responsabilidade do Supabase Auth
10. Não criar migrations SQL nesta sessão — a tabela `users` já existe

## Critério de validação

Ao final, a sessão estará correta se:
- Existirem exatamente 8 arquivos gerados nos caminhos listados acima
- `JwtAuthGuard` for aplicável via `@UseGuards(JwtAuthGuard)` em qualquer controller futuro
- `AuthService` não tiver nenhum `any` explícito ou implícito
- O fluxo de rollback (delete Auth se insert em `users` falhar) estiver implementado no `register`
- `deleted_at`, `is_banned` e `is_approved` forem verificados no guard E no login