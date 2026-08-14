## 1. Contrato e testes

- [x] 1.1 Registrar proposta, design, spec e tarefas antes da implementação
- [x] 1.2 Adicionar testes RED para manifest, terminal-safety, targeting, segredos, release pull-only, health e workflow

## 2. Implementação

- [x] 2.1 Adicionar workflow tag-triggered aprovado, ancestry/main, preflight build-once, pins SHA, imagem por digest, attestation e manifest asset
- [x] 2.2 Fixar três stages Docker no digest manifest-list aprovado e atualizar Compose com `DASHBOARD_IMAGE` e fallback/build local
- [x] 2.3 Implementar manifest estável/seguro, verificação autoritativa gh/attestation e CLI executável autocontido
- [x] 2.4 Remover efeitos de opções shell globais do helper legado e registrar estado somente após sucesso
- [x] 2.5 RED/GREEN: exigir usuário/rootfs na inspeção efetiva e probe comportamental limitado no CID fixo após health, sem secret, dump de ambiente ou tentativa de escrita

## 3. Operação e documentação

- [x] 3.1 Adicionar runbook versionado e atualizar README/runbook local
- [x] 3.2 Documentar produção, local, rollback/down, segredos, estratégia auditável e ausência de versão atual

## 4. Verificação

- [x] 4.1 Rodar testes direcionados e suite Vitest limitada a um worker
- [x] 4.2 Rodar typecheck, lint, build e E2E exato
- [x] 4.3 Validar OpenSpec strict, shell, YAML, audit e diff; preservar `next-env.d.ts`
- [x] 4.4 Restaurar servidor dev em `127.0.0.1:3011` e limpar processos de teste
