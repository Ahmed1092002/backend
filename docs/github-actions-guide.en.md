# GitHub Actions in Mini ERP

This guide explains `.github/workflows/ci.yml`: when it runs, how it is read, and what it verifies before new code is accepted.

## The idea

CI removes reliance on memory. Instead of every developer remembering tests, TypeScript checks, and Docker builds before every push, GitHub runs them on a clean Linux machine.

```text
push or pull request
       |
       v
temporary Ubuntu runner
       |
       +--> check: install -> Prisma -> typecheck -> test
       |
       +--> docker: build image -> validate compose YAML
```

The current CI does not deploy or connect to AWS/Azure. It is verification only.

## 1. File location and triggers

GitHub reads workflow files from:

```text
.github/workflows/
```

The beginning of this project's workflow:

```yaml
name: CI

on:
  push:
  pull_request:
```

- `name` is the label shown in GitHub UI.
- `on` defines when the workflow runs.
- `push` means pushes to any branch.
- `pull_request` means opening or updating a PR.

## 2. Job versus step

```yaml
jobs:
  check:
    runs-on: ubuntu-latest
  docker:
    runs-on: ubuntu-latest
```

A job is a group of steps running on one runner. `check` and `docker` are independent, so they normally run in parallel. Each starts from a clean machine and cannot see another job's files or `node_modules`.

## 3. The check job, step by step

```yaml
env:
  DATABASE_URL: postgresql://erp_user:erp_password@localhost:5432/mini_erp?schema=public
  JWT_SECRET: ci-only-secret-not-for-production
```

These variables are available to every `check` step. Current tests do not connect to a real database, but Prisma/configuration needs a valid-looking `DATABASE_URL`. They are not production credentials.

### Checkout

```yaml
- name: Get the project code
  uses: actions/checkout@v4
```

The runner is empty at first. `actions/checkout@v4` is a ready-made GitHub action that copies the repository and current commit.

### Node.js

```yaml
- name: Set up Node.js
  uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm
```

It installs Node 22, matching the Dockerfile major version. `cache: npm` saves downloaded packages for a faster next run, while `npm ci` still creates a clean install.

### Dependencies and Prisma

```yaml
- run: npm ci
- run: npx prisma generate
```

`npm ci` installs exact versions from `package-lock.json` and fails when it disagrees with `package.json`. Prisma Client is generated code, so `prisma generate` must happen before type checks and tests.

### Type checking and tests

```yaml
- run: npm run typecheck
- run: npm test
```

Type checking runs first because it gives a faster, clearer error when TypeScript does not compile. Tests run afterwards for currently covered behaviour.

## 4. The docker job

```yaml
docker:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: docker/setup-buildx-action@v2
    - run: docker build -t mini-erp-api .
    - run: docker compose config --quiet
```

This job checks out code again because it has a new runner.

`docker/setup-buildx-action@v2` prepares Docker Buildx, Docker's modern builder. Its main value here is a consistent build environment.

`docker build -t mini-erp-api .` reads the Dockerfile, executes image layers, and creates a local image. It does not start a container or push an image. It fails if the Dockerfile, `npm ci`, or Prisma generation fails.

`docker compose config --quiet` parses and expands `docker-compose.yml`, checking that configuration is valid. It does not start PostgreSQL or the API.

## 5. See results in GitHub

1. Commit and push.
2. Open the repository on GitHub.
3. Open **Actions**, then the workflow named **CI**.
4. Open a run to see `check` and `docker`.
5. On failure, read the first useful error in the log.

A green check means current checks passed. It does not mean every feature is tested or the application is production-ready.

## 6. Adding a future job

After adding a real lint tool and a script, a lint job could be:

```yaml
lint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: npm
    - run: npm ci
    - run: npm run lint
```

Do not add it before a real `npm run lint` exists. CI should run commands that are also runnable locally.

## 7. CI versus CD

| Concept | Project status |
| --- | --- |
| CI | Builds and checks code on every push/PR |
| CD | Not present yet; later it can build/push an image and deploy when a cloud target exists |

Before deployment, the project needs broader tests, GitHub Secrets, environment strategy, and a rollback plan. Do not put AWS credentials or production secrets in `ci.yml`.

## 8. Troubleshooting

| Problem | Typical cause | Correct first check |
| --- | --- | --- |
| `Cannot find module @prisma/client` | Prisma generate did not run | Check step order. |
| `npm ci` fails | Lockfile does not match package.json | Run `npm install` locally, then commit the intended lockfile. |
| Only Docker job fails | Dockerfile or `.dockerignore` differs from expectation | Try the Docker build locally. |
| Workflow never runs | Wrong file path or YAML indentation | Check `.github/workflows/ci.yml`. |

## 9. Practical rule

Run these important commands locally before pushing: `npm ci`, `npx prisma generate`, `npm run typecheck`, `npm test`, `docker build -t mini-erp-api .`, and `docker compose config --quiet`.

If they work locally but fail in CI, compare environments: Linux versus Windows, missing variables, or a file that was never committed.
