import React from 'react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">
            <span className="text-blue-500 dark:text-blue-400">Techno</span>
            <span className="text-green-500 dark:text-green-400">Ring</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Tech Ecosystem Platform
          </p>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold mb-4">Welcome to Ring!</h2>
            <p className="text-gray-600 dark:text-gray-300">
              Connect with tech professionals and opportunities in the Cherkasy region.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}