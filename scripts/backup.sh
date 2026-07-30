#!/bin/sh

set -eu

data_dir="${1:-.}"
output="${2:-gofi-backup-$(date -u +%Y%m%dT%H%M%SZ).tar.gz}"

if [ ! -d "$data_dir" ]; then
	printf '数据目录不存在：%s\n' "$data_dir" >&2
	exit 1
fi

if [ ! -f "$data_dir/gofi.db" ]; then
	printf '数据目录中没有 gofi.db，请先停止 Gofi 并确认目录正确。\n' >&2
	exit 1
fi

parent="$(cd "$(dirname "$data_dir")" && pwd)"
name="$(basename "$data_dir")"
tar -C "$parent" -czf "$output" "$name"
printf '备份已生成：%s\n' "$output"
