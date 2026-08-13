# Static demos

Place a fully static build in `public/demos/<slug>/`. Astro copies it unchanged to `dist/demos/<slug>/`, making it available at `https://stevenchendan.github.io/demos/<slug>/` after the next deployment.

For a true subdomain such as `map.example.com`, use a separate repository and deployment. Point that subdomain to Cloudflare Pages, Vercel, Netlify, or another static host with a DNS CNAME. GitHub Pages supports one custom domain per Pages site and is not a wildcard reverse proxy.

Demo builds must use relative asset URLs or set their base path to `/demos/<slug>/`.
