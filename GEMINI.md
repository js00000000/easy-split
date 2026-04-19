# Project Mandates

This file contains foundational instructions for Gemini CLI. These mandates take absolute precedence over general workflows.

## Build and Verification
- **Pre-commit Build**: You MUST run `npm run build` and ensure it completes without errors before committing any code changes. This ensures that type safety and bundle optimizations are verified.
- **Fix Failures**: If a build fails, you must resolve the issues and successfully complete a build before proceeding with the commit.
