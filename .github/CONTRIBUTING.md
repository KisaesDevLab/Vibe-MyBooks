# Contributing to Vibe MyBooks

Contributions are welcome! By contributing, you agree that your contributions are licensed under the same [PolyForm Small Business License 1.0.0](../LICENSE) terms as the project.

## Getting Started

1. Fork the repository
2. Clone your fork with `git clone --recurse-submodules` and create a branch
3. Set up the development environment:

```bash
git submodule update --init   # engine/ = kisaes-gl-engine
npm install                   # at the repository root only, never inside engine/
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

4. Make your changes
5. Run tests: `npm test`
6. Submit a pull request

## Code Standards

- **TypeScript** — No `any` types. All code must be fully typed.
- **Tenant isolation** — Every database query must include `WHERE tenant_id = ?`
- **Monetary values** — Use `decimal(19,4)` in the database, never float/double
- **API endpoints** — Must include Zod validation, error handling, audit logging, and tenant scoping
- **UI pages** — Must include loading, error, and empty states
- **Migrations** — Additive only. Never drop columns or tables.
- **Tests** — Add tests for new functionality. Run the full suite before submitting.

## Architecture

- **The engine** (`@kis-books/api` + `@kis-books/shared`, `openapi.json`, migrations) lives in [KisaesDevLab/kisaes-gl-engine](https://github.com/KisaesDevLab/kisaes-gl-engine), mounted here as the `engine/` git submodule. Engine changes are pull requests on that repository; this repository then moves the pin (`git -C engine checkout <commit>`, `npm install` at the root, commit the gitlink and lockfile).
- Until the engine's knowledge-generator path fix lands, don't run `generate-knowledge` from a checkout (it looks for `packages/api/src/knowledge` at the repository root); the Docker images are unaffected.
- **Business logic** lives in `engine/packages/api/src/services/`, not route handlers
- **Route handlers** validate input, call services, and format responses
- **Shared types** go in `engine/packages/shared/src/`
- **React hooks** for data fetching use TanStack Query in `packages/web/src/api/`

See [CLAUDE.md](../CLAUDE.md) for the complete coding conventions and patterns.

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Write a clear description of what changed and why
- Include test coverage for new functionality
- Ensure all existing tests still pass

## Reporting Issues

Use the [issue templates](https://github.com/KisaesDevLab/Vibe-MyBooks/issues/new/choose) on GitHub for bug reports and feature requests.

## License

All contributions are subject to the [PolyForm Small Business License 1.0.0](../LICENSE). See [LICENSING_FAQ.md](../docs/LICENSING_FAQ.md) for details.
