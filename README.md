# Gofi (Refactoring) &middot; [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

> Refactoring in Progress

English | [简体中文](./README.zh-CN.md)

Gofi is a modern, open-source web file indexer and manager, featuring a fully refactored frontend and backend for enhanced security, usability, and maintainability.

## ✨ What's New in the Refactored Branch

- **Modern UI/UX**: Frontend rebuilt with React, Vite, Tailwind CSS, and shadcn/ui. Unified, responsive, and accessible design.
- **Settings & File List Redesign**: Settings page and file list page are fully modernized, with improved forms, toolbars, and interaction details.
- **Toolbar & Filtering**: File list toolbar now supports icon-based filtering, floating search, and consistent view switching.
- **Internationalization**: Full i18n support for English and Chinese, including error messages and UI.
- **Security & Auth**: bcrypt passwords, revocable JWT sessions, centralized path isolation, guest permissions, and correct HTTP error semantics.
- **Configurable & Extensible**: All key settings are environment-configurable. Backend and frontend are modular and easy to extend.
- **Performance Optimizations**: Reduced redundant operations, improved database queries, and optimized logging.
- **Complete File Management**: Resumable chunk uploads, folders, rename, copy, move, and batch deletion.
- **Indexed Search**: Incremental SQLite indexing for names, paths, and small text files.

## 📦 Project Structure

- `gofi-backend/` — Go backend (API, auth, config, i18n)
- `gofi-frontend/` — React frontend (UI, state, routes, i18n)
- `preview/` — Screenshots and logo

## 🚀 Quick Start

Requirements: Go 1.26.5, Node.js 24.14.1 LTS, pnpm 10.34.5, and GNU Make.

### Install and start

```bash
make install
make dev
```

### Check and build

```bash
make check
make build
make package
make smoke
```

Visit: http://localhost:3000

## 🛠️ Configuration

Backend config via environment variables, e.g.:
```bash
export GOFI_JWT_SECRET="a-random-secret-with-at-least-32-characters"
export GOFI_JWT_EXPIRE_HOURS="168"
export GOFI_ALLOWED_ORIGINS="https://files.example.com"
export GOFI_ENABLE_DEBUG="false"
```

`GOFI_JWT_SECRET` is optional. Gofi generates `.gofi-jwt-secret` when it is absent; persist it with the database and storage directory. During first-time setup, choose an administrator account and a password of at least 10 characters. There are no default administrator credentials.

## 📝 Documentation

- [Quick Start](./doc/quickstart.md)
- [Configuration](./doc/config.md)
- [FAQ](./doc/faq.md)
- [Contributing](./doc/contributing.md)
- [Upgrade, Backup, and Restore](./doc/upgrade.md)
- [Security Deployment Checklist](./doc/security.md)
- [Build and Release Process](./doc/release.md)

## 🖼️ Preview

![preview1](./preview/1.jpg)
![preview2](./preview/2.jpg)
![preview3](./preview/3.jpg)
![preview4](./preview/4.jpg)
![preview5](./preview/5.jpg)
![preview6](./preview/6.jpg)

## 📝 License

[MIT](./LICENSE)
