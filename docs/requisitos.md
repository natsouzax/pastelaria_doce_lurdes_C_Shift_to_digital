# Requisitos e fluxos — Cliente C

## Pessoas

- Cliente: vê catálogo, encomenda sem conta e consulta o estado com código de seguimento.
- Gestora: gere catálogo e encomendas, regista pagamentos simulados, confirma e entrega pedidos.
- Produção: vê encomendas confirmadas por dia, com alergias em destaque, e avança a produção até Pronta.

## Cinco requisitos obrigatórios

1. Catálogo: nome, categoria, preço e unidade de venda, alergénios, antecedência mínima.
2. Encomenda: itens e quantidades, data/hora de levantamento, mensagem no bolo, alergias, nome e telefone de contacto; código de seguimento gerado.
3. Validação no servidor: 5 dias para bolos personalizados, 48 horas para os restantes, sem levantamento à segunda-feira e máximo de 6 encomendas não canceladas por dia. Mantém-se também o limite de 6 bolos personalizados confirmados por dia.
4. Estados: Pendente → Confirmada → Em produção → Pronta → Entregue, ou Cancelada. Sinal e restante simulados; saldo calculado. Bolo personalizado só confirma depois do sinal de 30% do total, arredondado ao euro. Cancelamento com menos de 48 horas não devolve o sinal.
5. Produção: encomendas confirmadas agrupadas por dia, com alergias e notas visíveis.

Cada item tem estado de produção independente. Um item pronto continua pronto mesmo que outro ainda não esteja; a encomenda só passa a `Pronta` quando todos os itens estiverem prontos.

## Política de capacidade decidida pela equipa

- Cada data aceita no máximo seis encomendas não canceladas. A verificação conta pedidos Pendentes, Confirmados e estados seguintes. Cancelar uma encomenda liberta o lugar. A criação bloqueia a data numa transação PostgreSQL, conta os pedidos e só cria um novo quando ainda há lugar; pedidos simultâneos não podem ultrapassar seis.

- Um pedido de bolo personalizado em `Pendente` ocupa um dos seis lugares diários de encomenda, mas ainda não reserva uma vaga específica de bolo personalizado.
- Ao criar o pedido público, o servidor faz uma pré-verificação instantânea: soma os bolos físicos personalizados já confirmados (e estados posteriores, exceto cancelados) na data aos bolos personalizados do pedido. Se o total exceder seis, recusa a criação sem gerar código; se houver capacidade observada, cria `Pendente`, mas não garante nem reserva vaga.
- A capacidade conta **bolos físicos**, não encomendas, clientes ou quilogramas. Cada bolo personalizado tem item/ID e peso individuais. Dois bolos na mesma encomenda ocupam duas das seis vagas.
- A vaga só é atribuída quando a Gestora regista o sinal pago e o pedido passa a `Confirmada`. Encomendas personalizadas confirmadas antes têm prioridade, independentemente da ordem em que os pedidos pendentes foram criados.
- Ao confirmar, o servidor volta a verificar o limite de seis bolos personalizados na data de levantamento e reserva a vaga na mesma transação. Se a capacidade se esgotar depois da pré-verificação, não confirma. Como o pagamento ocorre fora da aplicação, a equipa deve verificar a agenda antes de instruir o cliente a pagar. Se o dinheiro tiver sido recebido antes de a vaga desaparecer, o registo financeiro deve refletir esse facto e a Gestora resolve a alteração de data ou o reembolso simulado; a exceção continua sem fluxo automático explícito.
- A verificação da capacidade e a confirmação devem ser uma única operação segura no servidor, para que dois pedidos simultâneos não ocupem a sexta vaga.
- Pedidos `Cancelada` não ocupam vaga. Pedidos confirmados em estados posteriores continuam a ocupar a capacidade da data correspondente.
- Esta lista de espera é uma decisão da equipa para pedidos pendentes; o dossier não especifica uma fila nem prioridade por ordem de chegada.

## Demonstração exigida

1. Cliente encomenda bolo personalizado de chocolate de 2 kg para sete dias depois, com “Parabéns Inês” e alergia a frutos secos; recebe código.
2. Pedido de bolo personalizado para depois de amanhã é bloqueado.
3. Levantamento à segunda-feira é bloqueado.
4. Gestora vê Pendente, regista sinal de 17 € de um total de 56 €, confirma; saldo 39 €.
5. Produção vê a encomenda e a alergia destacada.
6. Um novo pedido é recusado na criação se a data já tiver seis encomendas não canceladas; não é criada encomenda nem código. O limite de bolos personalizados continua a ser validado separadamente na confirmação.
7. Cliente consulta por código; Produção marca Pronta; Gestora regista restante e marca Entregue.

## Dados de origem

O catálogo contém 11 produtos e a agenda contém 8 encomendas. O seed deve preservar os valores originais. Como a agenda informa dias da semana sem datas completas, a data atribuída a cada registo terá de ser documentada.

## Decisões já especificadas no contrato técnico

- Como representar itens vendidos por kg, unidade, cento, dúzia e meia dúzia? Ver [modelo proposto](modelo-dados.md).
- Para cada bolo personalizado, apresentar um subformulário com produto, peso individual, mensagem, alergias e notas. Um bolo de 2 kg ocupa uma vaga; dois bolos de 1 kg cada ocupam duas. A encomenda agrupa os itens e tem um total e um sinal calculados para o pedido completo.
- Seguimento: código aleatório de alta entropia, armazenamento de hash, limitação de tentativas e resposta mínima sem contacto pessoal.
- Transições por perfil, estados independentes dos itens e prazos para encomendas mistas: ver [contrato da API](api.md).

Estas decisões devem ser aplicadas como documentado no contrato técnico e explicadas no pitch e no README. A criação reserva um lugar diário de encomenda; pedidos Pendentes só não reservam a capacidade específica de bolos personalizados.
