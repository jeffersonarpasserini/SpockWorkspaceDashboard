## Why

O dashboard já funciona como aplicação local, mas ainda não possui um artefato de produção reproduzível para uma futura instalação no homelab. Esta mudança prepara e valida o empacotamento sem alterar Docker, Homepage, proxy reverso ou qualquer serviço vivo do homelab.

## What Changes

- Adiciona imagem Next.js de produção multi-stage, com saída standalone, Git no runtime e processo não-root.
- Adiciona Compose com publicação padrão apenas em `127.0.0.1`, workspace somente leitura e endurecimento sem socket Docker, diretório Hermes ou credenciais do host.
- Limita o Compose não-Swarm por padrão a `512m`, `1.0` CPU e `128` PIDs e configura rotação do driver `local` em `10m` x 3, com overrides explícitos para tuning do host.
- Alinha a inicialização e o rollback Node local à saída standalone, com loopback/porta host padrão `3011` e overrides de shell preservados, sem `next start` incompatível nem build implícito; a porta interna do contêiner permanece `3000`.
- Adiciona um endpoint de liveness mínimo, não autenticado e sem detalhes de integrações, exclusivo para healthcheck local.
- Documenta configuração por ambiente/secret, limitações do Hermes Kanban no contêiner e conexão opcional à API Hermes.
- Registra que qualquer exposição além do loopback exige proxy autenticado/Tailscale e uma nova mudança OpenSpec quando houver alteração de comportamento da aplicação.
- Registra a consulta Graphify executada nesta raiz e preserva seus resultados e limitações em `docs/graphify-evidence.md`.

### Goals

- Produzir artefatos portáveis para build e execução futura em Docker.
- Aplicar defaults locais, mínimos e verificáveis.
- Preservar a leitura conservadora de evidências e o modo degradado das integrações.

### Non-goals

- Executar ou alterar Docker, Homepage, proxy reverso, Tailscale ou serviços do homelab.
- Fornecer autenticação da aplicação ou afirmar que o serviço está seguro para LAN/Internet.
- Empacotar Hermes CLI, montar `~/.hermes`, credenciais do host ou `/var/run/docker.sock`.
- Implantar no homelab ou publicar imagem/container, release ou integração no Homepage.

### Operational risks

- O Hermes Kanban ficará indisponível no contêiner enquanto a Hermes CLI não for fornecida por uma futura integração deliberada.
- Uma URL Hermes em loopback aponta para o próprio contêiner, não para o host; a conectividade deve ser configurada explicitamente pelo operador.
- Mudanças futuras no binding de porta podem ampliar a superfície de exposição sem adicionar autenticação.
- Overrides de recursos inadequados podem causar pressão ou ociosidade no host; os valores versionados são limites conservadores de preparação, não dimensionamento final.
- Tags de imagem base e dependências devem continuar sendo revisadas e reconstruídas com atualizações de segurança.

### Affected data sources

- Workspace local montado somente leitura para os adaptadores de filesystem, Git e OpenSpec.
- Git CLI instalado dentro da imagem para evidência local.
- Hermes Kanban opcional, indisponível por padrão sem Hermes CLI.
- Hermes API opcional, configurada somente por URL e chave server-side.

## Capabilities

### New Capabilities

- `containerized-local-deployment`: Empacotamento e operação Docker local-only com healthcheck mínimo, mounts e segredos restritos e defaults de rede seguros.

### Modified Capabilities

- Nenhuma.

## Impact

Afeta a configuração de build Next.js, um novo route handler de health, artefatos Docker/Compose, testes, documentação operacional e arquivos OpenSpec. Não altera serviços externos nem o comportamento autenticado da aplicação, que continua inexistente para exposição remota.
