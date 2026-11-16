# Doce Lurdes — gestão de encomendas

Aplicação web para a Pastelaria Doce Lurdes. O cliente encomenda e acompanha sem conta; a Gestora administra encomendas e pagamentos simulados; a Produção consulta a agenda e avança cada item.

## Estado e verificação da integração

Arquitetura/API, fluxos, backend e frontend estão integrados em `main` (PRs #2, #3, #5 e #4). Este PR #1 contém apenas documentação de integração e permanece separado para revisão.

Executado neste checkout com Node.js 24.19.0 e npm 11.17.0:

- `npm ci` — concluído com o lockfile integrado; auditoria npm reportou 0 vulnerabilidades.
- `npm run typecheck` — passou.
- `npm test` — 15 passaram, 1 ignorado; o teste de concorrência foi ignorado porque não havia `DATABASE_URL` apontando para PostgreSQL local.
- `npm run build` — passou; Next.js compilou as páginas e rotas da API.

Não foi possível iniciar uma instância Supabase local porque Docker não está instalado neste ambiente. Também não foi possível usar Supabase remoto: a conta ligada atingiu o limite de dois projetos gratuitos. Portanto, apesar de o comando da CLI para migrações estar verificado, não foi executada a migração contra PostgreSQL real, os scripts de seed contra uma base real, testes de permissões com sessões Auth reais, o percurso completo no navegador nem a verificação de deploy. O teste de migração usa PGlite; não substitui um teste de integração Supabase/PostgreSQL.

## Instalação local

Requisitos: Node.js 20.9 ou posterior, npm e Docker para o Supabase local.

1. Instale dependências pelo lockfile: `npm ci`.
2. Copie `.env.example` para `.env.local` e preencha os valores de um projeto Supabase local ou autorizado.
3. Inicie Supabase local: `npx --yes supabase@3.2.0 start`.
4. Aplique as migrações locais: `npx --yes supabase@3.2.0 migration up`. O CLI 3.2.0 aplica localmente por padrão; não acrescente `--remote`.
5. Carregue os dados originais e a fixture de demonstração, por esta ordem: `npm run seed:original` e `npm run seed:demo`.
6. Inicie a aplicação: `npm run dev` (Next.js em `http://localhost:3000`).

O Supabase local fornece a URL, a publishable key e a ligação PostgreSQL local. `DATABASE_URL` só é usada pelo servidor e pelos scripts de seed; nunca a exponha como variável `NEXT_PUBLIC_*`. Os valores do projeto remoto vêm da configuração do projeto Supabase autorizado. Não existe projeto remoto disponível nesta sessão para fornecer ou validar esses valores.

## Variáveis de ambiente

`.env.example` contém somente nomes e valores vazios, sem tokens ou credenciais:

| Variável | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do endpoint Supabase usada pelo cliente Auth. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave publicável do Supabase Auth; não é a chave `service_role`. |
| `DATABASE_URL` | Connection string PostgreSQL usada apenas no servidor e nos scripts. Tratar como segredo. |
| `DEMO_RECORDED_BY` | Opcional: UUID de uma Gestora Auth para atribuir o pagamento simulado da fixture. Se omitido, permanece nulo por ser dado importado. |

Nunca commitar `.env`, `.env.local`, chaves privadas, palavras-passe ou connection strings. `.gitignore` cobre `.env*` (com exceção de `.env.example`), `node_modules/`, `.next/` e `*.tsbuildinfo`.

## Migração, seed e contas internas

O schema inicial está em `supabase/migrations/20261116210057_initial_schema.sql`. Aplique-o com os comandos do setup local acima. Para uma base nova, carregue os dados assim:

- `npm run seed:original` importa exatamente 11 produtos e 8 encomendas do dossier, com IDs estáveis.
- `npm run seed:demo` acrescenta cinco bolos para 24/11/2026 às 10:00; o sexto bolo é criado pelo fluxo do cliente na demonstração.

Os dados históricos não têm datas absolutas na fonte. O seed atribui a semana de 17–22/11/2026 e documenta as datas, estados e valores inferidos em [seed/README.md](seed/README.md). Estas datas históricas não são a fixture de relógio da demo. A fixture do passo a passo usa T0=17/11/2026 10:00 Europe/Lisbon, pedido principal para 24/11 às 10:00, pedido demasiado cedo para 19/11 às 10:00 e segunda-feira 23/11. O código atual usa o relógio real do servidor; não há injeção de relógio na aplicação, portanto a repetição futura das datas do roteiro exige ajustar a fixture ou executar num ambiente de teste com relógio compatível.

O signup público está desativado na configuração local (`supabase/config.toml`); manter também desativado no projeto hospedado. Para provisionar perfis de teste num projeto local/autorizado:

1. Crie utilizadores internos em Supabase Auth (Dashboard/Studio ou mecanismo administrativo autorizado), definindo as palavras-passe fora do repositório.
2. Copie o UUID de cada utilizador e insira-o na tabela protegida `public.staff_profiles`, atribuindo `manager` ou `production`:

```sql
insert into public.staff_profiles (user_id, role)
values ('<UUID_DO_UTILIZADOR>', 'manager');

insert into public.staff_profiles (user_id, role)
values ('<UUID_DO_UTILIZADOR>', 'production');
```

Não existem contas de demonstração pré-criadas nem credenciais para publicar. A Gestora regista pagamentos e entrega encomendas; Produção só avança estado por item. As rotas verificam a sessão Auth e o perfil ativo no servidor.

## Cenário oficial de demonstração

Os contratos completos estão em [docs/requisitos.md](docs/requisitos.md), [docs/api.md](docs/api.md) e [docs/fluxos.md](docs/fluxos.md). A fixture usa T0=17/11/2026 10:00 Europe/Lisbon, levantamento principal em 24/11/2026 às 10:00, prazo curto em 19/11 e segunda-feira em 23/11. Estas datas de demonstração são distintas das datas históricas inferidas no seed.

Roteiro previsto para a demonstração:

1. Cliente cria bolo personalizado de chocolate de 2 kg com mensagem “Parabéns Inês” e alergia a frutos secos; guarda o código apresentado uma vez.
2. Pedido para 19/11 é rejeitado por antecedência insuficiente.
3. Pedido para 23/11 é rejeitado por encerramento à segunda-feira.
4. Gestora confirma o pedido principal após registar sinal de 17 € sobre o total de 56 €; saldo calculado de 39 €.
5. Produção encontra o bolo para 24/11 e vê a alergia declarada em destaque, separada dos alergénios do produto.
6. A fixture já contém cinco bolos confirmados para 24/11; com o pedido principal confirmado, há seis. Outro bolo nessa data é rejeitado por capacidade.
7. Cliente consulta pelo código; Produção avança o item até Pronto; Gestora regista o restante e marca Entregue.

Este roteiro ainda não foi executado ponta a ponta, pois não há acesso a uma base Supabase nesta sessão. O backend usa o relógio real; a aplicação ainda não permite injetar T0 para repetir a demo em qualquer data.

`POST /api/orders` recusa uma data que já tenha seis bolos personalizados confirmados, sem criar pedido ou código (`409 CAPACITY_FULL`). Um pedido aceite fica Pendente e não reserva vaga; a confirmação revalida capacidade e reserva-a atomicamente. Cada bolo personalizado ocupa uma vaga. Cancelados libertam vaga; pedidos confirmados e estados seguintes contam para a data.

## Comandos de qualidade

```sh
npm run typecheck
npm test
npm run build
```

O teste de concorrência requer `DATABASE_URL` para uma base local com a migração aplicada. Sem essa configuração, o teste é ignorado. O projeto não integra pagamentos, email, SMS, WhatsApp ou Instagram; todos os registos de pagamento são simulados.

## Deploy e limitações

Vercel é o destino previsto, mas não há URL de deploy confirmada. A publicação exige um projeto Supabase autorizado com Auth e PostgreSQL, configuração das quatro variáveis acima, aplicação da migração, seed e contas internas. A conta Supabase ligada a esta sessão está no limite de dois projetos gratuitos e não foi criada nem alterada nenhuma base remota. O deploy e a demo ponta a ponta ficam por validar quando houver acesso a um projeto autorizado.
