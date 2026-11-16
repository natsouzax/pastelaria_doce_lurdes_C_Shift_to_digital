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

## Política de capacidade decidida pela equipa

- Um pedido de bolo personalizado em `Pendente` fica registado numa lista de espera, **sem reservar vaga**.
- A capacidade conta **bolos físicos**, não encomendas, clientes ou quilogramas. Dois bolos personalizados na mesma encomenda ocupam duas das seis vagas.
- A vaga só é atribuída quando a Gestora regista o sinal pago e o pedido passa a `Confirmada`. Encomendas personalizadas confirmadas antes têm prioridade, independentemente da ordem em que os pedidos pendentes foram criados.
- Nesse momento, o servidor deve voltar a verificar o limite de seis bolos personalizados na data de levantamento. Se já estiver cheio, não confirma o pedido; a interface explica que a data ficou indisponível e pede outra data. Como o pagamento ocorre fora da aplicação, a equipa deve verificar a disponibilidade antes de instruir o cliente a pagar. Se o dinheiro tiver sido recebido antes de a vaga desaparecer, o registo financeiro deve refletir esse facto e a gestora deve resolver a alteração de data ou o reembolso simulado; esta exceção ainda precisa de um fluxo explícito.
- A verificação da capacidade e a confirmação devem ser uma única operação segura no servidor, para que dois pedidos simultâneos não ocupem a sexta vaga.
- Pedidos `Cancelada` não ocupam vaga. Pedidos confirmados em estados posteriores continuam a ocupar a capacidade da data correspondente.
- Esta lista de espera é uma decisão da equipa para pedidos pendentes; o dossier não especifica uma fila nem prioridade por ordem de chegada.

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

- Como representar itens vendidos por kg, unidade, cento, dúzia e meia dúzia? Ver [modelo proposto](modelo-dados.md).
- Para um item personalizado, guardar separadamente peso total em kg e número de bolos físicos. Um bolo de 2 kg ocupa uma vaga; dois bolos que somem 2 kg ocupam duas. A interface deve pedir ambos sem ambiguidade.
- Como consultar por código sem expor dados de contacto ou permitir adivinhação fácil?
- Que transições de estado cada perfil pode executar?
- Como lidar com encomendas com vários produtos e prazos mínimos diferentes?

Estas escolhas devem respeitar as regras do dossier e ser explicadas no pitch e no README.
