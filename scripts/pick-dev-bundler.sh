#!/usr/bin/env bash
# Shared next dev bundler selection (Turbopack vs webpack fallback).

inotify_instances_used() {
  # find は /proc 走査で 1 を返すことがある。pipefail + set -e で落ちないようにする。
  { find /proc/*/fd -lname 'anon_inode:inotify' 2>/dev/null || true; } | wc -l
}

maybe_enable_watchpack_polling() {
  local max_instances used
  max_instances="$(cat /proc/sys/fs/inotify/max_user_instances 2>/dev/null || echo 128)"
  used="$(inotify_instances_used)"
  if (( used >= max_instances - 16 )); then
    export WATCHPACK_POLLING=true
  fi
}

pick_dev_bundler() {
  if [[ "${USE_WEBPACK:-}" == "1" ]]; then
    printf '%s' "--webpack"
    return
  fi
  if [[ "${USE_TURBOPACK:-}" == "1" ]]; then
    return
  fi

  local max_instances used
  max_instances="$(cat /proc/sys/fs/inotify/max_user_instances 2>/dev/null || echo 128)"
  used="$(inotify_instances_used)"

  if (( used >= max_instances - 2 )); then
    {
      echo "Warning: inotify instances nearly exhausted (${used}/${max_instances})."
      echo "Turbopack needs file watchers; falling back to webpack for this session."
      echo "File watching uses polling to avoid EMFILE errors."
      echo "To use Turbopack again, raise the limit and restart WSL:"
      echo "  sudo sysctl -w fs.inotify.max_user_instances=512"
      echo "Or force webpack anytime: USE_WEBPACK=1 npm run dev"
      echo ""
    } >&2
    export WATCHPACK_POLLING=true
    printf '%s' "--webpack"
  fi
}
