# Resumo simples do desafio — Doce Lurdes

## Do que se trata

Construir o MVP de uma aplicação web para a Pastelaria Doce Lurdes:

- **Cliente:** encomenda sem criar conta e acompanha o pedido por código.
- **Gestora:** gere encomendas e regista pagamentos simulados.
- **Produção:** vê a agenda do dia e avança cada item até `Pronto`.

Regras centrais: catálogo com 11 produtos, antecedência de 5 dias para bolos personalizados e 48 horas para os restantes, sem levantamento à segunda-feira, máximo de 6 encomendas não canceladas e 6 bolos personalizados confirmados por dia, sinal de 30% arredondado ao euro, estados por item e alergias em destaque. Fontes: `docs/requisitos.md` e `docs/contrato-mvp.md`.

## O que temos de fazer

- Fazer passar os **7 passos do cenário oficial de demonstração**: criar bolo de chocolate de 2 kg para 24/11 com “Parabéns Inês” e alergia a frutos secos; bloquear 19/11 e 23/11; Gestora registar 17 € de sinal sobre 56 € e confirmar; Produção ver a alergia; sexto bolo ocupar a última vaga e sétimo ser recusado; cliente consultar por código; Produção marcar `Pronto` e Gestora `Entregue`.
- Manter API REST, permissões por perfil, validações no servidor, capacidade reservada atomicamente na confirmação, seed fiel (11 produtos, 8 encomendas originais e 5 bolos da fixture) e README executável sem segredos.

## O que já está pronto

- **Documentação e contratos:** requisitos, API, fluxos, arquitetura, modelo de dados, contrato do MVP e plano de agentes em `docs/`.
- **Backend:** migração PostgreSQL, seeds `original` e `demo`, rotas da API, cálculos, transições de estado, validações e capacidade com transação segura.
- **Frontend:** interfaces de Cliente, Gestora e Produção ligadas à API, incluindo o redesign mais recente.
- **Verificação local:** `npm ci`, `npm run typecheck`, `npm run build`; 15 testes passaram e 1 foi ignorado (concorrência, por falta de `DATABASE_URL`); auditoria npm sem vulnerabilidades.
- **Supabase remoto:** migração, seed e teste transacional de capacidade já reportados pela equipa.

## O que falta fazer

- Disponibilizar `DATABASE_URL`/pooler do Supabase e voltar a executar o teste de concorrência.
- Criar contas Auth internas para Gestora e Produção e validar as rotas protegidas com sessões reais.
- Percorrer o roteiro completo da demo em API e interface, ponta a ponta.
- Permitir repetir a demo em qualquer data (injeção de `T0`) ou executá-la nas datas fixas 17–24/11/2026.
- Validar o setup local com Docker (não executado neste ambiente) e confirmar URL de deploy na Vercel.
- Definir/operacionalizar o caso em que o sinal já foi recebido mas a vaga desapareceu (`CAPACITY_LOST_AFTER_PAYMENT`).

## Funções para colegas que não programam

- **QA manual:** executar os 7 passos da demo na interface, testar as regras de prazo, segunda-feira, capacidade e alergias, e reportar falhas em linguagem simples.
- **Documentação e apresentação:** revisar README e requisitos, preparar o roteiro do pitch, screenshots e evidências da demonstração.
- **Validação de requisitos (opcional):** conferir se o resultado final corresponde ao dossier do Cliente C e aos critérios oficiais.
