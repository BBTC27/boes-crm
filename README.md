# boes-crm

## RFP pipeline feed

The RFP Pipeline (Live) view reads one row from the Supabase table `pipeline_status`. The migration is `supabase/migrations/20261125223000_pipeline_status.sql`. Run that file in the Supabase SQL editor. It creates an empty table.

The row id is `current`. The `data` column is the feed document (`updatedAt` and `rfps`). The view uses the signed-in session. Row level security allows select, insert, and update only when `is_team_member()` is true. There is no delete policy.

`pipeline-status.json` is gitignored. Do not commit it.

Nothing in this repo writes the feed. Updates used to be direct commits to `main` (see the pull request that removed the file). That writer has to stop committing the file and upsert the same document with a team-member session:

```js
await sb.from('pipeline_status').upsert(
  { id: 'current', data: feed },
  { onConflict: 'id' }
);
```

`sb` is a Supabase client signed in on project `gppskzsoxprwqymfcjtu`. Do not put a service-role key in the repo.
