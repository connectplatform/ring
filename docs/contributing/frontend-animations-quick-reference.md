# Frontend Animations Quick Reference

**Ring Platform Animation System - Developer Cheat Sheet**

---

## 🎨 **Hero Animations**

### **Scroll-Triggered Animations**
```html
<div data-hero-animate="fade-in">Fade in when visible</div>
<div data-hero-animate="slide-up">Slide up from bottom</div>
<div data-hero-animate="scale-in">Scale in from small</div>
<div data-hero-animate="rotate-in">Rotate in with scale</div>
```

### **Parallax Effects**
```html
<div data-hero-parallax="0.3">Slow parallax</div>
<div data-hero-parallax="0.5">Medium parallax</div>
<div data-hero-parallax="0.8">Fast parallax</div>
```

### **Gradient Animations**
```html
<div data-hero-gradient>Default gradient</div>
<div data-hero-gradient="#3B82F6,#22C55E,#F59E0B">Custom colors</div>
```

### **Mouse Tracking**
```html
<div data-hero-mouse-track>3D tilt effect</div>
```

### **Typing Effects**
```html
<h1 data-hero-typing="Your text here">Typing animation</h1>
<h1 data-hero-typing="Text" data-hero-typing-speed="30">Fast typing</h1>
<h1 data-hero-typing="Text" data-hero-typing-speed="100">Slow typing</h1>
```

### **Floating Elements**
```html
<div data-hero-float>Floating animation</div>
```

---

## 🎭 **Home Interactions**

### **Card Hover Effects**
```html
<div data-card-hover="light">Light shadow</div>
<div data-card-hover="medium">Medium shadow</div>
<div data-card-hover="heavy">Heavy shadow</div>
<div data-card-hover="medium" data-card-tilt>With tilt</div>
<div data-card-hover="medium" data-card-glow>With glow</div>
```

### **Form Enhancements**
```html
<form data-enhance>
  <input type="email" required minlength="5">
  <button type="submit">Submit</button>
</form>
```

### **Lazy Loading**
```html
<img data-lazy-load="image" data-src="/image.jpg">
<div data-lazy-load="background" data-background-image="/bg.jpg">
<div data-lazy-load="content" data-content-url="/api/data">
```

### **Interaction Tracking**
```html
<button data-track="button-click" data-track-category="engagement">
<a data-track="link-click" data-track-category="navigation">
```

---

## 🔧 **Combining Effects**

### **Hero Section Example**
```html
<section class="hero">
  <div data-hero-parallax="0.3" class="bg">
    <div data-hero-gradient="#45B7D1,#96CEB4"></div>
  </div>
  <div data-hero-animate="fade-in">
    <h1 data-hero-typing="Welcome to Ring Platform">Welcome</h1>
  </div>
  <div data-hero-float class="particle"></div>
</section>
```

### **Interactive Card Grid**
```html
<div class="grid">
  <div data-card-hover="medium" data-card-tilt data-hero-animate="scale-in">
    <h3>Card 1</h3>
  </div>
  <div data-card-hover="medium" data-card-tilt data-hero-animate="scale-in">
    <h3>Card 2</h3>
  </div>
</div>
```

---

## 🎯 **Global JavaScript APIs**

### **Notifications**
```javascript
window.ringNotify('Success!', 'success', 3000)
window.ringNotify('Error occurred', 'error', 5000)
window.ringNotify('Information', 'info', 4000)
```

### **User Preferences**
```javascript
// Update preferences
window.ringInteractions.updatePreference('reducedMotion', true)
window.ringInteractions.updatePreference('animationsEnabled', false)

// Check preferences
console.log(window.ringInteractions.userPreferences)
```

### **Animation Control**
```javascript
// Control hero animations
window.ringHeroAnimations.cleanup()
window.ringHeroAnimations.init()

// Check active animations
console.log(window.ringHeroAnimations.activeAnimations)
```

---

## 📱 **Responsive & Accessibility**

### **Auto-Disabled On:**
- Mobile devices (for complex animations)
- `prefers-reduced-motion` setting
- User preference for reduced motion
- Low-performance devices

### **Performance Optimized:**
- GPU acceleration with `transform` and `opacity`
- Throttled scroll events
- Intersection Observer for visibility
- RequestAnimationFrame for smooth animations

---

## 🎨 **Common CSS Classes**

### **Auto-Generated Classes**
```css
.ring-interactive-card     /* Applied to card-hover elements */
.hero-animated            /* Applied after scroll animations */
.ring-form-loading        /* Applied to loading forms */
.ring-field-error         /* Applied to form error messages */
.ring-field-invalid       /* Applied to invalid form fields */
```

### **Recommended Custom Classes**
```css
.hero-section             /* Hero section container */
.hero-background          /* Parallax background */
.hero-content            /* Hero content wrapper */
.floating-particle       /* Floating elements */
.gradient-overlay        /* Gradient backgrounds */
```

---

## 🚀 **Quick Setup**

### **1. Include Scripts**
```html
<script src="/scripts/hero-animations.js"></script>
<script src="/scripts/home-interactions.js"></script>
```

### **2. Add Data Attributes**
```html
<div data-hero-animate="fade-in">Your content</div>
```

### **3. Style with CSS**
```css
.my-element {
  transition: all 0.3s ease;
}
```

---

## 🔗 **Full Documentation**

For detailed examples and advanced usage, see:
- **[Frontend Animations Guide](./frontend-animations-guide.md)** - Complete documentation
- **[Interactive Documentation](./interactive-docs.md)** - Jupyter notebook integration
- **[Style Guide](./STYLE_GUIDE.md)** - Design standards

---

**�� Happy Animating!** 