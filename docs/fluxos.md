# Fluxos e experiência do MVP

Este documento descreve como Cliente, Gestora e Produção percorrem o MVP, com base em `docs/requisitos.md`, `docs/modelo-dados.md`, `docs/contrato-mvp.md` e `docs/api.md` v1.0. A interface orienta e apresenta os resultados; prazo, preço, sinal, permissões, capacidade e transições são sempre validados pelo servidor.

## Princípios de interação

- O Cliente encomenda e acompanha sem conta. O código secreto de seguimento aparece uma única vez depois da criação; a página pública de acompanhamento não revela contacto nem alergias declaradas.
- Cada bolo personalizado é um item independente, com peso, mensagem, alergias e estado de produção próprios. Produtos comuns podem ter quantidade agregada na unidade do catálogo.
- Uma encomenda com bolo personalizado fica `Pendente` até à Gestora registar o sinal. `Pendente` não ocupa vaga. Um item de bolo personalizado em encomenda confirmada ou estado posterior ocupa uma das seis vagas; cancelar liberta-a.
- Ao criar o pedido, o servidor recalcula valores. O sinal é 30% do total da encomenda, arredondado ao euro mais próximo (metade para cima). O saldo é calculado a partir dos pagamentos simulados.
- Datas e horas são apresentadas e validadas em `Europe/Lisbon`. O servidor verifica a antecedência exata de cada produto e rejeita levantamento à segunda-feira.
- A Produção altera um item de cada vez. O estado agregado da encomenda é derivado: passa a `Em produção` quando algum item começa e a `Pronta` apenas quando todos estão prontos.

## Percurso do Cliente

1. **Explorar catálogo.** A página inicial mostra produtos ativos agrupados por categoria, preço, unidade de venda, alergénios e antecedência mínima. Produtos personalizados indicam que cada bolo terá a sua própria configuração.
2. **Montar encomenda.** O Cliente adiciona produtos e quantidades. Para cada bolo personalizado, a ação “Adicionar bolo personalizado” cria um cartão/subformulário independente com peso em kg, mensagem, alergias declaradas e nota de produção opcional. Duplicar um bolo cria outro item; não aumenta a quantidade do mesmo item personalizado.
3. **Escolher levantamento.** O seletor apresenta horários disponíveis conforme as indicações recebidas do sistema. A interface desativa segunda-feira e datas que não cumprem a antecedência conhecida, mas a submissão continua sujeita à validação final do servidor. Em encomendas mistas, vale o maior prazo aplicável a cada item.
4. **Validar e rever.** O resumo inclui nome, telefone, data/hora, itens, unidades, quantidades/pesos, mensagens, alergias declaradas, subtotais, total e sinal/saldo indicativos. Erros associados a itens levam o Cliente ao campo correspondente; não se apagam os valores preenchidos.
5. **Criar pedido.** O Cliente confirma a submissão. `POST /api/orders` valida os campos e cria `Pendente`, sem reservar capacidade. Para encomenda com personalizado, o resumo de sucesso apresenta total, sinal exigido, saldo inicial e a indicação de que a confirmação depende de sinal e vaga. A interface não deve orientar a pagar antes de a Gestora verificar a disponibilidade.
6. **Guardar código.** O ecrã de sucesso apresenta o código de seguimento integralmente, com ação de copiar e instrução para o guardar. Não se promete recuperar o código. Também há ligação direta para consultar o pedido nesta sessão.
7. **Acompanhar sem conta.** O Cliente introduz o código em “Acompanhar pedido”. O resumo público mostra estado, levantamento, itens, mensagem, estado individual de produção, total, valor pago e saldo. Não mostra nome, telefone, notas internas, alergias declaradas completas nem pagamentos detalhados.

Se a capacidade se esgotar antes do registo do sinal, o pedido continua sem vaga e não pode ser confirmado. A equipa deve contactar o Cliente para combinar uma nova data ou cancelar; a alteração de data não existe na API v1. Se um pagamento externo já tiver sido recebido quando a capacidade se perder, não se pede novo pagamento: a Gestora vê a resolução pendente e encaminha para reagendamento operacional ou reembolso simulado, conforme o caso. A API v1 regista essa exceção como `CAPACITY_LOST_AFTER_PAYMENT`; não oferece edição de data.

## Percurso da Gestora no telemóvel

### Pedidos e disponibilidade

1. A Gestora entra pela autenticação interna e abre o painel “Pedidos”. O ecrã inicial prioriza pedidos `Pendente`; filtros rápidos levam a Confirmados, Em produção, Prontos e Cancelados.
2. Cada cartão de pedido mostra levantamento, nome/contacto, estado, itens, total, sinal exigido, valor pago e saldo. Ações disponíveis dependem do estado e da resposta da API.
3. A vista “Agenda” agrupa por data e mostra ocupação de bolos personalizados como número de itens físicos confirmados sobre seis. Pedidos Pendentes aparecem numa lista separada e não incrementam ocupação. O valor mostrado é indicativo e sujeito à confirmação atómica no servidor.
4. Antes de pedir ao Cliente que pague o sinal, a Gestora verifica a agenda e confirma que há vaga. A API v1 não tem rota de pré-verificação; a Gestora usa a agenda/lista operacional e deve tratar a confirmação da rota de pagamento como autoridade final. A interface não deve apresentar a vaga indicativa como garantia.

### Sinal, confirmação e saldo

5. No detalhe de um pedido personalizado, “Registar sinal” sugere o valor exigido já calculado. A Gestora regista o valor efetivamente recebido e confirma a ação; para o caso demonstrativo são 17 € num total de 56 €. O registo é simulado, não cobra dinheiro.
6. O backend regista o sinal e tenta reservar capacidade e confirmar na mesma transação. Em sucesso, o estado passa a `Confirmada`, a vaga é ocupada e o saldo fica 39 €. Se a data ficar cheia antes da confirmação, a interface informa que o pagamento foi registado, mas o pedido ficou sem vaga (`CAPACITY_LOST_AFTER_PAYMENT`); bloqueia nova tentativa de pagamento e cria orientação para contacto, reembolso simulado ou reagendamento operacional. A alteração de data é fora da API v1.
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
| Capacidade cheia antes de registar pagamento | “A data já não tem vagas para bolos personalizados. O pedido continua sem confirmação. Contacte a pastelaria para escolher outra data ou cancelar.” |
| Capacidade perdida após pagamento externo | “O sinal foi registado, mas a data ficou sem vaga antes da confirmação. Não pague novamente. A Gestora vai contactar para reagendar ou tratar o reembolso.” |
| Código inválido/não encontrado | “Não encontrámos um pedido com este código. Confirme-o e tente novamente.” |
| Ação sem permissão | “Não tem permissão para esta ação. Entre com o perfil adequado ou contacte a Gestora.” |
| Pedido criado, confirmação pendente | “Pedido recebido. Ainda não está confirmado nem reserva uma vaga. Aguarde a confirmação da Gestora antes de pagar o sinal.” |
| Saldo por pagar ao tentar entregar | “Registe o valor em falta antes de marcar a encomenda como entregue.” |
| API indisponível | “Não foi possível concluir agora. Os dados continuam preenchidos; tente novamente.” |

As mensagens públicas de seguimento para código válido/inválido não devem expor contacto ou permitir inferir existência do pedido. O texto e a resposta HTTP devem preservar o comportamento indistinguível definido para `NOT_FOUND` e aplicar os limites de tentativas do contrato.

## Roteiro exato da demonstração em sete passos

### Fixture temporal e de dados

- Usar relógio de demonstração fixado em **terça-feira T0, 17-11-2026 às 10:00, `Europe/Lisbon`**. O levantamento do primeiro pedido é **T0 + 7 dias: terça-feira 24-11-2026 às 10:00**. Esta fixture torna o cenário reproduzível e evita a segunda-feira real de 23-11-2026; não muda o relógio nem as regras de produção.
- Produto: `Bolo personalizado de chocolate`, ativo, preço 28 €/kg e unidade `kg`. Peso individual: 2 kg. Total esperado: 56 € (5 600 cêntimos); sinal: 17 € (1 700 cêntimos); saldo: 39 € (3 900 cêntimos). Usar contacto fictício `+351000000000`.
- Os anexos do dossier do Cliente C e os critérios oficiais não estão versionados neste checkout; `README.md` diz que as fontes originais ficam fora do repositório. Portanto este roteiro usa apenas os valores disponíveis em `docs/requisitos.md` e no contrato v1, sem reconstruir o catálogo de 11 produtos nem as oito encomendas históricas.
- Para o passo 6 são necessários **cinco itens de bolo personalizado adicionais** para a mesma data de 24-11-2026, além do bolo do passo 1 já confirmado. Antes de testar o bloqueio, a agenda precisa mostrar seis itens personalizados reservados por encomendas não canceladas em estados Confirmada, Em produção, Pronta ou Entregue. Os cinco itens devem ser identificados como dados extra da demonstração, com pagamentos/situações coerentes; não inventar que pertencem ao seed original. Se houver limite de seis por item, não basta criar seis encomendas sem itens.
- Um segundo conjunto de entrada, para o passo 2, usa o mesmo produto e levantamento T0 + 2 dias (quinta-feira 19-11-2026 às 10:00); falha apenas por antecedência, sem colidir com o teste de segunda-feira. O passo 3 usa levantamento na segunda-feira 23-11-2026 às 10:00.

| Passo | Dados de entrada | Ecrã | Ação | Resultado esperado |
| --- | --- | --- | --- | --- |
| 1. Pedido personalizado | Cliente Inês; telefone fictício `+351000000000`; bolo de chocolate personalizado, 2 kg; mensagem “Parabéns Inês”; alergia declarada “frutos secos”; levantamento 24-11-2026 10:00; preço 28 €/kg | Cliente: catálogo → formulário do bolo → levantamento → revisão | Submeter pedido | `201`; pedido `Pendente`, total 56 €, sinal exigido 17 €, saldo 56 €, `capacity_reserved:false`; mostrar código aleatório uma única vez e instrução de aguardar a Gestora antes de pagar. |
| 2. Prazo insuficiente | Mesmo produto; levantamento 19-11-2026 10:00 (T0 + 2 dias, quinta-feira) | Cliente: revisão/resultado da validação | Submeter | Servidor rejeita com `PICKUP_TOO_SOON`; texto de prazo insuficiente; formulário e dados mantidos; nenhum pedido criado. |
| 3. Segunda-feira | Mesmo produto; levantamento 23-11-2026 10:00 (segunda-feira) | Cliente: seletor de levantamento/resultado da validação | Tentar escolher/submeter a data, inclusive por pedido adulterado | Interface desativa a segunda-feira; se chegar ao servidor, `MONDAY_PICKUP`; mensagem específica; nenhum pedido criado. |
| 4. Sinal e confirmação | ID do pedido do passo 1; registo simulado de sinal recebido de 1 700 cêntimos; agenda com menos de seis itens confirmados antes da operação | Gestora: Pendentes → detalhe → registar sinal | Registar sinal efetivamente recebido | Uma operação atómica regista o sinal, reserva uma vaga e muda o pedido para `Confirmada`; pago 17 €, saldo 39 €. Se a capacidade se perder concorrentemente após pagamento externo, demonstrar a exceção do passo 6 e não repetir pagamento. |
| 5. Produção e alergia | Pedido confirmado do passo 1; bolo individual com alergia declarada “frutos secos” e alergénios do produto conforme catálogo ativo | Produção: 24-11-2026 → encomenda → cartão do bolo | Abrir a lista diária e inspecionar o cartão | Pedido aparece agrupado pelo dia; “Alergia declarada: frutos secos” e “Alergénios do produto: …” aparecem separados. O valor exato dos alergénios precisa do catálogo original/seed, ausente neste checkout; não o inferir. |
| 6. Sexta vaga ocupada | Data 24-11-2026 com os seis itens personalizados confirmados (bolo do passo 1 + cinco itens extra); novo pedido de outro bolo de chocolate personalizado, 1 kg, levantamento na mesma data, contacto fictício | Cliente: criar pedido; Gestora: lista Pendentes/agenda → detalhe | Submeter o pedido e observar que fica Pendente sem vaga. Com seis vagas ocupadas, tentar registar sinal **sem pagamento externo recebido** através de `POST /api/staff/orders/{id}/payments`, corpo `{"kind":"deposit","amount_cents":1700,"external_payment_received":false,"note":null}` e `Idempotency-Key` único. Não instruir o Cliente a pagar antes de confirmar a disponibilidade indicativa. | **Contrato v1:** `POST /api/orders` cria `Pendente`, pois não reserva nem recusa por capacidade. A tentativa de sinal com `external_payment_received:false` responde `409 CAPACITY_FULL` e não regista pagamento; a encomenda mantém-se Pendente, sem reserva. **Caso separado:** se o sinal já foi efetivamente recebido fora do sistema, enviar `external_payment_received:true`; a API regista o sinal, mantém a encomenda Pendente, define resolução necessária e responde `409 CAPACITY_LOST_AFTER_PAYMENT`. Não repetir o pagamento; encaminhar para reagendamento operacional ou reembolso simulado. **Discrepância:** o enunciado oficial diz “novo bolo … é recusado”, mas o contrato cria Pendente sem reserva e só impede a confirmação. Preservar contrato v1 até decisão de integração alterar o contrato. |
| 7. Consulta, conclusão, restante e entrega | Código do passo 1; item do bolo; restante de 3 900 cêntimos; saldo final zero | Cliente: acompanhamento; Produção: lista diária e cartão; Gestora: detalhe do pedido | Consultar pelo código; Produção avança o item `A fazer` → `Em produção` → `Pronto`; Gestora regista restante de 39 € e marca Entregue | Seguimento mostra estado sem dados de contacto. Como todos os itens deste exemplo ficam prontos, estado agregado torna-se `Pronta`; depois do restante, saldo zero e Gestora pode marcar `Entregue`. Para demonstrar o bloqueio agregado numa encomenda com vários itens, é necessário acrescentar outro item e deixá-lo por concluir até ao fim do primeiro. |

**Limitação de capacidade antes do pagamento:** a API v1 não define rota de pré-verificação nem rota para editar a data de levantamento. A agenda interna pode orientar a Gestora, mas não garante a vaga até à confirmação atómica. Não representar uma indicação de disponibilidade como reserva. Se a equipa quiser que o passo 6 recuse já na criação, essa alteração precisa de decisão explícita de arquitetura e contrato partilhado.

## Esboços de baixa fidelidade

### Cliente — telemóvel, encomenda

```text
┌──────────────────────────┐
│ Doce Lurdes     [Cesto 2]│
├──────────────────────────┤
│ Catálogo                 │
│ Bolo chocolate   28 €/kg │
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
│ │ Alergénios do produto: …  │                               │
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
- Antes de alterar o resultado literal do passo 6, a arquitetura deve decidir se a criação pública passa a consultar capacidade, ou se se mantém o pedido Pendente e a recusa acontece na confirmação. A mudança requer atualização coordenada de contrato e roteiro.
- Rota de pré-verificação e alteração de data não estão no contrato v1. Se forem necessárias para dar à Gestora uma garantia antes do pagamento ou reagendar diretamente no sistema, devem ser propostas e contratadas antes de a interface depender delas.

## Escolhas menores e motivos

- Agrupar o catálogo por categoria e manter resumo persistente do cesto: reduz procura e evita que a pessoa perca o que já preencheu.
- Mostrar alergias declaradas e alergénios do produto em blocos separados: são dados com origens e significados diferentes, conforme modelo/API.
- Usar ações simples por item na Produção e não botões por encomenda: evita marcar todos os bolos como iniciados/prontos por engano.
- Separar pedidos Pendentes da contagem de ocupação na Agenda: torna a regra “Pendente não reserva” visível para a Gestora e reduz promessas indevidas ao Cliente.
- Exibir o saldo como valor derivado pelo servidor e manter estados de carregamento/erro sem limpar o formulário: previne totais divergentes e facilita recuperação.

## Alinhamento e ambiguidades registadas

- O agente de arquitetura confirmou que o cenário deve seguir o contrato v1: criação pública produz Pendente sem reserva; quando seis vagas estão ocupadas, não é possível confirmar. A frase oficial “recusado” deve ser registada como discrepância, sem alterar o contrato unilateralmente.
- O agente confirmou o uso de fixture de relógio de demonstração numa terça-feira (T0) com levantamento T0 + 7 dias. A regra de produção permanece baseada no relógio real do servidor.
- A pré-verificação de capacidade e a edição de data não têm rota no contrato v1. A Gestora usa a agenda como indicação e a transação final é autoritativa; melhoria de contrato é decisão conjunta com arquitetura/backend.
- Dossier original, critérios de avaliação e valores da agenda de oito encomendas não estão disponíveis neste checkout. Datas, alergénios e registos históricos não foram inventados.
