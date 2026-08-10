## Why

O procedimento manual atual exige carregar um helper no shell interativo e habilitar opções globais; uma falha pode encerrar a sessão remota. O dashboard também ainda não exporta uma versão imutável que possa ser construída uma vez em CI e implantada sem compilação no homelab.

## What Changes

- Adicionar workflow aprovado acionado somente por tags estáveis `vMAJOR.MINOR.PATCH`, com ancestralidade em `main`, concorrência/preflight build-once, actions fixadas, imagem GHCR por digest e Artifact Attestation.
- Exportar `releases/<versão>.env` como asset auditável do GitHub Release e exigir publisher/tag/commit/proveniência exatos antes do pull, sem tentar gravá-lo silenciosamente em branch protegida.
- Adicionar um CLI executável, sempre usado como processo filho, para validar, construir localmente, implantar versão, verificar, consultar e remover somente a stack fixa do dashboard.
- Selecionar a imagem do Compose por `DASHBOARD_IMAGE`, mantendo build e fallback local para preparação.
- Substituir blocos operacionais sourced por comandos únicos e documentar release, rollback, segredos e limites de escopo.

## Impact

Arquivos afetados: workflow de release, Compose, scripts de deploy/validação, testes, README e runbooks. A mudança não cria tag/release, não executa Docker, não altera Homepage, proxy ou Tailscale e não adiciona credenciais.
