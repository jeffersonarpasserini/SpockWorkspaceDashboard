## ADDED Requirements

### Requirement: Publicação Tailscale explícita e restrita

A configuração Compose MUST publicar em `127.0.0.1` por padrão. Quando o operador fornecer `DASHBOARD_BIND_ADDRESS`, o deployment MUST aceitar somente `127.0.0.1` ou um IPv4 canônico no bloco Tailscale CGNAT `100.64.0.0/10`, MUST rejeitar wildcard, LAN RFC1918, hostnames, IPv6 e valores malformados, e MUST publicar exatamente uma porta TCP no endereço validado. Para endereço Tailscale, o CLI MUST provar antes de Compose que o valor aparece exatamente em `tailscale ip -4`; ausência do CLI, daemon indisponível, saída ambígua ou endereço não pertencente ao host MUST falhar fechado. A aplicação MUST NOT representar o health endpoint como autenticação.

#### Scenario: Default seguro permanece local
- **WHEN** o operador executa o deployment sem `DASHBOARD_BIND_ADDRESS`
- **THEN** o host publica somente `127.0.0.1:${DASHBOARD_PORT:-3011}:3000/tcp`

#### Scenario: Operador seleciona o IPv4 Tailscale
- **WHEN** o operador define `DASHBOARD_BIND_ADDRESS=100.95.240.74` e executa o deployment
- **THEN** o Compose declarado e o estado efetivo publicam exatamente `100.95.240.74:${DASHBOARD_PORT:-3011}:3000/tcp`, sem publicação adicional em loopback, LAN ou wildcard

#### Scenario: Operador tenta ampliar a exposição
- **WHEN** `DASHBOARD_BIND_ADDRESS` contém `0.0.0.0`, endereço LAN RFC1918, hostname, IPv6, valor fora de `100.64.0.0/10` ou formato inválido
- **THEN** o CLI falha antes de criar/recriar o contêiner

#### Scenario: Endereço CGNAT não pertence ao host Tailscale
- **WHEN** o endereço solicitado pertence a `100.64.0.0/10`, mas `tailscale ip -4` não o retorna exatamente ou não pode ser consultado
- **THEN** o CLI falha antes de executar Compose ou alterar o contêiner existente

### Requirement: Verificação e rollback do acesso Tailscale

O CLI SHALL usar o endereço validado nas verificações declarativa e efetiva e na liveness HTTP do host, mantendo o health interno separado. O runbook SHALL fornecer recriação, verificação, inspeção das ACLs/tags Tailscale aplicáveis, teste a partir de peer autorizado, contraprova de ausência de publicação na LAN e rollback exato para loopback, sem `source` e sem alterar opções da shell interativa.

#### Scenario: Binding Tailscale é verificado
- **WHEN** o contêiner é recriado com endereço Tailscale válido
- **THEN** `deploy.sh verify` falha se o Compose ou Docker reportar HostIp divergente, port binding adicional, health inválido, liveness inválida ou qualquer hardening existente inválido

#### Scenario: Operador retorna ao loopback
- **WHEN** o operador executa novamente o deployment com `DASHBOARD_BIND_ADDRESS=127.0.0.1`
- **THEN** o contêiner é recriado com publicação somente em loopback e nenhum dado persistente da aplicação é removido
