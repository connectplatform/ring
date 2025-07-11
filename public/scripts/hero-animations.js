/**
 * Hero Animations Script for Ring Platform
 * Handles hero section animations, parallax effects, and visual enhancements
 * Complements React/Framer Motion animations with vanilla JavaScript
 */

console.log('Ring Platform Hero Animations: Ready')

// Global hero animations object
window.ringHeroAnimations = {
  isInitialized: false,
  activeAnimations: new Set(),
  
  // Initialize hero animations
  init: function() {
    if (this.isInitialized) return
    
    console.log('Initializing Ring Hero Animations...')
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupAnimations())
    } else {
      this.setupAnimations()
    }
    
    this.isInitialized = true
  },
  
  // Setup all hero animations
  setupAnimations: function() {
    this.setupParallaxEffects()
    this.setupScrollAnimations()
    this.setupGradientAnimations()
    this.setupMouseTrackingEffects()
    this.setupTypingEffects()
    this.setupFloatingElements()
    this.trackPageView()
  },
  
  // Parallax effects for hero background
  setupParallaxEffects: function() {
    const heroElements = document.querySelectorAll('[data-hero-parallax]')
    
    if (heroElements.length === 0) return
    
    const handleScroll = () => {
      const scrolled = window.pageYOffset
      const rate = scrolled * -0.5
      
      heroElements.forEach(element => {
        const speed = element.dataset.heroParallax || 0.5
        element.style.transform = `translateY(${rate * speed}px)`
      })
    }
    
    // Throttled scroll handler
    let ticking = false
    const throttledScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll()
          ticking = false
        })
        ticking = true
      }
    }
    
    window.addEventListener('scroll', throttledScroll, { passive: true })
    this.activeAnimations.add('parallax')
  },
  
  // Scroll-triggered animations
  setupScrollAnimations: function() {
    const animatedElements = document.querySelectorAll('[data-hero-animate]')
    
    if (!window.IntersectionObserver || animatedElements.length === 0) return
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target
          const animation = element.dataset.heroAnimate
          
          switch (animation) {
            case 'fade-in':
              element.style.opacity = '1'
              element.style.transform = 'translateY(0)'
              break
            case 'slide-up':
              element.style.opacity = '1'
              element.style.transform = 'translateY(0)'
              break
            case 'scale-in':
              element.style.opacity = '1'
              element.style.transform = 'scale(1)'
              break
            case 'rotate-in':
              element.style.opacity = '1'
              element.style.transform = 'rotate(0deg) scale(1)'
              break
          }
          
          // Add animation class
          element.classList.add('hero-animated')
          observer.unobserve(element)
        }
      })
    }, {
      threshold: 0.1,
      rootMargin: '50px'
    })
    
    animatedElements.forEach(element => {
      // Set initial state
      element.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
      const animation = element.dataset.heroAnimate
      
      switch (animation) {
        case 'fade-in':
          element.style.opacity = '0'
          element.style.transform = 'translateY(20px)'
          break
        case 'slide-up':
          element.style.opacity = '0'
          element.style.transform = 'translateY(50px)'
          break
        case 'scale-in':
          element.style.opacity = '0'
          element.style.transform = 'scale(0.8)'
          break
        case 'rotate-in':
          element.style.opacity = '0'
          element.style.transform = 'rotate(-5deg) scale(0.9)'
          break
      }
      
      observer.observe(element)
    })
    
    this.activeAnimations.add('scroll-animations')
  },
  
  // Animated gradient backgrounds
  setupGradientAnimations: function() {
    const gradientElements = document.querySelectorAll('[data-hero-gradient]')
    
    gradientElements.forEach(element => {
      const colors = element.dataset.heroGradient?.split(',') || [
        '#3B82F6', '#22C55E', '#F59E0B', '#EF4444'
      ]
      
      let currentIndex = 0
      const duration = 4000 // 4 seconds
      
      const animateGradient = () => {
        const nextIndex = (currentIndex + 1) % colors.length
        const gradient = `linear-gradient(45deg, ${colors[currentIndex]}, ${colors[nextIndex]})`
        
        element.style.background = gradient
        element.style.backgroundSize = '400% 400%'
        element.style.animation = `heroGradientShift ${duration}ms ease-in-out infinite`
        
        currentIndex = nextIndex
      }
      
      // Initial setup
      animateGradient()
      
      // Continuous animation
      setInterval(animateGradient, duration)
    })
    
    // Add CSS keyframes for gradient animation
    if (!document.getElementById('hero-gradient-styles')) {
      const style = document.createElement('style')
      style.id = 'hero-gradient-styles'
      style.textContent = `
        @keyframes heroGradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `
      document.head.appendChild(style)
    }
    
    this.activeAnimations.add('gradient-animations')
  },
  
  // Mouse tracking effects
  setupMouseTrackingEffects: function() {
    const trackingElements = document.querySelectorAll('[data-hero-mouse-track]')
    
    trackingElements.forEach(element => {
      element.addEventListener('mousemove', (e) => {
        const rect = element.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        
        const centerX = rect.width / 2
        const centerY = rect.height / 2
        
        const rotateX = (y - centerY) / centerY * 10
        const rotateY = (centerX - x) / centerX * 10
        
        element.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
      })
      
      element.addEventListener('mouseleave', () => {
        element.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)'
      })
    })
    
    this.activeAnimations.add('mouse-tracking')
  },
  
  // Typing effect for hero text
  setupTypingEffects: function() {
    const typingElements = document.querySelectorAll('[data-hero-typing]')
    
    typingElements.forEach(element => {
      const text = element.dataset.heroTyping || element.textContent
      const speed = parseInt(element.dataset.heroTypingSpeed) || 50
      
      element.textContent = ''
      element.style.borderRight = '2px solid currentColor'
      element.style.animation = 'heroBlink 1s infinite'
      
      let i = 0
      const typeText = () => {
        if (i < text.length) {
          element.textContent += text.charAt(i)
          i++
          setTimeout(typeText, speed)
        } else {
          // Remove cursor after typing is complete
          setTimeout(() => {
            element.style.borderRight = 'none'
            element.style.animation = 'none'
          }, 1000)
        }
      }
      
      // Start typing with delay
      setTimeout(typeText, 1000)
    })
    
    // Add blinking cursor CSS
    if (!document.getElementById('hero-typing-styles')) {
      const style = document.createElement('style')
      style.id = 'hero-typing-styles'
      style.textContent = `
        @keyframes heroBlink {
          0%, 50% { border-color: currentColor; }
          51%, 100% { border-color: transparent; }
        }
      `
      document.head.appendChild(style)
    }
    
    this.activeAnimations.add('typing-effects')
  },
  
  // Floating elements animation
  setupFloatingElements: function() {
    const floatingElements = document.querySelectorAll('[data-hero-float]')
    
    floatingElements.forEach((element, index) => {
      const duration = 3000 + (index * 500) // Stagger animations
      const amplitude = 20 + (index * 5)
      
      const float = () => {
        element.style.transform = `translateY(${Math.sin(Date.now() / duration) * amplitude}px)`
        requestAnimationFrame(float)
      }
      
      // Start with random delay
      setTimeout(float, index * 200)
    })
    
    this.activeAnimations.add('floating-elements')
  },
  
  // Track page view for analytics
  trackPageView: function() {
    if (window.ringAnalytics) {
      window.ringAnalytics.pageView('hero-animations-loaded')
    }
  },
  
  // Cleanup function
  cleanup: function() {
    this.activeAnimations.clear()
    this.isInitialized = false
    console.log('Ring Hero Animations: Cleaned up')
  }
}

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
  window.ringHeroAnimations.init()
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  window.ringHeroAnimations.cleanup()
}) 