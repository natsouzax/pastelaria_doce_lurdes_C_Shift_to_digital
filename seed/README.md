# Seeds e origem dos dados

## Dados originais Cliente C

O dossier e os anexos com os 11 produtos e 8 pedidos não estão neste repositório nem nos worktrees locais revistos. O seed original não preenche valores fictícios: `scripts/seed-original.ts` lê um ficheiro local `seed/original-data.json` e valida as contagens antes de escrever.

O ficheiro local deve incluir os produtos, encomendas, linhas, valores originais e, para cada encomenda, `pickup_weekday`, `pickup_date` atribuída e instante ISO 8601. `date_assignment_notes` deve explicar a regra aplicada (por exemplo, calendário de referência escolhido e como cada dia da semana foi mapeado). O seed valida que a data atribuída cai no dia da semana informado. As datas não podem ser inventadas sem a agenda fonte.

O arquivo local está ignorado pelo Git para que material não revisto não entre no commit. Não inserir contactos reais da equipa nem credenciais.

## Fixture separada da demonstração

`demo-day.json` é inteiramente fictícia e não substitui nenhum dos oito pedidos da origem. Contém seis registos separados, cada um com um item/ID de bolo personalizado. O primeiro ilustra o bolo de chocolate de 2 kg por 56 €, com mensagem e alergia a frutos secos; os restantes cinco ocupam as outras vagas. A data escolhida é terça-feira, 8 de dezembro de 2026, 10:00 em Europe/Lisbon. É posterior ao dia de referência da implementação (16 de novembro de 2026) e cumpre a antecedência de cinco dias.

A fixture cria também um produto ativo na categoria `Demonstração`, a 28 €/kg. É um item extra claramente identificado e não altera os 11 produtos de origem. O seed recusa a execução se já houver bolos confirmados nessa data, para não misturar a fixture com encomendas locais.

## Resolução do sinal quando a vaga desaparece

`Pendente` nunca ocupa vaga, inclusive quando ficou sinal registado. Confirmações de bolos personalizados bloqueiam a data numa transação PostgreSQL. Se um sinal já recebido vencer a corrida, o registo fica Pendente com `capacity_resolution_required=true` e não conta para a capacidade. A Gestora resolve por reembolso simulado (que cancela o pedido) ou por reagendamento manual fora desta API; não existe operação de alteração de data no contrato atual. Não se repete o registo do sinal.

## Cancelamento e saldo

Até 48 horas antes do levantamento, o cancelamento reembolsa de forma simulada o sinal líquido quando não houve pagamento acima do sinal. A menos de 48 horas, o sinal fica retido. Pagamentos além do sinal exigem resolução manual e a API não os retém nem reembolsa automaticamente. Entrega exige todos os itens Prontos e saldo zero. Um bolo de 56 € exige sinal de 17 € e saldo de 39 €.
