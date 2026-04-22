/// <reference types="vite/client" />
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

console.log("Clerk Publishable Key detected:", PUBLISHABLE_KEY ? `${PUBLISHABLE_KEY.substring(0, 10)}...` : "MISSING")

const root = ReactDOM.createRoot(document.getElementById('root')!)

if (!PUBLISHABLE_KEY) {
  root.render(
    <div className="flex h-screen flex-col items-center justify-center bg-red-50 p-4 text-center">
      <h1 className="text-2xl font-bold text-red-600">Configuration Error</h1>
      <p className="mt-2 text-gray-700">The Clerk Publishable Key is missing. Please check your environment variables.</p>
      <code className="mt-4 rounded bg-gray-100 p-2 text-sm">VITE_CLERK_PUBLISHABLE_KEY or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>
    </div>
  )
} else {
  root.render(
    <React.StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </ClerkProvider>
    </React.StrictMode>,
  )
}
