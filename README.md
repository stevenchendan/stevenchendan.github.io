# stevenchendan.github.io

Steven Chen's portfolio, built as a static Astro site and deployed to GitHub Pages.

## Develop

```sh
npm install
npm run dev
```

Run `npm run build` before opening a pull request. The command includes Astro's strict type and content check.

## Publish a quick demo

Copy a static production build to `public/demos/<slug>/`. Make sure the demo's asset base is `/demos/<slug>/`, then add it to `site/data/portfolio.ts`. It will be published with the next portfolio deployment.

For independent deployments and true subdomains such as `experiment.yourdomain.com`, keep each demo in its own repository, host it on a static provider, and connect the subdomain with DNS. This keeps prototype dependencies and deployment lifecycles isolated from the portfolio.

## Deployment

The workflow in `.github/workflows/deploy.yml` checks pull requests and publishes `dist` from `master` through GitHub's official Pages artifact deployment.
