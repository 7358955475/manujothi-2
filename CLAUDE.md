# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a hybrid React-based media library application called "OGON" that displays books, audiobooks, and videos organized in interactive shelves. The app supports multiple languages (Tamil, English, Telugu, Hindi) and includes media viewers for different content types. Built with React + Vite for web and Capacitor for mobile deployment to Android.

## Development Commands

### Frontend (Vite + React + TypeScript)
- **Development server**: `cd frontend && npm run dev`
- **Build**: `cd frontend && npm run build`
- **Lint**: `cd frontend && npm run lint`
- **Preview build**: `cd frontend && npm run preview`

### Mobile Development (Capacitor + Android)
- **Sync web build to native**: `cd frontend && npx cap sync android`
- **Open Android Studio**: `cd frontend && npx cap open android`
- **Run on Android device**: `cd frontend && npx cap run android`
- **Build APK**: Use Android Studio or `cd frontend/android && ./gradlew assembleDebug`

### Dependencies
- Install dependencies: `cd frontend && npm install`

## Architecture

### Frontend Structure (`/frontend`)
- **Entry point**: `src/main.tsx` - React root setup
- **Main component**: `src/App.tsx` - Single large component containing entire MediaLibraryApp
- **Styling**: Tailwind CSS with custom orange theme and Times New Roman typography
- **Build tool**: Vite with React plugin

### Key Application Features
- **Media shelves**: Horizontal scrollable shelves for books, audiobooks, and videos
- **Language filtering**: Multi-language support with filter buttons
- **Media viewer**: Modal overlay for viewing PDFs, playing audio, and embedding YouTube videos
- **Navigation**: Single-page app with page state management via `currentPage` state

### State Management
The app uses React useState for all state management:
- `currentPage`: Controls which view is shown ('home', 'book', 'audio', 'video')
- `selectedLanguage`: Language filter state
- `selectedMedia` & `mediaType`: Controls modal media viewer

### Media Types
- **Books**: Display with covers, support PDF viewing
- **Audio Books**: Display with covers, audio playback, narrator info
- **Videos**: Display with thumbnails, YouTube embed integration

### Styling Approach
- Tailwind CSS utility classes
- Custom orange color scheme (orange-50, orange-500, etc.)
- Consistent Times New Roman font family
- Responsive design with mobile-first approach
- Hover effects and transitions throughout

## Development Notes

### Key Files
- `frontend/src/App.tsx:4-401` - Main application component (single large component)
- `frontend/package.json:7-10` - Available npm scripts
- `frontend/vite.config.ts:5-10` - Vite configuration with React plugin
- `frontend/eslint.config.js:7-28` - ESLint configuration for TypeScript + React

### Technology Stack
- React 18 with TypeScript
- Vite for development and building
- Tailwind CSS for styling
- Lucide React for icons
- ESLint for code quality
- Capacitor for mobile hybrid app deployment
- React PDF Viewer for document viewing
- PDF.js for PDF rendering

### Mobile Configuration
- **App ID**: `com.ogon.app`
- **App Name**: OGON
- **Target**: Android platform
- **Web directory**: `dist` (Vite build output)
- **Capacitor config**: `frontend/capacitor.config.ts`

### Static Assets
- Audio file: `frontend/public/ground_truth.wav` (used in audiobook demo)
- PDF file: `frontend/public/15 June 2025 Circular_Eng.pdf` (sample document)
- External images: Uses Pexels CDN for sample media covers

### Development Workflow
1. **Web development**: Use `npm run dev` in frontend directory for hot reload
2. **Mobile testing**: Build with `npm run build`, sync with `npx cap sync android`, then use Android Studio
3. **Code quality**: Run `npm run lint` before committing changes