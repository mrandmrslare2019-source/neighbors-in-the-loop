# Neighbors in the Loop
A neighborhood discovery app for finding local shops, services, wellness spaces, and community favorites.

## Features

- Business directory and search/filter UI
- Interactive map view using Leaflet and OpenStreetMap tiles
- Business detail panel with photos, tags, and metadata
- Add-your-business form for rich neighborhood listings
- Saved places and a profile sync endpoint
- Review posting and moderation workflow
- Persistent business and comment storage with SQLite
- Recommendations counter, analytics, and moderation stats
- CRUD support for business records

## Run locally

```sh
npm install
npm run migrate
npm start
```

Then open:

http://localhost:8080/index.html

You can also run the server in watch mode:

```sh
npm run dev
```

The app listens on port 8080 by default, or on PORT if you set it in the environment.

## Environment variables

```sh
PORT=8080
HOST=0.0.0.0
NODE_ENV=production
DB_PATH=./data/nm-app.db
AUTH_SECRET=change-this-to-a-long-random-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=use-a-unique-long-password
ALLOWED_ORIGIN=https://your-domain.example
```

Create a `.env` file locally or set these values in your deploy environment before starting the app.

Never commit `.env`. `AUTH_SECRET` signs sessions, and `ADMIN_PASSWORD` bootstraps the administrator account on first startup.

## Production deployment

This app is ready for a simple Node deployment on a managed host such as Render, Railway, Fly.io, or a VM/container host.

### Docker

```sh
docker build -t neighbors-in-the-loop .
docker run --rm -p 8080:8080 -e PORT=8080 -e DB_PATH=/app/data/nm-app.db neighbors-in-the-loop
```

### Docker Compose

```sh
docker compose up --build
```

### Render / Railway / other Node hosts

- Set `PORT` to the platform-assigned port.
- Set `AUTH_SECRET` to a generated secret string.
- Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` to the credentials used by the moderation dashboard.
- Set `ALLOWED_ORIGIN` to the exact public app origin, including `https://` and without a trailing slash.
- Keep `DB_PATH` pointed to a writable persistent volume or managed database path.
- Ensure the app is served with Node 18+.

### Recommended Railway launch

1. Create a Railway project from this repository.
2. Add a Volume mounted at `/app/data`.
3. Set `DB_PATH=/app/data/nm-app.db` and the variables from `.env.example`.
4. Deploy with `npm install` and `node server.js`.
5. Confirm the deployment health check at `/api/health`.
6. Configure a custom domain and enable HTTPS before sharing the app.

Railway volumes are required for SQLite data to survive redeploys. Schedule regular copies of `/app/data/nm-app.db` to external storage. For higher traffic, migrate the database to managed PostgreSQL instead of scaling SQLite across instances.

### Render launch

The included `render.yaml` provisions a paid starter service with a 1 GB persistent disk. Add the secret `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ALLOWED_ORIGIN` values in Render, then deploy the blueprint.

## API

- GET /api/health
- GET /api/businesses
- POST /api/businesses
- PUT /api/businesses/:name
- DELETE /api/businesses/:name
- GET /api/comments?business=Name
- POST /api/comments
- PUT /api/comments/:id
- GET /api/users
- POST /api/users
- GET /api/analytics
- POST /api/auth/register
- POST /api/auth/login
- GET /api/admin/moderation

## Database

The app uses SQLite for persistent storage. The database file lives in `data/nm-app.db` and is created automatically by the server.

```sh
npm run migrate
```

## Docker

```sh
docker build -t neighbors-in-the-loop .
docker run --rm -p 8080:8080 neighbors-in-the-loop
```

## Production deployment notes

- Use a managed PostgreSQL database when traffic or multiple app instances make SQLite unsuitable.
- Use a persistent volume for `data/nm-app.db`; container-local storage is disposable.
- Back up the SQLite file before deployments and on a schedule. Test restoring a backup before launch.
- Keep `AUTH_SECRET` and `ADMIN_PASSWORD` in the host secret manager, not in source control.
- Use the admin sign-in inside the Moderation queue; moderation and approvals require an administrator token.
- Keep `ALLOWED_ORIGIN` restricted to the public web origin.
- Put the app behind the host's HTTPS endpoint and use a custom domain for public sharing.
- Donations are currently a local UI flow, not a payment processor. Connect Stripe or another provider before accepting real funds.

## Launch checklist

- [ ] Set production secrets and a persistent database volume
- [ ] Deploy and confirm `/api/health`
- [ ] Sign in to the moderation queue and approve a test review
- [ ] Verify the custom domain and HTTPS certificate
- [ ] Create and test a database backup restore
- [ ] Configure a real payment provider before accepting donations
