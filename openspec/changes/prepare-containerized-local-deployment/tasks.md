## 1. Contrato e healthcheck

- [x] 1.1 RED: adicionar teste falhando para `GET /api/health` com payload mínimo e `Cache-Control: no-store`; executar `npm test -- src/app/api/health/route.test.ts` e confirmar falha pela ausência do route.
- [x] 1.2 GREEN: implementar o route de liveness sem consultar integrações e executar novamente o teste direcionado.

## 2. Imagem e Compose seguros

- [x] 2.1 RED: adicionar testes falhando para saída standalone, usuário não-root, Git, healthcheck, loopback, workspace read-only e ausência de mounts sensíveis; executar `npm test -- src/container-config.test.ts`.
- [x] 2.2 GREEN: adicionar `next.config.ts`, `.dockerignore` e Dockerfile multi-stage de produção, sem secrets de build e com runtime não-root.
- [x] 2.3 GREEN: adicionar `compose.yaml` com porta `127.0.0.1`, workspace obrigatório `:ro`, root filesystem read-only, capabilities removidas e sem Docker socket/home Hermes.
- [x] 2.4 Executar novamente `npm test -- src/container-config.test.ts` e confirmar os defaults declarados.
- [x] 2.5 RED/GREEN: cobrir e adicionar limites Compose não-Swarm de `512m`, `1.0` CPU, `128` PIDs e logging `local` rotacionado em `10m` x 3, sem `deploy.resources`.
- [x] 2.6 RED/GREEN: substituir `next start` por script standalone Linux com loopback/3011 por padrão, `HOSTNAME` ambiente neutralizado e overrides explícitos `DASHBOARD_HOSTNAME`/`PORT` preservados, exigindo build prévio sem fazê-lo implicitamente.

## 3. Operação e documentação

- [x] 3.1 Documentar configuração por ambiente/secret, modo degradado do Kanban e conectividade explícita da API Hermes.
- [x] 3.2 Documentar que o healthcheck é liveness não autenticado e que exposição além do loopback exige proxy autenticado/Tailscale e revisão OpenSpec posterior.
- [x] 3.3 Registrar que nenhum Docker/Homepage/proxy/Tailscale vivo foi alterado e que esta preparação não é um deployment.
- [x] 3.4 Corrigir o runbook para inspecionar o Compose com `HERMES_API_KEY` vazia, alertar sobre inspeções que revelam ambiente, fornecer assertions reproduzíveis de health/UID/escrita/hardening e whitelists exaustivas de portas, capabilities, `.Mounts` e `.HostConfig.Tmpfs` no Compose e no contêiner efetivo, além de documentar rollback sem volumes persistentes com retorno exato ao Node local.
- [x] 3.5 Alinhar README/rollback ao servidor standalone e documentar limites de preparação versus tuning real do host Linux.
- [x] 3.6 Estender assertions declaradas/efetivas para rejeitar `deploy`, controles de recurso ou opções de log adicionais e comparar memória, CPU, PIDs e rotação aos overrides escolhidos.
- [x] 3.7 Fixar toda operação e rollback Compose à raiz/arquivo/nome de projeto validados, neutralizar variáveis Compose herdadas e extrair verificadores versionados com sandbox fail-closed para privilégio, devices e perfis/modos host-like.
- [x] 3.8 Adicionar `prepare:standalone` para assets estáticos/public em todo start, remover cópia duplicada do Playwright e proibir reutilização do servidor E2E.
- [x] 3.9 Tornar verificadores e payload de health fail-closed sem `assert`, cobrir Python normal/otimizado e separar config/build sem segredo de `up` com chave opcional de runtime.
- [x] 3.10 RED/GREEN: rejeitar `User` efetivo vazio/root e `ReadonlyRootfs` falso/ausente, projetar ambos no inspect e executar no CID fixo um probe comportamental limitado, sem escrita nem dump de ambiente, para UID não-zero e `/`/`/workspace` não graváveis após start/health e em `verify`.

## 4. Verificação

- [x] 4.1 Executar `npm test`, `npm run typecheck`, `npm run lint` e `npm run build`; confirmar que `.next/standalone/server.js` foi gerado e exercitar `/api/health` no servidor standalone local.
- [x] 4.2 Executar `npx -y @fission-ai/openspec@1.8.0 validate prepare-containerized-local-deployment --strict` e corrigir erros.
- [x] 4.3 No host Linux Docker `bumblebee`, executar na revisão `04c51db` o fluxo corrigido completo `deploy.sh local`, seguido de `verify`, `status` e liveness HTTP. A execução de 2026-08-16 reconstruiu e recriou o contêiner, retornou `verify` rc 0, serviço `healthy`, publicação exclusiva em `127.0.0.1:3011`, `User=node`, `ReadonlyRootfs=true`, UID não-root e `/`/`/workspace` não graváveis.
- [x] 4.4 Consultar Graphify e cruzar relações de Docker, control plane, retenção, Hermes e Tailscale; registrar evidência e limitações em `docs/graphify-evidence.md`.
- [x] 4.5 Revisar `git diff`/`git status`, manter `next-env.d.ts` fora do diff e deixar commit/push fora da preparação técnica até a aprovação final integrada.
- [x] 4.6 Executar o gate real `npm run test:e2e` contra um standalone novo em `127.0.0.1:3101`, com `reuseExistingServer: false` e assets preparados pelo próprio start; confirmar 3 testes aprovados e 1 skip esperado do cenário exclusivamente mobile.
