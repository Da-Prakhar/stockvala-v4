# StockVala Landing Page - Quick Start Guide

## Installation & Setup

### 1. Navigate to the project
```bash
cd "packages/landing"
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start development server
```bash
npm run dev
```
The app will be available at `http://localhost:3000`

## Project Structure Quick Reference

```
src/
├── pages/                    # Page components
├── components/
│   ├── layout/             # Navbar, Footer, Layout
│   ├── ui/                 # Reusable UI components
│   └── home/               # Landing page sections
├── store/                  # Zustand stores (theme, auth)
├── utils/                  # Animations, API setup
└── styles/                 # Global CSS
```

## Available Scripts

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Build for production
npm run preview      # Preview production build
```

## Features Overview

### Navigation & Layout
- **Navbar** - Sticky with mobile hamburger menu, theme toggle, auth buttons
- **Footer** - Full company info, links, social media
- **Responsive** - Works perfectly on mobile, tablet, desktop

### Pages

#### Home Page (Landing)
1. **Hero** - Animated heading, CTAs, trading chart, stats
2. **Features** - 6 feature cards (Execution, Spreads, Copy Trading, MT5, Support, Security)
3. **Accounts** - 3 account types (Standard, Pro, VIP) with pricing
4. **Platforms** - MT5 Desktop, Mobile, WebTrader showcase
5. **Copy Trading** - Master traders grid with stats
6. **Stats** - Animated KPI counters
7. **CTA** - Email signup section

#### Login Page
- Email/password login
- Remember me checkbox
- Forgot password link
- Social login (Google, Apple) - placeholder
- Sign up link

#### Register Page
- Multi-step form (3 steps)
- Step 1: Email, Password, Confirm Password
- Step 2: First Name, Last Name, Phone, Country
- Step 3: Referral Code, Terms Acceptance
- Progress indicator
- Form validation

#### Forgot Password
- Email input
- Success confirmation
- Back to login link

## Customization Guide

### Change Theme Colors
Edit `tailwind.config.js`:
```javascript
colors: {
  primary: '#0066FF',      // Change primary blue
  secondary: '#00D4FF',    // Change cyan
  accent: '#FFD700',       // Change gold
}
```

### Update Trading Data
- **Features**: Edit `src/components/home/FeaturesSection.jsx`
- **Account Types**: Edit `src/components/home/AccountTypesSection.jsx`
- **Platforms**: Edit `src/components/home/PlatformsSection.jsx`
- **Master Traders**: Edit `src/components/home/CopyTradingSection.jsx`

### Modify Animations
- Global animations: `src/utils/animations.js`
- CSS animations: `src/styles/globals.css`
- Component animations: Individual component files

### Update Navigation Links
Edit `src/components/layout/Navbar.jsx` - update `navLinks` array

### Change Company Info
Edit `src/components/layout/Footer.jsx` - update contact info and links

## Component Usage Examples

### Button
```jsx
<Button variant="gradient" size="lg">
  Start Trading
</Button>
```

### Input
```jsx
<Input 
  label="Email" 
  type="email"
  placeholder="Enter email"
  icon={Mail}
  error={errors.email?.message}
  {...register('email')}
/>
```

### Card
```jsx
<Card className="p-6" hover>
  Content here
</Card>
```

### GradientText
```jsx
<GradientText type="primary">
  Trade Smarter
</GradientText>
```

### ScrollReveal
```jsx
<ScrollReveal animation="slideUp" delay={0.2}>
  Content that animates on scroll
</ScrollReveal>
```

## Theme System

### Using Dark/Light Theme
The app automatically persists theme preference:
```javascript
import { useThemeStore } from './store/themeStore';

const { theme, toggleTheme } = useThemeStore();
```

## Form Handling

All forms use `react-hook-form` for efficient validation:
```jsx
const { register, handleSubmit, formState: { errors } } = useForm();

<form onSubmit={handleSubmit(onSubmit)}>
  <Input {...register('email')} error={errors.email?.message} />
</form>
```

## API Integration

Ready to connect to backend:
```javascript
import api from './utils/api';

// API calls automatically include auth token
const response = await api.get('/endpoint');
```

## Key Technologies

- **React 18** - UI framework
- **Vite** - Build tool (lightning fast)
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Zustand** - State management
- **React Hook Form** - Form handling
- **Axios** - HTTP client
- **Lucide Icons** - Icon library

## Common Tasks

### Add New Page
1. Create file in `src/pages/NewPage.jsx`
2. Add route in `src/App.jsx`
3. Create navigation link in `Navbar.jsx`

### Add New Component
1. Create file in `src/components/`
2. Use existing UI components for consistency
3. Apply animations with Framer Motion

### Add New Section to Home
1. Create component in `src/components/home/`
2. Import in `src/pages/HomePage.jsx`
3. Add to page in desired order

### Update API Endpoint
1. Update base URL in `src/utils/api.js`
2. Create API functions in store or page
3. Handle loading/error states

## Performance Tips

- Components are tree-shakeable
- Animations use requestAnimationFrame
- Scroll reveals use InView for performance
- Tailwind purges unused CSS
- Consider lazy loading for routes

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome)

## Troubleshooting

**Dark mode not working?**
- Check browser localStorage for 'stockvala-theme'
- Verify `useThemeStore` is imported correctly

**Animations stuttering?**
- Check GPU acceleration in browser DevTools
- Reduce animation complexity if needed

**Styles not applying?**
- Clear Tailwind cache: Delete `node_modules/.vite`
- Run `npm run dev` again

**Form validation not working?**
- Ensure `useForm` from `react-hook-form` is initialized
- Check field names in `register()`

## Production Deployment

```bash
# Build for production
npm run build

# Output is in dist/ folder
# Deploy dist/ folder to hosting
```

## Support & Resources

- Framer Motion Docs: https://www.framer.com/motion/
- Tailwind CSS: https://tailwindcss.com/
- React Hook Form: https://react-hook-form.com/
- Zustand: https://github.com/pmndrs/zustand

---

Happy coding! The landing page is ready to impress your users.
