# Doce Lurdes — backend e dados

Route Handlers Next.js (Node.js) e PostgreSQL no Supabase. O contrato comum está em [docs/contrato-mvp.md](docs/contrato-mvp.md) e [docs/api.md](docs/api.md); decisões e limitações do seed estão em [seed/README.md](seed/README.md).

## Configuração local

Requisitos: Node.js 20.9 ou posterior, uma base PostgreSQL/Supabase com as migrações aplicadas, e utilizadores internos criados no Supabase Auth.

1. `npm ci`
2. Copiar `.env.example` para `.env.local` e preencher a URL e publishable key do Supabase, além de `DATABASE_URL` para uso exclusivo do servidor.
3. Iniciar a stack local e aplicar a migração: `npx --yes supabase@3.2.0 start` e `npx --yes supabase@3.2.0 migration up`. Na CLI 3, estes comandos usam o alvo local por padrão.
4. `npm run dev`

Não definir `DATABASE_URL` como variável `NEXT_PUBLIC_*`. O código de seguimento é mostrado uma vez; a base armazena apenas o respetivo hash.

## Perfis internos

Criar os utilizadores em Supabase Auth e inserir o respetivo UUID em `public.staff_profiles` com perfil `manager` ou `production`. O signup público está desativado na configuração local. Na configuração hospedada, aplicar a mesma opção no Supabase Auth. Essa tabela não aceita escrita pela Data API pública. Nunca atribuir perfil a partir de metadata editável pelo utilizador, nem incluir credenciais de demonstração no repositório. Para a fixture de seis bolos, definir `DEMO_RECORDED_BY` com o UUID de um utilizador Gestora existente.

Os Route Handlers validam a sessão com Supabase Auth e consultam `staff_profiles` no servidor em cada ação protegida. A Produção não recebe contactos, notas gerais ou pagamentos. A Gestora é a única que regista pagamentos e entrega encomendas.

As mutações de equipa também verificam que o header `Origin` corresponde à origem da própria API; chamadas de browser same-origin incluem-no automaticamente.

## Seed

- `npm run seed:original` carrega o arquivo local `seed/original-data.json` e exige exatamente 11 produtos e 8 encomendas.
- `npm run seed:demo` carrega a fixture separada com seis itens de bolo personalizados para 8 de dezembro de 2026.

O arquivo original não está no histórico nem nos worktrees revistos. Por isso não há valores inventados no seed; o primeiro comando falha com ficheiro ausente até a fonte ser colocada localmente. As datas completas dos oito registos só podem ser documentadas quando a agenda original for fornecida. Ver [seed/README.md](seed/README.md).

## Verificações

- `npm run typecheck`
- `npm test`
- `npm run build`

O teste de concorrência precisa de `DATABASE_URL` apontado para uma base local com migrações aplicadas. Sem essa variável, o Node assinala-o como ignorado; nenhum projeto Supabase remoto é alterado por estes comandos.

Não há integração de pagamento, email, SMS ou mensagens. Registos de pagamento são dados simulados.
