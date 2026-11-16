# Decisões de arquitetura

Este documento regista o desenho antes da implementação. Preencher cada decisão com a razão e a alternativa considerada.

| Decisão | Escolha | Porquê / consequência |
| --- | --- | --- |
| Frontend | Next.js + TypeScript + Tailwind; SWR onde houver atualização no cliente | Stack conhecida pelo utilizador. SWR é ferramenta de busca/atualização de dados na interface, não substitui API nem regras de servidor. |
| Backend e API REST | Route Handlers do Next.js em Node.js, proposta | Mantém um único projeto TypeScript e expõe rotas REST. Regras de negócio e permissões ficam no servidor. |
| Base de dados (MySQL ou PostgreSQL) | PostgreSQL hospedado no Supabase | Supabase fornece PostgreSQL, que satisfaz o requisito relacional. |
| Autenticação de Gestora e Produção | Supabase Auth, proposta | Login apenas para equipa interna; autorização verificada nas rotas do servidor. Confirmar detalhes antes de implementar. |
| Seguimento sem conta pelo Cliente | Por definir | |
| Implantação ou Docker | Vercel, proposta | Publicação online pode valer os 5 pontos de boas práticas; Docker é opcional. |

## Contratos a desenhar

1. Entidades e relações: produtos, encomendas, itens, pagamentos simulados e utilizadores internos. Ver [modelo proposto](modelo-dados.md).
2. Ações por perfil e transições de estados.
3. Validações no servidor: prazo, segunda-feira, capacidade, sinal e saldo.
4. Fluxos de ecrãs: encomendar, gerir, produzir e acompanhar.
5. Seed reproduzível com dados originais e dados adicionais de demonstração claramente identificados.

## Trabalho paralelo após o contrato

- Frente A: interface e fluxos do Cliente, Gestora e Produção, usando o contrato da API.
- Frente B: API, regras de negócio, autenticação e permissões.
- Frente C: modelo relacional, migrações, seed, documentação de execução e cenário de demonstração.

As frentes devem trabalhar em ramos separados e integrar cedo os fluxos obrigatórios. A divisão final depende das decisões acima.

## Pendência Orca

Criar ou abrir no Orca um projeto ligado a este repositório GitHub e distribuir as frentes de trabalho em worktrees/branches separadas. Nesta sessão, o comando `orca` não foi encontrado; retomar quando o acesso ao Orca estiver disponível. Não iniciar agentes antes de fechar as decisões abaixo e um contrato comum.

## Ordem das decisões pendentes

1. Definir stack: frontend, backend, MySQL ou PostgreSQL, e modo de execução local/deploy. Justificar pela experiência da equipa e pelo prazo.
2. Definir modelo de dados e unidades: produtos, preços por kg/unidade/cento/dúzia/meia dúzia, encomendas com múltiplos itens, clientes, pagamentos simulados, utilizadores internos.
3. Definir regras de estado e capacidade: **decidido** que Pendente não reserva vaga; a vaga é atribuída ao confirmar após o sinal. Falta definir quantos bolos há em cada item e implementar a confirmação com verificação atómica para impedir ultrapassar seis vagas em pedidos simultâneos.
4. Definir autenticação e seguimento: contas de Gestora/Produção, permissões da API, código de seguimento para Cliente sem conta.
5. Definir contrato da API e fluxos de ecrãs, incluindo erros de prazo/segunda/capacidade, sinal e alergias.
6. Definir datas documentadas para os oito pedidos antigos do seed e preparar dados adicionais para demonstrar o dia com seis bolos.
7. Confirmar responsáveis, usernames GitHub e telefones fora do repositório público. Depois, repartir tarefas sem duplicar ficheiros entre agentes.
