# Deploy beside NiceNails

Target: **bruno.castelo.net**, on the existing NCN Docker server. Dino Games adds only app and MongoDB containers. Nginx continues to belong to NCN. The following steps are prepared instructions; they do not imply that DNS, TLS or production were changed.

## 1. Prepare the application

Copy this directory to `/opt/dino-games/deploy` on the server. Create `.env` from `.env.example`. Set distinct MongoDB credentials, a random session secret (32+ characters), and the image tag. Use a hexadecimal database password so the connection URI requires no additional encoding. Never reuse NCN database credentials.

```sh
cd /opt/dino-games/deploy
cp .env.example .env
# Edit .env with real secrets before continuing.
docker network inspect dino-proxy >/dev/null 2>&1 || docker network create dino-proxy
# If the GHCR package is private, authenticate using a token with read:packages.
docker compose --env-file .env config --quiet
docker compose --env-file .env pull
docker compose --env-file .env up -d
docker compose --env-file .env exec app node seed.mjs
docker compose --env-file .env ps
```

The shipped question bank remains locked. Approve content in the repository and publish a new image before reseeding to enable the quiz. Indexes are created by application startup and the seed command. Database changes never alter existing attempt snapshots.

## 2. Connect the existing NCN proxy

Verify A/AAAA records for `bruno.castelo.net` point to this server, with ports 80/443 reachable. Leave NCN's `PUBLIC_DOMAIN=nicenails.pt` and certificate variables unchanged.

From NCN's production deployment directory (example `/opt/NCN/deploy`), take a copy of its current template and add one include inside `http`. Keep the original for rollback.

```sh
cd /opt/NCN/deploy
docker compose --env-file .env -f compose.yml cp nginx:/etc/nginx/nginx.conf.template ./nginx-original.template
python3 /opt/dino-games/deploy/prepare-proxy.py nginx-original.template dino-nginx.conf.template
cp /opt/dino-games/deploy/nginx-http.conf dino-games.conf
cp /opt/dino-games/deploy/ncn-network.override.yml dino-network.override.yml
docker compose --env-file .env -f compose.yml -f dino-network.override.yml config --quiet
```

The override retains the default NCN network, connects Nginx to `dino-proxy`, and mounts the new template and virtual host. No database service or NCN application is changed. Inspect the merged configuration before applying it. Recreating Nginx briefly interrupts both sites, so choose a suitable maintenance moment.

```sh
docker compose --env-file .env -f compose.yml -f dino-network.override.yml up -d --no-deps nginx
docker compose --env-file .env -f compose.yml -f dino-network.override.yml exec nginx nginx -t
curl --fail --head https://nicenails.pt
```

First use the HTTP-only Dino configuration to obtain its certificate without requiring missing TLS files at Nginx startup. The existing NiceNails HTTPS server stays intact.

```sh
docker compose --env-file .env -f compose.yml -f dino-network.override.yml exec nginx certbot certonly --webroot -w /var/www/certbot -d bruno.castelo.net --email YOUR_CERTIFICATE_EMAIL --agree-tos --non-interactive
# Preserve the mounted file's inode by writing into it, rather than replacing it.
cat /opt/dino-games/deploy/nginx-site.conf > dino-games.conf
docker compose --env-file .env -f compose.yml -f dino-network.override.yml exec nginx nginx -t
docker compose --env-file .env -f compose.yml -f dino-network.override.yml exec nginx nginx -s reload
curl --fail https://bruno.castelo.net/api/health
curl --fail --head https://nicenails.pt
```

Always include `-f dino-network.override.yml` in subsequent NCN deployment commands. The existing NCN entrypoint runs `certbot renew` for all managed certificates, including the new hostname. Confirm renewal with `certbot renew --dry-run` inside Nginx.

After NCN proxy upgrades, regenerate the mounted template from the updated NCN template and reapply the include so upstream improvements are retained. The app hostname uses Docker's resolver dynamically, so app container recreation does not leave Nginx using a stale IP.

If certificate issuance fails, keep the HTTP bootstrap configuration and inspect Certbot logs. Do not overwrite or delete the NiceNails certificate lineage.

## 3. Updates and rollback

CI runs format, lint, types, unit/integration tests, mobile tests, a production build and Compose validation. Main builds publish `production` and an immutable `<commit SHA>-<run ID>` tag. PRs do not push images.

Set `IMAGE_TAG` to the chosen tag in the app deployment's `.env`, then:

```sh
cd /opt/dino-games/deploy
docker compose --env-file .env pull app
docker compose --env-file .env up -d --no-deps app
docker compose --env-file .env ps
curl --fail https://bruno.castelo.net/api/health
```

Run `exec app node seed.mjs` only when deploying a reviewed content change. To roll back application code, set the previous immutable tag and repeat pull/up. A code rollback does not revert content; previous question versions remain in MongoDB, and the registry selects its matching version.

To roll back proxy integration, run NCN Compose with its original file alone and `up -d --no-deps nginx`; this restores the image's original template and network attachment. Keep the generated files for inspection.

## 4. Acceptance on the actual host

- Verify NiceNails before and after proxy changes, both homepage and `/admin`.
- Verify Dino Games redirects HTTP to HTTPS and `/api/health` reports `ok`.
- Create a test user. Confirm it survives `docker compose up -d --force-recreate` of the Dino stack. Once content is approved, complete a run and verify its ranking also survives recreation.
- Inspect published ports: MongoDB and the app must have none in production. Only NCN publishes 80/443.
- Check refresh recovery, account login on another device and multiple simultaneous players.
- Check `docker compose logs --tail 100 app mongo` for startup errors; keep secrets out of support messages.

The MongoDB named volume persists through container recreation. Do not run `docker compose down -v`. No automatic backup service is included; persistent storage is not a backup.
