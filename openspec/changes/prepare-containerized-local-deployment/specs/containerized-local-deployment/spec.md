## Purpose

Define uma preparação Docker local e reproduzível que preserve os limites de confiança, o modo degradado e a acessibilidade do dashboard sem afirmar segurança para exposição remota.

## ADDED Requirements

### Requirement: Imagem de produção restrita

A imagem de produção MUST executar a saída de produção como usuário não-root, MUST incluir Git para coleta de evidência e MUST NOT incluir a Hermes CLI como requisito implícito.

#### Scenario: Runtime de produção inicia
- **WHEN** a imagem é construída e iniciada com uma configuração válida
- **THEN** o servidor standalone executa como usuário não-root e pode invocar Git para repositórios montados

#### Scenario: Runtime Node local inicia o artefato standalone
- **WHEN** o operador constrói e inicia a produção Node fora do contêiner sem overrides
- **THEN** o script prepara novamente `.next/static` e `public` quando presente dentro da árvore `.next/standalone`, executa o artefato já gerado por um `npm run build` bem-sucedido em `.next/standalone/server.js` em `127.0.0.1:3011`, sem usar `next start` nem executar build implicitamente, ignora o `HOSTNAME` ambiente do sistema e preserva overrides explícitos `DASHBOARD_HOSTNAME` ou `PORT` fornecidos pelo operador no shell Linux

#### Scenario: Hermes CLI não está empacotada
- **WHEN** o contêiner consulta Hermes Kanban sem uma Hermes CLI fornecida explicitamente
- **THEN** a integração é marcada como indisponível e as demais evidências continuam utilizáveis

### Requirement: Rede local por padrão

A configuração Compose MUST publicar o serviço somente no loopback por padrão e MUST NOT representar o endpoint de health como autenticação de usuário ou autorização para exposição em LAN ou Internet.

#### Scenario: Porta padrão é publicada
- **WHEN** o operador inicia a configuração Compose sem override de porta ou endereço
- **THEN** a porta HTTP do host é publicada em `127.0.0.1:3011`, direcionada à porta interna `3000`, e não em todas as interfaces do host; `DASHBOARD_PORT` preserva o override explícito

#### Scenario: Exposição além do loopback é considerada
- **WHEN** o operador precisa acessar o dashboard além do host local
- **THEN** a documentação exige proxy reverso autenticado ou Tailscale e uma mudança OpenSpec posterior se o comportamento da aplicação for alterado

### Requirement: Workspace e credenciais permanecem isolados

A configuração de contêiner MUST montar o workspace somente leitura, MUST NOT montar o socket Docker, o diretório Hermes do host ou arquivos de credenciais e SHALL aceitar segredos somente por ambiente ou mecanismo de secrets do orquestrador.

#### Scenario: Workspace é configurado
- **WHEN** um caminho de workspace do host é fornecido ao Compose
- **THEN** ele é apresentado ao adaptador em um caminho fixo somente leitura e continua sujeito às validações de contenção da aplicação

#### Scenario: Configuração mínima é inspecionada
- **WHEN** os mounts e variáveis declarados são revisados
- **THEN** não há mount de `/var/run/docker.sock`, `~/.hermes` ou arquivo de credencial e a chave Hermes não é incorporada na imagem

#### Scenario: Compose expandido é inspecionado com segurança
- **WHEN** o operador renderiza a configuração Compose para revisão
- **THEN** o runbook exige sobrescrever `HERMES_API_KEY` com valor vazio em config/build, preserva a chave opcional somente no `up` de runtime e alerta que configuração expandida, inspeção ampla do contêiner e ambiente de runtime podem revelar segredos

### Requirement: Healthcheck mínimo e limitado

O serviço SHALL fornecer um endpoint HTTP não autenticado de liveness que MUST retornar somente estado mínimo, MUST disable caching e MUST NOT consultar nem revelar workspace, Git, OpenSpec, Hermes, ambiente ou credenciais.

#### Scenario: Processo está vivo
- **WHEN** o healthcheck solicita o endpoint de liveness
- **THEN** recebe HTTP 200, `Cache-Control: no-store` e um objeto JSON mínimo indicando `ok`

#### Scenario: Integração está indisponível
- **WHEN** Git, OpenSpec ou Hermes está indisponível
- **THEN** o endpoint de liveness não inclui esse detalhe e não converte a resposta em uma afirmação de prontidão funcional

### Requirement: Interface preservada no contêiner

A execução containerizada MUST preservar os comportamentos de teclado, foco visível, headings semânticos e layout responsivo definidos para a interface local.

#### Scenario: Dashboard é aberto no runtime containerizado
- **WHEN** um usuário acessa a interface pelo endereço local publicado
- **THEN** os mesmos controles acessíveis e estados degradados do build de produção permanecem disponíveis

### Requirement: Verificação e rollback operacionais reproduzíveis

A documentação operacional SHALL fornecer comandos fail-closed, inclusive sob otimização Python, que rejeitem qualquer porta publicada, capability adicionada, device ou mount fora da whitelist, MUST NOT criar arquivos no workspace e SHALL distinguir o estado de health do Docker de uma requisição HTTP independente. Toda operação Compose, inclusive CID e rollback, MUST fixar a raiz validada do repositório, o caminho absoluto de `compose.yaml` e o nome de projeto `spock-workspace-dashboard`, neutralizando variáveis Compose herdadas que alterem targeting. Config e build MUST apagar a chave no processo Compose, enquanto `up` MUST preservar uma chave opcional fornecida para runtime. Ela SHALL verificar o Compose expandido e o estado efetivo do contêiner quando disponível, além de documentar rollback, ausência de volumes persistentes da aplicação, workspace somente leitura e retorno à execução de produção Node limitada ao loopback.

#### Scenario: Host Docker é verificado
- **WHEN** o operador executa a sequência documentada em um host com Docker
- **THEN** config/build/up/ps/exec e CID usam targeting fixo e assertions exaustivas validam health do Docker, resposta HTTP, UID não-root, `/` e `/workspace` não graváveis, rootfs read-only, `Privileged=false`, devices/device requests/device cgroup rules ausentes, modos PID/IPC não host-like, perfis AppArmor/seccomp não `unconfined`, publicação única `127.0.0.1:<porta>:3000/tcp`, `CapAdd` vazio/nulo, `CapDrop` contendo `ALL`, `no-new-privileges`, `.Mounts` contendo exatamente o bind `/workspace` read-only e `.HostConfig.Tmpfs` contendo exatamente `/tmp` com tamanho e opções aprovados, sem escrever no workspace

#### Scenario: Operador reverte para Node local
- **WHEN** o operador decide abandonar a execução Compose
- **THEN** o runbook remove somente o contêiner e a rede do projeto fixo usando raiz/arquivo/nome validados e variáveis Compose de targeting neutralizadas, informa que não há volume persistente da aplicação, neutraliza valores herdados de `DASHBOARD_HOSTNAME`, `PORT` e `HOSTNAME` e fornece comandos exatos para build bem-sucedido seguido do start standalone Node local fixado em `127.0.0.1:3011`, com preparo dos assets e sem build implícito

### Requirement: Recursos e logs são limitados no Compose local

A configuração Compose não-Swarm MUST aplicar limites diretos de memória, CPU e PIDs e MUST configurar rotação limitada de logs. Os defaults SHALL ser `512m`, `1.0` CPU, `128` PIDs e driver `local` com `max-size=10m` e `max-file=3`; SHALL aceitar overrides positivos documentados para tuning medido do host e MUST NOT depender de `deploy.resources`.

#### Scenario: Defaults de preparação são renderizados
- **WHEN** o operador renderiza o Compose sem overrides de recursos ou logging
- **THEN** o serviço contém exatamente os limites e opções padrão documentados, sem `deploy.resources`, controles de recursos concorrentes, driver adicional ou opções extras de logging

#### Scenario: Overrides do host são verificados
- **WHEN** o operador fornece overrides positivos e executa as verificações do runbook
- **THEN** o Compose expandido e o estado efetivo de memória, CPU, PIDs, driver e rotação são comparados exatamente aos valores escolhidos e qualquer campo ou opção adicional falha a verificação
