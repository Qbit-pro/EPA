# CostTrack - Expense & Receipt Manager

A full-stack mobile expense app for tracking expenses, purchases, and receipt images. The frontend is an Ionic/Angular app packaged with Capacitor for Android. The backend is an Express API with MongoDB, JWT authentication, Google OAuth, and Google Drive receipt storage.

## Project Structure

```text
MobileApp/
  backend/                 Express API
    controllers/           Auth, expense, purchase handlers
    middleware/            JWT auth and multer upload handling
    models/                Mongoose models
    routes/                API route definitions
    services/              Google Drive helper logic
    app.js                 API entry point

  frontend/mobileApp/      Ionic Angular + Capacitor app
    src/app/pages/         Home, login, expense, purchase screens
    src/app/services/      API and auth session services
    src/environments/      API URL and OAuth callback settings
    android/               Native Android project
```

## Features

- Email/password signup and login.
- Google OAuth sign-in.
- Connect Google Drive to an existing email/password account.
- Expense and purchase creation.
- Receipt capture from camera or gallery.
- Receipt upload to Google Drive.
- Recent activity dashboard.
- Owner-scoped expense and purchase deletion.
- Android OAuth callback through the `expensemanager://oauth` app link.

## Backend Setup

```bash
cd backend
npm install
copy .env.example .env
node app.js
```

Fill `.env` with:

```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/?appName=Cluster0
JWT_SECRET=your_jwt_secret_here
CLIENT_ID=your_google_client_id.apps.googleusercontent.com
CLIENT_SECRET=your_google_client_secret
REDIRECT_URI=http://localhost:5000/api/auth/google/callback
APP_REDIRECT_SCHEME=expensemanager://oauth
```

In Google Cloud Console, add this as an authorized redirect URI:

```text
http://localhost:5000/api/auth/google/callback
```

Enable the Google Drive API for the same Google Cloud project.

## Frontend Setup

```bash
cd frontend/mobileApp
npm install
npm start
```

Browser preview runs at:

```text
http://localhost:4200
```

The app calls the API at `http://localhost:5000/api` in the browser.

## Android Setup

The Android emulator uses this API URL by default:

```text
http://10.0.2.2:5000/api
```

For a physical Android device, update `androidApiUrl` in both environment files to your computer LAN IP, for example:

```ts
androidApiUrl: 'http://192.168.1.25:5000/api'
```

Then build and sync:

```bash
cd frontend/mobileApp
npm run build
npx cap sync android
npx cap open android
```

## API Endpoints

### Auth - `/api/auth`

| Method | Route | Description |
|---|---|---|
| POST | `/signup` | Register a user |
| POST | `/login` | Login with email and password |
| GET | `/me` | Get current user and Drive connection status |
| GET | `/google` | Start Google OAuth |
| GET | `/google/callback` | Google OAuth callback |

### Expenses - `/api/expense`

| Method | Route | Description |
|---|---|---|
| GET | `/all` or `/` | Get current user's expenses |
| POST | `/add` or `/` | Create an expense |
| DELETE | `/:id` | Delete an expense |

### Purchases - `/api/purchase`

| Method | Route | Description |
|---|---|---|
| GET | `/all` or `/` | Get current user's purchases |
| POST | `/add` or `/` | Create a purchase |
| POST | `/upload` | Upload a receipt and create the matching record |
| DELETE | `/:id` | Delete a purchase |

### Health Check

```text
GET /api/health
```

## Receipt Storage

Receipt uploads require Google Drive connection. Files are stored in this folder structure:

```text
ExpenseApp/
  Expense/<year>/<month>/
  Purchase/<year>/<month>/<company|self>/
```

## Notes

- Keep `.env` out of version control.
- For production, replace open CORS settings with the real frontend origin.
- The local Android HTTP setup uses cleartext traffic for development. Use HTTPS for production.
