# draba

> **Who is working on what, and when?**

**draba** is a lightweight team coordination and planning tool designed for small teams (5–20 people) who need visibility across people and time, without the heavy overhead of tickets, sprints, or complex dependencies. 

It is not a calendar replacement. It is not a project management suite. It is a **shared team timeline** that your team can adopt in minutes.

---

## Key Features

- **Horizontal Timeline:** The primary view is a person-first timeline. See exactly what everyone is doing at a glance.
- **Real-Time Collaboration:** Multiple users can view and edit simultaneously. Changes appear instantly for everyone without refreshing.
- **Calendar Sync (Coming Soon):** Two-way sync with Google Calendar, plus a built-in CalDAV server so you can connect native apps (like Apple Calendar) directly to draba.
- **Public & Restricted Views:** Share specific timelines publicly with a stable link, or restrict them to authenticated team members.
- **Zero-Friction Self-Hosting:** Runs as a single Docker container with an embedded SQLite database. No external services required.

## Technology Stack

draba is built as an API-first, event-driven application:

- **Backend:** Go (API + built-in CalDAV server)
- **Database:** SQLite (default for zero-config hosting) via `sqlx`
- **Frontend:** React 19, TypeScript, Vite, and Tailwind CSS v4
- **Real-Time:** WebSockets (team-scoped broadcasting)
- **API Contract:** OpenAPI with auto-generated TypeScript types

## Status

draba is currently under active development. The core API foundation (auth, teams, events, websockets) is complete, and we are currently building out the React frontend. 

Check out the `docs/` folder for our architecture decisions, roadmap, and design patterns.

## Deployment (Self-Hosted)

draba is deployable as a single Docker container. The official image is available on Docker Hub at `mewcus/draba`.

```yaml
services:
  draba:
    image: mewcus/draba:latest
    ports:
      - "8080:8080"
    volumes:
      - ./data:/data
```

## License

[MIT License](LICENSE)