#!/bin/sh
# Next standalone: parseInt(process.env.PORT, 10) || 3000
set -eu
cd /app

if ! test -f server.js; then
  echo '[web-entrypoint] ERRO: /app/server.js não existe (build standalone falhou ou WORKDIR errado?).' >&2
  ls -la /app >&2 || true
  exit 1
fi

_effective="${PORT-}"
if [ -z "$_effective" ]; then
  _effective=3000
fi

printf '\n'
printf '%s\n' '=========================================='
printf '%s\n' '  Railway — serviço WEB (Next standalone)'
printf '%s\n' '=========================================='
printf '%s\n' "  cwd:                  $(pwd)"
printf '%s\n' "  PORT (env bruto):     ${PORT:-<vazio → Next usa 3000>}"
printf '%s\n' "  Porta efetiva (Node): $_effective"
printf '%s\n' "  HOSTNAME:             ${HOSTNAME:-<vazio → Next usa 0.0.0.0>}"
printf '%s\n' ''
printf '%s\n' '  No serviço Web → Networking / Target →'
printf '%s\n' "  coloque este número:  $_effective"
printf '%s\n' '=========================================='
printf '\n'

exec node server.js
