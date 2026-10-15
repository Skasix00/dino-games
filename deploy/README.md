# Deploy brunocastelo.me with one Compose file

The root `compose.yml` runs the whole site on its own server:

- `app`: published Dino Games image; seeds the quiz automatically before starting Next.js.
- `mongo`: authenticated MongoDB with a persistent named volume and no public port.
- `proxy`: Caddy, with automatic HTTPS issuance/renewal and persistent certificate storage.

The proxy configuration is embedded in Compose. No external database, proxy files, shared network, override file, or manual seed command is required. NiceNails is on a separate server and is not involved.

## First deployment

1. Push the current changes to `main` and wait for **Verify and publish Dino Games** in GitHub Actions to finish successfully.
2. On the new server, install Docker Engine and Docker Compose **2.23.1 or newer**. Point the DNS A record for `brunocastelo.me` to this server. Only add an AAAA record if its IPv6 address also reaches this server. Ports **80 and 443 TCP** must be free and reachable; **443 UDP** enables HTTP/3.
3. Copy the repository's root `compose.yml` into `/opt/dino-games/compose.yml`. Copy `deploy/.env.example` into `/opt/dino-games/.env`. These are the only files needed on the server.
4. Edit `.env`, keeping `PUBLIC_DOMAIN=brunocastelo.me`. Set your certificate contact email in `ACME_EMAIL`. Generate the MongoDB password and session secret separately with `openssl rand -hex 32`, and replace both placeholders. Protect the file with `chmod 600 .env`. Keep these values stable across updates.
5. Start everything from that directory:

```sh
cd /opt/dino-games
# Only for a private GHCR package: docker login ghcr.io
# Use a GitHub token with read:packages if authentication is needed.
docker compose config --quiet
docker compose pull
docker compose up -d --wait
```

Open **https://brunocastelo.me**. Caddy requests a public certificate after DNS and inbound ports are ready. Container health alone does not prove public certificate issuance; verify it with:

```sh
curl --fail https://brunocastelo.me/api/health
docker compose ps
```

The quiz starts with 16 questions (1,600 points). Question 4 remains stored but disabled. BennyRex Rush is immediately available. Startup seeding is idempotent and preserves players, results and existing attempt snapshots.

## Updates and rollback

```sh
cd /opt/dino-games
docker compose pull
docker compose up -d --wait
curl --fail https://brunocastelo.me/api/health
```

The app seeds the content bundled in its image automatically whenever its container starts. Existing content versions remain stored. To roll back, set `IMAGE_TAG` in `.env` to the previous immutable `<commit SHA>-<run ID>` tag and run the same commands. Keep the Compose project name `dino-games` and named volumes unchanged.

## Troubleshooting and persistence

```sh
docker compose logs --tail 100 app mongo proxy
```

- GHCR `unauthorized`: log into `ghcr.io` with package read access, or make the image public.
- Certificate errors: check DNS A/AAAA records, inbound ports 80/443, the contact email, and proxy logs. Do not put another web server on these ports.
- Registration errors: check that app and MongoDB are healthy; retain the original MongoDB credentials when reusing an initialized volume.
- Accounts/results live in `mongo-data`; certificates live in `caddy-data`. Container recreation preserves both. **Do not use `docker compose down -v`**, which deletes the volumes. Automatic backups are not included.

The container test starts this stack with a local test certificate, verifies authenticated requests through HTTPS, plays both games, and recreates all three containers to verify persistence. Public DNS and public CA issuance must still be verified on the real server.

References: [Compose inline configs](https://docs.docker.com/reference/compose-file/configs/) and [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https).
