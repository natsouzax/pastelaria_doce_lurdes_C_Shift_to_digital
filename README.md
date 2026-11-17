# Pastelaria Doce Lurdes

Aplicação web para gerir encomendas de uma pastelaria, desde o catálogo até à produção e ao levantamento. O cliente faz e acompanha uma encomenda sem criar conta; a equipa gere pedidos e consulta o trabalho do dia.

## Aplicação

O projeto está [publicado em produção na Vercel](https://pastelaria-doce-lurdes-c-shift-to-d.vercel.app). O acesso aos domínios `vercel.app` está protegido por SSO e requer autorização da equipa.

## O que é possível fazer

| Perfil | Funcionalidades |
| --- | --- |
| Cliente | Consultar o catálogo, fazer uma encomenda sem conta e acompanhar o estado com um código de seguimento. |
| Gestora | Gerir catálogo e encomendas, registar pagamentos simulados, confirmar pedidos e concluir a entrega. |
| Produção | Consultar encomendas confirmadas por data, ver alergias e notas, e atualizar o estado de produção de cada artigo. |

### Regras principais

- O servidor valida os prazos de antecedência, os dias de levantamento e a capacidade diária.
- Cada data aceita até seis encomendas não canceladas. Cada bolo personalizado confirmado ocupa uma vaga própria, até ao limite de seis bolos por data.
- A confirmação de uma encomenda personalizada exige o registo do sinal. O saldo é calculado pela aplicação.
- Os estados de produção são acompanhados por artigo. A encomenda fica pronta quando todos os artigos estiverem prontos.
- Os pagamentos são apenas registados na aplicação; não existe integração com um prestador de pagamentos.

## Tecnologias

- [Next.js](https://nextjs.org/) e React
- TypeScript
- [Supabase](https://supabase.com/) para autenticação e PostgreSQL
- Vercel para alojamento

## Executar localmente

### Requisitos

- Node.js 20.9 ou posterior
- npm
- Docker, para iniciar o Supabase local

### Instalação

1. Instale as dependências:

   ```sh
   npm ci
   ```

2. Copie `.env.example` para `.env.local` e preencha as variáveis com os valores do seu projeto Supabase local ou autorizado.

3. Inicie o Supabase local e aplique as migrações:

   ```sh
   npx --yes supabase@3.2.0 start
   npx --yes supabase@3.2.0 migration up
   ```

4. Opcionalmente, carregue os dados de origem e a fixture de demonstração:

   ```sh
   npm run seed:original
   npm run seed:demo
   ```

5. Inicie a aplicação:

   ```sh
   npm run dev
   ```

A aplicação fica disponível em `http://localhost:3000`.

## Configuração

| Variável | Utilização |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase usada pelo cliente de autenticação. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave publicável do Supabase Auth. |
| `DATABASE_URL` | Ligação PostgreSQL usada apenas no servidor e nos scripts de seed. É um segredo. |
| `DEMO_RECORDED_BY` | Opcional. UUID da conta de Gestora usada para atribuir pagamentos da fixture. |

Não exponha `DATABASE_URL`, palavras-passe ou chaves privadas em variáveis `NEXT_PUBLIC_*`, no repositório ou em documentação. O ficheiro `.env.example` contém apenas os nomes das variáveis.

## Contas internas

O registo público de contas está desativado. Para testar os painéis internos, crie utilizadores no Supabase Auth e atribua-lhes um perfil `manager` ou `production` na tabela protegida `public.staff_profiles`. As palavras-passe devem ser definidas fora do repositório. Não há contas de demonstração nem credenciais incluídas.

## Comandos

```sh
npm run dev        # inicia o servidor local
npm run typecheck  # verifica os tipos TypeScript
npm test           # executa os testes
npm run build      # prepara a aplicação para produção
```

O teste de integração PostgreSQL é ignorado por omissão. Para o executar, configure `RUN_DATABASE_INTEGRATION_TESTS=1` e `TEST_DATABASE_URL` para uma base de teste com as migrações aplicadas. Para uma base remota, é também necessário definir explicitamente `TEST_ALLOW_REMOTE_DATABASE=true`.

## Documentação

- [Requisitos e fluxos](docs/requisitos.md)
- [Contrato da API](docs/api.md)
- [Fluxos da aplicação](docs/fluxos.md)
- [Modelo de dados](docs/modelo-dados.md)
- [Dados de origem e demonstração](seed/README.md)

## Dados e demonstração

O seed original importa 11 produtos e 8 encomendas com identificadores estáveis. A fixture de demonstração acrescenta dados para percorrer os fluxos de encomenda, confirmação e produção. As datas históricas atribuídas aos dados de origem são inferidas e estão documentadas em [seed/README.md](seed/README.md).

O roteiro funcional está descrito em [docs/requisitos.md](docs/requisitos.md). A aplicação usa o relógio real do servidor; as datas fixas do roteiro destinam-se ao contexto de demonstração documentado e não constituem um relógio de teste configurável.
