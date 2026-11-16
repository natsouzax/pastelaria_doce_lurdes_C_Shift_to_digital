# Fluxos e experiência do MVP

Este documento descreve como Cliente, Gestora e Produção percorrem o MVP, com base em `docs/requisitos.md`, `docs/modelo-dados.md`, `docs/contrato-mvp.md` e `docs/api.md` v1.0. A interface orienta e apresenta os resultados; prazo, preço, sinal, permissões, capacidade e transições são sempre validados pelo servidor.

## Princípios de interação

- O Cliente encomenda e acompanha sem conta. O código secreto de seguimento aparece uma única vez depois da criação; a página pública de acompanhamento não revela contacto nem alergias declaradas.
- Cada bolo personalizado é um item independente, com peso, mensagem, alergias e estado de produção próprios. Produtos comuns podem ter quantidade agregada na unidade do catálogo.
- Uma encomenda com bolo personalizado fica `Pendente` até à Gestora registar o sinal. `Pendente` não ocupa vaga. `POST /api/orders` verifica se há capacidade no momento da criação e recusa com `CAPACITY_FULL` se já houver seis bolos confirmados; se aceitar, não reserva vaga. Um item de bolo personalizado em encomenda confirmada ou estado posterior ocupa uma das seis vagas; cancelar liberta-a. A confirmação revalida a capacidade atomicamente.
- Ao criar o pedido, o servidor recalcula valores. O sinal é 30% do total da encomenda, arredondado ao euro mais próximo (metade para cima). O saldo é calculado a partir dos pagamentos simulados.
- Datas e horas são apresentadas e validadas em `Europe/Lisbon`. O servidor verifica a antecedência exata de cada produto e rejeita levantamento à segunda-feira.
- A Produção altera um item de cada vez. O estado agregado da encomenda é derivado: passa a `Em produção` quando algum item começa e a `Pronta` apenas quando todos estão prontos.

## Percurso do Cliente

1. **Explorar catálogo.** A página inicial mostra produtos ativos agrupados por categoria, preço, unidade de venda, alergénios e antecedência mínima. Produtos personalizados indicam que cada bolo terá a sua própria configuração.
2. **Montar encomenda.** O Cliente adiciona produtos e quantidades. Para cada bolo personalizado, a ação “Adicionar bolo personalizado” cria um cartão/subformulário independente com peso em kg, mensagem, alergias declaradas e nota de produção opcional. Duplicar um bolo cria outro item; não aumenta a quantidade do mesmo item personalizado.
3. **Escolher levantamento.** O seletor apresenta horários disponíveis conforme as indicações recebidas do sistema. A interface desativa segunda-feira e datas que não cumprem a antecedência conhecida, mas a submissão continua sujeita à validação final do servidor. Em encomendas mistas, vale o maior prazo aplicável a cada item.
4. **Validar e rever.** O resumo inclui nome, telefone, data/hora, itens, unidades, quantidades/pesos, mensagens, alergias declaradas, subtotais, total e sinal/saldo indicativos. Erros associados a itens levam o Cliente ao campo correspondente; não se apagam os valores preenchidos.
5. **Criar pedido.** O Cliente confirma a submissão. `POST /api/orders` valida os campos e verifica a capacidade atual. Se houver seis bolos já confirmados para a data, responde `CAPACITY_FULL` e não cria encomenda; a interface pede outra data. Se aceitar, cria `Pendente`, sem reservar vaga. Para encomenda com personalizado, o resumo apresenta total, sinal exigido, saldo inicial e a indicação de que ainda depende de sinal e nova verificação de capacidade na confirmação. A interface não deve orientar a pagar antes de a Gestora verificar a disponibilidade.
6. **Guardar código.** O ecrã de sucesso apresenta o código de seguimento integralmente, com ação de copiar e instrução para o guardar. Não se promete recuperar o código. Também há ligação direta para consultar o pedido nesta sessão.
7. **Acompanhar sem conta.** O Cliente introduz o código em “Acompanhar pedido”. O resumo público mostra estado, levantamento, itens, mensagem, estado individual de produção, total, valor pago e saldo. Não mostra nome, telefone, notas internas, alergias declaradas completas nem pagamentos detalhados.

Se a capacidade já estiver esgotada ao submeter, a criação falha com `CAPACITY_FULL`; o Cliente escolhe outra data e envia novamente. Se um pedido aceite ficar Pendente e a capacidade se esgotar antes de registar o sinal, a nova tentativa de confirmação com `external_payment_received:false` falha sem guardar pagamento e sem reservar vaga; a Gestora orienta para uma nova data. A alteração de data não existe na API atual, por isso a equipa cancela o Pendente e pede ao Cliente que crie outro pedido. Se o sinal externo já tiver sido recebido quando a capacidade se perder, não se pede novo pagamento: a Gestora vê `CAPACITY_LOST_AFTER_PAYMENT` e encaminha para reagendamento operacional ou reembolso simulado.

## Percurso da Gestora no telemóvel

### Pedidos e disponibilidade

1. A Gestora entra pela autenticação interna e abre o painel “Pedidos”. O ecrã inicial prioriza pedidos `Pendente`; filtros rápidos levam a Confirmados, Em produção, Prontos e Cancelados.
2. Cada cartão de pedido mostra levantamento, nome/contacto, estado, itens, total, sinal exigido, valor pago e saldo. Ações disponíveis dependem do estado e da resposta da API.
3. A vista “Agenda” agrupa por data e mostra ocupação de bolos personalizados como número de itens físicos confirmados sobre seis. Pedidos Pendentes aparecem numa lista separada e não incrementam ocupação. O valor mostrado é indicativo e sujeito à confirmação atómica no servidor.
4. Antes de pedir ao Cliente que pague o sinal, a Gestora verifica a agenda. O `POST /api/orders` já recusou uma data cheia quando o pedido foi criado, mas um Pendente não reserva a vaga; outra confirmação pode ocupá-la entretanto. A agenda é indicativa, e a confirmação com sinal revalida capacidade atomicamente. A interface não deve apresentar a aceitação do pedido Pendente como garantia de vaga.

### Sinal, confirmação e saldo

5. No detalhe de um pedido personalizado, “Registar sinal” sugere o valor exigido já calculado. A Gestora regista o valor efetivamente recebido e confirma a ação; para o caso demonstrativo são 17 € num total de 56 €. O registo é simulado, não cobra dinheiro.
6. O backend tenta registar o sinal, revalidar capacidade e confirmar na mesma transação. Em sucesso, o estado passa a `Confirmada`, a vaga é ocupada e o saldo fica 39 €. Se a vaga desaparecer antes de o pagamento externo ter sido recebido, a operação falha com `CAPACITY_FULL` sem registar pagamento. Se o pagamento já tiver sido efetivamente recebido, a interface informa que foi registado, mas a encomenda ficou sem vaga (`CAPACITY_LOST_AFTER_PAYMENT`); bloqueia nova tentativa de pagamento e orienta para reagendamento operacional ou reembolso simulado.
7. Pedidos sem bolo personalizado são confirmados por ação explícita da Gestora; não exigem sinal pela regra v1. Registar sinal em encomenda sem personalizado é inválido.
8. Para saldo, a Gestora abre “Registar restante”, vê o montante em falta e regista o valor recebido. A entrega fica disponível apenas quando o pedido está `Pronta` e o saldo líquido é zero.

### Cancelar e entregar

- “Cancelar” pede uma razão curta e mostra a consequência financeira calculada pelo servidor antes de concluir. Com pelo menos 48 horas para o levantamento, a API simula o reembolso do sinal se não houver pagamentos adicionais; menos de 48 horas, não cria reembolso do sinal. A capacidade é libertada no cancelamento.
- Se houver pagamento adicional que impeça o reembolso automático previsto no contrato, apresentar resolução manual requerida; não fazer cancelamento parcial silencioso.
- “Marcar entregue” só aparece para pedido `Pronta` com saldo zero. A Gestora confirma a ação e o estado passa a `Entregue`.
- Encomenda entregue é terminal. O cancelamento pode ser iniciado antes da entrega, conforme as regras do contrato.

## Percurso da Produção no tablet

1. A Produção autentica-se e escolhe uma data na agenda diária. A lista inclui apenas encomendas Confirmadas e estados seguintes, agrupadas por dia e ordenadas pela hora de levantamento.
2. Cada encomenda expande-se para cartões por item. Em cada bolo, alergias declaradas pelo Cliente e alergénios do produto surgem em blocos separados e com destaque visual. Mensagem do bolo e notas de produção também ficam visíveis junto do item a que pertencem.
3. Em cada cartão, a Produção avança `A fazer` → `Em produção` → `Pronto`, uma ação por vez. A ação afeta apenas aquele item. Ao começar o primeiro item, o estado agregado torna-se `Em produção`.
4. O estado agregado só passa a `Pronta` quando todos os itens da encomenda estiverem `Pronto`; itens já prontos mantêm o estado enquanto os outros avançam. A Produção não regista pagamentos, não cancela e não marca Entregue.

## Mapa de ecrãs e navegação

```text
Público / Cliente
  Catálogo → Cesto e formulários por item → Levantamento → Rever → Sucesso + código
      └────────────────────────────── Acompanhar pedido (introduzir código) → Estado

Gestora (telemóvel, sessão interna)
  Pedidos (Pendentes | Confirmados | Em produção | Prontos | Cancelados)
    → Detalhe do pedido → Registar sinal/restante | Cancelar | Marcar entregue
  Agenda → Data → Ocupação confirmada + pedidos pendentes separados → Detalhe

Produção (tablet, sessão interna)
  Produção → Data → Lista de encomendas → Encomenda → Cartões individuais dos itens
                                                   └→ A fazer → Em produção → Pronto
```

### Estados de interface

| Contexto | Carregamento | Vazio | Sucesso | Erro e recuperação |
| --- | --- | --- | --- | --- |
| Catálogo | Cartões-esqueleto; filtros utilizáveis depois dos dados | “Ainda não há produtos disponíveis.” | Produto adicionado ao cesto com atualização do total | Erro ao carregar: “Não foi possível carregar o catálogo.” Ação “Tentar novamente”. |
| Cesto/formulário | Rever bloqueado enquanto se recalcula | “Adicione um produto para começar.” | Valores preservados ao avançar | Validação inline; levar ao primeiro campo inválido, sem limpar os restantes. |
| Submissão | Botão bloqueado e indicador “A criar pedido…” | — | Mostrar código uma vez, estado Pendente e valores finais do servidor | Prazo/segunda-feira/capacidade: manter o formulário e a data selecionada; mensagem específica. Erro de rede: permitir nova tentativa sem afirmar que o pedido foi criado. |
| Seguimento | “A procurar pedido…” | “Ainda não consultou nenhum pedido.” | Mostrar estado e resumo mínimo | Código desconhecido e inválido usam a mesma mensagem. Limite excedido: esperar antes de tentar novamente. |
| Gestora — lista/agenda | Esqueleto da lista; conservar filtros/data | “Não há pedidos para esta data.” Pedidos Pendentes têm vazio separado | Atualizar estado e contadores depois da resposta do servidor | Sem sessão: entrar novamente. Sem permissão: informar e retirar ação. Falha de rede: manter os dados visíveis como desatualizados e oferecer recarga. |
| Pagamento/cancelamento/entrega | Ação desativada durante o envio | — | Mostrar estado, pago e saldo devolvidos pela API | Mostrar erro de negócio sem duplicar submissão; usar chave de idempotência no pedido. `CAPACITY_LOST_AFTER_PAYMENT` tem tratamento próprio abaixo. |
| Produção | Esqueleto por encomenda/item | “Sem encomendas confirmadas para este dia.” | Atualizar só o cartão acionado e o estado agregado | Conflito de estado: atualizar lista e explicar que outro utilizador alterou o item. Sem permissão: ocultar/recusar ação. |

## Textos curtos de interface

| Situação | Texto |
| --- | --- |
| Prazo insuficiente | “Esta data não cumpre a antecedência mínima. Escolha uma data posterior.” |
| Levantamento à segunda-feira | “Não fazemos levantamentos à segunda-feira. Escolha outro dia.” |
| Capacidade cheia ao criar pedido | “Esta data já não tem vagas para bolos personalizados. Nenhum pedido foi criado. Escolha outra data.” |
| Capacidade perdida antes de registar pagamento | “A data ficou sem vagas antes de confirmar o pedido. Não pague o sinal. Contacte a Gestora para escolher outra data.” |
| Capacidade perdida após pagamento externo | “O sinal foi registado, mas a data ficou sem vaga antes da confirmação. Não pague novamente. A Gestora vai contactar para reagendar ou tratar o reembolso.” |
| Código inválido/não encontrado | “Não encontrámos um pedido com este código. Confirme-o e tente novamente.” |
| Ação sem permissão | “Não tem permissão para esta ação. Entre com o perfil adequado ou contacte a Gestora.” |
| Pedido criado, confirmação pendente | “Pedido recebido. Ainda não está confirmado nem reserva uma vaga. Aguarde a Gestora verificar a data antes de pagar o sinal.” |
| Saldo por pagar ao tentar entregar | “Registe o valor em falta antes de marcar a encomenda como entregue.” |
| API indisponível | “Não foi possível concluir agora. Os dados continuam preenchidos; tente novamente.” |

As mensagens públicas de seguimento para código válido/inválido não devem expor contacto ou permitir inferir existência do pedido. O texto e a resposta HTTP devem preservar o comportamento indistinguível definido para `NOT_FOUND` e aplicar os limites de tentativas do contrato.

## Roteiro exato da demonstração em sete passos

### Fixture temporal e de dados

- Usar relógio de demonstração fixado em **terça-feira T0, 17-11-2026 às 10:00, `Europe/Lisbon`**. O levantamento do primeiro pedido é **T0 + 7 dias: terça-feira 24-11-2026 às 10:00**. Esta fixture torna o cenário reproduzível e evita a segunda-feira real de 23-11-2026; não muda o relógio nem as regras de produção.
- Produto do catálogo original: `Bolo de aniversário personalizado (chocolate)`, ativo, 28 €/kg, alergénios “Glúten, ovo, leite” e antecedência de 5 dias. Peso individual: 2 kg. Total esperado: 56 € (5 600 cêntimos); sinal: 17 € (1 700 cêntimos); saldo: 39 € (3 900 cêntimos). Nome e telefone são obrigatórios no formulário, mas não são fornecidos pelo cenário; usar apenas dados de contacto fictícios de teste, identificados como tal.
- O dossier, os critérios, o PDF de dados e a folha Excel foram consultados em `C:/Users/natan/orca/pastelaria_doce_lurdes/content_project`; as fontes originais não são versionadas neste checkout. O catálogo confirmado tem 11 produtos e a agenda 8 encomendas. A agenda só dá dias da semana, sem datas absolutas; não se atribuem datas aos registos históricos. As cinco encomendas extra do cenário de capacidade ficam identificadas como fixture de demonstração, sem alterar o seed original.
- Para o passo 6 são necessários **cinco itens de bolo personalizado adicionais** para a mesma data de 24-11-2026, além do bolo do passo 1 já confirmado. Antes de testar o bloqueio, a agenda precisa mostrar seis itens personalizados reservados por encomendas não canceladas em estados Confirmada, Em produção, Pronta ou Entregue. Os cinco itens devem ser identificados como dados extra da demonstração, com pagamentos/situações coerentes; não inventar que pertencem ao seed original. Se houver limite de seis por item, não basta criar seis encomendas sem itens.
- Um segundo conjunto de entrada, para o passo 2, usa o mesmo produto e levantamento T0 + 2 dias (quinta-feira 19-11-2026 às 10:00); falha apenas por antecedência, sem colidir com o teste de segunda-feira. O passo 3 usa levantamento na segunda-feira 23-11-2026 às 10:00.

| Passo | Dados de entrada | Ecrã | Ação | Resultado esperado |
| --- | --- | --- | --- | --- |
| 1. Pedido personalizado | Produto original `Bolo de aniversário personalizado (chocolate)`; 2 kg; mensagem “Parabéns Inês”; alergia declarada “frutos secos”; levantamento 24-11-2026 10:00; preço 28 €/kg. Nome e telefone são campos obrigatórios mas não constam deste passo oficial: usar valores de teste claramente fictícios, sem os atribuir ao dossier. | Cliente: catálogo → formulário do bolo → levantamento → revisão | Submeter pedido | `201`; pedido `Pendente`, total 56 €, sinal exigido 17 €, saldo 56 €, `capacity_reserved:false`; mostrar código aleatório uma única vez e instrução para aguardar a Gestora antes de pagar. |
| 2. Prazo insuficiente | Mesmo produto; levantamento 19-11-2026 10:00 (T0 + 2 dias, quinta-feira) | Cliente: revisão/resultado da validação | Submeter | Servidor rejeita com `PICKUP_TOO_SOON`; texto de prazo insuficiente; formulário e dados mantidos; nenhum pedido criado. |
| 3. Segunda-feira | Mesmo produto; levantamento 23-11-2026 10:00 (segunda-feira) | Cliente: seletor de levantamento/resultado da validação | Tentar escolher/submeter a data, inclusive por pedido adulterado | Interface desativa a segunda-feira; se chegar ao servidor, `MONDAY_PICKUP`; mensagem específica; nenhum pedido criado. |
| 4. Sinal e confirmação | ID do pedido do passo 1; registo simulado de sinal recebido de 1 700 cêntimos; menos de seis itens personalizados confirmados tanto no momento da criação como imediatamente antes da confirmação | Gestora: Pendentes → detalhe → registar sinal | Registar sinal efetivamente recebido | Uma operação atómica regista o sinal, revalida e reserva uma vaga e muda o pedido para `Confirmada`; pago 17 €, saldo 39 €. Se a vaga se perder após pagamento externo, tratar pela exceção separada abaixo, sem repetir pagamento. |
| 5. Produção e alergia | Pedido confirmado do passo 1; produto `Bolo de aniversário personalizado (chocolate)`; alergia declarada “frutos secos”; alergénios do produto “Glúten, ovo, leite” | Produção: 24-11-2026 → lista diária → cartão do item | Abrir a lista diária e inspecionar o cartão | Pedido aparece agrupado pelo dia; alergia declarada e alergénios do produto aparecem em campos separados e bem visíveis, como pede o dossier. |
| 6. Capacidade cheia | Data 24-11-2026 com seis itens personalizados confirmados (bolo do passo 1 + cinco itens adicionais apenas para esta demonstração); novo pedido de `Bolo de aniversário personalizado (chocolate)`, 1 kg a 28 €/kg, sinal calculado de 8 € (800 cêntimos), levantamento na mesma data | Cliente: catálogo → formulário → levantamento → resultado | Submeter o novo pedido quando a agenda já tem seis itens personalizados confirmados | `POST /api/orders` responde `409 CAPACITY_FULL` e não cria pedido. A interface informa que a data está cheia e pede outra data. Esta é a recusa exigida no cenário oficial; os pedidos que passam no pré-check continuam Pendente e não reservam vaga. |
| 7. Consulta, conclusão, restante e entrega | Código do passo 1; item do bolo; restante de 3 900 cêntimos; saldo final zero | Cliente: acompanhamento; Produção: lista diária e cartão; Gestora: detalhe do pedido | Consultar pelo código; Produção avança o item `A fazer` → `Em produção` → `Pronto`; Gestora regista restante de 39 € e marca Entregue | Seguimento mostra estado sem dados de contacto. Como todos os itens deste exemplo ficam prontos, estado agregado torna-se `Pronta`; depois do restante, saldo zero e Gestora pode marcar `Entregue`. Para demonstrar o bloqueio agregado numa encomenda com vários itens, é necessário acrescentar outro item e deixá-lo por concluir até ao fim do primeiro. |

**Corrida de capacidade (teste separado do passo oficial 6):** usar o pedido de 2 kg do passo 1, criado quando há menos de seis itens confirmados; antes de confirmar, confirmar outros pedidos até ocupar as seis vagas. Se o sinal ainda não foi pago fora do sistema, a Gestora tenta registar o sinal exigido de 17 € com `{"kind":"deposit","amount_cents":1700,"external_payment_received":false,"note":null}`; a API deve devolver `409 CAPACITY_FULL`, sem guardar pagamento ou confirmar. Se o sinal de 17 € já foi efetivamente recebido fora do sistema, usar o mesmo corpo com `external_payment_received:true`; a API regista o pagamento, mantém o pedido Pendente com resolução necessária e devolve `409 CAPACITY_LOST_AFTER_PAYMENT`. Não pedir novo pagamento; a Gestora encaminha para reagendamento operacional ou reembolso simulado. A API não tem rota para editar a data, pelo que a solução operacional atual é cancelar o Pendente e criar outro pedido para a data acordada.

## Esboços de baixa fidelidade

Os esboços aplicam duas limitações explícitas do dossier: a Gestora trabalha pelo telemóvel e precisa de ações rápidas, em um ou dois toques; a Produção usa um tablet lido à distância, por isso a lista deve usar letra grande e alergias impossíveis de ignorar.

### Cliente — telemóvel, encomenda

```text
┌──────────────────────────┐
│ Doce Lurdes     [Cesto 2]│
├──────────────────────────┤
│ Catálogo                 │
│ Bolo aniversário chocolate│
│ 28 €/kg · alergénios:    │
│ glúten, ovo, leite        │
│ Alergénios: …            │
│ [Adicionar bolo]         │
├──────────────────────────┤
│ Bolo personalizado #1    │
│ Peso (kg)       [2,000]  │
│ Mensagem        [______] │
│ Alergias        [______] │
│ Nota produção  [opcional]│
│ Subtotal          56,00 €│
│ [+ Adicionar outro bolo] │
├──────────────────────────┤
│ Levantamento             │
│ [24/11/2026] [10:00  v]  │
├──────────────────────────┤
│ Total             56,00 €│
│ Sinal             17,00 €│
│ [Rever e enviar pedido]  │
└──────────────────────────┘
```

### Gestora — telemóvel

```text
┌──────────────────────────┐
│ Pedidos   Agenda   Conta │
├──────────────────────────┤
│ Pendentes (3)            │
│ 24 nov · Inês            │
│ Bolo chocolate · 2 kg    │
│ Total 56 €  Sinal 17 €   │
│ Ocupação confirmada: 1/6 │
│ [Abrir pedido]           │
├──────────────────────────┤
│ Detalhe                  │
│ Estado: Pendente         │
│ Pago 0 € · Saldo 56 €    │
│ Data: 24 nov, 10:00      │
│ [Registar sinal: 17 €]   │
│ [Cancelar pedido]        │
└──────────────────────────┘
```

### Produção — tablet

```text
┌─────────────────────────────────────────────────────────────┐
│ Produção     [‹ Dia anterior]  24 nov 2026  [Dia seguinte ›]│
├─────────────────────────────────────────────────────────────┤
│ 10:00 · Pedido #… · Confirmada                              │
│ ┌───────────────────────────┐ ┌───────────────────────────┐ │
│ │ Bolo chocolate · 2 kg     │ │ Outro item da encomenda   │ │
│ │ Mensagem: Parabéns Inês   │ │ Estado: A fazer           │ │
│ │ ⚠ Alergia declarada:      │ │ [Iniciar produção]        │ │
│ │   frutos secos            │ └───────────────────────────┘ │
│ │ Alergénios do produto:    │                               │
│ │ Glúten, ovo, leite        │                               │
│ │ Estado: A fazer           │                               │
│ │ [Iniciar produção]        │                               │
│ └───────────────────────────┘                               │
├─────────────────────────────────────────────────────────────┤
│ Encomenda: Confirmada → Em produção → Pronta (todos itens) │
└─────────────────────────────────────────────────────────────┘
```

## Dependências de implementação

### Frontend

- Catálogo e cesto com formulário separado para cada bolo personalizado; conversão e apresentação de preço/unidade coerentes com o contrato.
- Seletor de levantamento em `Europe/Lisbon`, validações de usabilidade sem substituir validações do servidor, resumo e preservação dos campos em erros.
- Ecrã de sucesso que revela e ajuda a copiar o código uma vez; seguimento público de dados mínimos e comportamento indistinguível para código inválido/inexistente.
- Painel da Gestora com Pendentes separados da ocupação, agenda indicativa, registo simulado de sinal/restante, saldo, cancelamento/reembolso, exceção após pagamento e entrega.
- Tablet de Produção com agrupamento por dia, alergias e alergénios visivelmente separados, transições independentes por item e estado agregado inequívoco.
- Estados de carregamento, vazio, sucesso, erro, sem sessão, sem permissão, conflito e limite de tentativas; impedir duplo envio de operações monetárias e fornecer `Idempotency-Key` conforme contrato.

### Backend/API

- Implementar integralmente rotas e códigos de erro em `docs/api.md`: validação de prazo, segunda-feira, unidade, preço, sinal, saldo, permissões e transições no servidor.
- Garantir confirmação e reserva atómica por data, contagem de cada item personalizado, sem contar Pendentes e libertando vaga ao cancelar; expor capacidade/resolução nos payloads da Gestora sem prometer pré-reserva.
- `CAPACITY_LOST_AFTER_PAYMENT` precisa manter o pedido Pendente, guardar o pagamento externo uma só vez, marcar resolução pendente e devolver orientação; a interface não deve solicitar pagamento repetido.
- Produção deve aceitar mudança por item e recalcular o estado agregado na mesma transação; proteger operações de pagamento contra duplicação e aplicar política de cancelamento/reembolso do contrato.
- Limitar dados de tracking, gerar/validar código de alta entropia, guardar apenas hash, aplicar rate limit e devolver resultado não enumerável para código desconhecido.
- A decisão mais recente da arquitetura define pré-verificação de capacidade em `POST /api/orders` (`409 CAPACITY_FULL`, sem criar pedido), sem reserva para pedidos aceites e com nova verificação atómica ao confirmar. Esta decisão complementa o contrato/API v1 atualmente publicado; o agente de arquitetura/backend deve atualizar `docs/contrato-mvp.md` e `docs/api.md` antes da implementação para manter o contrato partilhado coerente.
- Não existe uma rota separada para consultar disponibilidade: a criação do pedido faz a pré-verificação, e a confirmação revalida atomicamente. A API também não tem rota para editar a data. O contrato v1 publicado precisa de ser atualizado com a decisão de pré-verificação antes de a interface e o backend serem implementados.

## Escolhas menores e motivos

- Agrupar o catálogo por categoria e manter resumo persistente do cesto: reduz procura e evita que a pessoa perca o que já preencheu.
- Mostrar alergias declaradas e alergénios do produto em blocos separados: são dados com origens e significados diferentes, conforme modelo/API.
- Usar ações simples por item na Produção e não botões por encomenda: evita marcar todos os bolos como iniciados/prontos por engano.
- Separar pedidos Pendentes da contagem de ocupação na Agenda: torna a regra “Pendente não reserva” visível para a Gestora e reduz promessas indevidas ao Cliente.
- Exibir o saldo como valor derivado pelo servidor e manter estados de carregamento/erro sem limpar o formulário: previne totais divergentes e facilita recuperação.

## Alinhamento e ambiguidades registadas

- O agente de arquitetura decidiu que a criação pública faz pré-verificação de capacidade: com seis itens confirmados, `POST /api/orders` devolve `CAPACITY_FULL` sem criar pedido; aceites ficam Pendentes sem reserva e revalidam capacidade atomicamente na confirmação. O caso de perda após sinal externo continua como teste separado (`CAPACITY_LOST_AFTER_PAYMENT`). A API v1 publicada ainda precisa ser atualizada pelo agente responsável pelo contrato.
- O agente confirmou o uso de fixture de relógio de demonstração numa terça-feira (T0) com levantamento T0 + 7 dias. A regra de produção permanece baseada no relógio real do servidor.
- A pré-verificação é feita em `POST /api/orders`, sem rota separada de disponibilidade; a edição da data continua fora da API. O contrato v1 publicado precisa de refletir a decisão de arquitetura.
- Dossier, critérios e fonte de dados foram lidos de `content_project`, fora deste checkout. A agenda tem oito encomendas sem datas absolutas; não foram atribuídas datas aos dados originais nem copiados contactos pessoais para a demo.
