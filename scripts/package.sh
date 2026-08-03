#!/bin/sh
set -eu

binary_path="${1:?production binary path is required}"
version="${2:?version is required}"
version="${version#v}"
target_os="${3:?target OS is required}"
target_arch="${4:?target architecture is required}"
output_dir="${5:?output directory is required}"

if [ ! -x "$binary_path" ]; then
    printf 'Production binary is missing or not executable: %s\n' "$binary_path" >&2
    exit 1
fi

safe_version="$(printf '%s' "$version" | tr -c 'A-Za-z0-9._-' '-')"
package_name="gofi-${safe_version}-${target_os}-${target_arch}"
archive_path="$output_dir/$package_name.tar.gz"
staging_root="$(mktemp -d "${TMPDIR:-/tmp}/gofi-package.XXXXXX")"
package_root="$staging_root/$package_name"
trap 'rm -rf "$staging_root"' EXIT HUP INT TERM

mkdir -p "$package_root"
cp "$binary_path" "$package_root/gofi"
chmod 0755 "$package_root/gofi"
cp LICENSE README.md README.zh-CN.md "$package_root/"

cat > "$package_root/INSTALL.txt" <<EOF
Gofi $version ($target_os/$target_arch)

1. Extract this archive.
2. Run: ./gofi -port 8080
3. Open: http://localhost:8080

Keep the generated database, storage directory, and .gofi-jwt-secret together
when backing up or moving an installation.
EOF

if command -v sha256sum >/dev/null 2>&1; then
    (cd "$package_root" && sha256sum gofi > SHA256SUMS)
else
    (cd "$package_root" && shasum -a 256 gofi > SHA256SUMS)
fi

export COPYFILE_DISABLE=1
tar -czf "$archive_path" -C "$staging_root" "$package_name"

if command -v sha256sum >/dev/null 2>&1; then
    (cd "$output_dir" && sha256sum "$package_name.tar.gz" > "$package_name.tar.gz.sha256")
else
    (cd "$output_dir" && shasum -a 256 "$package_name.tar.gz" > "$package_name.tar.gz.sha256")
fi

printf 'Created deployment package: %s\n' "$archive_path"
