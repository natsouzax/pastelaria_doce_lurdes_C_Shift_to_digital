# Decisões de arquitetura

Este documento regista as decisões atuais e separa o que já está especificado do que continua por resolver. O contrato da API é [docs/api.md](api.md); os fluxos de ecrã estão a ser alinhados na frente de fluxos e experiência.

## Decisões fechadas

| Área | Decisão | Registo e consequência |
| --- | --- | --- |
| Frontend | Next.js App Router, TypeScript e Tailwind; SWR quando for útil atualizar dados no cliente | A interface consome a API; regras de negócio não dependem apenas de validação no browser. |
| Backend | API REST nos Route Handlers Next.js, runtime Node.js | Validação, autorização, cálculos e transições ocorrem no servidor. |
| Base de dados | PostgreSQL no Supabase | Modelo relacional com snapshots de preço/unidade e transação segura para a capacidade diária. |
| Autenticação interna | Supabase Auth para Gestora e Produção | Perfil e estado ativo vêm do registo interno; cada rota valida a sessão e a função no servidor. Ver matriz em `api.md`. |
| Cliente sem conta | Código de seguimento aleatório, segredo de consulta de alta entropia; armazenar hash e aplicar rate limit | O endpoint público devolve apenas resumo mínimo, sem nome, telefone ou notas internas. |
| Limite diário de encomendas | Máximo de seis encomendas não canceladas por data, contando Pendentes; POST bloqueia e verifica atomicamente | Cada pedido ocupa um lugar desde a criação; cancelar liberta-o. |
| Capacidade de personalizados | Um item por bolo físico; máximo de seis por data; confirmar com sinal verifica e reserva atomicamente | Esta capacidade é distinta do limite de encomendas; canceladas libertam-na. |
| Pagamento | Registo simulado pela Gestora, em cêntimos, sem gateway/transação real | Sinal é 30% do total da encomenda quando inclui personalizado, arredondado ao euro; saldo é derivado dos pagamentos e reembolsos. |
| Produção e estados | Produção avança cada item; estados agregados da encomenda são derivados; apenas Gestora entrega | Uma encomenda fica `Pronta` quando todos os itens estão prontos. Transições e permissões estão em `api.md`. |
| Deploy | Vercel | Alvo de publicação; Docker permanece opcional. |
| Agenda | Instantes com offset, persistidos como `timestamptz`; calendário e capacidade por data local `Europe/Lisbon` | Segunda-feira é proibida. A demo usa relógio determinístico documentado em `api.md`, sem alterar produção. |

## Trabalho paralelo

Os worktrees/branches Orca estão ativos. As frentes podem avançar em paralelo usando o contrato comum e devem propor alterações de contrato em revisão antes de as implementar de forma incompatível.

- Frontend e fluxos: consumir as rotas de `api.md` e alinhar a demo nos documentos de fluxo da frente.
- Backend: implementar schema, autenticação/autorização, API, pagamentos simulados e reserva atómica da capacidade.
- Dados e integração: preparar migrações, seed, execução e documentação, sem atribuir datas históricas como se fossem originais.
- Verificação: percorrer os sete passos, incluindo permissões, prazo, segunda-feira, capacidade, pagamentos, tracking e produção.

## Decisões e dependências ainda pendentes

1. **Dossier de origem:** PDFs, critérios e XLSX foram consultados em `content_project` fora do checkout e não são versionados no Git. O catálogo (11 produtos) e a agenda (8 encomendas) coincidem com o resumo no dossier; conservar os valores originais e não copiar anexos para este PR.
2. **Datas do seed histórico:** a agenda de origem só indica dias da semana. Atribuições de datas absolutas têm de ser identificadas como inferidas e documentadas antes de integrar o seed.
3. **Sinal recebido sem vaga:** o contrato guarda o pagamento informado e bloqueia a confirmação quando a capacidade se esgota, mas não oferece alteração de data. O caso exige resolução operacional ou uma proposta de extensão de API para reagendamento/refund coordenado.
4. **Disponibilidade antes do pagamento:** `POST /api/orders` verifica a ocupação instantânea, mas não reserva vaga nem oferece uma rota de calendário/disponibilidade. A confirmação atómica é a autoridade final; a equipa deve verificar a agenda antes de instruir pagamento.
5. **Dados e acessos reais de demonstração:** definir contas fictícias de Gestora/Produção e os dados sintéticos do seed no processo de implementação; nunca colocar credenciais reais ou contactos da equipa no repositório.

O desenho técnico base (stack, modelo mínimo, estados, permissões e contrato REST) está documentado. Estes pontos pendentes não reabrem silenciosamente as decisões fechadas: uma alteração deve ficar registada e alinhada entre frontend e backend.
