# GitLab setup (MooreVIEW)

Host **`mooreview-pc`** and **`mooreview-cloud`** on [GitLab](https://gitlab.com).  
Digital Ocean App Platform can deploy directly from a GitLab project.

## 1. Create projects on GitLab

1. Sign in at [gitlab.com](https://gitlab.com) (or your self-hosted GitLab URL).
2. **New project → Create blank project** (twice):
   - `mooreview-pc` — visibility **Private**
   - `mooreview-cloud` — visibility **Private**
3. Leave **Initialize with README** unchecked (local repos already have commits).

Note your **namespace** (username or group), e.g. `recycleroy` or `mooreview`.

## 2. Personal access token (HTTPS push)

GitLab → **Preferences → Access tokens** (or **User Settings → Access tokens**):

- Name: `mooreview-push`
- Scopes: `write_repository` (and `read_repository` if listed separately)
- Create token and copy it (shown once).

When Git prompts for a password, paste the **token**, not your GitLab account password.

## 3. Point `origin` at GitLab and push

```powershell
cd C:\Users\public\data\est-pc
git remote set-url origin https://gitlab.com/<namespace>/mooreview-pc.git
git push -u origin cloud

cd C:\Users\public\data\mooreview-cloud
git remote set-url origin https://gitlab.com/<namespace>/mooreview-cloud.git
git push -u origin master
```

Replace `<namespace>` with your GitLab username or group path.

If `est-pc` uses branch `main` instead of `cloud`:

```powershell
git -C C:\Users\public\data\est-pc branch --show-current
git push -u origin <that-branch>
```

## 4. Desktop GUI options

GitHub Desktop does **not** support GitLab. Common choices:

| Tool | Notes |
|------|--------|
| **GitLab Web IDE** | Browse project → edit files in browser |
| **VS Code / Cursor** | Built-in Git panel after remote is set |
| **GitKraken**, **Fork**, **Sourcetree** | Add existing local repo, push to GitLab remote |

In Cursor: **Source Control** → publish/push after `origin` points at GitLab.

## 5. Digital Ocean deploy from GitLab

1. **Apps → Create App → GitLab** — authorize GitLab.
2. Select namespace → project **`mooreview-cloud`**.
3. **Run command:** `npm start` · **HTTP port:** `3100`
4. Environment: `MONGODB_URI`, `JWT_SECRET`, `MONGODB_DB`, `NODE_ENV=production` (see `DEPLOY.md`).

## 6. GitHub repos (optional cleanup)

Remotes may still reference GitHub until you run `git remote set-url`:

- `https://github.com/recycleroy/mooreview-pc.git`
- `https://github.com/recycleroy/mooreview-cloud.git`

After a successful GitLab push, archive or delete those GitHub repos if you no longer need them.

## Secrets

`.gitignore` excludes `.env`, `data/drivers.json`, and `data/settings.json`. Never commit credentials.
