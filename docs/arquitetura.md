# Decisões de arquitetura

Este documento regista o desenho antes da implementação. Preencher cada decisão com a razão e a alternativa considerada.

| Decisão | Escolha | Porquê / consequência |
| --- | --- | --- |
| Frontend | Por definir | |
| Backend e API REST | Por definir | |
| Base de dados (MySQL ou PostgreSQL) | Por definir | |
| Autenticação de Gestora e Produção | Por definir | |
| Seguimento sem conta pelo Cliente | Por definir | |
| Implantação ou Docker | Por definir | |

## Contratos a desenhar

1. Entidades e relações: produtos, encomendas, itens, pagamentos simulados e utilizadores internos.
2. Ações por perfil e transições de estados.
3. Validações no servidor: prazo, segunda-feira, capacidade, sinal e saldo.
4. Fluxos de ecrãs: encomendar, gerir, produzir e acompanhar.
5. Seed reproduzível com dados originais e dados adicionais de demonstração claramente identificados.

## Trabalho paralelo após o contrato

- Frente A: interface e fluxos do Cliente, Gestora e Produção, usando o contrato da API.
- Frente B: API, regras de negócio, autenticação e permissões.
- Frente C: modelo relacional, migrações, seed, documentação de execução e cenário de demonstração.

As frentes devem trabalhar em ramos separados e integrar cedo os fluxos obrigatórios. A divisão final depende das decisões acima.
