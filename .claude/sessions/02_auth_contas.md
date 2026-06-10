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
- Aceitar: `email`, `password`, `name`, `gender` (enum: `male` | `female`)
- Criar usuário no Supabase Auth via Admin API (`supabase.auth.admin.createUser`)
- Após criação no Auth, inserir registro na tabela `users` com o mesmo `id` (UUID do Supabase Auth)
- Campos obrigatórios no insert: `id`, `email`, `name`, `gender`
- Campos com default aplicados automaticamente pelo schema: `availability_status = 'offline'`, `is_approved = false`, `is_banned = false`
- Mulheres (`gender = 'female'`) criadas com `is_approved = false` — aprovação manual pelo admin
- Homens (`gender = 'male'`) criados com `is_approved = true` via UPDATE imediato após o insert
- Se o insert em `users` falhar após criação no Auth: deletar o usuário do Supabase Auth (rollback manual via `supabase.auth.admin.deleteUser`)
- Nunca expor `password` em nenhuma resposta

### Login
- Autenticar via Supabase Auth (`supabase.auth.signInWithPassword`)
- Retornar: `access_token` (JWT do Supabase), `user` (dados da tabela `users`, sem campos sensíveis)
- Se `is_banned = true`: retornar 403 com mensagem "Conta suspensa"
- Se `deleted_at IS NOT NULL`: retornar 403 com mensagem "Conta desativada"
- Se `is_approved = false` e `gender = 'female'`: retornar 403 com mensagem "Conta aguardando aprovação"
- Homens com `is_approved = true` podem logar normalmente

### Logout
- Revogar sessão no Supabase Auth via Admin API (`supabase.auth.admin.signOut`)
- Rota autenticada (requer JWT válido)

### Perfil
- `GET /auth/me` — retorna dados do usuário autenticado da tabela `users`
- Rota autenticada (requer JWT válido)
- Campos a NUNCA retornar: `deleted_at`, `is_banned`, `is_approved`, `stripe_account_id`

### Soft delete (desativar conta)
- `DELETE /auth/me` — não deleta o registro real
- Apenas define `deleted_at = now()` na tabela `users`
- Revoga sessão no Supabase Auth via Admin API
- Usuário com `deleted_at IS NOT NULL` não consegue logar (verificar no login e no guard)

### JwtAuthGuard
- Validar o JWT do Supabase em toda rota autenticada
- Extrair `sub` (UUID do usuário) do payload JWT
- Buscar o usuário na tabela `users` pelo `id = sub`
- Rejeitar com 401 se: token inválido, expirado, ou usuário não encontrado
- Rejeitar com 403 se: `is_banned = true` ou `deleted_at IS NOT NULL`
- Injetar o objeto `user` no `request` para uso nos controllers

## Arquivos a gerar

Gere APENAS os seguintes arquivos — não crie nenhum outro:

apps/api/src/modules/auth/auth.module.ts
apps/api/src/modules/auth/auth.controller.ts
apps/api/src/modules/auth/auth.service.ts
apps/api/src/modules/auth/jwt.strategy.ts
apps/api/src/modules/auth/jwt-auth.guard.ts
apps/api/src/modules/auth/dto/register.dto.ts
apps/api/src/modules/auth/dto/login.dto.ts
apps/api/src/modules/auth/decorators/current-user.decorator.ts


## Instruções técnicas

1. TypeScript strict em todos os arquivos — sem `any` implícito ou explícito
2. Usar `@supabase/supabase-js` com `createClient` usando `SUPABASE_SERVICE_ROLE_KEY` (nunca a anon key)
3. O `SupabaseClient` deve ser instanciado como provider no `AuthModule` e injetado via DI no `AuthService`
4. DTOs com `class-validator`:
   - `@IsEmail()` para email
   - `@IsString()` e `@MinLength(8)` para password
   - `@IsString()` e `@MinLength(2)` para name
   - `@IsEnum(GenderType)` para gender
5. `GenderType` enum TypeScript deve espelhar o ENUM PostgreSQL: `male | female`
6. Todas as respostas de erro devem usar as exceções do NestJS:
   - `UnauthorizedException` — token inválido/expirado
   - `ForbiddenException` — banido, desativado ou não aprovado
   - `ConflictException` — email já cadastrado
   - `InternalServerErrorException` — falha no Supabase Auth ou no banco
7. `JwtAuthGuard` deve estender `AuthGuard('jwt')` do `@nestjs/passport`
8. `JwtStrategy` deve estender `PassportStrategy(Strategy)` do `passport-jwt`
9. `CurrentUser` decorator deve usar `createParamDecorator` para extrair o usuário do `request`
10. Não usar `bcrypt` — o hash de senha é responsabilidade do Supabase Auth
11. Não criar migrations SQL nesta sessão — a tabela `users` já existe
12. Respostas de sucesso sempre tipadas com interfaces ou tipos explícitos — nunca retornar `any`
13. Mensagens de erro em português do Brasil

## Critério de validação

Ao final, a sessão estará correta se:

- Existirem exatamente 8 arquivos gerados nos caminhos listados acima
- `JwtAuthGuard` for aplicável via `@UseGuards(JwtAuthGuard)` em qualquer controller futuro
- `AuthService` não tiver nenhum `any` explícito ou implícito
- O fluxo de rollback (deleteUser no Auth se insert em `users` falhar) estiver implementado no `register`
- `deleted_at`, `is_banned` e `is_approved` forem verificados tanto no `login` quanto no `JwtAuthGuard`
- Homens registrados com `is_approved = true` (set via UPDATE após insert)
- Mulheres registradas com `is_approved = false` (default do schema)
- Nenhum arquivo fora da lista acima for criado ou modificado