# ByteJournal security and operations checklist

- Keep `.env`, SMTP credentials, PostgreSQL credentials, backup files and uploaded content private.
- Generate a unique `JWT_SECRET` and strong `ADMIN_PASSWORD`; never reuse example values.
- Configure SMTP to enable admin password-reset delivery. Do not expose reset tokens in API responses.
- Use HTTPS and set `COOKIE_SECURE=true` in a production deployment.
- Prefer same-origin frontend/API routing through a trusted reverse proxy. Configure it to overwrite forwarded host/protocol headers, and keep the Node API bound to localhost or a private network.
- Restrict PostgreSQL to the application host/private network; do not expose the database port publicly.
- Back up both PostgreSQL and `server/uploads`. Test restore to a non-production environment.
- Keep dependencies patched and review audit output before deployment.
- Use a shared rate-limit store and centralized monitoring before scaling beyond one API process; current login/public-form throttles are in-process.
- The provided CI and source tests do not replace live PostgreSQL migration, authentication, authorization, browser, load, accessibility or penetration tests.

## Signed-in account profile and password changes
- The `/api/auth/profile` GET and PUT endpoints only read or update the authenticated account identified by the server-verified session; clients cannot supply another user ID.
- Profile email updates are validated and duplicate addresses are returned as HTTP 409. Changing the email clears the email-verification timestamp.
- The `/api/auth/change-password` endpoint verifies the current bcrypt hash, requires a new password of at least 12 characters, hashes it with bcrypt cost 12, and consumes outstanding password-reset tokens.
- Each password change increments `users.token_version`. The authenticated middleware compares the JWT version with the database version, invalidating prior sessions while issuing a refreshed cookie to the current browser.
