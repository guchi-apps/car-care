#!/usr/bin/env bash
# WSL 開発時の LAN / スマホアクセス用（ポート転送・allowedDevOrigins）

get_wsl_ip() {
  python3 -c "import socket; s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('8.8.8.8', 80)); print(s.getsockname()[0]); s.close()"
}

is_wsl() {
  grep -qi microsoft /proc/version 2>/dev/null
}

get_portproxy_target() {
  local port="${1:-3000}"
  powershell.exe -NoProfile -Command "
    \$text = netsh interface portproxy show all | Out-String
    if (\$text -match '0\.0\.0\.0\s+${port}\s+(\S+)\s+${port}') { \$matches[1] }
  " 2>/dev/null | tr -d '\r\n'
}

get_lan_ip() {
  powershell.exe -NoProfile -Command "
    (Get-NetIPAddress -AddressFamily IPv4 |
      Where-Object { \$_.PrefixOrigin -eq 'Dhcp' -and \$_.IPAddress -notmatch '^169\.' } |
      Select-Object -First 1).IPAddress
  " 2>/dev/null | tr -d '\r\n'
}

lan_to_sslip() {
  echo "${1}.sslip.io"
}

update_port_forward() {
  local port="${1:-3000}"
  local root_dir="$2"
  local wsl_ip script_win
  wsl_ip="$(get_wsl_ip)"
  script_win="$(wslpath -w "$root_dir/scripts/wsl-port-forward.ps1")"

  if [[ "$(get_portproxy_target "$port")" == "$wsl_ip" ]]; then
    return 0
  fi

  echo "Updating Windows port forward -> ${wsl_ip} (approve UAC if prompted)..."
  powershell.exe -NoProfile -Command \
    "Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"$script_win\"'"

  if [[ "$(get_portproxy_target "$port")" != "$wsl_ip" ]]; then
    echo ""
    echo "Warning: port forward was not updated. Phone access may not work."
    echo "Run manually in elevated PowerShell:"
    echo "  powershell -ExecutionPolicy Bypass -File $script_win"
    echo ""
  fi
}

print_phone_urls() {
  local port="${1:-3000}"
  local lan_ip phone_host
  lan_ip="$(get_lan_ip)"

  echo ""
  echo "Local: http://localhost:${port}/"
  if [[ -n "$lan_ip" ]]; then
    phone_host="$(lan_to_sslip "$lan_ip")"
    export DEV_ALLOWED_ORIGINS="${lan_ip},${phone_host}"
    echo "Phone: http://${phone_host}:${port}/  (same Wi-Fi as this PC)"
    echo ""
    echo "Google login requires a domain (raw IP is rejected by Google OAuth)."
    echo "Add this redirect URI in Google Cloud Console:"
    echo "  http://${phone_host}:${port}/api/auth/callback/google"
    echo "Passkeys do not work over HTTP on LAN — use Google sign-in on phone."
  fi
  echo ""
}

setup_wsl_lan_dev_access() {
  local port="${1:-3000}"
  local root_dir="$2"

  if ! is_wsl; then
    return 0
  fi

  update_port_forward "$port" "$root_dir"
  print_phone_urls "$port"
}
