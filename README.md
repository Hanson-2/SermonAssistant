# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Automated tests

The repository contains a simple script for verifying that the Firestore
`translations` collection is populated. Run it with Node after setting the
required Firebase environment variables:

```bash
FIREBASE_API_KEY=... FIREBASE_AUTH_DOMAIN=... FIREBASE_PROJECT_ID=... \
FIREBASE_STORAGE_BUCKET=... FIREBASE_MESSAGING_SENDER_ID=... \
FIREBASE_APP_ID=... FIREBASE_MEASUREMENT_ID=... \
node scripts/testTranslations.js
```

The script exits with a non-zero status if no documents are found or if an error
occurs so it can be integrated into automated CI pipelines.
