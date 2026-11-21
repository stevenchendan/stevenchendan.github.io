import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://stevenchendan.github.io',
  integrations: [sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/australian-open') }), react()],
  output: 'static',
  srcDir: './site'
});
