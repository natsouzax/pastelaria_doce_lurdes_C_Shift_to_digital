# Plano de trabalho paralelo

Este plano acompanha os worktrees/branches Orca ativos. O contrato comum está em [api.md](api.md), as decisões de arquitetura em [arquitetura.md](arquitetura.md) e a frente de fluxos está a preparar a especificação de ecrãs e dos sete passos. As frentes devem integrar cedo e manter compatibilidade com estes documentos.

## Frentes e limites

| Frente | Responsabilidade | Limite de trabalho |
| --- | --- | --- |
| Arquitetura (`architecture-design-flow`) | Manter modelo, regras, contrato REST, permissões e decisões em sincronia; rever propostas incompatíveis | Documentação e revisão; não implementar a aplicação inteira nem alterar contrato silenciosamente. |
| Documentação e entrega (`docs-integration`) | README executável, `.env.example`, instruções de seed/demo e verificação dos entregáveis | Entregar PR; não fazer merges na `main`. |
| Dados e backend (`backend-data`) | Migrações PostgreSQL, seed fiel aos dados, API REST, cálculos, transições, capacidade e validações atómicas | Seguir campos, códigos HTTP, regras e perfis de `api.md`; sinalizar lacunas antes de divergir. |
| Fluxos e experiência (`product-flows`) | Percursos dos três perfis, mapa de ecrãs, estados e roteiro dos sete passos | Documentar fluxos; não implementar frontend nem alterar regras do servidor sem coordenação. |
| Frontend (`frontend-ui`) | Interfaces de Cliente, Gestora e Produção, responsividade, feedback e alergias | Consumir `docs/api.md` e os fluxos acordados; não duplicar regras como única validação. |
| Verificação do MVP (`mvp-verification`) | Percorrer demo, perfis/permissões, seed, instalação e URL publicado | Relatar evidência e falhas aos donos das áreas; evitar alterações concorrentes. |
| Coordenação da `main` (`main`) | Rever e integrar PRs, verificar o MVP e distribuir novas tarefas | Único agente responsável pelos merges na `main`; criar tarefas com donos e dependências e pedir correções antes de integrar. |

## Regras de integração

- Cada frente trabalha na sua branch/worktree e entrega PR para revisão; apenas a coordenação indicada integra na `main`.
- `docs/api.md` é o contrato atual de rotas, payloads, respostas, permissões e estados. Mudanças de regra requerem acordo e atualização coordenada de requisitos, contrato, backend e fluxos.
- A criação reserva um de seis lugares por data para cada encomenda não cancelada, contando Pendente, com bloqueio transacional. Separadamente, a capacidade de bolos personalizados é reservada atomicamente na confirmação após o sinal.
- O relógio da fixture da demo é determinístico (`T0` terça-feira, 2026-11-17; levantamento principal sete dias depois, 2026-11-24). Não alterar relógio nem regra de produção para fazer a demo passar.
- Os sete passos da demo têm prioridade sobre trabalho opcional. O passo 6 recusa a sétima encomenda não cancelada; a confirmação revalida a capacidade específica de bolos personalizados.
- Seed histórico deve preservar dados originais quando disponíveis. Datas completas inferidas não podem ser apresentadas como dados de origem.
- Não publicar `.env`, chaves, credenciais, dados reais de contacto ou identificadores pessoais da equipa.

## Pendências conhecidas para coordenação

1. PDFs originais, critérios e XLSX já foram conferidos em `content_project` fora do checkout; catálogo de 11 produtos e agenda de 8 encomendas coincidem com o resumo do dossier. Manter essas fontes fora do Git.
2. Confirmar e documentar datas atribuídas aos oito pedidos históricos, pois a agenda de origem indica apenas dias da semana.
3. Resolver operacionalmente o caso em que o sinal foi recebido mas a capacidade desapareceu; qualquer fluxo de reagendamento/reembolso que mude o contrato exige proposta coordenada.
4. Não há rota separada de calendário/disponibilidade e o POST não reserva vaga; antes de instruir pagamento, a Gestora verifica a agenda, e a confirmação continua a ser a reserva autoritativa.
5. Criar contas e dados exclusivamente fictícios para demonstração, sem comitar segredos.

As transições autorizadas por perfil, o fluxo de tracking e as regras de sinal/cancelamento estão especificados em `api.md`; não são itens por fechar. Orca está em uso para coordenar as frentes, não é uma dependência indisponível.
