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

### Arena entrance reconstruction references

The arena models use recessed facade apertures, door banks and sheltered approaches. Margaret Court includes its raised entrance stair; Rod Laver's eastern annex has three storeys and glazed links; ANZ / Show Court 3 uses a blue base with open steel framing and a fabric canopy. Dimensions and secondary entrance positions remain visual approximations, not surveyed access or evacuation plans.

- [AO25 venue floor plans](https://officiating.tennis.com.au/pdf/AO/AO25_Seating_player%20toilets_room%20locations_5JAN25.pdf): arena layout and circulation reference.
- [M&OP precinct map](https://johncainarena.com.au/wp-content/uploads/sites/6/2025/03/MOP07-Precinct-Map-v9.pdf): public gate sides and Eastern Plaza level.
- [COX: Rod Laver redevelopment](https://www.coxarchitecture.com.au/project/rod-laver-arena-redevelopment/): Eastern Pavilion elevated over the concourse, curved glazed frontage and bridge links; north, south and west amenity pods. The city footprint `812707-1-0` belongs to Rod Laver and is rebuilt once, rather than rendered as a generic solid building over a duplicate annex.
- [Inhabit: Rod Laver Arena](https://inhabitgroup.com/project/melbourne-park-rod-laver-arena/): eastern annex, glass links and ground-level facade photography.
- [Populous: Margaret Court Arena](https://populous.com/showcases/margaret-court-arena-redevelopment): entrance stairs, glazing and folded roof.
- [Fairview: John Cain Arena](https://fv.com.au/projects/john-cain-arena): entrance cladding and sheltered doors.
- [F42 AO ground photographs](https://www.f42consulting.com/blog/australian-open-tennis-sponsorship): ANZ exterior canopy/base and 1573 identity.
- [Development Victoria: Stage 3](https://www.development.vic.gov.au/projects/melbourne-park-redevelopment?page=stage_3): confirms demolition of the southern tubular footbridge. The historic city footprint is trimmed before generating decks, supports and rails, preserving both northern ground approaches and preventing the obsolete span from intersecting Kia Arena.

Player entries and concourse passages in Rod Laver and Margaret Court are cut through the seating geometry, with seats and advertising removed from the openings. Passage dimensions remain approximate.

Run `node scripts/check-arena-access.mjs` for aperture ray checks and bridge footprint/approach regression checks. Rebuild the seat sunlight asset with `node scripts/bake-seat-sun.mjs` after structural changes.

The workflow in `.github/workflows/deploy.yml` checks pull requests and publishes `dist` from `master` through GitHub's official Pages artifact deployment.
