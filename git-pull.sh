#!/bin/bash

echo "⚙️ Resetting repo to match remote 'main'..."

git reset --hard
git clean -fd
git pull --rebase origin web-hosting

echo "✅ Repo updated successfully!"
