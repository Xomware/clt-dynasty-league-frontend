# Xomper

Fantasy football companion app built on the [Sleeper API](https://docs.sleeper.com). Provides league management, matchup history, team analysis, taxi squad management, and rule proposals for dynasty leagues.

**Live:** https://xomper.xomware.com

## Xomware Ecosystem

| App | URL | Frontend | Backend | Infrastructure |
|-----|-----|----------|---------|----------------|
| **Xomware** (Hub) | [xomware.com](https://xomware.com) | [xomware-frontend](https://github.com/domgiordano/xomware-frontend) | - | [xomware-infrastructure](https://github.com/domgiordano/xomware-infrastructure) |
| **Xomify** | [xomify.xomware.com](https://xomify.xomware.com) | [xomify-frontend](https://github.com/domgiordano/xomify-frontend) | [xomify-backend](https://github.com/domgiordano/xomify-backend) | [xomify-infrastructure](https://github.com/domgiordano/xomify-infrastructure) |
| **Xomcloud** | [xomcloud.xomware.com](https://xomcloud.xomware.com) | [xomcloud-frontend](https://github.com/domgiordano/xomcloud-frontend) | [xomcloud-backend](https://github.com/domgiordano/xomcloud-backend) | [xomcloud-infrastructure](https://github.com/domgiordano/xomcloud-infrastructure) |
| **Xomper** | [xomper.xomware.com](https://xomper.xomware.com) | [xomper-front-end](https://github.com/domgiordano/xomper-front-end) | [xomper-back-end](https://github.com/domgiordano/xomper-back-end) | [xomper-infrastructure](https://github.com/domgiordano/xomper-infrastructure) |

## Tech Stack

- **Frontend:** Angular 16, RxJS, SCSS
- **Auth & DB:** Supabase (Google OAuth, email/password, PostgreSQL + RLS)
- **Backend:** AWS Lambda (Python), API Gateway, SES
- **Hosting:** S3 + CloudFront
- **CI/CD:** GitHub Actions (auto-deploy on push to `master`)
- **IaC:** Terraform Cloud

## Features

- **League Dashboard** - Standings, roster breakdowns, World Cup divisions, rule proposals with voting
- **Matchup History** - Season-by-season matchup results with expandable week views
- **Team View** - Detailed roster with player stats, starters/bench/taxi/IR breakdown
- **Taxi Squad** - Browse all taxi squad players across the league, request steals with email notifications
- **Draft History** - Historical draft board for all league drafts
- **Player Search** - Search any Sleeper user or league by username/ID
- **Rule Proposals** - Propose, vote on, and auto-resolve league rule changes
- **Email Notifications** - SES-powered emails for rule proposals, votes, and taxi squad steals

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
npm install
npm start
```

App runs at `http://localhost:4200`.

### Build

```bash
npm run build                                # dev build
npm run build -- --configuration production  # prod build
```

### Environment

Local config is in `src/environments/environment.ts`. Production secrets are injected at build time via AWS SSM Parameters (see `.github/workflows/deploy-frontend.yml`).

## Deployment

Pushes to `master` trigger the GitHub Actions workflow which:

1. Pulls secrets from AWS SSM Parameter Store
2. Injects them into `environment.prod.ts`
3. Builds the Angular app in production mode
4. Syncs the build output to the S3 bucket behind CloudFront

Manual deploys can be triggered via `workflow_dispatch`.

## Project Structure

```
src/app/
  components/     # Shared components (toolbar, modals, loader, toast, footer)
  pages/          # Route-level page components
  services/       # Angular services (Sleeper API, Supabase, email, etc.)
  models/         # TypeScript interfaces and model classes
  animations/     # Reusable Angular animations
  constants/      # Static data (team colors, etc.)
  guards/         # Route guards (auth)
```
