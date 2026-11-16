# Plano de agentes para Orca — preparar prompts após fechar o contrato

Este plano define responsabilidades; ainda não é um conjunto de prompts de execução. Cada agente deve receber o dossier, os critérios, o modelo de dados e o contrato comum quando estiverem fechados. Podem criar subagentes no Codex Orchestrate/OpenCode/Codex, desde que as subtarefas permaneçam na sua área e sejam integradas pelo agente responsável.

| Agente / branch sugerida | Responsabilidade | Limite para evitar conflitos |
| --- | --- | --- |
| Arquitetura (`architecture-design-flow`) | Fechar modelo de dados, regras, contrato REST, permissões e fluxos; registar decisões e ambiguidades do dossier | Documentação e revisão de contratos; não implementar todas as frentes |
| Documentação e integração (`docs-integration`) | README executável, `.env.example`, instruções de seed/demo, verificação dos entregáveis, integração final | Não trabalhar diretamente na `main` enquanto outras frentes estão ativas; integrar por revisão |
| Dados e backend (`backend-data`) | Migrações PostgreSQL, seed fiel aos dados, API REST, cálculos, transições, capacidade e validações atómicas | Ser dono do esquema e da API; publicar contrato para frontend |
| Frontend e fluxos (`frontend-flows`) | Interfaces de Cliente, Gestora e Produção, responsividade, feedback, alergias e sete passos da demo | Consumir contrato da API; não duplicar regras como única validação |
| Verificação do MVP (`mvp-verification`) | Executar o cenário de sete passos, testar perfis/permissões, seed, instalação e URL publicado | Preferir reportar falhas e corrigir com o dono da área, para evitar alterações concorrentes |

## Integração

- `main` contém apenas versões verificadas. Cada frente parte de uma base comum e entrega uma branch para revisão.
- O contrato da API e as regras de negócio devem estar fechados antes de dividir backend e frontend.
- Cada prompt deve definir objetivo, ficheiros/área, critérios de aceitação, verificações e formato de devolução.
- Subagentes não devem publicar segredos, criar integrações externas não pedidas ou alterar decisões de negócio sem registar a proposta para revisão.

## Decisões ainda necessárias para escrever prompts executáveis

1. **Resolvido:** contam-se bolos físicos, não encomendas nem kg; `numero_bolos` separado do peso total do item.
2. Fluxo quando um sinal chega depois de a data esgotar.
3. Transições autorizadas por perfil e comportamento de cancelamento/reembolso.
4. Contrato REST e estrutura de pastas do projeto Next.js.
5. Confirmar responsáveis humanos e contas GitHub, fora do repositório público.

## Orca

Criar as branches/worktrees e lançar os agentes quando o Orca estiver acessível e o contrato estiver pronto. Nesta conversa, o comando `orca` continua indisponível; o utilizador pode abrir o projeto no Orca e aplicar os prompts finais quando forem produzidos.
