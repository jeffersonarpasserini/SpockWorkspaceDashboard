# Execução Docker local

Esta configuração prepara e verifica somente o dashboard. Ela não altera Homepage, proxy reverso, Tailscale ou outros serviços do homelab.

## Limites

- Publicação padrão em `127.0.0.1:3011`; não exponha diretamente em LAN/Internet.
- Único mount: workspace explícito e read-only em `/workspace`.
- Sem Docker socket, devices, home Hermes ou credenciais do host.
- Root filesystem read-only, usuário não-root, `cap_drop: ALL`, `no-new-privileges`, recursos e logs limitados.
- `/api/health` é liveness, não autenticação nem readiness das integrações.

## Um comando executável, nunca um helper sourced

O host suportado é Linux com Docker/Compose, `curl`, Python 3 e GNU coreutils `timeout` com a opção `--kill-after`; implementação incompatível de `timeout` falha fechado no probe de isolamento. O probe não usa `--foreground`, permitindo que o timeout encerre o grupo de processos completo caso o cliente Docker ou seu filho fique bloqueado.

Defina um workspace absoluto existente e execute o CLI como processo filho:

```bash
export DASHBOARD_WORKSPACE_PATH=/caminho/absoluto/do/workspace
./scripts/deploy.sh validate
./scripts/deploy.sh build
./scripts/deploy.sh local
```

Não execute `source scripts/compose-safe.sh`, `. scripts/compose-safe.sh` nem habilite `set -euo pipefail` no shell remoto. Se uma validação falhar, somente `deploy.sh` termina com status não zero; a sessão chamadora permanece aberta e com as mesmas opções.

`build` valida o Compose sem secret e constrói a imagem local. `local` repete essa preparação, inicia o runtime e exige health Docker, verifier efetivo, probe comportamental de isolamento e liveness HTTP. O primeiro uso sempre exige `DASHBOARD_WORKSPACE_PATH`; o CLI não tenta adivinhar onde estão os projetos.

## Configuração e segredos

Defaults configuráveis: `DASHBOARD_PORT=3011`, `DASHBOARD_MEMORY_LIMIT=512m`, `DASHBOARD_CPUS=1.0`, `DASHBOARD_PIDS_LIMIT=128`, `DASHBOARD_LOG_MAX_SIZE=10m`, `DASHBOARD_LOG_MAX_FILE=3` e `DEPLOY_RUNTIME_TIMEOUT=10` segundos para o probe comportamental.

`HERMES_API_URL` e `HERMES_API_KEY` são opcionais. O executável usa o interpretador fixo `/bin/bash -p`, desativa tracing e remove `BASH_ENV`/`ENV` antes de ler a chave, impedindo hooks de startup, funções/opções importadas e resolução de interpretador por `PATH`. Em seguida, o CLI captura a chave em variável shell não exportada e exporta globalmente `HERMES_API_KEY=`. Assim, Git, `stat`, temporários, verifiers, `gh`, inspect, health, estado e todas as operações Compose exceto uma recebem chave vazia. Somente o processo exato `docker compose ... up --no-start` recebe a chave salva para criar o ambiente de runtime; o CLI nunca a imprime. Não imprima configuração expandida, ambiente, inspect amplo, logs ou bundles de debug quando houver secrets.

Toda chamada do CLI deriva e valida sua raiz física, fixa `--project-directory`, o caminho absoluto de `compose.yaml` e `--project-name spock-workspace-dashboard`, e remove seletores Compose herdados. Depois de canonicalizar o workspace, o CLI retém device/inode. Startup usa `up --no-start`, inspeciona o contêiner criado ainda parado e só então executa `start`. O entrypoint compara device/inode de `/workspace` com a identidade capturada antes de executar Node; mismatch impede o serviço e remove o contêiner staged. Em Linux Docker com bind mount local, o mount fixa o objeto montado, portanto troca posterior do pathname não troca o mount já criado.

Isto fecha o início de serviço sobre uma substituição não verificada, mas não afirma atomicidade impossível entre o último `stat` do host e o consumo do bind pelo daemon: a proteção dessa janela é o gate dentro do mount efetivo. A igualdade device/inode é um requisito de compatibilidade Linux; daemon remoto, Docker Desktop ou filesystem que remapeie esses valores falha fechado e não é suportado sem um mecanismo de identidade equivalente validado. Alterações de conteúdo dentro do mesmo diretório continuam dentro do modelo de workspace local não confiável e read-only para o contêiner. JSON temporário fica em `${TMPDIR:-/tmp}` e é removido por trap.

## Estado, verificação e teardown

```bash
./scripts/deploy.sh status
./scripts/deploy.sh verify
./scripts/deploy.sh down
```

O CLI executa `scripts/verify-compose-config.py` sobre a configuração declarada e `scripts/verify-container-inspect.py` sobre uma projeção efetiva restrita. O verifier declarado aceita `privileged` ausente porque Compose v5 pode omitir o valor padrão `false` ao renderizar JSON; quando presente, somente o booleano literal `false` é aceito. Ele continua rejeitando serviços, portas, mounts, privilégios, recursos e opções de log extras. O verifier efetivo exige `Privileged=false`, `.Config.User` literalmente `node` (o contrato do Dockerfile) e `.HostConfig.ReadonlyRootfs` literalmente `true`, além de rejeitar escapes equivalentes no estado do contêiner.

Depois de start e health, e também em `deploy.sh verify`, o CLI usa o mesmo CID já capturado para executar um probe com timeout no host e `HERMES_API_KEY` vazia. O probe não imprime ambiente e não tenta criar arquivos: captura somente `id -u`, exige UID diferente de zero e usa `test ! -w /` e `test ! -w /workspace`. Falha ou timeout encerram a verificação antes do `curl`. O health Docker continua validado separadamente do payload HTTP exato `{ "status": "ok" }`.

O Compose não possui volume persistente; o workspace é read-only. `down` remove somente a stack fixa do dashboard. Para retornar exatamente ao Node local em loopback, execute cada comando como processo filho (não use `source` e não altere opções do shell):

```bash
./scripts/deploy.sh down
npm ci
npm run build
env -u HOSTNAME -u PORT DASHBOARD_HOSTNAME=127.0.0.1 PORT=3011 npm start
```

O último comando fica em primeiro plano, prepara os assets standalone pelo script de `npm start` e fixa `127.0.0.1:3011`, neutralizando valores herdados. Para releases imutáveis e rollback por versão/digest, consulte [`versioned-deployment.md`](versioned-deployment.md).

## Graphify

A consulta Graphify deste repositório segue pendente porque `graphify-out/graph.json` não existe. Nenhum resultado foi presumido.
