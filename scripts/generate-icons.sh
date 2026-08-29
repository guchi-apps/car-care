#!/usr/bin/env bash
# scripts/icon.template.svg からアプリアイコン一式を書き出す。
#
#   npm run generate:icons
#
# 書き出したファイルはリポジトリにコミットする（ビルド時には実行しない）。
# rsvg-convert（librsvg2-bin）と convert（ImageMagick）を使う。どちらも Ubuntu の
# 標準パッケージで、npm の依存関係は増やさない。
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
template="$root/scripts/icon.template.svg"
icons="$root/public/icons"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

for cmd in rsvg-convert convert; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[generate-icons] $cmd が見つかりません。sudo apt install librsvg2-bin imagemagick" >&2
    exit 1
  fi
done

header='<!-- scripts/icon.template.svg から生成。直接編集しないこと。 -->'

# 通常のアイコン: 角丸あり・マークは原寸
render() {
  local radius="$1" scale="$2" offset="$3" out="$4"
  {
    echo "$header"
    sed -e "s/__RADIUS__/$radius/g" \
        -e "s/__SCALE__/$scale/g" \
        -e "s/__TX__/$offset/g" \
        -e "s/__TY__/$offset/g" \
        "$template"
  } >"$out"
}

mkdir -p "$icons"
render 116 1 0 "$icons/icon.svg"
# マスカブル: 角丸なしの全面塗り。マークは安全領域（中央 80%）に収まるよう縮める
render 0 0.76 61.44 "$icons/icon-maskable.svg"

rsvg-convert -w 192 -h 192 "$icons/icon.svg" -o "$icons/icon-192.png"
rsvg-convert -w 512 -h 512 "$icons/icon.svg" -o "$icons/icon-512.png"
rsvg-convert -w 512 -h 512 "$icons/icon-maskable.svg" -o "$icons/icon-512-maskable.png"

for size in 16 32 48; do
  rsvg-convert -w "$size" -h "$size" "$icons/icon.svg" -o "$tmp/favicon-$size.png"
done
convert "$tmp/favicon-16.png" "$tmp/favicon-32.png" "$tmp/favicon-48.png" \
  "$root/src/app/favicon.ico"

echo "[generate-icons] public/icons/*.{svg,png} と src/app/favicon.ico を書き出しました"
