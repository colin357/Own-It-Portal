# Own It Social — Client Portal

A client portal for Own It Social built with Next.js (App Router), TypeScript, Tailwind CSS, and Firebase (Auth, Firestore, Storage).

## What it does

**For clients**
- Sign up and get onboarding tasks assigned automatically (from admin-managed templates)
- Work through tasks with due dates, urgency levels, and optional Loom / Google Drive video walkthroughs embedded right in the task
- View content ideas, email blasts, blog posts, and social posts — and submit their own ideas
- A month-view content calendar of everything scheduled for their brand
- Upload photos, videos, and documents to share with the agency (Firebase Storage)
- Invite teammates (assistants, colleagues) to get their own logins on the same account

**For the agency (admin)**
- Project-management dashboard: overdue / due-this-week / waiting-on-client stats and a cross-client table of every open task, filterable by client and tag
- Drag-and-drop task board (kanban) across all clients
- Per-client workspace: tasks, content, calendar, files, and team, in one place
- Manually create tasks for any client, with due date, urgency, and optional video link
- Onboarding task templates — active templates are auto-assigned to every new signup, and can be re-applied to existing clients
- Tags to group and filter clients (by package, industry, etc.)

**Integrations**
- **Twilio SMS**: a daily cron job (see `vercel.json`, runs 15:00 UTC) texts clients who have tasks overdue or due within 24 hours (clients opt in by saving a mobile number on their Team page — at most one reminder per day per client), and teammate invites can be texted directly when a phone number is entered.
- **OpenAI**: a "✨ Generate ideas" button on the content pages (client portal and admin client view) drafts five content ideas tailored to the client's business, tags, and existing content; any of them can be added to the content list with one click.
- **Bulk content upload**: add many content ideas at once instead of one at a time — either paste them in the admin UI (client → Content → **Bulk add**) or push them from a script via `POST /api/content/bulk`. See [Bulk-uploading content ideas](#bulk-uploading-content-ideas).

## Setup

This app uses your **existing Firebase project** but only new, portal-specific collections (`clients`, `portalUsers`, `tasks`, `taskTemplates`, `contentItems`, `tags`, `invites`) and the `portal/` folder in Storage — existing data is untouched.

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env.local
   ```

   - Fill in the `NEXT_PUBLIC_FIREBASE_*` values from Firebase console → Project settings → General → Your apps (add a Web app if you don't have one).
   - Generate a service account key (Project settings → Service accounts → Generate new private key) and set `FIREBASE_SERVICE_ACCOUNT_KEY` to the base64-encoded JSON: `base64 -w0 service-account.json`.
   - Set `ADMIN_EMAILS` to a comma-separated list of your team's emails. Those accounts become admins on first login.
   - Optional integrations: set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` for SMS reminders/invites (plus `CRON_SECRET` to lock down the cron endpoint and `NEXT_PUBLIC_APP_URL` so texted links point at your production domain), and `OPENAI_API_KEY` for AI content ideas. Everything degrades gracefully if these are missing.

3. **Enable Email/Password auth** in Firebase console → Authentication → Sign-in method.

4. **Deploy security rules and indexes** (requires the [Firebase CLI](https://firebase.google.com/docs/cli)):

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

   `firestore.rules`, `storage.rules`, and `firestore.indexes.json` are in the repo root.

5. **Run**

   ```bash
   npm run dev
   ```

   To create your admin login: add the user in Firebase console → Authentication → Add user (with an email listed in `ADMIN_EMAILS`), then log in at `/login` — the admin role is granted automatically on first login.

## How the flows work

- **Client signup** (`/signup`): creates the Auth user, a `clients` org doc, a `portalUsers` profile, sets custom claims (`role`, `clientId`), and copies all active onboarding templates into real tasks with due dates offset from the signup date.
- **Admin access**: any signed-in user whose email is in `ADMIN_EMAILS` is granted the `admin` custom claim via `/api/auth/bootstrap` on first load.
- **Invites** (`/portal/team` or admin → client → Team): generates a shareable `/join/<id>` link (valid 14 days). The teammate sets a name and password and lands in the same client account.
- **Videos**: paste a Loom share link or Google Drive file link on a task or template — it renders as an embedded player. Drive files need link sharing enabled.
- **Security**: Firestore/Storage rules scope every read and write by the `role` / `clientId` custom claims; privileged flows (signup, invites, role granting) run server-side with the Admin SDK.

## Bulk-uploading content ideas

Every week you draft a batch of ideas per client. Two ways to load them without
adding each one by hand:

**In the portal (paste):** open a client, go to the **Content** tab, and click
**Bulk add**. Paste one idea per line — add optional details after a `|`:

```
5 signs your water heater is failing | Educational post, end with a service CTA
Behind the scenes: a day with our install crew
Customer spotlight: the Johnson family kitchen remodel
```

Pick the type/status once and they're all created together. Dates and links can
be set later by editing an item.

**By POST request (automation):** `POST /api/content/bulk` creates ideas for one
or many clients in a single call — wire it to a spreadsheet export, Zapier/Make,
or a cron script.

- **No auth required.** The endpoint is open: anyone who can reach the URL can
  create content ideas. It only ever *creates* `contentItems` (no reads,
  updates, or deletes) and is capped at 1000 items per request.
- **Reference clients** by `clientId` or by `clientName` (case-insensitive; the
  name must be unique). Top-level `type`, `status`, `clientId`, and `clientName`
  act as defaults every item inherits.
- **Item fields:** `title` (required), `body`, `type`
  (`idea` | `email_blast` | `blog_post` | `social_post`, default `idea`),
  `status` (`idea` | `draft` | `scheduled` | `published`, default `idea`),
  `scheduledDate` (`YYYY-MM-DD`), `link`.

Flat list:

```bash
curl -X POST https://your-portal.example.com/api/content/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "type": "idea",
    "items": [
      { "clientName": "Joe'\''s Plumbing", "title": "5 signs your water heater is failing", "body": "Educational; end with a service CTA.", "scheduledDate": "2026-07-20" },
      { "clientName": "Bright Smiles Dental", "title": "Meet the hygienists", "body": "Team intro reel." }
    ]
  }'
```

Grouped by client (handy for "8 ideas per client"):

```json
{
  "clients": [
    { "clientName": "Joe's Plumbing", "ideas": [ { "title": "Idea 1" }, { "title": "Idea 2" } ] },
    { "clientId": "abc123",          "ideas": [ { "title": "Idea 1" } ] }
  ]
}
```

The response reports what happened, so a bad row never blocks the rest:

```json
{ "created": 3, "skipped": 1, "byClient": { "abc123": 2, "def456": 1 },
  "errors": [ { "index": 4, "reason": "Could not find client \"Acme\"." } ] }
```

Up to 1000 items per request.

## Temporary legacy login mode (pre-launch)

Setting `NEXT_PUBLIC_LEGACY_AUTH=true` makes the login page check credentials directly against the old portal's Firestore docs (`adminUsers`, then `users`) — the same behavior as the previous portal — instead of Firebase Authentication. All portal features (including the in-app migration page) work with these sessions.

Requirements while this mode is on:
- Firestore rules must allow unauthenticated access (the old portal's setup). If you've deployed the strict rules, switch back temporarily: `firestore-legacy.rules` is provided.
- The migration keeps working; if Firebase Auth account creation fails it falls back to Firestore-only identities and leaves the old password fields in place so legacy login keeps working.

**Before go-live:** fix the Firebase Auth configuration, set `NEXT_PUBLIC_LEGACY_AUTH=false`, re-run the migration (it will create the real logins and scrub plaintext passwords), and deploy the strict `firestore.rules`.

## Migrating data from the old portal

`scripts/migrate.js` copies the old portal's collections (`users`, `groups`, `adminUsers`, `content`, `calendarEvents`, `videos`) into the new schema in the same project. Old data is never modified or deleted, with one deliberate exception: plaintext `password` fields are removed from `users`/`adminUsers` after proper Firebase Auth accounts are created (existing passwords keep working).

**Option A — from the deployed portal (easiest):** log in as an admin and open **Migration** in the sidebar (`/admin/migrate`). Run the dry run, review the log, then "Migrate for real". Uses the deployment's own service account; nothing to install.

**Option B — from the command line:**

```bash
# put service-account.json in the project root (gitignored), then:
npm run migrate            # dry run — prints everything it would do
npm run migrate -- --commit  # actually migrate
```

Details:
- Every migrated doc gets a `legacyId` and a deterministic ID, so re-running updates in place (no duplicates).
- `groups` → tags; `users` → clients + owner logins (+ four onboarding tasks marked done/open from old progress; onboarding answers preserved in client notes); `content`/`calendarEvents` → content items with scheduled dates; `videos` → copied into `portal/{clientId}/uploads/` Storage so they show on Files pages.
- `adminActivities`, `dailyTasks`, and `dailyTaskCompletions` are intentionally not migrated (old audit log; recurring daily tasks have no equivalent yet).

## Ideas for later

- Email notifications (invites, overdue task digests) via Resend or similar
- Task comments and a per-client activity feed
- In-app notification bell with unread counts
- Calendar drag-to-reschedule and ICS export for clients
- Audit trail of status changes
