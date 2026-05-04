# SLICE (群組分帳)

A modern, mobile-friendly group expense splitting application built with React, TypeScript, and Firebase.

**Live Demo:** [https://slice.fusion-labs.cc](https://slice.fusion-labs.cc)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/js00000000/easy-split)

## Key Features

- 🚀 **Multi-Group Architecture**: Create, join, and manage multiple splitting groups simultaneously.
- 🔐 **Authentication & Data Integrity**: 
  - Support for **Anonymous Guest sign-in** and **Google Authentication**.
  - Safe migration path for guest users to Google accounts, with built-in protection against accidental data overwrites.
- 👥 **Smart Member Binding**: Bind your user account to a specific group member to track your own balances and expenses easily.
- 📊 **Optimized Settlement**: 
  - Uses a **Greedy Algorithm** to minimize the total number of reimbursement transactions.
  - Real-time balance calculations for all members.
- 🛡️ **Group Management**: 
  - Hosts can manage members, update group names, or permanently delete groups.
  - Regular members can **Leave Group** once their balance is fully settled.
- 🌐 **Internationalization (i18n)**: Full support for **English** and **Traditional Chinese (繁體中文)**.
- 📱 **Mobile First UI**: Fully responsive design with a clean, intuitive interface built with Tailwind CSS 4 and Lucide Icons.
- 🔄 **State Persistence**: Remembers your last visited group and syncs joined groups across your user profile.

## Tech Stack

- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite 8](https://vitejs.dev/)
- **Routing**: [React Router 7](https://reactrouter.com/)
- **State Management**: React Context API
- **Backend**: [Firebase 12](https://firebase.google.com/) (Firestore, Auth)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/), [Lucide Icons](https://lucide.dev/)
- **i18n**: [i18next](https://www.i18next.com/), [react-i18next](https://react.i18next.com/)
- **Notifications**: [React Hot Toast](https://react-hot-toast.com/)
- **Testing**: [Vitest](https://vitest.dev/)

## Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/).
2. Enable **Firestore Database**.
3. Enable **Authentication** and activate the **Google** and **Anonymous** providers.
4. Add a Web App to your project and copy the configuration.
5. Environment variables are required for the app to connect to your Firebase instance.

## Environment Variables

Create a `.env` file in the root directory (see `.env.example`):

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Preview production build
npm run preview
```

## License

MIT
