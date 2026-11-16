# Origem e reprodução dos dados

`original-data.json` transcreve os 11 produtos e 8 encomendas de `content_project/Dados C - Pastelaria Doce Lurdes.xlsx` no checkout principal. Os valores, contactos fictícios, mensagens, alergias, notas textuais e coluna `Sinal` foram preservados. O ficheiro foi versionado para permitir `npm run seed:original` num clone limpo. O script valida a contagem, as datas e os dias da semana e faz upsert com IDs estáveis.

## Datas atribuídas

A agenda original contém apenas dia da semana e hora. Para tornar as linhas reproduzíveis, atribuí a semana de **17 a 22 de novembro de 2026**, em `Europe/Lisbon`: quinta 19 (Marta), sexta 20 (Escola), sábado 21 (Sofia, Inês, Rui, Catarina), domingo 22 (Pedro, Ana Luísa). Estas datas são inferências, não datas da folha. Também foram inferidos `source=counter`, `confirmed` para itens comuns e bolos com sinal Pago, e `pending` para Pedro com sinal Por pagar.

Sofia tem sinal Pago inferido em **17 €** (bolo 2 kg × 28 € = 56 €, 30% arredondados para cima); Catarina tem **24 €** (2,5 kg × 32 € = 80 €). `seed-original.ts` grava ambos em `simulated_payments`, marcados como pagamento externo histórico. Pedro não recebe registo financeiro. A folha não fornece montantes nem colaborador que registou os sinais; por isso `recorded_by` é `NULL` apenas nesses registos importados. Pagamentos feitos pela API exigem sempre Gestora autenticada. `DEMO_RECORDED_BY` é opcional na fixture; quando omitido, indica igualmente registo importado, sem fingir uma conta da equipa.

## Fixture da demonstração

`demo-day.json` contém cinco bolos individuais adicionais para **24 de novembro de 2026, 10:00**, usando o produto chocolate do catálogo original. O sexto é o bolo de 2 kg/56 € criado pelo percurso público em T0 = **17 de novembro de 2026, 10:00**. Execute `npm run seed:original` antes de `npm run seed:demo`. A fixture aceita até um bolo confirmado já presente nessa data. Cada linha tem ID, peso, mensagem e alergias próprios. O roteiro usa 19/11 para rejeição por antecedência e segunda-feira 23/11 para rejeição do dia fechado. O relógio da aplicação continua real; para reproduzir integralmente o percurso, o ambiente de teste precisa de relógio injetável/fixo em T0.

## Capacidade, sinal e cancelamento

`pending` nunca reserva vaga. Na criação pública, uma pré-verificação devolve `CAPACITY_FULL` se os bolos já confirmados somados aos novos excederem seis. Na confirmação, uma transação PostgreSQL bloqueia a data, conta apenas `confirmed`, `in_production`, `ready`, `delivered` e revalida a capacidade. Se o sinal externo já foi recebido mas a vaga desapareceu, o pedido fica `pending` com `capacity_resolution_required=true` e sem reserva. A Gestora decide operacionalmente entre nova data (rota futura) e reembolso simulado que cancela o pedido.

Até 48 horas antes do levantamento, o cancelamento reembolsa o sinal líquido simulado quando não houve pagamento acima dele. Depois desse limite, o sinal fica retido. Pagamentos acima do sinal exigem resolução manual. Não há ligação real a pagamentos ou mensagens.
