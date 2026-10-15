# Dino Games

BennyRex's family game portal, in Portuguese (Portugal). Next.js App Router, TypeScript, Tailwind CSS and MongoDB. The portal is ready to host more games; Bernardo's quiz is the first entry.

**The quiz intentionally starts locked.** Question 4 has no supplied answer and the proposed answer choices are not approved. Test fixtures are synthetic and never unlock production content.

## Local development

Use Node.js 24 and npm.

```sh
npm ci
cp .env.example .env
docker compose -f deploy/compose.local.yml up -d
npm run seed
npm run dev
```

Set a random `SESSION_SECRET` of at least 32 characters in `.env` before using accounts. Next.js and the seed script read this file. The local database binds only to localhost; production uses authenticated MongoDB without a host port.

Open <http://localhost:3000>. Each person creates a unique username and password. There is no invitation code, email, or selector for other people's accounts. The cookie lasts seven days. Accounts and leaderboard results work across devices; an in-progress attempt belongs to the browser session that started it. Signing out ends access to that browser's unfinished attempt. Password recovery is not automated in v1.

Registration is open. Signing in protects endpoints from anonymous access but does not make the quiz family-only. `robots.txt` and `noindex` discourage indexing; they are not access controls.

## Project structure

```text
src/
  app/                    # Thin Next.js layouts, pages and route handlers
    (views)/              # Portal, game, account and ranking pages
    api/                  # Explicit endpoint folders
  components/
    common/               # Reusable interface elements and mascot
    layout/               # Header and footer
    home/                 # Portal and reusable game card
    players/              # Personal account form
    games/                # Quiz renderer
    ranking/              # Game selector and leaderboard
  content/                # Server-only reviewed question source (never public assets)
  hooks/                  # Client hooks
  server/                 # Auth, passwords, database, quiz rules and services
  settings/               # Server-side game registry
  themes/                 # Shared theme tokens and Tailwind entrypoint
  types/                  # Shared contracts
  utils/                  # Public formatting and API utilities
scripts/                  # Content seeding and browser-test orchestration
tests/                    # Unit, real-Mongo integration and browser tests
deploy/                   # Compose, proxy integration and production runbook
```

Feature components use `ComponentName/index.tsx` and colocated `styles.module.css`, following Carris Metropolitana's organization. ESLint rules are defined locally in `eslint.config.mjs`; no Carris packages are used. Prettier and `.editorconfig` enforce tabs, multiline formatting and consistent newlines. ESLint adds statement spacing, import organization, strict equality, explicit braces, type imports, React/Next conventions and promise checks.

Reference conventions: [Carris ESLint](https://github.com/carrismetropolitana/eslint), [Carris frontend](https://github.com/carrismetropolitana/website/tree/main/apps/frontend/src). Framework setup follows the [Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation) and [Tailwind Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs).

## Content approval and new games

Edit `src/content/bernardo.json`. Review every question and its four options. Supply the confirmed `correctOptionId` for question 4, then mark each reviewed question `approved: true`. Seeding incomplete content is allowed; starting a game is not. Run `npm run seed` again. Existing attempts keep their snapshots, selected option order and elapsed times.

When changing published content, increment `contentVersion` in both the source and `src/settings/games.ts`. Rankings separate content/rules versions. Do not change `rulesVersion` during an event with active games. Keep the published scoring implementation available if introducing another rules version later.

To add a quiz, add its registry entry and content seed, then reuse the account, quiz renderer and ranking components. Adding a different game type requires a renderer and its server rules, plus a page dispatch branch and ranking configuration. There is no separate games database or CMS.

Question 8 currently has the supplied binary wording but four draft options describing different delivery methods. Review that wording and the distinctions along with all other distractors before approval.

## API

All mutations accept JSON and require `Origin` equal to `APP_ORIGIN`. Account endpoints are rate limited by proxy IP and normalized username. Gameplay requests are limited by signed session. The proxy must overwrite `X-Real-IP`; only enable `TRUST_PROXY=true` when the app has no direct public ingress.

| Endpoint                              | Method | Purpose                                               |
| ------------------------------------- | ------ | ----------------------------------------------------- |
| `/api/auth/register`                  | POST   | Create `{ displayName, password }` and sign in        |
| `/api/auth/login`                     | POST   | Sign in with `{ displayName, password }`              |
| `/api/logout`                         | POST   | Clear the signed cookie                               |
| `/api/me`                             | GET    | Current player's public profile                       |
| `/api/games/:slug/availability`       | GET    | Whether approved content is ready                     |
| `/api/games/:slug/start`              | POST   | Start or resume an active browser attempt             |
| `/api/games/:slug/current`            | GET    | Recover the latest attempt, including final results   |
| `/api/games/:slug/answer`             | POST   | `{ sessionId, questionId, optionId }`                 |
| `/api/games/:slug/next`               | POST   | `{ sessionId, questionId }` for the answered question |
| `/api/games/:slug/result?sessionId=…` | GET    | Owned completed result                                |
| `/api/games/:slug/leaderboard`        | GET    | Best completed result per player                      |
| `/api/health`                         | GET    | Database readiness without private content            |

All endpoints except health, registration and login require an authenticated cookie. API responses are not cached. Passwords use salted scrypt hashes; responses never contain hashes. Unknown-user login performs the same hash derivation as known-user login.

Quiz changes use atomic revision checks within a single MongoDB document, so transactions/replica sets are unnecessary. An answer retry returns saved state, conflicting choices fail with 409, and repeated next requests cannot skip ahead. Refresh and network delay count toward answer time; feedback-reading time does not. Browser timing is display-only. Rank on a result screen refers to the player's best result in that version, not necessarily the just-finished attempt.

## Checks

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:browser
docker compose --env-file deploy/.env.example -f deploy/compose.yml config --quiet
```

Integration and browser suites start temporary real MongoDB instances using `mongodb-memory-server`. The first run downloads MongoDB 7.0.14. Browser tests use an isolated database of synthetic questions and an isolated Next.js server on port 3100. They do not modify `.env` or approve family content. Use `npm run lint:fix` and `npm run format` for automatic fixes.

Production deployment, TLS setup, updates, rollback and persistence checks are in [deploy/README.md](deploy/README.md). The accepted plan and subsequent account/organization amendments are in [DINO_GAMES_PLAN.md](DINO_GAMES_PLAN.md).
