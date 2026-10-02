# FJMC Academy Admin Panel

## What changed
- `admin.html` + `admin.js`: admin-only management panel.
- `dashboard.js`: student dashboard now reads student assignments and course/content from Firestore.
- `login.js`: removed hard-coded student allowlist; Firebase Authentication handles login, and the dashboard checks the Firestore student profile.
- `admin-default-data.js`: current hard-coded dashboard data for one-click import.

## Admin URL
`https://fjmc-academy.github.io/fjmcacademy/admin.html` (use your actual GitHub Pages path).

## First setup
1. Create/sign in to the Firebase Authentication account you want to use as admin.
2. Open `admin.js` and change `ADMIN_EMAILS` to the admin email(s).
3. Open the admin page and click **Import Existing Dashboard Data** once.
4. After import, manage students/courses/content from the panel.
5. Students still need a Firebase Authentication account. The admin panel creates the Firestore student profile/assignment, not the Firebase Auth account.

## Firestore collections
- `students/{emailId}`: name, email, exam, batch, year, courses[]
- `courses/{courseId}`: course metadata + contents[]
- `testResults/*`: existing test results; admin can view/delete them
- `users/{uid}/devices/*`: existing device reservations; admin can release a device

## Important security
The email allowlist in `admin.js` is a UI gate, not a complete server-side security boundary. Your Firestore Security Rules should restrict writes to `students`, `courses`, and `testResults` deletion/device management to trusted admin accounts. Do not make these collections publicly writable.

Existing `test.js` remains unchanged, so the current test/question system continues to work. The course `testId` field controls which existing test is opened.
