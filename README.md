# somethingcool.

A small private-download dashboard with Spotify embeds.

## Run locally
1. Install Node.js 20+.
2. Run `npm install`.
3. Set a strong `SESSION_SECRET` environment variable.
4. Run `npm start`.
5. Open `http://localhost:3000`.

## What is real
- Passwords are hashed with bcrypt.
- Login state uses server-side sessions.
- Files are stored outside the public web directory.
- Every download checks the signed-in user's database ID before sending the file.
- Spotify uses the official Spotify embed player; tracks are not downloaded or re-hosted.

For production, deploy the Node server on a platform that supports persistent storage (or move the database/uploads to managed services) and set a strong session secret. Do not deploy this as GitHub Pages alone; GitHub Pages cannot run the private backend.
