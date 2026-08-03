#!/bin/sh

set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
	printf '用法：%s <gofi-binary> [expected-version]\n' "$0" >&2
	exit 2
fi

expected_version="${2:-}"

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
storage_dir="$work_dir/storage"
cookie_jar="$work_dir/cookies.txt"
response_file="$work_dir/response.json"
headers_file="$work_dir/headers.txt"
download_file="$work_dir/downloaded.svg"
upload_file="$work_dir/avatar.svg"
pid=""

mkdir -p "$storage_dir"

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

if [ -n "$expected_version" ]; then
	curl --fail --silent --show-error "http://127.0.0.1:$port/api/configuration" >"$response_file"
	if ! grep -F --quiet "\"version\":\"$expected_version\"" "$response_file"; then
		printf '程序版本与预期不一致，预期：%s，响应：\n' "$expected_version" >&2
		cat "$response_file" >&2
		exit 1
	fi
fi

if ! curl --fail --silent "http://127.0.0.1:$port/" | grep --quiet '<div id="root">'; then
	printf '生产二进制未提供嵌入的前端入口。\n' >&2
	exit 1
fi

base_url="http://127.0.0.1:$port"
origin="$base_url"

curl --fail --silent --show-error -D "$headers_file" -o /dev/null "$base_url/"
if ! grep -i --quiet '^Cache-Control:.*no-store' "$headers_file"; then
	printf '前端入口缺少 no-store 缓存策略。\n' >&2
	exit 1
fi

asset_path="$(curl --fail --silent --show-error "$base_url/" | grep -o '/assets/[^" ]*\.js' | head -n 1)"
if [ -z "$asset_path" ]; then
	printf '前端入口中未找到带哈希的 JavaScript 资源。\n' >&2
	exit 1
fi
curl --fail --silent --show-error -D "$headers_file" -o /dev/null "$base_url$asset_path"
if ! grep -i --quiet '^Cache-Control:.*immutable' "$headers_file"; then
	printf '带哈希的静态资源缺少 immutable 缓存策略。\n' >&2
	exit 1
fi

curl --fail --silent --show-error \
	-H "Origin: $origin" \
	-H 'Content-Type: application/json' \
	--data "{\"customStoragePath\":\"$storage_dir\",\"adminUsername\":\"owner\",\"adminPassword\":\"local-smoke-password\"}" \
	"$base_url/api/setup" >"$response_file"
if ! grep --quiet '"success":true' "$response_file"; then
	printf '首次初始化失败：\n' >&2
	cat "$response_file" >&2
	exit 1
fi

curl --fail --silent --show-error \
	-c "$cookie_jar" -b "$cookie_jar" \
	-H "Origin: $origin" \
	-H 'Content-Type: application/json' \
	--data '{"username":"owner","password":"local-smoke-password"}' \
	"$base_url/api/user/login" >"$response_file"
if ! grep --quiet '"success":true' "$response_file"; then
	printf '管理员登录失败：\n' >&2
	cat "$response_file" >&2
	exit 1
fi

printf '%s\n' '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="red"/></svg>' >"$upload_file"
curl --fail --silent --show-error \
	-c "$cookie_jar" -b "$cookie_jar" \
	-H "Origin: $origin" \
	-F "files=@$upload_file;type=image/svg+xml" \
	"$base_url/api/upload?path=%2F" >"$response_file"
if ! grep --quiet '"success":true' "$response_file"; then
	printf '头像图片上传失败：\n' >&2
	cat "$response_file" >&2
	exit 1
fi

curl --fail --silent --show-error -b "$cookie_jar" \
	"$base_url/api/file?path=%2F" >"$response_file"
if ! grep --quiet '"name":"avatar.svg"' "$response_file"; then
	printf '上传后目录列表没有立即返回新文件：\n' >&2
	cat "$response_file" >&2
	exit 1
fi

curl --fail --silent --show-error -b "$cookie_jar" \
	"$base_url/api/download?path=%2Favatar.svg&raw=true" >"$download_file"
if ! cmp -s "$upload_file" "$download_file"; then
	printf '图片预览/下载内容与上传内容不一致。\n' >&2
	exit 1
fi

curl --fail --silent --show-error \
	-c "$cookie_jar" -b "$cookie_jar" \
	-X DELETE -H "Origin: $origin" \
	"$base_url/api/file?path=%2Favatar.svg" >"$response_file"
if ! grep --quiet '"success":true' "$response_file"; then
	printf '冒烟文件清理请求失败。\n' >&2
	exit 1
fi

if grep -Eiq 'panic|fatal' "$log_file"; then
	printf '生产服务日志包含 panic 或 fatal：\n' >&2
	cat "$log_file" >&2
	exit 1
fi

printf 'Gofi 生产链路冒烟检查通过（初始化、登录、上传、列表刷新、预览、删除、缓存），端口：%s\n' "$port"
