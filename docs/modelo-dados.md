# Modelo de dados proposto — versão para revisão

Este desenho cobre os cinco requisitos obrigatórios do dossier. A base de dados candidata é PostgreSQL, inclusive se hospedada no Supabase. Nenhuma tabela foi criada ainda.

| Entidade | Dados essenciais | Relações e razão |
| --- | --- | --- |
| Produto | ID, nome, categoria, preço em cêntimos por unidade de venda, unidade (`kg`, `unidade`, `cento`, `dúzia`, `meia dúzia`), alergénios, antecedência mínima, indicador de bolo personalizado, ativo | Um produto aparece em muitos itens de encomenda. Guardar unidade evita interpretar “2” como 2 kg ou 2 unidades por engano. |
| Encomenda | ID, código de seguimento não sequencial, nome e telefone do cliente, data/hora de levantamento, estado, mensagem do bolo, alergias declaradas, notas, total em cêntimos, origem (`online`, `balcão`, `telefone`), data de criação | Uma encomenda possui vários itens e registos de pagamento. O total é calculado no servidor. |
| Item de encomenda | ID, encomenda, produto, quantidade, preço unitário e unidade no momento do pedido, subtotal | O preço fica preservado mesmo que o catálogo mude depois. Quantidade permite kg fracionários, como 1,5 kg. |
| Pagamento simulado | ID, encomenda, tipo (`sinal`, `restante`, `reembolso`), valor em cêntimos, data/hora, utilizador que registou | Permite calcular pago e em falta sem depender de um único campo booleano. Não representa uma transação real. |
| Utilizador interno | ID, identificador de login, hash da palavra-passe ou referência a provedor de autenticação, perfil (`gestora`, `produção`), ativo | O cliente encomenda e acompanha sem criar conta. As permissões de Gestora e Produção são verificadas no servidor. |

## Relações

`Produto 1—N Item de encomenda N—1 Encomenda 1—N Pagamento simulado`. O utilizador interno pode ser associado aos pagamentos e às mudanças de estado para auditoria.

## Valores derivados e regras

- `subtotal = quantidade × preço unitário`; `total = soma dos subtotais`; preços já incluem IVA.
- Para encomenda com bolo personalizado, `sinal exigido = 30% do total, arredondado ao euro`; o cenário exige 56 € → 17 €.
- `valor em falta = total − pagamentos registados`, considerando eventuais reembolsos.
- Alergias declaradas pelo cliente ficam separadas dos alergénios do catálogo: umas são restrições individuais, os outros são ingredientes/alertas do produto. A produção deve ver ambos claramente.
- O servidor valida prazo, segunda-feira, limite diário, transições de estado, saldo e permissões. Um personalizado `Pendente` não ocupa vaga; a vaga só é atribuída na confirmação após registo do sinal, com verificação atómica da capacidade no servidor. Pedidos cancelados libertam vaga; os demais estados confirmados continuam a contar para a data.
- A data/hora de levantamento deve ser tratada no fuso `Europe/Lisbon`; os oito pedidos históricos não têm data completa no ficheiro original, por isso o seed precisa de uma escolha documentada.

### Exemplo de encomenda com unidades diferentes

Uma encomenda pode ter duas linhas de itens, sem criar colunas especiais para cada tipo de produto:

| Item | Quantidade | Unidade guardada | Preço por unidade | Subtotal |
| --- | ---: | --- | ---: | ---: |
| Bolo personalizado de chocolate | 2 | kg | 28 € | 56 € |
| Mini-quiches | 4 | dúzia | 12 € | 48 € |

Total = 104 €. Como inclui bolo personalizado, a regra do sinal incide sobre o total da encomenda: 30% = 31,20 €, arredondado ao euro = 31 €. Esta aplicação da regra a uma encomenda mista deve ser documentada, pois o dossier não dá um exemplo desse caso.

## Questões de revisão antes de implementar

1. O código de seguimento sozinho permite consultar dados pessoais? Se sim, que dados aparecem e como evitar enumeração?
2. O sinal é arredondado por encomenda (30% do total), como diz o dossier, ou por item? A proposta usa o total da encomenda.
3. A capacidade de seis conta bolos, não kg. Como representar explicitamente o número de bolos quando uma encomenda pode conter vários personalizados?
4. Que perfil pode passar `Confirmada` a `Em produção` e `Pronta` a `Entregue`?
