# Contrato da API do MVP

Versão 1.0 — contrato comum entre frontend e backend. API JSON em Route Handlers Next.js (runtime Node.js), com regras executadas no servidor e persistência em PostgreSQL/Supabase. Valores monetários são inteiros em cêntimos. Datas de levantamento são instantes ISO 8601 com offset; regras de calendário usam `Europe/Lisbon`.

## Convenções

- Prefixo `/api`; `Content-Type: application/json` nos pedidos com corpo.
- IDs internos são UUIDs. O código público de seguimento é aleatório, não sequencial, com pelo menos 128 bits de entropia; guardar apenas hash pesquisável na base de dados. Nunca usar UUID de encomenda como código público.
- Autenticação de equipa por sessão Supabase Auth validada no servidor. O perfil e a autorização vêm de registo interno confiável, nunca de campos enviados pelo browser. Não expor `service_role` ao cliente.
- Valores decimais de peso são kg, positivos, no máximo três casas decimais. Quantidade é positiva e unidade compatível com o produto. O preço do catálogo é por unidade de venda; num bolo personalizado a unidade de venda é `kg`, logo `subtotal_cents = weight_kg × unit_price_cents_per_kg`, arredondado ao cêntimo. Pesos e preços congelam no item ao criar o pedido.
- `pickup_at` deve ser ISO 8601 com offset. Apresentar e validar o calendário em `Europe/Lisbon`; persistir instante em `timestamptz` e manter também `pickup_date` local (`date`) para capacidade/agenda. Segunda-feira é rejeitada. Os exemplos da demo usam relógio determinístico `T0 = 2026-11-17T10:00:00+00:00` (terça-feira); o levantamento principal é `T0 + 7 dias = 2026-11-24T10:00:00+00:00` (terça-feira). A fixture não altera o relógio nem as regras de produção.
- Prazo é calculado contra a hora do servidor: cada produto impõe a sua antecedência; bolo personalizado exige pelo menos 5 dias e restantes produtos pelo menos 48 horas. Em encomendas mistas, o levantamento tem de cumprir o maior prazo aplicável a cada item. Não arredondar a prazo pelo dia civil.
- Só produtos ativos podem ser encomendados. Erros não alteram dados, exceto resposta `CAPACITY_LOST_AFTER_PAYMENT`, em que o pagamento externo informado é intencionalmente registado e requer resolução.
- Listagens usam paginação `limit` (default 50, máximo 100) e `cursor` opaco. Sem suporte a filtros desconhecidos: responder `400`.

## Entidades e campos

Campos comuns de auditoria: `created_at`, `updated_at` (`timestamptz` UTC). Campos monetários `*_cents` são `integer` não negativo, com constraints no banco. Enumerações são valores fechados.

### `products`

`id uuid`, `name text`, `category text`, `unit` enum (`kg`, `unidade`, `cento`, `duzia`, `meia_duzia`), `unit_price_cents integer`, `allergens text[]`, `min_lead_hours integer`, `is_custom_cake boolean`, `active boolean`.

Para bolos personalizados, `unit = kg`, `min_lead_hours >= 120`, preço expresso por kg. As opções de venda não são convertidas umas nas outras. Produtos inativos não podem ser adicionados a novos pedidos, mas os snapshots históricos permanecem legíveis.

### `orders`

`id uuid`, `tracking_code_hash text unique`, `customer_name text`, `customer_phone text`, `pickup_at timestamptz`, `pickup_date date`, `status` enum (`pending`, `confirmed`, `in_production`, `ready`, `delivered`, `cancelled`), `notes text nullable`, `source` enum (`online`, `counter`, `phone`), `total_cents integer`, `deposit_required_cents integer`, `created_at`, `updated_at`, `confirmed_at timestamptz nullable`, `cancelled_at timestamptz nullable`, `cancellation_reason text nullable`, `capacity_resolution_required boolean default false`.

`total_cents` e `deposit_required_cents` são snapshots calculados pelo servidor. O sinal exigido para uma encomenda com pelo menos um bolo personalizado é 30% do total da encomenda, arredondado ao euro mais próximo (metade para cima); sem personalizado é zero. `amount_paid_cents` e `balance_due_cents` são derivados dos pagamentos: pagamentos capturados menos reembolsos, e total menos líquido pago, nunca negativos na resposta. A regra de reembolso fora de política exige resolução manual; não exceder o valor líquido pago.

### `order_items`

`id uuid`, `order_id uuid FK`, `product_id uuid FK`, `product_name_snapshot text`, `unit_snapshot` enum, `unit_price_cents_snapshot integer`, `quantity numeric(10,3)`, `subtotal_cents integer`, `is_custom_cake boolean`, `weight_kg numeric(7,3) nullable`, `cake_message text nullable`, `declared_allergies text[]`, `production_notes text nullable`, `production_status` enum (`to_do`, `in_progress`, `ready`), `created_at`, `updated_at`.

Cada bolo personalizado é exatamente um item, `quantity = 1`, com `weight_kg > 0`, mesmo se houver vários bolos iguais; logo cada item personalizado confirmado ocupa uma vaga física. O snapshot de nome, unidade e preço impede alteração retroativa do pedido. Itens não personalizados podem representar quantidade agregada da unidade vendida. `declared_allergies` são restrições declaradas pelo cliente e não substituem `products.allergens`.

### `simulated_payments`

`id uuid`, `order_id uuid FK`, `kind` enum (`deposit`, `balance`, `refund`), `amount_cents integer > 0`, `recorded_at timestamptz`, `recorded_by uuid` (membro autenticado nas operações da API; `NULL` apenas nos sinais históricos importados sem ator conhecido), `note text nullable`, `external_payment_received boolean default false`.

São registos informativos, sem cobrança, gateway ou transferência real. `deposit`/`balance` aumentam o valor pago; `refund` reduz o valor líquido. Não permitir somatório líquido acima do total, nem sinal acima do sinal exigido, salvo uma operação explícita de restante depois da confirmação; para simplificar o MVP, excedentes são rejeitados.

### `staff_profiles`

`user_id uuid` (ID Supabase Auth, PK), `role` enum (`manager`, `production`), `active boolean`, `created_at`, `updated_at`. Um perfil inativo é sempre proibido. Supabase Auth guarda credenciais; não duplicar password/hash na aplicação.

## Estados e permissões

| Entidade | Transição | Quem / condições |
| --- | --- | --- |
| Encomenda | inexistente → `pending` | Público; pedido validado, inicialmente sem vaga reservada |
| Encomenda | `pending` → `confirmed` | Gestora. Personalizado: apenas ao registar sinal suficiente e reservar capacidade atomicamente. Sem personalizado: ação explícita da Gestora em `PATCH status`; não exige sinal |
| Encomenda | `confirmed` → `in_production` | Automática quando pelo menos um item passa a `in_progress` |
| Encomenda | `confirmed`/`in_production` → `ready` | Automática quando todos os itens estão `ready` |
| Encomenda | `ready` → `delivered` | Gestora; saldo líquido tem de ser zero |
| Encomenda | `pending`/`confirmed`/`in_production`/`ready` → `cancelled` | Gestora. Libertar capacidade. Cancelamento a menos de 48 h do levantamento não cria reembolso. Se houver sinal e faltarem pelo menos 48 h, registar reembolso simulado pelo sinal líquido como parte da operação de cancelamento |
| Item | `to_do` → `in_progress` → `ready` | Produção. Pode avançar um único passo por chamada. Nunca retroceder. Itens já prontos não são alterados quando outros avançam |

Cancelamento é permitido até à entrega, mas encomenda `delivered` é terminal. No cancelamento com menos de 48 horas, o sinal fica retido e o valor remanescente é apresentado à Gestora como retido; não inventar política de retenção adicional para pagamentos além do sinal. Para devolução após 48 horas, o MVP simula reembolso do valor líquido pago, limitado ao sinal efetivamente pago; se houver pagamentos adicionais, resposta exige resolução manual e não executa cancelamento parcial. Encomendas com capacidade reservada contam até serem canceladas. O servidor deriva estado agregado e rejeita alterações diretas inconsistentes.

## Rotas

### `GET /api/products` — público

Query opcional: `category`, `is_custom_cake` (`true|false`), `limit`, `cursor`. Apenas ativos. Resposta `200`:

```json
{
  "data": [{
    "id": "uuid", "name": "Bolo personalizado de chocolate",
    "category": "Bolos", "unit": "kg", "unit_price_cents": 2800,
    "allergens": ["gluten", "egg"], "min_lead_hours": 120,
    "is_custom_cake": true
  }],
  "next_cursor": null
}
```

### `POST /api/orders` — público

Na mesma transação, bloquear a data local, contar encomendas não canceladas e criar `pending` apenas se houver menos de seis. Pedidos Pendentes também ocupam um dos seis lugares; cancelados libertam-no. Se já houver seis, responder `409 CAPACITY_FULL` sem criar encomenda nem código. Aplicar também a verificação separada de até seis bolos físicos personalizados confirmados (e estados seguintes) para os itens personalizados deste pedido. Recalcular preços, total, sinal e regras com os dados de catálogo no servidor. Corpo:

O mesmo bloqueio aplica o limite de **6 bolos por dia de levantamento** (qualquer produto de categoria Bolo ou bolo personalizado, incluindo pedidos pendentes e excluindo cancelados): se o pedido sozinho ou somado ao dia ultrapassar 6, responde `409 CAKE_LIMIT` sem criar pedido. O carrinho avisa e bloqueia antes de enviar.

```json
{
  "customer": {"name": "Inês", "phone": "+351000000000"},
  "pickup_at": "2026-11-24T10:00:00+00:00",
  "notes": null,
  "items": [{
    "product_id": "uuid", "quantity": 1, "weight_kg": 2,
    "cake_message": "Parabéns Inês", "declared_allergies": ["frutos secos"],
    "production_notes": null
  }]
}
```

Para item personalizado, `quantity` é sempre 1 e `weight_kg` obrigatório. Item comum usa `quantity` na unidade do produto e não aceita campos de bolo. Corpo não aceita preço, subtotal, estado, sinal, total, `source`, ID de encomenda ou estado de produção. Resposta `201` inclui `order_id`, `tracking_code` (exibido uma única vez), `status`, `pickup_at`, linhas com preço/total, `total_cents`, `deposit_required_cents`, `amount_paid_cents: 0`, `balance_due_cents`, `order_slot_reserved: true`, `capacity_reserved: false` (reserva específica de bolo personalizado) e mensagem para contactar a Gestora antes do pagamento. Persistir somente hash do código. Se não for possível mostrar o código após criação, permitir apenas emissão controlada por equipa, não recuperar o segredo guardado.

### `GET /api/orders/track/{code}` — público com código

Código no segmento URL; responder `200` com `status`, `pickup_at`, resumo de itens (nome snapshot, quantidade/peso, mensagem do bolo, estado por item), total, pago e saldo. Não incluir nome, telefone, notas internas, ID, utilizador, alergias declaradas completas ou dados de pagamentos. Para evitar enumeração, respostas iguais `404 NOT_FOUND` para inexistente/inválido; aplicar rate limit por IP e por hash do código, resposta `429` quando excedido, sem revelar se código existe.

Resposta `200` inclui também `can_cancel` (`true` só se o estado for `pending` ou `confirmed`, sem nenhum registo de pagamento e sem `capacity_resolution_required`).

### `POST /api/orders/track/{code}/cancel` — público com código (extensão)

Cancelamento pelo cliente. Exige o código secreto (nunca só o telefone) e `Origin` igual ao do servidor. Numa transação com a encomenda bloqueada (`for update`), só cancela se `can_cancel` for verdadeiro; define `status='cancelled'`, `cancelled_at` e `cancellation_reason='Cancelado pelo cliente'`, o que liberta a vaga de bolo personalizado. Sem reembolsos: se existir qualquer pagamento, responde `409 INVALID_STATE` e o cliente deve falar com a pastelaria. Código inexistente ou inválido: `404 NOT_FOUND`. Rate limit de 20 por IP e 5 por código em 15 minutos (`429 RATE_LIMITED`). Resposta `200`: `{ "status": "cancelled" }`.

### `POST /api/orders/lookup` — público com telefone (extensão, acesso reduzido)

Corpo `{ "phone": "+351 912 345 678" }` (POST para o telefone não ficar no URL; exige `Origin`). Compara os últimos 9 dígitos do telefone guardado, ignorando espaços, `+351` e pontuação; menos de 9 dígitos devolve `400 VALIDATION_ERROR`. Resposta `200`: `{ "data": [ { "status", "pickup_at", "items": [{ "product_name", "quantity", "unit", "weight_kg", "production_status" }] } ] }`, até 20 pedidos por `pickup_at` decrescente; telefone sem pedidos devolve `data: []`.

Como o telefone não é um segredo, esta rota é deliberadamente mais pobre do que o tracking por código: sem ID, nome, telefone, mensagens de bolos, alergias, notas, valores ou pagamentos, e não permite cancelar. Rate limit de 10 por IP e 5 por telefone em 15 minutos (`429 RATE_LIMITED`). Decisão de produto: aceita-se que quem souber o telefone veja estado, dia de levantamento e produtos; isto relaxa o princípio 7 apenas para estes campos.

### Autorização da área interna

O papel nunca vem do browser. Cada operação interna chama `requireStaff`, que valida a sessão com Supabase Auth `getUser()` no servidor e consulta `staff_profiles` pelo `user_id` autenticado; apenas perfis `active` podem prosseguir. `GET /api/staff/me` devolve o papel validado para a interface mostrar as secções adequadas. Enviar ou alterar um campo `role` no browser não concede permissões.

| Operação | Gestora (`manager`) | Produção (`production`) |
| --- | --- | --- |
| `GET /api/staff/me` e `GET /api/staff/orders` | Permitido; lista inclui contacto e dados financeiros | Permitido; só encomendas confirmadas/em produção/prontas, sem dados financeiros; nome e telefone apenas quando a encomenda está `ready` |
| `PATCH /api/staff/order-items/{id}/status` | Permitido | Permitido |
| `PATCH /api/staff/orders/{id}/status` | Permitido | `403 FORBIDDEN` |
| `POST /api/staff/orders/{id}/payments` | Permitido | `403 FORBIDDEN` |

As rotas de pagamento e estado da encomenda continuam exclusivas da Gestora, exigem `assertSameOrigin` e a rota de pagamentos exige `Idempotency-Key`. Nunca enviar `service_role` ao cliente.

### `GET /api/staff/orders` — Gestora ou Produção

Query: `pickup_date` (`YYYY-MM-DD` em Europe/Lisbon) ou `pickup_date_from` e `pickup_date_to` inclusivos para um intervalo de sete dias; `status`, `limit` e `cursor` são opcionais. Ambos os papéis podem consultar a semana. `manager` vê dados de contacto, origem, pagamentos e ações; `production` vê apenas encomendas confirmadas e estados seguintes, itens, alergénios de catálogo, alergias declaradas, mensagem e notas de produção. Produção não recebe pagamentos nem notas gerais do cliente; só recebe `customer_name` e `customer_phone` nas encomendas em estado `ready`, para avisar o cliente por WhatsApp (ligação `wa.me`, sem API do WhatsApp). Resposta `200`: `{ "data": [ { "id", "status", "pickup_at", "pickup_date", "customer_name" (apenas gestora), "items": [{"id","product_name","quantity","unit","weight_kg","cake_message","product_allergens","declared_allergies","production_notes","production_status"}], "total_cents", "amount_paid_cents", "balance_due_cents" (financeiro apenas Gestora) } ], "next_cursor": null }`.

### `GET /api/staff/me` — Gestora ou Produção (extensão de integração)

Devolve `{ "role": "manager" | "production" }` após validar sessão e `staff_profiles` no servidor. Responde `401 UNAUTHENTICATED` sem sessão e `403 FORBIDDEN` sem perfil ativo. A interface usa esta rota para determinar o papel mesmo quando a lista de pedidos está vazia. Não devolve dados pessoais. Esta rota foi acrescentada para integração do frontend e não altera as sete operações originais do contrato.

### `POST /api/staff/orders/{id}/payments` — Gestora

Corpo: `{"kind":"deposit|balance|refund","amount_cents":1700,"external_payment_received":true,"note":null}`. Valor positivo. `deposit` apenas em `pending`; `balance` em `confirmed|in_production|ready`; `refund` em cancelamento permitido ou resolução manual explicitamente autorizada. Para deposit personalizado, aceitar apenas valor exato de `deposit_required_cents`; para encomenda sem personalizado rejeitar `deposit` e usar confirmação explícita. Para restante, valor não pode exceder saldo. Uma encomenda `ready` pode ser marcada como entregue quando levantada mesmo com saldo em falta; o saldo continua pendente.

Ao receber sinal personalizado, guardar pagamento e tentar na mesma transação confirmar estado e capacidade. Bloquear a data local (advisory/row lock transacional por `pickup_date`), contar itens personalizados de encomendas não canceladas já confirmadas e somar a nova encomenda; confirmar só se total ≤ 6. O lock e a verificação têm de estar na mesma transação PostgreSQL. Resposta `200` quando registado: `{ "payment": {"id","kind","amount_cents","recorded_at"}, "order": {"id","status","total_cents","deposit_required_cents","amount_paid_cents","balance_due_cents","capacity_reserved"}, "resolution_required": false }`.

Se o pagamento externo já foi recebido, mas a vaga desapareceu, registar o sinal mantendo estado `pending`, `capacity_reserved:false`, `capacity_resolution_required:true`; responder `409 CAPACITY_LOST_AFTER_PAYMENT` com `payment_recorded:true` e ações recomendadas `reschedule_or_refund`. Não pedir à interface para repetir pagamento. Gestora resolve por operação de reembolso simulada, ou altera data numa futura rota de edição (fora deste contrato); até essa alteração existir, esta exceção deve ser resolvida operacionalmente e não pode ser confirmada manualmente. O frontend deve verificar a agenda com a Gestora antes de instruir o cliente a pagar.

### `PATCH /api/staff/order-items/{id}/status` — Gestora ou Produção

Corpo `{"status":"in_progress"}` ou `{"status":"ready"}`. Item deve pertencer a encomenda `confirmed` ou `in_production`; estado apenas avança um passo. Operação atualiza item e estado agregado da encomenda na mesma transação. Gestora e Produção podem usar esta rota. Resposta `200`: `{ "item": {"id","production_status"}, "order": {"id","status"} }`. Produção continua proibida de marcar `delivered`, cancelar, editar pagamentos ou mudar dados do cliente.

### `PATCH /api/staff/orders/{id}/status` — Gestora

Corpo `{"status":"confirmed"}` para pedido sem personalizado, `{"status":"cancelled","reason":"..."}` para cancelamento, ou `{"status":"delivered"}`. Gestora não pode forçar `in_production`/`ready`; estes são derivados dos itens. Confirmar personalizado por esta rota é sempre rejeitado: exige pagamento e capacidade na rota de pagamento. Cancelar aplica a política das 48 horas acima e liberta vagas transacionalmente. Entregar exige encomenda `ready` e saldo zero. Resposta `200`: `{ "id","status","amount_paid_cents","balance_due_cents","capacity_reserved" }`; cancelamento que cria reembolso inclui também o registo de pagamento refund.

## Erros comuns

Formato consistente, sem stack trace: `{"error":{"code":"VALIDATION_ERROR","message":"...","fields":{"pickup_at":"..."}}}`. `fields` é opcional e só contém campos enviados. Códigos HTTP:

| HTTP | `code` | Situação |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | JSON inválido, campo ausente/formato incorreto, unidade/campos incompatíveis |
| 401 | `UNAUTHENTICATED` | Sem sessão válida em rota interna |
| 403 | `FORBIDDEN` | Perfil sem permissão ou perfil inativo |
| 404 | `NOT_FOUND` | ID/código não encontrado; tracking igual para códigos inválidos |
| 409 | `INVALID_STATE` | Transição/ação não permitida, saldo pendente, pagamento duplicado ou pedido terminal |
| 409 | `PICKUP_TOO_SOON` | Antecedência mínima de algum produto não cumprida |
| 409 | `MONDAY_PICKUP` | Levantamento em segunda-feira local |
| 409 | `CAKE_LIMIT` | No POST, o pedido (ou o pedido somado aos não cancelados do mesmo dia, incluindo pendentes) ultrapassa 6 bolos por dia de levantamento. Conta bolos personalizados, bolos vendidos ao kg (1 por linha) e bolos à unidade (pela quantidade). Para mais, o cliente contacta a pastelaria |
| 409 | `CAPACITY_FULL` | No POST, a data já tem seis encomendas não canceladas ou a capacidade de bolos personalizados está cheia; não cria encomenda/código. Na confirmação sem pagamento externo associado, não confirma nem reserva vaga |
| 409 | `CAPACITY_LOST_AFTER_PAYMENT` | Sinal externo já recebido e guardado, mas sem vaga; resolução requerida |
| 409 | `PAYMENT_MISMATCH` | Tipo/valor não coincide com sinal, saldo ou política de reembolso |
| 429 | `RATE_LIMITED` | Limite de tentativas de seguimento excedido |
| 500 | `INTERNAL_ERROR` | Erro inesperado; incluir `request_id`, nunca detalhe interno |

A criação de encomendas bloqueia a data e conta encomendas não canceladas na mesma transação; pedidos simultâneos não ultrapassam seis. Esse lugar é ocupado desde o estado Pendente e libertado ao cancelar. A capacidade separada de bolos personalizados continua a ser revalidada e reservada atomicamente na confirmação após sinal. Se essa capacidade se esgotar após pagamento externo, responder `CAPACITY_LOST_AFTER_PAYMENT`. Não repetir efeitos com retries da Vercel sem chave idempotente: pagamentos usam `Idempotency-Key` obrigatório (UUID) e unicidade por utilizador; criação pública pode usar chave opcional para prevenir duplicados de submissão.

## Lacunas decididas para o MVP

1. Em encomenda mista, qualquer bolo personalizado torna exigível sinal sobre o total completo, não apenas sobre os bolos; regra preserva a decisão do modelo proposto.
2. Arredondamento de 30% é ao euro mais próximo, metade para cima (`56 € → 17 €`), como demonstração. Armazenar sinal em cêntimos, sempre múltiplo de 100.
3. Para item personalizado, o preço por kg multiplica o peso individual. O produto do dossier deve ter unidade kg; o peso é obrigatório mesmo quando a quantidade lógica é um bolo.
4. Prazo em encomenda mista é por item, validado no instante exato de submissão. Segunda-feira é proibida para todos os pedidos.
5. A confirmação de produtos não personalizados é explícita pela Gestora e não depende de pagamento; para bolo personalizado é sempre sinal + vaga.
6. A lista de espera de pedidos pendentes não reserva capacidade nem prioridade. A ordem de confirmação após sinal decide; confirmar é a única reserva.
7. Dados públicos de tracking são mínimos e sem dados de contacto. Código secreto de alta entropia, hash na BD e rate limit.
8. Cancelamento a menos de 48 horas mantém o sinal sem reembolso. A pelo menos 48 horas, o MVP reembolsa apenas o sinal, se não houver pagamentos adicionais; demais casos exigem resolução manual.
9. A capacidade conta cada item físico personalizado de encomendas em `confirmed`, `in_production`, `ready` e `delivered` na data; canceladas não contam. `delivered` continua a ocupar aquela data histórica.
10. Os PDFs originais, critérios e XLSX foram conferidos em `content_project` fora do checkout e não são versionados neste repositório. Catálogo de 11 produtos e agenda de 8 encomendas coincidem com os valores resumidos no dossier; a agenda original só informa dias da semana, por isso datas absolutas no seed têm de ser identificadas como inferidas.

## Checklist dos sete passos da demo

1. Com o relógio de demo fixado em terça-feira, 2026-11-17 às 10:00 Europe/Lisbon, `POST /orders` para terça-feira, 2026-11-24 às 10:00 cria um item de bolo de chocolate de 2 kg, com mensagem e alergia; total 5 600 cêntimos e código apresentado uma vez.
2. Com o mesmo relógio, pedido personalizado para quinta-feira, 2026-11-19 às 10:00 (depois de amanhã) falha `PICKUP_TOO_SOON` por antecedência inferior a cinco dias.
3. Pedido para segunda-feira, 2026-11-23, falha `MONDAY_PICKUP`.
4. Gestora regista sinal de 1 700 cêntimos; transação confirma se ainda houver vaga, saldo passa a 3 900.
5. Listagem de Produção para o dia mostra o bolo, alergia declarada e alergénios do produto em campos separados.
6. Com seis encomendas não canceladas para a data, `POST /orders` responde `409 CAPACITY_FULL`, sem criar pedido nem código. A capacidade separada de bolos personalizados continua a ser verificada ao confirmar; se se esgotar depois de o sinal externo ter sido recebido, a transação devolve `CAPACITY_LOST_AFTER_PAYMENT`.
7. Cliente acompanha com código; Produção avança cada item até `ready`; Gestora regista restante, saldo zera e marca entregue.

A pré-verificação de capacidade no POST cumpre a recusa do passo 6 quando a data já está cheia sem dar prioridade ou reserva aos pedidos pendentes. A confirmação continua a repetir a contagem atomicamente, pois a capacidade pode mudar entre a criação e o pagamento.
