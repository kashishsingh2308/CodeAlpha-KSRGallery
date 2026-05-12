# 🧿 KSR Gallery

A minimalist, elegant, and collaborative visual storytelling platform. Lumiere Gallery allows creators to curate their own digital space, share their unique perspectives, and explore the collections of others.

## ✨ Features

- **Google Authentication**: Secure sign-in to manage your personal gallery.
- **Dynamic Collections**: Create and organize photos into custom categories (Architecture, Nature, Minimal, etc.).
- **Smart Image Optimization**: Automatic client-side resizing and compression to ensure fast uploads and storage efficiency within Firestore document limits.
- **Shared Perspectives**: Generate a unique link to share your curated gallery with anyone.
- **Immersive Lightbox**: Experience photos in full-screen with smooth transitions, keyboard navigation, and detailed descriptions.
- **Real-time Synchronization**: Instant updates across devices using Firebase Firestore's real-time listeners.
- **Sophisticated Design**: Built with a "Swiss/Modern" aesthetic, utilizing serif typography and rhythmic spacing.

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, TypeScript
- **Styling**: Tailwind CSS
- **Animations**: `motion` (motion/react)
- **Icons**: Lucide React
- **Backend / DB / Auth**: Firebase (Authentication & Firestore)

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- A Firebase Project

### Setup

1. **Clone the project** and install dependencies:
   ```bash
   npm install
   ```

2. **Firebase Configuration**:
   Create a `firebase-applet-config.json` file in the root directory with your Firebase credentials:
   ```json
   {
     "projectId": "YOUR_PROJECT_ID",
     "appId": "YOUR_APP_ID",
     "apiKey": "YOUR_API_KEY",
     "authDomain": "YOUR_AUTH_DOMAIN",
     "firestoreDatabaseId": "(default)",
     "storageBucket": "YOUR_STORAGE_BUCKET",
     "messagingSenderId": "YOUR_MESSAGING_SENDER_ID",
     "measurementId": "YOUR_MEASUREMENT_ID"
   }
   ```

3. **Firestore Setup**:
   Ensure you have created a Firestore database and added the necessary indexes for sorting images and categories by `userId` and `createdAt`.

4. **Run the development server**:
   ```bash
   npm run dev
   ```

## 🔒 Security

This project uses hardened Firestore Security Rules to ensure:
- Users can only modify their own content.
- PII is isolated.
- Document integrity is maintained via schema validation.

## 📱 Responsive Design

KSR Gallery is fully responsive, offering a tailored experience for mobile, tablet, and desktop viewports, with touch-optimized interactions and fluid layouts.

---