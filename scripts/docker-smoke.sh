#!/bin/sh

set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
	printf '用法：%s <docker-image> [expected-version]\n' "$0" >&2
	exit 2
fi

expected_version="${2:-}"

container="$(docker run --detach --rm --publish-all "$1")"

cleanup() {
	docker stop "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

port="$(docker port "$container" 8080/tcp | head -n 1 | awk -F: '{print $NF}')"
attempt=0
while [ "$attempt" -lt 40 ]; do
	if curl --fail --silent "http://127.0.0.1:$port/api/configuration" |
		grep --quiet '"code":200'; then
		break
	fi
	attempt=$((attempt + 1))
	sleep 1
done

if [ "$attempt" -eq 40 ]; then
	printf '容器未在限定时间内响应配置接口。\n' >&2
	docker logs "$container" >&2
	exit 1
fi

if [ -n "$expected_version" ]; then
	actual_label="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.version" }}' "$1")"
	if [ "$actual_label" != "$expected_version" ]; then
		printf 'Docker 镜像版本标签不一致，预期：%s，实际：%s\n' "$expected_version" "$actual_label" >&2
		exit 1
	fi
	if ! curl --fail --silent "http://127.0.0.1:$port/api/configuration" |
		grep -F --quiet "\"version\":\"$expected_version\""; then
		printf 'Docker 内程序版本与预期不一致：%s\n' "$expected_version" >&2
		exit 1
	fi
fi

docker exec "$container" sh -c '
	test "$(id -u)" != 0 &&
	test -w /app &&
	test -f /app/gofi.db &&
	test -f /app/.gofi-jwt-secret &&
	test "$(stat -c %a /app/.gofi-jwt-secret)" = 600
'

printf 'Docker 镜像冒烟检查通过：%s\n' "$1"
