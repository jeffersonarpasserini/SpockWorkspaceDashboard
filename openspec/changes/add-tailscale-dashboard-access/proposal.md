## Why

O dashboard está saudável no homelab, porém sua publicação Docker está restrita a `127.0.0.1`. O operador precisa acessá-lo pela rede privada Tailscale sem abrir a aplicação não autenticada para todas as interfaces ou para a LAN física.

## What Changes

- Manter loopback como default seguro.
- Adicionar override explícito do endereço de publicação para um IPv4 Tailscale no bloco `100.64.0.0/10`.
- Rejeitar wildcard, endereço LAN e outros endereços fora de loopback/Tailscale nos verificadores declarativo e efetivo.
- Fazer health/liveness e o fluxo de deployment usarem o endereço validado.
- Documentar implantação, verificação e rollback do acesso Tailscale-only.

## Impact

- Afeta `compose.yaml`, CLI/verificadores de deployment, testes e documentação operacional.
- Recriará o contêiner para alterar o port binding, causando uma interrupção curta.
- Não adiciona autenticação da aplicação, TLS, proxy, exposição direta à LAN/Internet, Homepage ou alteração de ACL Tailscale.
- Graphify permanece pendente porque `graphify-out/graph.json` não existe neste root.
