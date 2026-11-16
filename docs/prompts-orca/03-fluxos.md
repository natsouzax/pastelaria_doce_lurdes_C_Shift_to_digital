# Prompt — agente de fluxos e experiência

Trabalha numa branch própria `product-flows`, criada a partir de `architecture-design-flow`. Lê `docs/requisitos.md`, `docs/modelo-dados.md`, `docs/contrato-mvp.md`, o dossier do Cliente C e os critérios de avaliação quando disponíveis. Coordena dúvidas de API com o agente de arquitetura. O teu trabalho é definir **como as pessoas percorrem a aplicação**, antes da implementação da interface. Não programes o frontend nem alteres o modelo de dados ou o contrato REST por conta própria.

Produz `docs/fluxos.md` com:

1. Percurso do Cliente: catálogo → vários itens, com um subformulário por bolo personalizado → escolha de levantamento → validações e total/sinal → pedido Pendente → código de seguimento → consulta sem conta.
2. Percurso da Gestora no telemóvel: pedidos pendentes, disponibilidade, registo de sinal simulado, confirmação, saldo, cancelamento e entrega. Um pedido Pendente não reserva vaga. Se a data esgotar antes de pagar, mostrar a situação claramente e orientar para outra data/reembolso conforme o caso.
3. Percurso da Produção no tablet: lista por dia, alergias declaradas e alergénios visíveis, início e conclusão **individual de cada item**. Uma encomenda só fica Pronta depois de todos os itens estarem prontos.
4. Mapa de ecrãs e navegação; estados vazios, carregamento, sucesso e erros; textos curtos para prazo insuficiente, segunda-feira, capacidade esgotada, código inválido e ação sem permissão.
5. Roteiro exato dos sete passos do cenário oficial, com dados de entrada, ecrã, ação e resultado esperado; indicar que dados adicionais são necessários para demonstrar o dia com seis bolos.
6. Esboços de baixa fidelidade em Markdown ou diagramas simples para telemóvel da Gestora, tablet da Produção e encomenda do Cliente. Prioriza clareza e rapidez de uso.

Resolve escolhas menores com bom senso e regista a razão. Se uma ambiguidade afetar a regra de negócio ou a API, documenta-a e comunica ao agente de arquitetura; não inventes uma regra definitiva. Podes criar subagentes para rever percursos dos três perfis e reunir os resultados. Faz commit/push na tua branch e entrega uma lista curta do que o frontend e o backend precisam de implementar.
