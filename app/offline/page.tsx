"use client"

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">📱</span>
        </div>
        <h1 className="text-2xl font-bold text-amber-900 mb-4">You're Offline</h1>
        <p className="text-amber-700 mb-6">
          No internet connection detected. You can still view your cached bowls and add new ones. Changes will sync when
          you're back online.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
