/**
 * Theme Persistence Script for Ring Platform
 * Handles theme persistence across sessions and prevents flash of unstyled content (FOUC)
 */

(function() {
  'use strict';

  // Theme persistence configuration
  const THEME_CONFIG = {
    STORAGE_KEY: 'ring-theme',
    SYSTEM_THEME_KEY: 'ring-system-theme',
    THEME_ATTRIBUTE: 'data-theme',
    THEMES: {
      LIGHT: 'light',
      DARK: 'dark',
      SYSTEM: 'system'
    }
  };

  // Theme persistence utilities
  const ThemePersistence = {
    /**
     * Get theme from localStorage or default to system
     */
    getStoredTheme() {
      try {
        return localStorage.getItem(THEME_CONFIG.STORAGE_KEY) || THEME_CONFIG.THEMES.SYSTEM;
      } catch (error) {
        console.warn('Failed to get theme from localStorage:', error);
        return THEME_CONFIG.THEMES.SYSTEM;
      }
    },

    /**
     * Store theme in localStorage
     */
    setStoredTheme(theme) {
      try {
        localStorage.setItem(THEME_CONFIG.STORAGE_KEY, theme);
      } catch (error) {
        console.warn('Failed to store theme in localStorage:', error);
      }
    },

    /**
     * Get system theme preference
     */
    getSystemTheme() {
      try {
        return window.matchMedia('(prefers-color-scheme: dark)').matches 
          ? THEME_CONFIG.THEMES.DARK 
          : THEME_CONFIG.THEMES.LIGHT;
      } catch (error) {
        console.warn('Failed to get system theme:', error);
        return THEME_CONFIG.THEMES.LIGHT;
      }
    },

    /**
     * Apply theme to document
     */
    applyTheme(theme) {
      const actualTheme = theme === THEME_CONFIG.THEMES.SYSTEM 
        ? this.getSystemTheme() 
        : theme;
      
      // Apply theme to document
      document.documentElement.setAttribute(THEME_CONFIG.THEME_ATTRIBUTE, actualTheme);
      document.documentElement.classList.remove(THEME_CONFIG.THEMES.LIGHT, THEME_CONFIG.THEMES.DARK);
      document.documentElement.classList.add(actualTheme);
      
      // Store actual theme for system preference
      try {
        localStorage.setItem(THEME_CONFIG.SYSTEM_THEME_KEY, actualTheme);
      } catch (error) {
        console.warn('Failed to store system theme:', error);
      }
    },

    /**
     * Initialize theme on page load
     */
    initialize() {
      const storedTheme = this.getStoredTheme();
      this.applyTheme(storedTheme);
      
      // Listen for system theme changes
      if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
          const currentTheme = this.getStoredTheme();
          if (currentTheme === THEME_CONFIG.THEMES.SYSTEM) {
            this.applyTheme(THEME_CONFIG.THEMES.SYSTEM);
          }
        });
      }
    },

    /**
     * Toggle theme between light and dark
     */
    toggleTheme() {
      const currentTheme = this.getStoredTheme();
      const actualTheme = currentTheme === THEME_CONFIG.THEMES.SYSTEM 
        ? this.getSystemTheme() 
        : currentTheme;
      
      const newTheme = actualTheme === THEME_CONFIG.THEMES.DARK 
        ? THEME_CONFIG.THEMES.LIGHT 
        : THEME_CONFIG.THEMES.DARK;
      
      this.setStoredTheme(newTheme);
      this.applyTheme(newTheme);
      
      // Dispatch custom event for React components
      window.dispatchEvent(new CustomEvent('themeChange', { 
        detail: { theme: newTheme } 
      }));
    },

    /**
     * Set specific theme
     */
    setTheme(theme) {
      if (Object.values(THEME_CONFIG.THEMES).includes(theme)) {
        this.setStoredTheme(theme);
        this.applyTheme(theme);
        
        // Dispatch custom event for React components
        window.dispatchEvent(new CustomEvent('themeChange', { 
          detail: { theme } 
        }));
      }
    },

    /**
     * Get current theme
     */
    getCurrentTheme() {
      return this.getStoredTheme();
    }
  };

  // Initialize theme persistence immediately to prevent FOUC
  ThemePersistence.initialize();

  // Make ThemePersistence available globally
  window.ThemePersistence = ThemePersistence;

  // Expose theme functions for React components
  window.toggleTheme = () => ThemePersistence.toggleTheme();
  window.setTheme = (theme) => ThemePersistence.setTheme(theme);
  window.getCurrentTheme = () => ThemePersistence.getCurrentTheme();

  // Analytics event for theme changes
  window.addEventListener('themeChange', (event) => {
    if (window.gtag) {
      window.gtag('event', 'theme_change', {
        theme: event.detail.theme,
        page_location: window.location.href
      });
    }
  });

  console.log('🎨 Theme persistence initialized');
})(); 