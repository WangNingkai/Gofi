#!/bin/sh

set -eu

if [ "$#" -ne 1 ]; then
	printf '用法：%s <gofi-binary>\n' "$0" >&2
	exit 2
fi

case "$1" in
	/*) binary="$1" ;;
	*) binary="$(pwd)/$1" ;;
esac

if [ ! -x "$binary" ]; then
	printf '生产二进制不存在或不可执行：%s\n' "$binary" >&2
	exit 1
fi

port="${GOFI_SMOKE_PORT:-$((20000 + $$ % 20000))}"
work_dir="$(mktemp -d "${TMPDIR:-/tmp}/gofi-smoke.XXXXXX")"
log_file="$work_dir/gofi.log"
pid=""

cleanup() {
	if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
		kill "$pid" 2>/dev/null || true
		wait "$pid" 2>/dev/null || true
	fi
	rm -rf "$work_dir"
}
trap cleanup EXIT INT TERM

(
	cd "$work_dir"
	exec "$binary" -port "$port"
) >"$log_file" 2>&1 &
pid=$!

attempt=0
while [ "$attempt" -lt 30 ]; do
	if curl --fail --silent "http://127.0.0.1:$port/api/configuration" \
		| grep --quiet '"code":200'; then
		break
	fi
	if ! kill -0 "$pid" 2>/dev/null; then
		printf 'Gofi 在冒烟检查完成前退出：\n' >&2
		cat "$log_file" >&2
		exit 1
	fi
	attempt=$((attempt + 1))
	sleep 1
done

if [ "$attempt" -eq 30 ]; then
	printf 'Gofi 未在限定时间内响应配置接口：\n' >&2
	cat "$log_file" >&2
	exit 1
fi

if ! curl --fail --silent "http://127.0.0.1:$port/" | grep --quiet '<div id="root">'; then
	printf '生产二进制未提供嵌入的前端入口。\n' >&2
	exit 1
fi

printf 'Gofi 生产二进制冒烟检查通过，端口：%s\n' "$port"
