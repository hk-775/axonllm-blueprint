#!/usr/bin/env sh
set -eu

if ! command -v git >/dev/null 2>&1; then
  echo "secret scan requires git" >&2
  exit 2
fi

pattern='(AKIA|ASIA)[A-Z0-9]{16}|aws_secret_access_key|aws_access_key_id|BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-ant-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9]{20,}'

if git grep -l -I -E "$pattern" -- \
  . \
  ':(exclude,glob)**/package-lock.json' \
  ':(exclude)scripts/secret-scan.sh'; then
  echo "potential secret material detected" >&2
  exit 1
fi

echo "secret pattern scan passed"
