## Context

O Compose publica hoje apenas em loopback. A aplicação não possui autenticação própria, portanto remover o host IP da sintaxe da porta publicaria em todas as interfaces e ampliaria indevidamente o limite de confiança. O host `bumblebee` possui o IPv4 Tailscale `100.95.240.74`.

Graphify foi atualizado e consultado nesta raiz em 2026-08-15. O cruzamento confirmou que reachability Tailscale e liveness Docker não concedem autorização da aplicação nem liberam dispatch; a evidência e suas limitações estão em `docs/graphify-evidence.md`.

Em 2026-08-16, o host `bumblebee` recriou e verificou a revisão `04c51db` com publicação exclusiva em `100.95.240.74:3011`, health HTTP 200 e ausência de resposta no IPv4 LAN `192.168.10.74:3011`. O dashboard foi devolvido a `127.0.0.1:3011` após o teste. Essa evidência prova binding local, não ACL, tag ou acesso de um peer; o gate remoto permanece aberto.

## Goals / Non-Goals

**Goals:**
- Permitir publicação intencional somente no IPv4 Tailscale do host.
- Preservar `127.0.0.1` como default.
- Manter verificações declarativas/efetivas fail-closed e targeting fixo.
- Fornecer operação terminal-safe e rollback exato.

**Non-Goals:**
- Publicar em `0.0.0.0`, na LAN física ou na Internet.
- Implementar autenticação da aplicação, TLS, proxy reverso, Homepage ou ACL Tailscale.
- Suportar IPv6 Tailscale nesta mudança.

## Decisions

### 1. Override explícito e restrito

`DASHBOARD_BIND_ADDRESS` controlará o host IP da publicação e continuará defaultando para `127.0.0.1`. Valores aceitos serão loopback exato ou IPv4 canônico no bloco Tailscale CGNAT `100.64.0.0/10`; wildcard, LAN RFC1918, hostname, IPv6 e formatos inválidos falharão antes de Compose. Para qualquer bind Tailscale, o CLI exigirá também que `tailscale ip -4` retorne exatamente o endereço solicitado, com ambiente de secrets sanitizado, antes de qualquer criação/recriação. Pertencer ao bloco CGNAT sem prova de ownership local não será suficiente.

O deployment solicitado usará `DASHBOARD_BIND_ADDRESS=100.95.240.74`. Não será adotada a forma `${DASHBOARD_PORT}:3000`, pois ela equivale a publicação em todas as interfaces.

### 2. Verificação declarativa e efetiva parametrizada

O endereço validado será passado aos verificadores. O Compose renderizado deverá conter exatamente uma publicação TCP `<bind>:<porta>:3000`; a inspeção efetiva deverá conter exatamente o mesmo `HostIp`. Nenhum port binding adicional será aceito.

### 3. Health e liveness

O health interno permanece em `127.0.0.1:3000`. A liveness do host usará o endereço de bind validado e a porta publicada. O probe de isolamento, mounts, usuário, rootfs, secrets e demais hardenings não mudam.

### 4. Operação e rollback

Alterar o binding exige recriar o contêiner com `deploy.sh local`; a operação permanece processo filho terminal-safe. Para reverter, o operador executa novamente com `DASHBOARD_BIND_ADDRESS=127.0.0.1`. O workspace continua read-only e não há volume persistente da aplicação.

## Risks / Trade-offs

- A aplicação continua sem autenticação própria; acesso depende das ACLs e da identidade Tailscale do host.
- A identidade Tailscale é o limite de autenticação; a aplicação e o endpoint de chat continuam sem autenticação própria. O runbook exigirá confirmar ACLs/tags aplicáveis e provar acesso por peer autorizado. A ausência de acesso pela LAN será testada separadamente; não se inferirá política apenas de um HTTP 200 local.
- Recriação do contêiner causa interrupção breve.

## Validation

- RED→GREEN para default loopback, override Tailscale e rejeição de wildcard/LAN/endereços inválidos.
- Fixtures declarativas e efetivas devem rejeitar qualquer bind divergente/adicional em Python normal e otimizado.
- Suite, typecheck, lint, build, E2E e OpenSpec strict.
- No `bumblebee`, recriar com `100.95.240.74`, executar `verify`/`status`, testar HTTP local pelo IP Tailscale e testar acesso a partir de peer Tailscale autorizado.
