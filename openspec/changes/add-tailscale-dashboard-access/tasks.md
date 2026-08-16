## 1. Contrato e testes

- [x] 1.1 RED: adicionar testes para default loopback, override `100.95.240.74`, ownership exato via `tailscale ip -4` e rejeição pré-Compose de wildcard/LAN/hostname/IPv6/malformados, CLI/daemon indisponível, saída ambígua e CGNAT não pertencente ao host.
- [x] 1.2 RED: adicionar fixtures declarativas e efetivas que exijam exatamente o HostIp selecionado, rejeitem inclusive um unsafe HostIp fornecido como expectativa e rejeitem bindings divergentes/adicionais, inclusive em Python otimizado.

## 2. Implementação

- [x] 2.1 GREEN: parametrizar o host IP do Compose com default loopback.
- [x] 2.2 GREEN: validar `DASHBOARD_BIND_ADDRESS` fail-closed no CLI e nos verificadores, provar ownership Tailscale com `tailscale ip -4` antes de Compose e passá-lo à liveness do host sem expor secrets.
- [x] 2.3 Preservar secrets, targeting fixo, staged startup, sandbox e rollback existentes.

## 3. Documentação

- [x] 3.1 Documentar acesso Tailscale-only em `100.95.240.74:3011`, ausência de autenticação da aplicação/chat, dependência das ACLs/tags Tailscale e verificação por peer autorizado.
- [x] 3.2 Documentar recriação terminal-safe, verificação por peer autorizado e rollback exato para `127.0.0.1`.
- [x] 3.3 Não instruir publicação sem host IP ou em `0.0.0.0`.

## 4. Validação e publicação

- [x] 4.1 Executar testes focados e completos (86/86), typecheck, lint, audit (0), build, E2E (3 pass/1 skip esperado) e quatro validações OpenSpec strict.
- [x] 4.2 Obter revisão Docker/DevOps, segurança e documentação; O’Brien, Tuvok e Uhura aprovaram commit/push e Spock revisou o diff integral. A aprovação de deployment permanece separada e pendente nos gates 4.3–4.4.
- [x] 4.3 No `bumblebee`, recriar com `DASHBOARD_BIND_ADDRESS=100.95.240.74`, executar `verify`/`status` e confirmar HTTP 200 local pelo IP Tailscale. Em 2026-08-16, a revisão `04c51db` passou com container `healthy`, binding efetivo exclusivo `100.95.240.74:3011` e ausência de resposta em `192.168.10.74:3011`; após a prova, o serviço retornou e foi verificado em `127.0.0.1:3011`.
- [ ] 4.4 Confirmar as ACLs/tags aplicáveis, acesso HTTP a partir de peer Tailscale autorizado e ausência de publicação no IPv4 LAN `192.168.10.74`; não inferir autorização apenas do teste local.
- [x] 4.5 Atualizar Graphify e cruzar Tailscale, Docker, autorização e gates operacionais; registrar evidência e limitações em `docs/graphify-evidence.md`.
