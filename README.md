# Vista

A portal, not a reimplementation. Vista sits in front of your Sonarr, Radarr,
Overseerr/Jellyseerr, NZBGet, and SABnzbd instances and gives you one account,
one mTLS cert, and one clean interface — on iOS, tvOS, Android, and Android TV
— to manage all of them from outside your LAN.

Vista's backend never re-derives or duplicates those services' own decisions
(quality profiles, root folders, request approval). It only ever calls out to
them and displays the result.

## What it does

- **Sonarr / Radarr** — browse your library by season/episode, add new
  shows/movies, delete, run an interactive search (also how you grab an
  upgrade), and see the calendar. Quality profile and root folder choices
  always come from Sonarr/Radarr's own live configuration, never stored by
  Vista.
- **Overseerr / Jellyseerr** — browse, search, and request. Vista submits the
  request to Overseerr, which hands it off to Radarr/Sonarr itself — approval
  stays in Overseerr's own admin UI.
- **NZBGet / SABnzbd** — view queue and history, delete items. Supports
  zero-to-one of each, independently.

## Architecture

One Next.js/Prisma backend (`apps/web`) is the only place that holds the URLs
and credentials for the five services above. Four native clients — iOS, tvOS,
Android, Android TV — talk only to this backend, never directly to Sonarr/
Radarr/etc., over mTLS with optional Cloudflare Access. Login is plain
username/password on every platform, including TV (no pairing flow). The
underlying services stay LAN-only, reachable only from Vista's own backend
container over the internal Docker network.

The web app itself is admin-only: connections, users, API tokens, and
backup/restore. All browsing/library/request/download UX lives in the native
apps.

## Status

- **Backend** (`apps/web`) — done.
- **iOS** (`apps/ios`) — done.
- **tvOS** (`apps/tvos`) — done.
- **Android / Android TV** — not yet started.

## Stack

- **Backend:** Next.js (App Router) + Prisma/SQLite, JWT session cookies for
  the web admin UI, opaque Bearer API tokens for native clients, argon2
  password hashing, AES-256-GCM at rest for stored service credentials.
- **iOS / tvOS:** SwiftUI, `xcodegen`-generated projects (`project.yml`),
  Keychain-backed mTLS client certificate + Cloudflare Access storage.
- **Deploy:** single Docker container, published to
  `ghcr.io/nimaste/vista` on every tagged release.

## Running locally

```bash
cp .env.example .env
# edit .env -- at minimum set JWT_SECRET:
#   openssl rand -hex 32

docker compose up --build
```

Open the configured port — first visit prompts you to create the admin
account, then go to Settings → Connections to point Vista at your Sonarr,
Radarr, Overseerr/Jellyseerr, NZBGet, and/or SABnzbd instances.

## Repo layout

```
apps/
  web/     # Next.js backend + admin web UI (the only thing holding service credentials)
  ios/     # SwiftUI client, project.yml-driven (xcodegen)
  tvos/    # SwiftUI client for tvOS, project.yml-driven (xcodegen)
```
