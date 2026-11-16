# Doce Lurdes — gestão de encomendas

Aplicação web para a Pastelaria Doce Lurdes. O cliente encomenda e acompanha sem conta; a Gestora administra encomendas e pagamentos simulados; a Produção consulta a agenda e avança cada item.

## Estado e verificação da integração

Arquitetura/API, fluxos, backend e frontend estão integrados em `main` (PRs #2, #3, #5 e #4). Este PR #1 contém apenas documentação de integração e permanece separado para revisão.

Executado neste checkout com Node.js 24.19.0 e npm 11.17.0:

- `npm ci` — concluído com o lockfile integrado; auditoria npm reportou 0 vulnerabilidades.
- `npm run typecheck` — passou.
- `npm test` — 15 passaram, 1 ignorado; o teste de concorrência foi ignorado porque não havia `DATABASE_URL` apontando para PostgreSQL local.
- `npm run build` — passou; Next.js compilou as páginas e rotas da API.

O setup local com Docker não foi executado porque Docker não está instalado neste ambiente. A equipa ativou um projeto Supabase remoto separado e reportou migração, seed e teste transacional PostgreSQL concluídos (detalhes abaixo). Ainda faltam `DATABASE_URL`/host do pooler e contas Auth para testar as rotas protegidas e a aplicação ponta a ponta. O teste de migração local usa PGlite; não substitui uma execução repetível no Supabase.

## Instalação local

Requisitos: Node.js 20.9 ou posterior, npm e Docker para o Supabase local.

1. Instale dependências pelo lockfile: `npm ci`.
2. Copie `.env.example` para `.env.local` e preencha os valores de um projeto Supabase local ou autorizado.
3. Inicie Supabase local: `npx --yes supabase@3.2.0 start`.
4. Aplique as migrações locais: `npx --yes supabase@3.2.0 migration up`. O CLI 3.2.0 aplica localmente por padrão; não acrescente `--remote`.
5. Carregue os dados originais e a fixture de demonstração, por esta ordem: `npm run seed:original` e `npm run seed:demo`.
6. Inicie a aplicação: `npm run dev` (Next.js em `http://localhost:3000`).

O Supabase local fornece a URL, a publishable key e a ligação PostgreSQL local. `DATABASE_URL` só é usada pelo servidor e pelos scripts de seed; nunca a exponha como variável `NEXT_PUBLIC_*`. Para o projeto remoto, obtenha a URL e publishable key na configuração do projeto e a connection string PostgreSQL/pooler em Database Settings. O README e `.env.example` não contêm chaves nem a connection string.

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

Validação remota reportada pela equipa: o seed carregou os 11 produtos, 8 encomendas originais, cinco bolos da fixture de 24/11 e os dois sinais históricos inferidos de 17 € e 24 €. A migração `20261116210057_initial_schema.sql` foi aplicada no projeto remoto abaixo. Estes resultados foram reportados pela equipa; os scripts não foram executados deste checkout porque falta a connection string `DATABASE_URL`.

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

O teste do roteiro completo de API/UI ainda está pendente. O backend usa o relógio real; a aplicação ainda não permite injetar T0 para repetir a demo em qualquer data. A criação das contas internas também está pendente: o painel de Auth não estava acessível e o signup público atingiu rate limit. Não há contas de teste nem credenciais para publicar.

`POST /api/orders` recusa uma data que já tenha seis bolos personalizados confirmados, sem criar pedido ou código (`409 CAPACITY_FULL`). Um pedido aceite fica Pendente e não reserva vaga; a confirmação revalida capacidade e reserva-a atomicamente. Cada bolo personalizado ocupa uma vaga. Cancelados libertam vaga; pedidos confirmados e estados seguintes contam para a data.

## Comandos de qualidade

```sh
npm run typecheck
npm test
npm run build
```

O teste de concorrência requer `DATABASE_URL` para uma base local com a migração aplicada. Sem essa configuração, o teste é ignorado. O projeto não integra pagamentos, email, SMS, WhatsApp ou Instagram; todos os registos de pagamento são simulados.

## Evidência PostgreSQL remota

A equipa reportou um teste transacional real no projeto `pastelaria-doce-lurdes-mvp` (`eu-west-1`, ref `cnrfbypzershppmwqtlw`, endpoint `https://cnrfbypzershppmwqtlw.supabase.co`): confirmação do sexto bolo; `CAPACITY_FULL` no sétimo sem gravar sinal; e `CAPACITY_LOST_AFTER_PAYMENT` após sinal externo, sem criar uma sétima vaga e com rollback mantendo cinco bolos confirmados na fixture. Esta evidência valida a migração/capacidade no PostgreSQL remoto, mas não valida as sessões Auth, as permissões através da API, nem os fluxos da interface.

## Deploy e limitações

Vercel é o destino previsto, mas não há URL de deploy confirmada. O projeto Supabase remoto foi criado pela equipa e teve migração, seed e teste transacional reportados; faltam disponibilizar a connection string/pooler em `DATABASE_URL` e provisionar contas internas para testar API/UI ponta a ponta. Nenhum segredo do projeto foi adicionado ao repositório. O deploy, as permissões com sessões reais e a demonstração integral ficam por validar.
