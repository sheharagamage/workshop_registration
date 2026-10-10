# Design Notes — Workshop Registration Service

## Stack
- **React + Vite:** quick, responsive SPA development and clear component state.
- **Node.js + Express:** small REST API with straightforward middleware-based authentication and authorization.
- **MongoDB + Mongoose:** flexible workshop and registration records, indexes, and atomic conditional updates.

## Design decisions
- Roles are enforced by backend middleware and endpoint-level checks. Hiding controls in React is only a usability measure.
- Admin creates all user accounts; there is no public signup route.
- Registration records are never deleted. They contain `registeredBy`, `registeredAt`, `cancelledBy`, and `cancelledAt`.
- Workshop `activeCount` is stored as a counter to make seat claims atomic and efficient.
- Attendee emails are normalized and a partial unique index prevents two active registrations for the same attendee/workshop.
- Workshop list filters are applied on the server so the UI can query only the relevant date range/status/availability.

## Preventing over-registration
The API uses a conditional, atomic MongoDB update that increments `activeCount` only when it is less than `capacity` and the workshop is scheduled. MongoDB serializes competing updates to the same document, so two requests for the final seat cannot both increment the count. If creating the registration document fails after the claim, the counter is rolled back. Cancellation transitions only an `Active` record to `Cancelled`, so repeated cancellation requests cannot release the same seat twice.

## Trade-offs and assumptions
- This implementation favors a single-document atomic capacity claim so it works on a local standalone MongoDB server, rather than requiring replica-set transactions. The registration record and counter are separate documents, so a process crash between the two operations can temporarily cause counter drift; a production version should use transactions on a replica set and a reconciliation job.
- JWT bearer tokens are stored in localStorage for assessment simplicity. A production deployment should use HttpOnly secure cookies, rate limiting, stronger secret management, and robust account lifecycle controls.
- The UI prioritizes end-to-end workflow and usability over extensive visual polish.
- Optional audit trail for workshop edits and role changes, waitlist, password reset, pagination, and automated tests were not implemented due to the time-boxed scope.
