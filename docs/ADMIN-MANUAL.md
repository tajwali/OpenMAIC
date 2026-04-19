# Administrator Manual

The Admin Dashboard provides high-level control over the OpenMAIC 2.0 platform, including user management, subject configuration, and system-wide statistics.

## Accessing the Dashboard

Administrators can access the dashboard by logging in with an account that has the `admin` role. Upon login, you will be redirected to the Admin Dashboard.

## 1. User Management

The **Users** tab allows you to oversee all accounts on the platform.

### Creating Teacher Accounts
Since OpenMAIC 2.0 is designed as a managed platform, teacher accounts are typically created by an administrator:
1. Navigate to the **Users** tab.
2. Click **Create Teacher**.
3. Provide a Display Name, Email, and Password.
4. The account will be created with the `teacher` role and is ready for use.

### Managing Existing Users
- **Change Roles:** You can promote or demote any user to `admin`, `teacher`, `mature_student`, or `school_student`.
- **Ban/Unban:** Use the block icon to disable an account. Disabled users cannot log in.
- **Reset Password:** Administrators can force a password change for any user via the **Edit** (pencil) icon.
- **Delete User:** Permanently remove a user and their associated data.

> [!WARNING]
> You cannot delete or disable your own account.

## 2. Subject Management

The **Subjects** tab allows you to define the educational categories used for course classification.

- **Default Subjects:** Built-in subjects like Mathematics, Science, and History. These are essential for AI classification and cannot be deleted.
- **Custom Subjects:** Add your own subjects by providing an Emoji icon and a name. Teachers can select these when generating courses.

## 3. Platform Statistics

The **Statistics** tab provides real-time insights into platform usage:

- **Total Courses & Scenes:** Monitor the volume of educational content generated.
- **Storage Usage:** View the total disk space used by media files (images, audio) and the total file count.
- **User Distribution:** See a breakdown of users by role.
- **Recent Activity:** A log of the last 10 courses generated across the platform, including which teacher created them.

## 4. Troubleshooting

### Auth Issues
If users report login failures with "Unexpected non-whitespace character after JSON", ensure the `SUPABASE_AUTH_URL` is correctly set in `.env.local` and that the file has been copied to the standalone directory.

### Media Generation Failures
If images or TTS are not appearing:
1. Check the **Statistics** tab to see if storage usage is increasing.
2. Verify API keys for Google (Gemini/TTS) in the server environment.
3. Check server logs using `journalctl -u openmaic -f`.
