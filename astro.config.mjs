// @ts-check
import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import analytics from '@astrolib/analytics';


// https://astro.build/config
export default defineConfig({
  integrations: [
    icon(),
    analytics({
      trackingId: import.meta.env.PUBLIC_GOOGLE_ANALYTICS_ID,
    }),
  ],
  vite: {
    ssr: {
      external: ['svgo']
    }
  },
  alias: {
    '@': './src'
  }
});