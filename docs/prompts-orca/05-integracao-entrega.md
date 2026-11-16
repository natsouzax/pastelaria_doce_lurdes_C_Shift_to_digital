# Prompt — agente de documentação e preparação da entrega

Trabalha na branch `docs-integration`, nunca diretamente na `main` enquanto backend e frontend estiverem ativos. Lê `docs/contrato-mvp.md`, `docs/api.md`, dossier e critérios. A tua missão é preparar a documentação e verificar os entregáveis; o agente coordenador da `main` é responsável por rever e integrar os PRs. Mantém README com instruções reais de instalação/execução, seed, contas de teste por perfil, cenário de demo, decisões e limitações; cria `.env.example` sem segredos e confirma `.gitignore`.

Quando as branches de backend e frontend estiverem prontas, acompanha os seus entregáveis para atualizar instruções e contas de teste. Executa o cenário oficial de sete passos numa versão integrada quando estiver disponível, verifica permissões pela API, base de dados inicial, responsividade e URL Vercel se houver deploy. Reporta falhas concretas com passos de reprodução ao agente coordenador e ao dono da área. Confirma que `.env`, credenciais e `node_modules` não foram publicados. O mínimo para prémio é 120/200, mas o objetivo é cumprir todos os obrigatórios.

Podes criar subagentes para revisão de segurança, QA e documentação. Não faças merge na `main`; entrega o teu trabalho por PR ao agente coordenador. Faz commit/push na tua branch; entrega checklist de pronto, evidências de testes e riscos restantes.
