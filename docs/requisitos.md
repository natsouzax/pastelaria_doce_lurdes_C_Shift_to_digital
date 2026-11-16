# Requisitos e fluxos — Cliente C

## Pessoas

- Cliente: vê catálogo, encomenda sem conta e consulta o estado com código de seguimento.
- Gestora: gere catálogo e encomendas, regista pagamentos simulados, confirma e entrega pedidos.
- Produção: vê encomendas confirmadas por dia, com alergias em destaque, e avança a produção até Pronta.

## Cinco requisitos obrigatórios

1. Catálogo: nome, categoria, preço e unidade de venda, alergénios, antecedência mínima.
2. Encomenda: itens e quantidades, data/hora de levantamento, mensagem no bolo, alergias, nome e telefone de contacto; código de seguimento gerado.
3. Validação no servidor: 5 dias para bolos personalizados, 48 horas para os restantes, sem levantamento à segunda-feira, máximo de 6 bolos personalizados por dia.
4. Estados: Pendente → Confirmada → Em produção → Pronta → Entregue, ou Cancelada. Sinal e restante simulados; saldo calculado. Bolo personalizado só confirma depois do sinal de 30% do total, arredondado ao euro. Cancelamento com menos de 48 horas não devolve o sinal.
5. Produção: encomendas confirmadas agrupadas por dia, com alergias e notas visíveis.

## Demonstração exigida

1. Cliente encomenda bolo personalizado de chocolate de 2 kg para sete dias depois, com “Parabéns Inês” e alergia a frutos secos; recebe código.
2. Pedido de bolo personalizado para depois de amanhã é bloqueado.
3. Levantamento à segunda-feira é bloqueado.
4. Gestora vê Pendente, regista sinal de 17 € de um total de 56 €, confirma; saldo 39 €.
5. Produção vê a encomenda e a alergia destacada.
6. Novo bolo personalizado é recusado num dia já com seis.
7. Cliente consulta por código; Produção marca Pronta; Gestora regista restante e marca Entregue.

## Dados de origem

O catálogo contém 11 produtos e a agenda contém 8 encomendas. O seed deve preservar os valores originais. Como a agenda informa dias da semana sem datas completas, a data atribuída a cada registo terá de ser documentada.

## Decisões por fechar antes do código

- Como representar itens vendidos por kg, unidade, cento, dúzia e meia dúzia?
- Quando reservar a capacidade diária: ao criar o pedido Pendente ou só ao confirmar?
- Como consultar por código sem expor dados de contacto ou permitir adivinhação fácil?
- Que transições de estado cada perfil pode executar?
- Como lidar com encomendas com vários produtos e prazos mínimos diferentes?

Estas escolhas devem respeitar as regras do dossier e ser explicadas no pitch e no README.
