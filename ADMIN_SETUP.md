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


# Updated Admin / Test System

## 1. Firestore Rules
Copy `firestore.rules` into Firebase Console → Firestore Database → Rules → Publish.

Admin email:
`fjmcacademy1008@gmail.com`

The device reservation code in `dashboard.js` was not changed. The rules now allow the existing
`users/{uid}/devices/{deviceId}` device system to work for the student owner and admin.

## 2. Import existing data
Login to `admin.html` with the admin Firebase account.

Use:
- **Import Existing Dashboard Data** → students + courses
- **Import Existing test.js Tests** → copies the old hard-coded lecture-wise tests into Firestore and maps them to the actual Exam/Batch/Year course IDs.

## 3. New test management
Admin → **Tests & Questions**

Structure:
Exam → Batch → Year → Course → Lecture → Test

You can:
- create a lecture-wise test
- add questions
- edit questions
- delete questions
- set A/B/C/D
- set correct option
- set explanation/solution
- set duration
- delete a complete test

Tests are stored in:
`tests/{courseId}__lecture-{lectureId}__test-{testNumber}`

## 4. Student test
The dashboard test button now sends the real assigned Firestore course ID to `test.html`.

The student test page reads the lecture-wise tests from Firestore instead of the old hard-coded test list.

## 5. Results / leaderboard
Results remain in:
`testResults`

The existing first-attempt rule is preserved:
- result document is based on course + lecture + test + email
- if it already exists, a retake does not overwrite it
- leaderboard ranks first-attempt results
- students can see leaderboard data
- admin can delete results

## 6. PDF
Admin → Test Results:
- individual **PDF** button for every result
- **Download All Results PDF** for all visible result data

PDF generation uses jsPDF from CDN, so the admin page needs internet access.

## Important
Do not remove the `tests`, `courses`, `testResults`, `students`, or `users/{uid}/devices` Firestore rules if the corresponding feature is being used.
