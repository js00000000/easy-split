# Easy Split

A simple group expense splitting application.

**Live Demo:** [https://easy-split-14.netlify.app](https://easy-split-14.netlify.app)

## Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/).
2. Enable **Firestore Database** and create a database in test mode (or with proper rules).
3. Add a Web App to your project and copy the configuration.
4. Set up the following collections in Firestore (or they will be created automatically on first use):
   - `groups`
   - `members`
   - `expenses`

## Environment Variables

Create a `.env` file or set these in your deployment platform:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## Features

- Join or Create Groups
- Remember user identity via LocalStorage
- Add expenses and see live balances
- Equal split calculation
