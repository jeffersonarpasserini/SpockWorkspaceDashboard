## Context

Veja `proposal.md` para a motivação. A aplicação Next.js 16.3 exige Node >=20.19, não possui `next.config`, Dockerfile ou Compose, e usa filesystem local e Git como evidência. Hermes Kanban depende de CLI opcional; chat depende de URL/chave server-side opcional. O runtime temporário de desenvolvimento não é um deployment e não será alterado.

`graphify-out/graph.json` não existe neste root. A consulta Graphify permanece pendente e não há dados de grafo disponíveis para orientar ou validar este design.

## Goals / Non-Goals

**Goals:**

- Construir uma saída standalone em imagem multi-stage e executar o runtime mínimo como usuário não-root.
- Tornar os limites de rede, mounts e segredos visíveis e seguros por padrão.
- Permitir verificação automatizada do processo sem acoplar o healthcheck a dados sensíveis ou integrações opcionais.
- Manter os adaptadores e a derivação conservadora de status sem mudança.

**Non-Goals:**

- Instalar Hermes CLI ou conceder acesso a estado/credenciais Hermes do host.
- Disponibilizar autenticação de aplicação, TLS ou acesso público/LAN.
- Automatizar deploy, Homepage, proxy reverso ou Tailscale.
- Executar Docker neste ambiente de preparação.

## Decisions

### 1. Imagem multi-stage com saída standalone

`next.config.ts` habilita `output: "standalone"`. Um estágio instala dependências reproduzíveis com `npm ci`, outro executa o build e o runtime copia apenas standalone/static e os pacotes de sistema necessários. Git e certificados CA ficam no runtime; o usuário `node` existente executa `server.js`.

Alternativa considerada: executar `next start` com todo o projeto e `node_modules`. Rejeitada por ampliar a imagem e a superfície de runtime.

O mesmo contrato vale fora do contêiner: `npm start` delega ao script explícito `start:standalone`, que sempre executa `prepare:standalone` para substituir `.next/standalone/.next/static` pela saída atual e copiar `public` quando presente antes de executar `.next/standalone/server.js`. O start exige que `npm run build` tenha concluído e não dispara build implicitamente. No shell Linux do homelab, `HOSTNAME=${DASHBOARD_HOSTNAME:-127.0.0.1}` evita que o `HOSTNAME` ambiente do sistema amplie o bind por acidente, enquanto `PORT=${PORT:-3011}` mantém 3011 por padrão sem sobrescrever a porta fornecida pelo operador. O override de endereço deliberado é `DASHBOARD_HOSTNAME`. Isso evita o warning/fluxo não suportado de `next start` com `output: "standalone"` no Next.js 16.3 e torna o rollback coerente com o artefato construído.

### 2. Binding interno versus publicação no host

O servidor escuta `0.0.0.0:3000` somente dentro da rede do contêiner; Compose publica `127.0.0.1:${DASHBOARD_PORT:-3011}:3000`. O host usa 3011 por padrão para não colidir com o Homepage existente em 3000, enquanto o target e o healthcheck internos permanecem em 3000. O limite de confiança é a publicação no host, não o binding interno necessário à rede Docker.

Alternativa considerada: publicar em `0.0.0.0`. Rejeitada porque a aplicação não fornece autenticação e a mudança original é local-only.

### 3. Mount mínimo e somente leitura

Somente o workspace selecionado é montado em `/workspace:ro`. Não são declarados socket Docker, devices, home Hermes ou credential files. O filesystem raiz do contêiner é read-only, `privileged` é explicitamente falso, capacidades são removidas, a coleção `security_opt` contém somente `no-new-privileges`, modos PID/IPC host-like são rejeitados e `/tmp` usa tmpfs.

A contenção dos adaptadores continua necessária mesmo com mount read-only: conteúdo local é tratado como não confiável e symlinks/traversal continuam sendo rejeitados.

### 4. Segredos e integrações opcionais

`HERMES_API_KEY` e demais configurações entram somente no runtime por ambiente (ou secret injection do orquestrador que materialize ambiente); não há `ARG`, `ENV` com valor secreto no Dockerfile nem cópia de `.env`. Sem Hermes CLI, Kanban degrada como já especificado. Chat só funciona com uma URL alcançável do contêiner e uma chave configurada explicitamente.

Alternativa considerada: montar `~/.hermes` para reutilizar configuração/CLI. Rejeitada por expor estado e credenciais do host e por quebrar o limite desta preparação.

### 5. Liveness deliberadamente raso

`GET /api/health` retorna apenas `{ "status": "ok" }` com `no-store`. Não lê configuração nem chama adaptadores. O healthcheck prova que o processo HTTP responde; não é readiness de integrações, autenticação ou autorização de exposição.

Alternativa considerada: retornar status de Git/Hermes/workspace. Rejeitada porque aumenta custo, fragilidade e vazamento de topologia operacional.

### 6. Validação sem workflow de CI adicional

Os gates locais existentes, build standalone, teste do route e validação OpenSpec cobrem a mudança. Não será criado workflow de CI apenas para esta preparação; uma validação real de imagem requer Docker disponível em ambiente posterior.

### 7. Runbook verificável e inspeção de segredos

O CLI executável usa `/bin/bash -p`, desativa tracing e remove `BASH_ENV`/`ENV` antes de ler a chave; então captura `HERMES_API_KEY` uma vez em variável shell não exportada e imediatamente exporta a variável ambiente vazia antes de qualquer filho. Git, stat, temporários, verifiers, `gh`, config/build/pull/ps/start/down, inspect, curl e estado recebem vazio. Somente o processo exato `docker compose ... up --no-start` recebe a chave salva para materializar o ambiente do runtime; nenhuma função recebe a atribuição durante revalidação e nenhum comando imprime a chave. Inspeções amplas com `docker inspect`, `compose config`, `exec env`, logs ou debug bundles continuam sendo saídas sensíveis.

Os comandos de host falham quando as invariantes não valem, inclusive com Python otimizado, e separam o health mantido pelo Docker da requisição `curl`. Como Compose v5 serializa o booleano `privileged` com omissão do valor padrão, o verifier declarado trata o campo ausente como o default seguro `false`, aceita apenas o booleano literal `false` quando o campo existe e mantém a confirmação independente de `Privileged=false` na inspeção efetiva.

Startup é bifásico: `up --no-start` cria o contêiner, a projeção efetiva é validada enquanto nenhum processo pode servir e somente depois `start` é chamado. Um entrypoint mínimo compara device/inode de `/workspace` dentro do bind efetivo com a identidade capturada no host e só então `exec` Node. Em Linux Docker local, o bind criado fixa o objeto montado; substituir posteriormente o pathname não redireciona esse mount. Não se afirma atomicidade impossível entre `stat` e o consumo do bind pelo daemon: o gate cobre essa janela validando o mount consumido. Remapeamento de device/inode em daemon remoto, Docker Desktop ou filesystem incompatível falha fechado; esses ambientes exigem mecanismo equivalente antes de suporte. Conteúdo mutável dentro do mesmo inode permanece workspace não confiável e read-only no contêiner. Um helper versionado resolve e valida sua própria raiz Git e fixa `--project-directory`, o caminho absoluto de `compose.yaml` e `--project-name spock-workspace-dashboard` em config/build/up/ps/exec/down e CID; ele remove variáveis Compose herdadas de arquivo, projeto, separador, env files e profiles. As verificações usam exceções explícitas de validação e igualdade/whitelist, não `assert` removível nem `any`: no Compose expandido e no estado efetivo, rejeitam privilégios, devices, modos PID/IPC host-like, AppArmor/seccomp `unconfined`, qualquer publicação além da única `127.0.0.1:<porta>:3000/tcp`, capabilities ou mounts fora da whitelist. Na inspeção efetiva, o bind é validado exaustivamente em `.Mounts`, enquanto o tmpfs curto do Compose é validado separadamente em `.HostConfig.Tmpfs`. Arquivos temporários usam `${TMPDIR:-/tmp}`, nunca o workspace.

### 8. Limites de recursos e logs para Compose não-Swarm

O serviço usa diretamente `mem_limit`, `cpus` e `pids_limit`, evitando `deploy.resources`, cujas semânticas pertencem a Swarm e podem ser ignoradas em operação Compose não-Swarm. Defaults conservadores de preparação limitam a aplicação Next a `512m`, `1.0` CPU e `128` PIDs. O driver `local` recebe `max-size=10m` e `max-file=3`, evitando crescimento de logs sem limite. Todas as cinco grandezas aceitam overrides de ambiente positivos para tuning medido do host Linux; elas não são uma recomendação universal de capacidade.

As assertions do runbook comparam o Compose expandido e `.HostConfig.Memory`, `.NanoCpus`, `.PidsLimit` e `.LogConfig` efetivos aos defaults/overrides escolhidos. Whitelists de campos rejeitam `deploy`, controles de recurso adicionais, driver diferente, campos extras e opções de logging fora de `max-size`/`max-file`, para que um valor seguro não masque outro valor perigoso.

## Trust boundaries and failure behavior

- Build context: `.dockerignore` exclui dependências, outputs, ambientes, logs e dados Graphify.
- Runtime: o workspace é conteúdo local não confiável e somente leitura; as proteções dos adaptadores permanecem ativas.
- Host: nenhum serviço vivo, socket, Hermes home ou credencial é montado.
- Rede: loopback é o único endereço publicado por padrão; o endpoint não autentica usuários.
- Falhas Git/OpenSpec/Hermes mantêm estados indisponíveis conservadores; o healthcheck continua restrito à vida do processo.

## Testing

- Teste unitário do route prova status, payload exato e `Cache-Control: no-store`.
- Suite completa, typecheck, lint, build e startup HTTP real do script standalone verificam regressões, geração standalone, loopback padrão e respeito a `PORT` fornecida.
- `openspec validate ... --strict` verifica os artefatos normativos.
- O runbook fornece assertions reproduzíveis e fail-closed para Compose expandido com chave vazia, build/up/ps, health Docker, liveness HTTP, UID, escrita e whitelists de portas, capabilities, mounts, recursos e logging no Compose e no contêiner efetivo.
- A sintaxe/execução Docker real fica explicitamente não verificada neste ambiente porque o binário Docker não está instalado; documentar os comandos não conclui a tarefa futura de host Docker.

## Risks / Trade-offs

- [Imagem base envelhece] → Fixar uma versão compatível e reconstruir/revisar atualizações regularmente.
- [Root filesystem read-only conflita com cache futuro] → Manter `/tmp` temporário e testar o runtime real antes do homelab.
- [API Hermes no host não é alcançável por loopback do contêiner] → Documentar que a URL deve ser explicitamente alcançável e protegida; não adicionar networking privilegiado implícito.
- [Operador altera o binding para LAN] → Exigir camada autenticada externa e revisão OpenSpec para mudanças de comportamento.
- [Health verde com integrações indisponíveis] → Nomear e documentar como liveness, nunca readiness funcional.

## Migration Plan

1. Revisar os arquivos e gates locais sem iniciar serviços externos.
2. Em ambiente com Docker, construir a imagem e iniciar Compose ainda em loopback com workspace de teste.
3. Executar as assertions do runbook para health Docker e HTTP separadamente, usuário não-root, rootfs e workspace não graváveis e hardening efetivo.
4. Configurar API Hermes apenas se houver endpoint protegido e alcançável.
5. Antes de qualquer acesso além do loopback, criar a configuração autenticada externa e uma mudança OpenSpec adicional quando necessário.

Rollback: executar, como processos filhos e sem source ou mutação de opções do shell, `./scripts/deploy.sh down`, `npm ci`, `npm run build` e `env -u HOSTNAME -u PORT DASHBOARD_HOSTNAME=127.0.0.1 PORT=3011 npm start`. O teardown fixa raiz/arquivo/nome de projeto e neutraliza targeting herdado; o start prepara os assets standalone e fixa o Node local em loopback. O Compose não declara volumes persistentes da aplicação e monta o workspace somente leitura; nenhum dado ou serviço externo é migrado por esta mudança. Homepage, proxy e Tailscale continuam adiados e fora do rollback.

## Open Questions

- A consulta Graphify deverá ser refeita quando `graphify-out/graph.json` existir para este root; até lá, a tarefa permanece pendente e nenhum resultado é inventado.
