# ─── Git Aliases ──────────────────────────────────────────────
alias gst='git status'
alias gl='git log --oneline --graph --all --decorate'
alias gd='git diff'
alias gds='git diff --staged'
alias gb='git branch -a'

# ─── Commit ───────────────────────────────────────────────────
alias ga='git add'
alias ga.='git add .'
alias gc='git commit'
alias gcm='git commit -m'
alias gcam='git commit -a -m'
alias gca='git commit --amend'

# ─── Push to GitHub ───────────────────────────────────────────
alias gp='git push'
alias gpo='git push origin'
alias gpom='git push origin main'
alias gpf='git push --force-with-lease'
alias gpu='git push -u origin HEAD'

# ─── Pull / Fetch ─────────────────────────────────────────────
alias gpl='git pull'
alias gplr='git pull --rebase'
alias gf='git fetch'
alias gfa='git fetch --all --prune'

# ─── Branch ───────────────────────────────────────────────────
alias gco='git checkout'
alias gcob='git checkout -b'
alias gcom='git checkout main'
alias gbd='git branch -d'
alias gbD='git branch -D'

# ─── Stash ────────────────────────────────────────────────────
alias gstash='git stash'
alias gstashp='git stash pop'
alias gstashl='git stash list'

# ─── Reset / Clean ────────────────────────────────────────────
alias grs='git reset'
alias grsh='git reset --hard'
alias gclean='git clean -fd'

# ─── Remote ───────────────────────────────────────────────────
alias gra='git remote add'
alias grv='git remote -v'

# ─── Shortcut: add, commit, push (one command) ────────────────
acp() {
  if [ $# -eq 0 ]; then
    echo "Usage: acp \"commit message\""
    return 1
  fi
  git add .
  git commit -m "$1"
  git push origin main
}

# ─── Load ~/.bashrc after edit ────────────────────────────────
alias reload='source ~/.bashrc'
