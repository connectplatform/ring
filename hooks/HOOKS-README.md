# Ring App - Custom Hooks Reference

This document provides a reference for using the custom hooks in the Ring main web app project.

## Table of Contents

1. [useAuth](#useauth)
2. [useLocalStorage](#uselocalstorage)
3. [useDebounce](#usedebounce)
4. [useLanguage](#uselanguage)

## useAuth

The `useAuth` hook manages authentication state and provides login, logout, and registration functions.

### Usage

```typescript
import { useAuth } from '@/hooks/useAuth'

function MyComponent() {
  const { user, loading, login, register, logout } = useAuth()

  const handleLogin = async (email: string, password: string) => {
    const result = await login(email, password)
    if (result.success) {
      console.log('Logged in successfully')
    } else {
      console.error('Login failed:', result.error)
    }
  }

  const handleLogout = async () => {
    const result = await logout()
    if (result.success) {
      console.log('Logged out successfully')
    } else {
      console.error('Logout failed:', result.error)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      {user ? (
        <div>
          <p>Welcome, {user.email}</p>
          <button onClick={handleLogout}>Logout</button>
        </div>
      ) : (
        <button onClick={() => handleLogin('user@example.com', 'password')}>Login</button>
      )}
    </div>
  )
}
```

## useLocalStorage

The `useLocalStorage` hook provides a way to easily use localStorage with React state, including automatic JSON parsing and stringifying.

### Usage

```typescript
import { useLocalStorage } from '@/hooks/useLocalStorage'

function MyComponent() {
  const [theme, setTheme] = useLocalStorage('theme', 'light')

  return (
    <div>
      <p>Current theme: {theme}</p>
      <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
        Toggle Theme
      </button>
    </div>
  )
}
```

## useDebounce

The `useDebounce` hook creates a debounced value, which is useful for reducing the frequency of expensive operations like API calls in response to user input.

### Usage

```typescript
import { useState } from 'react'
import { useDebounce } from '@/hooks/useDebounce'

function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Use debouncedSearchTerm for API calls
  useEffect(() => {
    if (debouncedSearchTerm) {
      // Perform search operation
      console.log('Searching for:', debouncedSearchTerm)
    }
  }, [debouncedSearchTerm])

  return (
    <input
      type="text"
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Search..."
    />
  )
}
```

## useLanguage

The `useLanguage` hook provides access to the current language and translation functions.

### Usage

```typescript
import { useLanguage } from '@/hooks/useLanguage'

function MyComponent() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <div>
      <p>{t('currentLanguage')}: {language}</p>
      <button onClick={() => setLanguage('en')}>English</button>
      <button onClick={() => setLanguage('uk')}>Ukrainian</button>
      <h1>{t('welcomeMessage')}</h1>
    </div>
  )
}
```

Remember to wrap your app with the `LanguageProvider` in your `_app.tsx` or root layout component:

```typescript
import { LanguageProvider } from '@/components/providers/LanguageProvider'

function MyApp({ Component, pageProps }) {
  return (
    <LanguageProvider>
      <Component {...pageProps} />
    </LanguageProvider>
  )
}

export default MyApp
```

These custom hooks provide powerful functionality to manage authentication, local storage, debounced values, and internationalization in your Ring main web app. Use them to simplify your component logic and improve the overall structure of your application.

