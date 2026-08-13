import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://stevenchendan.github.io',
  integrations: [sitemap()],
  output: 'static',
  srcDir: './site'
});
