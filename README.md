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

## Ideas for later

- Email notifications (invites, overdue task digests) via Resend or similar
- Task comments and a per-client activity feed
- In-app notification bell with unread counts
- Calendar drag-to-reschedule and ICS export for clients
- Audit trail of status changes
