# The Yearly Grind — Monthly Poker Tournament Tracker

A full-stack app for tracking a monthly home poker tournament and ranking
players across the season.

## How it works

- **Scoring:** each month, every player who finishes gets
  `points = entrantsCount - finishPosition + 1` (minimum 1 point), so a
  bigger field is worth more and nobody walks away with zero.
- **Standings** reset each calendar year; past years stay browsable in the
  History archive.
- **Ties** at year-end are flagged in the UI (`tied — check H2H`) rather than
  silently resolved — the app breaks ties automatically by most 1st-place
  finishes, then total winnings, but a tie on points is called out so you can
  make the final call by head-to-head record if you want to.
- **Admins** (you + co-organizers) log in with AWS Cognito to create each
  month's game and enter results. Anyone can view the leaderboard, history,
  and player profiles without logging in.

## Architecture

```
frontend/   React + TypeScript (Vite), hosted as a static site
backend/    Node.js + TypeScript on AWS Lambda, behind API Gateway
            DynamoDB (single table, on-demand billing)
            Cognito User Pool for admin auth
            Defined as AWS SAM (template.yaml)
```

This is a serverless, pay-per-use setup — with a small home league's traffic
(a few dozen requests a month, one table, a handful of Lambda invocations),
it should cost close to $0/month; DynamoDB on-demand, Lambda, and API Gateway
all have generous free tiers, and Cognito is free for this scale of user pool.

### Data model (DynamoDB single table)

| Item            | PK              | SK                     | GSI1PK          | GSI1SK                  |
|-----------------|-----------------|------------------------|-----------------|--------------------------|
| Player profile  | `PLAYER#<id>`   | `PROFILE`              | `PLAYERS`       | `PLAYER#<id>`            |
| Game metadata   | `GAME#<id>`     | `METADATA`             | `YEAR#<year>`   | `GAME#<date>#<id>`       |
| Result          | `GAME#<id>`     | `RESULT#<playerId>`    | `PLAYER#<id>`   | `YEAR#<year>#GAME#<id>`  |
| Year marker     | `YEARS`         | `YEAR#<year>`          | —               | —                        |

Standings are computed on read (query games for a year, then results for
each game, then aggregate) rather than cached — with ~12 games/year and a
few dozen players this is cheap and avoids any risk of stale cached totals.

## Prerequisites

- An AWS account with credentials configured locally (`aws configure`)
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- Node.js 22+ and npm

## 1. Deploy the backend

```bash
cd backend
npm install
npm run sam:deploy   # first time: --guided walks you through stack name, region, etc.
```

When it finishes, note the `Outputs` section — you'll need `ApiUrl`,
`UserPoolId`, and `UserPoolClientId` for the frontend.

For future updates you can just run `npm run sam:deploy:quick`.

### Create your admin accounts

SAM doesn't create Cognito users for you. After the first deploy, add
yourself and your co-organizers:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_kA7EyeHfJ \
  --username cteater@gmail.com \
  --user-attributes Name=email,Value=cteater@gmail.com Name=email_verified,Value=true \
  --temporary-password "1"
```

Each admin signs in once with the temporary password and is prompted to set
a permanent one. On the admin page, you can add players by their first and last names,
then log game results for each player.

## 2. Configure and run the frontend

```bash
cd frontend
npm install
cp .env.example .env
# fill in .env with the ApiUrl, UserPoolId, and UserPoolClientId from step 1
npm start
```

This runs a local dev server at `http://localhost:3000`.

## 3. Deploy the frontend

The S3 bucket and CloudFront distribution are created by the SAM template.
After `npm run sam:deploy`, grab the bucket name from the stack outputs and sync:

```bash
npm run build            # outputs to frontend/dist
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name pokerTracker \
  --query "Stacks[0].Outputs[?OutputKey=='your-poker-tracker-site'].OutputValue" \
  --output text)
aws s3 sync dist/ s3://your-poker-tracker-site --delete
```

The `FrontendUrl` output gives you the CloudFront HTTPS URL.
CloudFront can take a few minutes to finish deploying on the first run.

## Extending it later

- Add a `PUT /games/{gameId}` bulk-recompute if you ever need to change
  `entrantsCount` after results are already in (right now it only updates
  the stored value, not historical points — re-save each result if that
  happens).
- The "tied" flag on standings is a nudge for manual head-to-head review,
  not an automated resolver — wire up real head-to-head lookback if the
  league wants it fully automatic.
- `careerStats` in the player profile endpoint gives you all-time numbers;
  a season-by-season breakdown would just be a matter of grouping
  `history` by `year` in `PlayerProfile.tsx`.
