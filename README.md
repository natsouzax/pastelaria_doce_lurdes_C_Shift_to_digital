# Pastelaria Doce Lurdes

Aplicação web para gerir encomendas de uma pastelaria. O cliente consulta o catálogo, encomenda sem criar conta e acompanha o pedido por um código; a equipa gere pagamentos simulados, produção e levantamento.

[Abrir aplicação de produção](https://pastelaria-doce-lurdes-c-shift-to-d.vercel.app)

> **Acesso para avaliação:** o domínio de produção está protegido por SSO da Vercel. O responsável pelo projeto tem de autorizar o acesso do avaliador. Os painéis internos também exigem uma conta Supabase com perfil de Gestora ou Produção. Não existem contas de demonstração nem credenciais no repositório; os acessos devem ser combinados e entregues em privado.

## Funcionalidades

| Perfil | O que pode fazer |
| --- | --- |
| Cliente | Consultar produtos e preços, criar uma encomenda, guardar o código de seguimento e consultar o estado. |
| Gestora | Consultar e gerir encomendas, registar pagamentos simulados, confirmar pedidos, gerir o catálogo e concluir entregas. |
| Produção | Consultar encomendas confirmadas por data, ver alergias e notas por artigo e atualizar o estado da produção. |

## Regras de negócio

- Bolos personalizados exigem pelo menos **120 horas** de antecedência; os restantes produtos exigem pelo menos **48 horas** ou o prazo superior definido no catálogo.
- Não são permitidos levantamentos à segunda-feira. A validação usa o fuso horário `Europe/Lisbon`.
- **Limite adicional do projeto:** cada data aceita até seis encomendas não canceladas, incluindo pedidos pendentes. Cancelar liberta o lugar.
- Separadamente, cada data aceita até seis **bolos personalizados físicos** confirmados. Cada bolo conta como uma unidade, mesmo que haja vários na mesma encomenda. Um pedido pendente ocupa lugar no limite global de encomendas, mas ainda não reserva lugar de bolo personalizado.
- A confirmação de um pedido com bolo personalizado exige o registo do sinal: **30% do total, arredondado ao euro mais próximo** (frações de 50 cêntimos arredondadas para cima). A aplicação calcula o valor pago e o saldo.
- Cancelamentos com menos de 48 horas de antecedência retêm o sinal. Com 48 horas ou mais, o sinal pode ser reembolsado; os registos são simulados.
- Os preços do catálogo e os totais apresentados ao cliente incluem IVA.
- O estado de produção pertence a cada artigo. A encomenda fica Pronta quando todos os artigos estiverem prontos.
- Não há integração com prestadores de pagamento. A aplicação pode abrir o WhatsApp com uma mensagem preparada, mas o envio depende de uma ação manual.

O limite global de seis encomendas é uma política adicional do projeto, distinta do limite de seis bolos personalizados. Ambos estão implementados e são validados no servidor. O contrato completo está em [docs/requisitos.md](docs/requisitos.md) e [docs/api.md](docs/api.md).

## Tecnologias

- Next.js e React
- TypeScript
- Supabase Auth e PostgreSQL
- Vercel

## Executar localmente

### Requisitos

- Node.js 20.9 ou posterior
- npm
- Docker, para executar o Supabase local

### Instalação

1. Instale as dependências:

   ```sh
   npm ci
   ```

2. Inicie o Supabase local:

   ```sh
   npx --yes supabase@3.2.0 start
   ```

3. Copie `.env.example` para `.env.local`. Preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `DATABASE_URL` com os dados indicados pelo ambiente local. `DATABASE_URL` é apenas para o servidor e scripts; nunca use o prefixo `NEXT_PUBLIC_` nessa variável.

4. Aplique as migrações:

   ```sh
   npx --yes supabase@3.2.0 migration up
   ```

5. Carregue o catálogo e os dados de origem. Este passo é necessário para ter produtos e encomendas na base local:

   ```sh
   npm run seed:original
   ```

6. Para preparar também o cenário de demonstração, carregue a fixture:

   ```sh
   npm run seed:demo
   ```

7. Inicie a aplicação:

   ```sh
   npm run dev
   ```

Abra `http://localhost:3000`.

## Cenário de demonstração

A fixture adiciona cinco bolos personalizados para 24/11/2026 às 10:00. O roteiro foi definido para T0 = 17/11/2026 às 10:00 em `Europe/Lisbon`; a aplicação usa o relógio real do servidor, por isso estas datas só reproduzem o fluxo de antecedência no período compatível. O código de seguimento de um pedido criado é apresentado uma vez: guarde-o para consultar o estado.

1. Crie uma encomenda de bolo de chocolate de 2 kg para 24/11 às 10:00, com “Parabéns Inês” e alergia a frutos secos.
2. Tente um levantamento para 19/11 às 10:00 e confirme que é recusado por antecedência insuficiente.
3. Tente um levantamento na segunda-feira, 23/11, e confirme que é recusado.
4. Como Gestora, registe o sinal de 17 € sobre o total de 56 €, confirme o pedido e verifique o saldo de 39 €.
5. Como Produção, consulte o pedido e confirme que a alergia declarada aparece destacada dos alergénios do produto.
6. Consulte a encomenda pelo código e avance os artigos até Pronto. A Gestora regista o restante e conclui a entrega.

### Testar os dois limites de capacidade

- **Limite global de encomendas:** com seis pedidos não cancelados na data, tente criar outro pedido. Deve ser recusado, qualquer que seja o produto.
- **Limite de bolos personalizados:** para isolar esta regra, prepare cinco pedidos ativos com cinco bolos personalizados confirmados. Num sexto pedido, inclua dois bolos personalizados. A criação deve ser recusada porque ultrapassaria seis bolos, embora o total de encomendas ainda fosse seis.

O seed da demonstração deixa cinco pedidos com um bolo cada. As datas, estados e restantes detalhes inferidos dos dados de origem estão documentados em [seed/README.md](seed/README.md).

## Contas internas e segurança

O registo público está desativado. Para testar os painéis, crie os utilizadores no Supabase Auth e atribua-lhes um perfil `manager` ou `production` em `public.staff_profiles`. A sessão e o perfil são validados no servidor. Defina palavras-passe fora do repositório e entregue credenciais de avaliação por um canal privado.

| Variável | Utilização |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase usada pelo cliente de autenticação. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave publicável do Supabase Auth. |
| `DATABASE_URL` | Ligação PostgreSQL do servidor e dos scripts de seed. Tratar como segredo. |
| `DEMO_RECORDED_BY` | Opcional: UUID da Gestora atribuído aos registos de pagamento da fixture. |

Nunca comite `.env`, `.env.local`, palavras-passe, chaves privadas ou connection strings. `.env.example` contém apenas os nomes das variáveis.

## Verificação

Execute os comandos abaixo para verificar tipos, testes e build:

```sh
npm run typecheck
npm test
npm run build
```

O teste de integração PostgreSQL é ignorado por omissão. Para o executar, configure `RUN_DATABASE_INTEGRATION_TESTS=1` e `TEST_DATABASE_URL` para uma base de teste com as migrações aplicadas. Para uma base remota, é também necessário definir `TEST_ALLOW_REMOTE_DATABASE=true`. Esta secção descreve como executar as verificações; não afirma resultados de uma execução recente.

## Documentação

- [Requisitos e fluxos](docs/requisitos.md)
- [Contrato da API](docs/api.md)
- [Fluxos da aplicação](docs/fluxos.md)
- [Modelo de dados](docs/modelo-dados.md)
- [Dados de origem e fixture](seed/README.md)
