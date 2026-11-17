# Contrato mínimo do MVP — versão 1

Esta é a base comum para agentes paralelos. Fontes de verdade: dossier do Cliente C, critérios oficiais e decisões da equipa em `requisitos.md` e `modelo-dados.md`. Em conflito, prevalecem o dossier e as decisões explícitas da equipa. Não alterar este contrato silenciosamente; propor mudança em PR/nota para integração.

## Stack e responsabilidades

- Next.js App Router, TypeScript, Tailwind; SWR apenas para atualização de dados no cliente onde útil.
- Route Handlers do Next.js em Node.js expõem API REST. Validação, cálculos, estados, capacidade e permissões são do servidor.
- Supabase: PostgreSQL relacional e Auth para Gestora e Produção. Cliente não cria conta.
- Vercel é alvo de publicação. Docker é opcional. Nenhuma integração com MB WAY, Instagram, email ou SMS. O WhatsApp limita-se a uma ligação `wa.me` com a mensagem escrita, aberta pela equipa quando a encomenda fica Pronta; não há API nem envio automático.

## Dados e regras partilhadas

- `orders` agrupa `order_items`; cada bolo personalizado é um item/ID distinto com peso próprio em kg, mensagem e alergias. Outros produtos podem ter quantidade na unidade do catálogo.
- `products` têm preço por unidade e antecedência. Cada item guarda preço e unidade aplicados no pedido.
- Cada data aceita no máximo **seis encomendas não canceladas**. O pedido Pendente ocupa lugar desde a criação; cancelar liberta-o. `POST /api/orders` bloqueia a data e verifica o limite na mesma transação, impedindo excesso por pedidos simultâneos. Além disso, um bolo personalizado consome uma vaga da capacidade específica de bolos: até seis bolos personalizados confirmados e estados seguintes por data, revalidados e reservados atomicamente ao registar o sinal.
- Item de produção: `a_fazer → em_producao → pronto`. A encomenda fica `Em produção` quando pelo menos um item começar e só fica `Pronta` quando **todos** os itens estiverem prontos. Produção não marca `Entregue`.
- Para personalizado, sinal de 30% do **total da encomenda**, arredondado ao euro; confirmação apenas após sinal registado e vaga disponível. Exemplo: 56 € → 17 € de sinal e 39 € em falta.
- Valores monetários em cêntimos inteiros; datas de levantamento no fuso Europe/Lisbon; código de seguimento não sequencial.
- Alergias declaradas por bolo e alergénios do produto são campos diferentes, ambos visíveis à produção.

## API REST proposta para o MVP

As rotas abaixo são contrato entre agentes; detalhes de campos devem ser publicados primeiro pelo agente de arquitetura em `docs/api.md`.

| Rota | Finalidade | Acesso |
| --- | --- | --- |
| `GET /api/products` | Catálogo | Público |
| `POST /api/orders` | Pré-verificar capacidade atual sem reservar; criar pedido Pendente se existir capacidade observada; validar prazo, segunda-feira e dados | Público |
| `GET /api/orders/track/[code]` | Estado e resumo mínimo do pedido | Público com código |
| `GET /api/staff/orders` | Lista por data/estado para gestão/produção | Gestora ou Produção, com visão por perfil |
| `POST /api/staff/orders/[id]/payments` | Registar sinal ou restante simulado; tentar confirmar quando aplicável | Gestora |
| `PATCH /api/staff/order-items/[id]/status` | Avançar produção do item | Produção |
| `PATCH /api/staff/orders/[id]/status` | Cancelar ou entregar conforme regras | Gestora |

## Casos que o contrato detalhado deve fechar

- Se o sinal tiver sido recebido fora do sistema e a vaga desaparecer entre a pré-verificação e a confirmação, guardar o facto do pagamento sem confirmar a encomenda (`CAPACITY_LOST_AFTER_PAYMENT`); expor claramente necessidade de nova data ou reembolso simulado. A pré-verificação não garante vaga; a Gestora deve conferir a agenda antes de instruir pagamento.
- Cancelamento em menos de 48 h não devolve sinal. Definir comportamento de cancelamento permitido e devolução simulada quando aplicável.
- Cliente sem conta: o código é segredo de consulta; limitar dados apresentados e evitar código previsível.
- Seed preserva 11 produtos e 8 pedidos originais. Datas absolutas inferidas para a agenda devem ser documentadas. Dados adicionais da demo ficam identificados.

## Critérios de pronto

Os sete passos do cenário devem passar ao vivo; perfis devem ser testados pela API; README descreve instalação, execução, seed, contas de teste, decisões e limitações; `.env.example` sem segredos; repositório público sem `.env`, credenciais e `node_modules`.
