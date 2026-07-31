SHELL := /bin/sh

FRONTEND_DIR := gofi-frontend
BACKEND_DIR := gofi-backend
FRONTEND_DIST := $(FRONTEND_DIR)/dist
BACKEND_DIST := $(BACKEND_DIR)/env/dist
OUTPUT_DIR := output

GO ?= go
PNPM ?= pnpm
MODE ?= production
TARGET_OS ?= $(shell $(GO) env GOOS)
TARGET_ARCH ?= $(shell $(GO) env GOARCH)
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
SOURCE_DATE_EPOCH ?= $(shell git log -1 --format=%ct 2>/dev/null || echo 0)
OUTPUT_NAME := gofi-$(TARGET_OS)-$(TARGET_ARCH)-$(MODE)

.DEFAULT_GOAL := help

.PHONY: help install install-frontend install-backend \
	dev dev-frontend dev-backend \
	test test-frontend test-backend \
	check check-frontend check-backend fmt-check \
	build build-frontend stage-frontend build-backend \
	smoke \
	build-linux-amd64 build-linux-arm64 cross-build checksums \
	clean clean-frontend clean-backend-dist clean-output printinfo

help:
	@printf '%s\n' \
		'Gofi 项目命令：' \
		'  make install       安装前端依赖并下载后端模块' \
		'  make dev           同时启动前后端开发服务' \
		'  make test          运行前后端测试' \
		'  make check         运行格式、静态检查、测试和前端构建' \
		'  make build         构建当前平台的生产二进制' \
		'  make smoke         验证已构建的生产二进制' \
		'  make cross-build   构建 Linux amd64/arm64 发布产物' \
		'  make clean         清理所有生成物'

install: install-frontend install-backend

install-frontend:
	$(PNPM) --dir $(FRONTEND_DIR) install --frozen-lockfile

install-backend:
	cd $(BACKEND_DIR) && $(GO) mod download

dev:
	$(MAKE) -j2 dev-backend dev-frontend

dev-frontend:
	$(PNPM) --dir $(FRONTEND_DIR) dev

dev-backend:
	cd $(BACKEND_DIR) && $(GO) run .

test: test-backend test-frontend

test-frontend:
	$(PNPM) --dir $(FRONTEND_DIR) test:run

test-backend:
	cd $(BACKEND_DIR) && $(GO) test ./...

check: check-backend check-frontend

check-frontend:
	$(PNPM) --dir $(FRONTEND_DIR) typecheck
	$(PNPM) --dir $(FRONTEND_DIR) test:run
	$(PNPM) --dir $(FRONTEND_DIR) build

check-backend: fmt-check
	cd $(BACKEND_DIR) && $(GO) vet ./...
	cd $(BACKEND_DIR) && $(GO) test -race ./...

fmt-check:
	@files="$$(cd $(BACKEND_DIR) && gofmt -l .)"; \
	if [ -n "$$files" ]; then \
		printf '以下 Go 文件需要执行 gofmt：\n%s\n' "$$files"; \
		exit 1; \
	fi

build: clean-output build-frontend stage-frontend build-backend checksums

build-frontend:
	$(PNPM) --dir $(FRONTEND_DIR) build

stage-frontend: clean-backend-dist
	mkdir -p $(BACKEND_DIST)
	cp -R $(FRONTEND_DIST)/. $(BACKEND_DIST)/

build-backend:
	mkdir -p $(OUTPUT_DIR)
	cd $(BACKEND_DIR) && \
		CGO_ENABLED=0 GOOS=$(TARGET_OS) GOARCH=$(TARGET_ARCH) \
		$(GO) build -tags=$(MODE) \
		-trimpath -buildvcs=false \
		-ldflags="-w -s -buildid= -X gofi/db.version=$(VERSION)" \
		-o ../$(OUTPUT_DIR)/$(OUTPUT_NAME) .

smoke:
	sh scripts/smoke.sh "$(OUTPUT_DIR)/$(OUTPUT_NAME)"

build-linux-amd64:
	$(MAKE) build-backend TARGET_OS=linux TARGET_ARCH=amd64

build-linux-arm64:
	$(MAKE) build-backend TARGET_OS=linux TARGET_ARCH=arm64

cross-build: clean-output build-frontend stage-frontend build-linux-amd64 build-linux-arm64 checksums

checksums:
	@cd $(OUTPUT_DIR) && for file in gofi-*; do \
		[ -f "$$file" ] || continue; \
		case "$$file" in *.sha256) continue ;; esac; \
		if command -v sha256sum >/dev/null 2>&1; then \
			sha256sum "$$file" > "$$file.sha256"; \
		else \
			shasum -a 256 "$$file" > "$$file.sha256"; \
		fi; \
	done

clean: clean-frontend clean-backend-dist clean-output

clean-frontend:
	rm -rf $(FRONTEND_DIST)

clean-backend-dist:
	rm -rf $(BACKEND_DIST)

clean-output:
	rm -rf $(OUTPUT_DIR)
	mkdir -p $(OUTPUT_DIR)

printinfo:
	@printf '%s\n' \
		"模式：$(MODE)" \
		"版本：$(VERSION)" \
		"目标平台：$(TARGET_OS)/$(TARGET_ARCH)" \
		"输出：$(OUTPUT_DIR)/$(OUTPUT_NAME)"
