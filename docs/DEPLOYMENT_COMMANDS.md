# Deployment Commands

The easiest production workflow is GitHub + two Vercel projects. If using Vercel CLI, these commands are a useful reference.

## Install Vercel CLI

```bash
npm install -g vercel
```

## Deploy Workspace

```bash
cd workspace
npm install
vercel
```

When prompted, create/link the Workspace Vercel project.

Add environment variables in the Vercel dashboard, or with CLI:

```bash
vercel env add SUPABASE_URL production
vercel env add SUPABASE_PUBLISHABLE_KEY production
vercel env add SUPABASE_SECRET_KEY production
```

After preview QA:

```bash
vercel --prod
```

## Deploy Online

```bash
cd online
npm install
vercel
```

Add:

```bash
vercel env add SUPABASE_URL production
vercel env add SUPABASE_PUBLISHABLE_KEY production
vercel env add SUPABASE_SECRET_KEY production
vercel env add ONLINE_PUBLIC_URL production
vercel env add GEMINI_API_KEY production
```

`GEMINI_API_KEY` is optional. Skip it if AI receipt reading is not enabled yet.

After preview QA:

```bash
vercel --prod
```

## Recommended GitHub setup

One repository can contain the whole suite. Create two Vercel projects from the same repository:

```text
Project 1 Root Directory: workspace
Project 2 Root Directory: online
```

Both must point to the same Supabase project.
