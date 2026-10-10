# Workshop Registration Service

A full-stack assessment implementation using React, Node.js/Express, and MongoDB.

## Features
- JWT authentication and backend-enforced `Admin`, `Manager`, and `Staff` roles.
- Admin-only account creation; no public signup.
- Workshop creation/editing by Managers.
- Register/cancel attendees by Managers and Staff.
- Registration history is retained, including actor and timestamps.
- Date-range, status, and seats-available filters.
- Atomic seat reservation using a conditional MongoDB update on `activeCount`, so simultaneous requests cannot reserve beyond capacity.
- Seeded development Admin and sample workshops.

## Requirements
- Node.js 20+
- MongoDB 6+ (local MongoDB or MongoDB Atlas)

## Run locally

### 1. Backend
```bash
cd backend
cp .env.example .env
npm install
npm run seed
npm run dev
```
Backend runs at `http://localhost:5000`.

Seeded development credentials:
- Email: `admin@example.com`
- Password: `Admin123!`

Change these credentials and `JWT_SECRET` before using this outside local development.

### 2. Frontend
Open another terminal:
```bash
cd frontend
npm install
npm run dev
```
Open the URL Vite prints (normally `http://localhost:5173`).

## Roles
- **Admin:** create accounts and assign roles. Can also view data.
- **Manager:** create/edit workshops; register/cancel attendees; view workshops and history.
- **Staff:** view workshops/history; register/cancel attendees.
- Every protected operation is checked in the API, not just in the UI.

## Capacity/concurrency design
`Workshop.activeCount` is a counter maintained by the API. Registering a person first performs one atomic MongoDB `findOneAndUpdate` with conditions `activeCount < capacity` and `status === "Scheduled"`. Only one concurrent request can claim the final seat. If registration record creation fails, the API compensates by decrementing the counter. Cancellation atomically changes a registration from `Active` to `Cancelled` and then releases its seat. A unique partial index prevents duplicate active registrations for the same email/workshop.

For a production system with stronger multi-document guarantees, use MongoDB transactions on a replica set and reconcile the counter periodically. This implementation uses a single-document atomic capacity claim so it also works with a standalone local MongoDB instance.

## API overview
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/users` — Admin only
- `GET /api/users` — Admin only
- `GET /api/workshops?from=YYYY-MM-DD&to=YYYY-MM-DD&status=Scheduled&available=true`
- `POST /api/workshops` — Manager only
- `PATCH /api/workshops/:id` — Manager only
- `GET /api/registrations?workshopId=...`
- `POST /api/registrations` — Manager/Staff
- `PATCH /api/registrations/:id/cancel` — Manager/Staff

## Notes / assumptions
- Workshop statuses: `Scheduled`, `Completed`, `Cancelled`.
- A workshop is open for registration only while its status is `Scheduled` and it has free seats.
- Attendee email is normalized to lowercase.
- Active duplicate registrations for the same workshop/email are rejected; a cancelled registration remains in history, and a new registration can be made later.
- The app uses a simple JWT bearer token stored in `localStorage` to keep this assessment easy to run. For production, prefer secure, HttpOnly cookies, CSRF protection where relevant, rate limiting, and stricter operational secret management.
- UI is intentionally simple to prioritize correctness and end-to-end functionality.

## Suggested smoke test
1. Sign in as the seeded Admin and create a Manager and Staff account.
2. Sign in as Manager and create a workshop with capacity `1`.
3. Open two browser sessions / send two registration requests for different attendees at nearly the same time. At most one should succeed.
4. Cancel the active registration and verify the seat becomes available while the cancelled record remains in history.
5. Sign in as Staff and confirm workshop create/edit and account creation endpoints are denied by the backend.
