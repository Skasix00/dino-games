# Dino Games

BennyRex's family game portal, in Portuguese (Portugal). Next.js App Router, TypeScript, Tailwind CSS and MongoDB. The portal includes Bernardo's quiz and **BennyRex Rush**, an original dinosaur endless runner for mobile.

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
    games/                # Quiz, runner, and runner artwork
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

## BennyRex Rush

Choose **BennyRex Rush** in the portal or open `/games/bennyrex-rush`. The playable character is an animated green dinosaur with a party hat. Swipe left/right to change between three lanes, up to jump over crates, and down to slide under striped barriers. Pizza carts require changing lanes. Buttons and arrow/WASD keys provide alternative controls; Space jumps and Escape/P pauses.

Each metre earns one point, and each coin earns ten. Coin trails award five coins when crossed. Speed increases gradually; every obstacle row has at least one clear lane. Collisions end the run. Pause allows resuming or saving the current score, and backgrounding the browser pauses automatically. Runs use the full mobile viewport with safe-area spacing and large controls.

The browser and server share a seeded, fixed-step simulation. Movement checkpoints are sent approximately every three seconds. The server replays inputs, checks elapsed time and session ownership, and derives distance, coins, collisions and score itself. It never trusts a submitted score. Requests are bounded and revision-checked; retries cannot score twice. Network failures pause progress and allow retrying the same checkpoint. Refresh resumes the last acknowledged checkpoint, so up to a few unsaved seconds may be lost on abrupt closure.

Runner sessions share `gameSessions`, player accounts and the leaderboard service, with their own runner state and game slug. Rankings compare score, distance, then earliest completion. Quiz rankings and the pending quiz-content approval are unaffected. Adding this game needs no database migration, seed approval or new dependency.

## API

All mutations accept JSON and require `Origin` equal to `APP_ORIGIN`. Account endpoints are rate limited by proxy IP and normalized username. Gameplay requests are limited by signed session. The proxy must overwrite `X-Real-IP`; only enable `TRUST_PROXY=true` when the app has no direct public ingress.

| Endpoint                              | Method | Purpose                                                           |
| ------------------------------------- | ------ | ----------------------------------------------------------------- |
| `/api/auth/register`                  | POST   | Create `{ displayName, password }` and sign in                    |
| `/api/auth/login`                     | POST   | Sign in with `{ displayName, password }`                          |
| `/api/logout`                         | POST   | Clear the signed cookie                                           |
| `/api/me`                             | GET    | Current player's public profile                                   |
| `/api/games/:slug/availability`       | GET    | Whether approved content is ready                                 |
| `/api/games/:slug/start`              | POST   | Start or resume an active browser attempt                         |
| `/api/games/:slug/current`            | GET    | Recover the latest attempt, including final results               |
| `/api/games/:slug/answer`             | POST   | `{ sessionId, questionId, optionId }`                             |
| `/api/games/:slug/next`               | POST   | `{ sessionId, questionId }` for the answered question             |
| `/api/games/:slug/checkpoint`         | POST   | Runner `{ sessionId, batchId, revision, toTick, inputs, finish }` |
| `/api/games/:slug/result?sessionId=…` | GET    | Owned completed result                                            |
| `/api/games/:slug/leaderboard`        | GET    | Best completed result per player                                  |
| `/api/health`                         | GET    | Database readiness without private content                        |

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
docker build -t dino-games:validation .
npm run test:containers
docker compose --env-file deploy/.env.example -f deploy/compose.yml config --quiet
```

Integration and browser suites start temporary real MongoDB instances using `mongodb-memory-server`. The first run downloads MongoDB 7.0.14. Browser tests use an isolated database of synthetic questions and an isolated Next.js server on port 3100. They do not modify `.env` or approve family content. Container verification creates a randomly named, isolated Compose project, checks registration and the content gate, completes a synthetic quiz, recreates both containers, verifies persisted results, and removes only its own temporary stack and volume. Use `npm run lint:fix` and `npm run format` for automatic fixes.

Production deployment, TLS setup, updates, rollback and persistence checks are in [deploy/README.md](deploy/README.md). The accepted plan and subsequent account/organization amendments are in [DINO_GAMES_PLAN.md](DINO_GAMES_PLAN.md).

### Preview on an iPhone

Connect the Mac and iPhone to the same Wi-Fi. Start a LAN preview with the Mac's Wi-Fi IP as the explicit application origin:

```sh
APP_ORIGIN=http://192.168.1.234:3000 npm run dev -- --hostname 0.0.0.0 --port 3000
```

Replace the example IP with `ipconfig getifaddr en0`, then open that same URL in Safari. Keep the Mac awake. Local HTTP previews support account cookies and runner checkpoints; production continues to require HTTPS.
