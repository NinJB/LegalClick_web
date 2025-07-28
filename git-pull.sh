#!/bin/bash

echo "⚙️ Resetting repo to match remote 'main'..."

git reset --hard
git clean -fd
git pull --rebase origin main

echo "✅ Repo updated successfully!"
