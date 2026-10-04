#!/usr/bin/env bash
# Preenche as variaveis de pagamento no .env do wayianeural SEM imprimir valores.
# - SUPABASE_SERVICE_ROLE_KEY e Asaas SANDBOX vem do wayAR (mesmo projeto Supabase).
# - ASAAS_WEBHOOK_TOKEN e PAY_SERVICE_TOKEN sao gerados aqui (so se ainda vazios).
# Para producao, troque depois ASAAS_API_KEY / ASAAS_API_BASE_URL por mao.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=../wayAR/.env
ENVF=.env
ADMIN="${1:-dreger.anderson@gmail.com}"

get() { grep -E "^$1=" "$SRC" | head -1 | sed -E "s/^$1=//; s/^\"//; s/\"$//"; }
has() { grep -qE "^$1=.+" "$ENVF" 2>/dev/null; }
put() { # put VAR VALOR (escapa $ para o docker compose)
  local v="${2//\$/\$\$}"
  grep -vE "^$1=" "$ENVF" > "$ENVF.tmp" || true
  printf '%s=%s\n' "$1" "$v" >> "$ENVF.tmp"; mv "$ENVF.tmp" "$ENVF"
}

touch "$ENVF"; chmod 600 "$ENVF"
has SUPABASE_SERVICE_ROLE_KEY || put SUPABASE_SERVICE_ROLE_KEY "$(get SUPABASE_SERVICE_ROLE_KEY)"
has ASAAS_API_KEY             || put ASAAS_API_KEY "$(get ASAAS_API_KEY)"
has ASAAS_API_BASE_URL        || put ASAAS_API_BASE_URL "$(get ASAAS_API_BASE_URL)"
has ASAAS_WEBHOOK_TOKEN       || put ASAAS_WEBHOOK_TOKEN "$(openssl rand -hex 24)"
has PAY_SERVICE_TOKEN         || put PAY_SERVICE_TOKEN "$(openssl rand -hex 24)"
has ADMIN_EMAILS              || put ADMIN_EMAILS "$ADMIN"

echo "Variaveis presentes no $ENVF (valores ocultos):"
for k in SUPABASE_SERVICE_ROLE_KEY ASAAS_API_KEY ASAAS_API_BASE_URL ASAAS_WEBHOOK_TOKEN PAY_SERVICE_TOKEN ADMIN_EMAILS; do
  has "$k" && echo "  ok  $k" || echo "  FALTA $k"
done
