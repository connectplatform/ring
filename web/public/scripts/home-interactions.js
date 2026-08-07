/**
 * Home Interactions Script for Ring Platform
 * Handles general home page interactions, UI enhancements, and user experience
 * Complements React components with vanilla JavaScript interactions
 */

console.log('Ring Platform Home Interactions: Ready')

// Global home interactions object
window.ringHomeInteractions = {
  isInitialized: false,
  activeInteractions: new Set(),
  userPreferences: {},
  
  // Initialize home interactions
  init: function() {
    if (this.isInitialized) return
    
    console.log('Initializing Ring Home Interactions...')
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupInteractions())
    } else {
      this.setupInteractions()
    }
    
    this.isInitialized = true
  },
  
  // Setup all home interactions
  setupInteractions: function() {
    this.loadUserPreferences()
    this.setupCardHoverEffects()
    this.setupSmoothScrolling()
    this.setupLazyLoading()
    this.setupFormEnhancements()
    this.setupThemeToggleEffects()
    this.setupNotificationSystem()
    this.setupKeyboardNavigation()
    this.setupPerformanceOptimizations()
    this.trackUserInteractions()
  },
  
  // Load user preferences from localStorage
  loadUserPreferences: function() {
    try {
      const stored = localStorage.getItem('ringUserPreferences')
      this.userPreferences = stored ? JSON.parse(stored) : {
        animationsEnabled: true,
        soundEnabled: false,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        fontSize: 'medium',
        colorScheme: 'auto'
      }
    } catch (error) {
      console.warn('Failed to load user preferences:', error)
      this.userPreferences = {
        animationsEnabled: true,
        soundEnabled: false,
        reducedMotion: false,
        fontSize: 'medium',
        colorScheme: 'auto'
      }
    }
    
    this.activeInteractions.add('user-preferences')
  },
  
  // Save user preferences to localStorage
  saveUserPreferences: function() {
    try {
      localStorage.setItem('ringUserPreferences', JSON.stringify(this.userPreferences))
    } catch (error) {
      console.warn('Failed to save user preferences:', error)
    }
  },
  
  // Enhanced card hover effects
  setupCardHoverEffects: function() {
    const cards = document.querySelectorAll('[data-card-hover]')
    
    cards.forEach(card => {
      // Add hover effect class
      card.classList.add('ring-interactive-card')
      
      // Mouse enter effect
      card.addEventListener('mouseenter', (e) => {
        if (this.userPreferences.reducedMotion) return
        
        const rect = card.getBoundingClientRect()
        const shadow = card.dataset.cardHover || 'medium'
        
        // Apply hover effects based on shadow level
        switch (shadow) {
          case 'light':
            card.style.transform = 'translateY(-2px)'
            card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
            break
          case 'medium':
            card.style.transform = 'translateY(-4px)'
            card.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)'
            break
          case 'heavy':
            card.style.transform = 'translateY(-6px)'
            card.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.15)'
            break
        }
        
        // Add glow effect if specified
        if (card.dataset.cardGlow) {
          card.style.filter = 'brightness(1.05)'
        }
      })
      
      // Mouse leave effect
      card.addEventListener('mouseleave', () => {
        if (this.userPreferences.reducedMotion) return
        
        card.style.transform = 'translateY(0)'
        card.style.boxShadow = ''
        card.style.filter = ''
      })
      
      // Mouse move effect for tilt
      card.addEventListener('mousemove', (e) => {
        if (this.userPreferences.reducedMotion) return
        if (!card.dataset.cardTilt) return
        
        const rect = card.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        
        const centerX = rect.width / 2
        const centerY = rect.height / 2
        
        const rotateX = (y - centerY) / centerY * 5
        const rotateY = (centerX - x) / centerX * 5
        
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`
      })
    })
    
    // Add base CSS for cards
    if (!document.getElementById('home-card-styles')) {
      const style = document.createElement('style')
      style.id = 'home-card-styles'
      style.textContent = `
        .ring-interactive-card {
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                      box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                      filter 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        
        .ring-interactive-card:hover {
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `
      document.head.appendChild(style)
    }
    
    this.activeInteractions.add('card-hover-effects')
  },
  
  // Smooth scrolling enhancement
  setupSmoothScrolling: function() {
    const scrollLinks = document.querySelectorAll('a[href^="#"]')
    
    scrollLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href').substring(1)
        const targetElement = document.getElementById(targetId)
        
        if (targetElement) {
          e.preventDefault()
          
          const headerOffset = 80 // Account for fixed header
          const elementPosition = targetElement.getBoundingClientRect().top
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset
          
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          })
          
          // Update URL without triggering scroll
          history.pushState(null, null, `#${targetId}`)
        }
      })
    })
    
    this.activeInteractions.add('smooth-scrolling')
  },
  
  // Enhanced lazy loading
  setupLazyLoading: function() {
    const lazyElements = document.querySelectorAll('[data-lazy-load]')
    
    if (!window.IntersectionObserver || lazyElements.length === 0) return
    
    const lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target
          const type = element.dataset.lazyLoad
          
          switch (type) {
            case 'image':
              if (element.dataset.src) {
                element.src = element.dataset.src
                element.classList.add('loaded')
              }
              break
            case 'background':
              if (element.dataset.backgroundImage) {
                element.style.backgroundImage = `url(${element.dataset.backgroundImage})`
                element.classList.add('loaded')
              }
              break
            case 'content':
              // Load dynamic content
              if (element.dataset.contentUrl) {
                this.loadDynamicContent(element)
              }
              break
          }
          
          lazyObserver.unobserve(element)
        }
      })
    }, {
      threshold: 0.1,
      rootMargin: '50px'
    })
    
    lazyElements.forEach(element => {
      lazyObserver.observe(element)
    })
    
    this.activeInteractions.add('lazy-loading')
  },
  
  // Load dynamic content
  loadDynamicContent: async function(element) {
    try {
      const url = element.dataset.contentUrl
      const response = await fetch(url)
      const content = await response.text()
      
      element.innerHTML = content
      element.classList.add('loaded')
      
      // Re-initialize interactions for new content
      this.setupCardHoverEffects()
    } catch (error) {
      console.error('Failed to load dynamic content:', error)
      element.innerHTML = '<p>Failed to load content</p>'
    }
  },
  
  // Form enhancements
  setupFormEnhancements: function() {
    const forms = document.querySelectorAll('form[data-enhance]')
    
    forms.forEach(form => {
      // Add loading states
      form.addEventListener('submit', (e) => {
        const submitBtn = form.querySelector('button[type="submit"]')
        if (submitBtn) {
          submitBtn.disabled = true
          submitBtn.dataset.originalText = submitBtn.textContent
          submitBtn.textContent = 'Processing...'
          submitBtn.classList.add('ring-form-loading')
        }
      })
      
      // Real-time validation
      const inputs = form.querySelectorAll('input, textarea, select')
      inputs.forEach(input => {
        input.addEventListener('blur', () => {
          this.validateField(input)
        })
        
        input.addEventListener('input', () => {
          // Clear previous errors on input
          this.clearFieldError(input)
        })
      })
    })
    
    this.activeInteractions.add('form-enhancements')
  },
  
  // Field validation
  validateField: function(field) {
    const value = field.value.trim()
    const type = field.type
    let isValid = true
    let message = ''
    
    // Basic validation rules
    if (field.required && !value) {
      isValid = false
      message = 'This field is required'
    } else if (type === 'email' && value && !this.isValidEmail(value)) {
      isValid = false
      message = 'Please enter a valid email address'
    } else if (field.minLength && value.length < field.minLength) {
      isValid = false
      message = `Minimum length is ${field.minLength} characters`
    }
    
    if (isValid) {
      this.clearFieldError(field)
    } else {
      this.showFieldError(field, message)
    }
    
    return isValid
  },
  
  // Show field error
  showFieldError: function(field, message) {
    this.clearFieldError(field)
    
    const error = document.createElement('div')
    error.className = 'ring-field-error'
    error.textContent = message
    
    field.parentNode.appendChild(error)
    field.classList.add('ring-field-invalid')
  },
  
  // Clear field error
  clearFieldError: function(field) {
    const existingError = field.parentNode.querySelector('.ring-field-error')
    if (existingError) {
      existingError.remove()
    }
    field.classList.remove('ring-field-invalid')
  },
  
  // Email validation
  isValidEmail: function(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(email)
  },
  
  // Theme toggle effects
  setupThemeToggleEffects: function() {
    const themeToggle = document.querySelector('[data-theme-toggle]')
    
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        // Add smooth transition effect
        document.documentElement.style.transition = 'color-scheme 0.3s ease'
        
        // Reset transition after animation
        setTimeout(() => {
          document.documentElement.style.transition = ''
        }, 300)
      })
    }
    
    this.activeInteractions.add('theme-toggle')
  },
  
  // Notification system
  setupNotificationSystem: function() {
    // Create notification container if it doesn't exist
    if (!document.getElementById('ring-notifications')) {
      const container = document.createElement('div')
      container.id = 'ring-notifications'
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        pointer-events: none;
      `
      document.body.appendChild(container)
    }
    
    // Make notification system globally available
    window.ringNotify = (message, type = 'info', duration = 3000) => {
      this.showNotification(message, type, duration)
    }
    
    this.activeInteractions.add('notification-system')
  },
  
  // Show notification
  showNotification: function(message, type, duration) {
    const container = document.getElementById('ring-notifications')
    const notification = document.createElement('div')
    
    notification.className = `ring-notification ring-notification-${type}`
    notification.textContent = message
    notification.style.cssText = `
      background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#3b82f6'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      margin-bottom: 10px;
      pointer-events: auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transform: translateX(100%);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `
    
    container.appendChild(notification)
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)'
      notification.style.opacity = '1'
    }, 10)
    
    // Auto remove
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)'
      notification.style.opacity = '0'
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification)
        }
      }, 300)
    }, duration)
  },
  
  // Keyboard navigation
  setupKeyboardNavigation: function() {
    document.addEventListener('keydown', (e) => {
      // Escape key to close modals
      if (e.key === 'Escape') {
        const openModal = document.querySelector('[data-modal-open="true"]')
        if (openModal) {
          openModal.click() // Trigger close
        }
      }
      
      // Alt + H to go home
      if (e.altKey && e.key === 'h') {
        e.preventDefault()
        window.location.href = '/'
      }
    })
    
    this.activeInteractions.add('keyboard-navigation')
  },
  
  // Performance optimizations
  setupPerformanceOptimizations: function() {
    // Preload critical resources
    const criticalLinks = document.querySelectorAll('a[data-preload]')
    criticalLinks.forEach(link => {
      link.addEventListener('mouseenter', () => {
        const href = link.getAttribute('href')
        if (href && !link.dataset.preloaded) {
          const prefetch = document.createElement('link')
          prefetch.rel = 'prefetch'
          prefetch.href = href
          document.head.appendChild(prefetch)
          link.dataset.preloaded = 'true'
        }
      })
    })
    
    // Optimize images
    const images = document.querySelectorAll('img[loading="lazy"]')
    images.forEach(img => {
      img.addEventListener('load', () => {
        img.style.opacity = '1'
      })
    })
    
    this.activeInteractions.add('performance-optimizations')
  },
  
  // Track user interactions
  trackUserInteractions: function() {
    // Track clicks on interactive elements
    document.addEventListener('click', (e) => {
      const element = e.target
      
      if (element.dataset.track) {
        const action = element.dataset.track
        const category = element.dataset.trackCategory || 'interaction'
        const label = element.dataset.trackLabel || element.textContent?.trim()
        
        if (window.ringAnalytics) {
          window.ringAnalytics.track(action, {
            category,
            label,
            element: element.tagName.toLowerCase(),
            timestamp: new Date().toISOString()
          })
        }
      }
    })
    
    this.activeInteractions.add('interaction-tracking')
  },
  
  // Public API methods
  updatePreference: function(key, value) {
    this.userPreferences[key] = value
    this.saveUserPreferences()
    
    // Apply changes immediately
    if (key === 'reducedMotion') {
      document.documentElement.style.setProperty('--motion-duration', value ? '0s' : '0.3s')
    }
  },
  
  // Cleanup function
  cleanup: function() {
    this.activeInteractions.clear()
    this.isInitialized = false
    console.log('Ring Home Interactions: Cleaned up')
  }
}

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
  window.ringHomeInteractions.init()
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  window.ringHomeInteractions.cleanup()
})

// Make interactions available globally
window.ringInteractions = window.ringHomeInteractions 