# 🏳️‍⚧️ redcudi.org - Astro Frontend

Static site generator and directory frontend for **redcudi.org**, an LGBTQ+ nonprofit focused on the trans community. This Astro site serves two purposes:

1. **Static Website** - Information about the nonprofit (mission, values, team, contact)
2. **Dynamic Directory** - Professional directory with professionals, health specialists, and organizations recommended by the community

## 🎯 Project Strategy

### Content Architecture

**Static Content** (hardcoded in Astro):
- Home page
- About page  
- Mission/Values pages
- Contact page
- Legal pages (Privacy, Terms)
- Navigation structure
- Hero sections

**Dynamic Content** (from Strapi API):
- Professional directory listings
- Professional detail pages
- Health specializations catalog
- Professional categories
- Organization listings
- Staff member profiles (for About section)

### Directory Features

#### Filtering & Discovery
- **By Entity Type**: Health Professionals | Other Professionals | Organizations
- **By Specialization**: Health categories (psychology, gynecology, etc.)
- **By Profession**: Non-health categories (law, accounting, etc.)
- **By Location**: City/State filtering
- **By Verification**: Show only verified providers
- **Search**: Full-text search across names and bios

#### Professional Profiles
- Name, pronouns, photo
- Bio and LGBTQ+ friendly statement
- Services offered
- Location information
- Contact methods (email, phone, WhatsApp, website)
- Social media links
- Pricing model
- Verification badge
- Related specializations/professions

### Build Strategy

**Static Generation (SSG)**:
- Build-time fetching from Strapi API
- Generate all professional detail pages at build time using dynamic routes
- Incremental Static Regeneration (ISR) support for updates
- SEO-optimized with pre-generated HTML

**Key Advantages**:
- Fast page loads (pre-rendered HTML)
- Excellent SEO
- Easy deployment to CDNs
- Low server requirements
- Can be deployed without backend dependency

## 📁 Project Structure

```
/
├── public/
│   └── [static assets, images, robots.txt]
├── src/
│   ├── pages/
│   │   ├── index.astro                 # Home page
│   │   ├── about.astro                 # About page
│   │   ├── contact.astro               # Contact form
│   │   ├── directory/
│   │   │   ├── index.astro             # Directory listing with filters
│   │   │   └── [slug].astro            # Dynamic professional detail pages
│   │   └── [other pages]/
│   ├── layouts/
│   │   ├── MainLayout.astro            # Primary layout
│   │   └── DirectoryLayout.astro       # Directory-specific layout
│   ├── components/
│   │   ├── directory/
│   │   │   ├── ProfessionalCard.astro  # Reusable professional card
│   │   │   ├── FilterBar.astro         # Filter controls
│   │   │   ├── SearchBar.astro         # Search functionality
│   │   │   └── SpecializationFilter.astro
│   │   ├── shared/
│   │   │   ├── Header.astro
│   │   │   ├── Footer.astro
│   │   │   ├── Navigation.astro
│   │   │   └── [shared components]/
│   │   └── [feature components]/
│   ├── lib/
│   │   ├── strapi.ts                   # Strapi API client
│   │   ├── types.ts                    # TypeScript types (from Strapi)
│   │   └── utils.ts                    # Utility functions
│   └── styles/
│       ├── global.css
│       └── [feature-specific]/
├── astro.config.mjs                    # Astro configuration
├── tsconfig.json
└── package.json
```

## 🔗 Strapi Integration

### API Client Pattern
```typescript
// lib/strapi.ts
export async function getProfessionals(filters?: {
  type?: "individual_health" | "individual_other" | "organization"
  specialization?: string
  profession?: string
  location?: string
  verified?: boolean
}) {
  // Fetch from STRAPI_URL with populated relations
}

export async function getProfessionalBySlug(slug: string) {
  // Fetch single professional with all relations
}

export async function getSpecializations() {
  // Fetch all health specializations
}

export async function getProfessions() {
  // Fetch all professions
}
```

### Environment Variables
```
STRAPI_URL=http://localhost:1337
STRAPI_API_TOKEN=your_api_token_here
```

## 🚀 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 🐳 Docker & Deployment

### Future Docker Setup
- **Build stage**: Fetch content from Strapi, generate static site
- **Serve stage**: Lightweight Node server to serve pre-built static files
- **Publish**: GHCR (GitHub Container Registry)

### Production Workflow
1. Update content in Strapi
2. Rebuild Docker image on main branch
3. Push to GHCR
4. Deploy container to production
5. Update automatically available without code changes

## 🎨 Design Considerations

### Inclusive Design for LGBTQ+ Community
- Pronoun support throughout (user-entered + standard Spanish options)
- Multiple contact methods for accessibility (email, WhatsApp, phone)
- LGBTQ+ friendly statements prominently displayed
- Sliding scale/free pricing options highlighted
- Multiple social media platform support
- Verification badges for trusted providers

### Accessibility
- Semantic HTML
- ARIA labels for interactive elements
- Proper color contrast
- Keyboard navigation support
- Mobile responsive design

## 📚 Learn More

- [Astro Documentation](https://docs.astro.build)
- [Astro Discord Community](https://astro.build/chat)
- [Strapi Integration Guide](../strapi/README.md)
