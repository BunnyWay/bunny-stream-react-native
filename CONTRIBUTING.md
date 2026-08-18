# Contributing to Bunny Stream React Native

Thanks for your interest in Bunny Stream React Native. This package is in early setup and will become a React Native bridge/plugin on top of the official [Bunny Stream iOS SDK](https://github.com/BunnyWay/bunny-stream-ios) and [Bunny Stream Android SDK](https://github.com/BunnyWay/bunny-stream-android).

## Current Stage

The repository currently contains only the base npm package setup (TypeScript, linting, and build tooling). There is no native bridge yet. Please keep this in mind when opening issues or pull requests — API surface, native modules, and project structure are expected to change significantly.

## Good First Contributions

Good places to start at this stage:

- README and documentation improvements
- TypeScript, linting, and build tooling improvements
- Feedback on the planned public API shape
- Small, well-scoped proposals for the native bridge architecture

If you are unsure whether a change fits, open an issue first and describe the problem you want to solve.

## Development Setup

Requirements:

- Node.js 22+ (see `.nvmrc`)
- Yarn 4 (managed via Corepack — see below)
- Xcode (latest) with iOS Simulator
- Android Studio with Android SDK and emulator

### Enabling Yarn 4 via Corepack

This project uses Yarn 4 (Berry), pinned via the `packageManager` field in `package.json`. Enable it with Corepack (built into Node.js 16.9+):

```bash
corepack enable
```

Corepack will automatically download and use the exact Yarn version specified in `package.json` (`yarn@4.11.0`). You do **not** need to install Yarn globally.

If you have an older Yarn 1.x installed globally, Corepack takes precedence once enabled.

Useful commands:

```bash
yarn install
yarn typecheck
yarn lint
yarn build
```

### Running the example app

The repository includes an example React Native app in `example/` that links the library from source. This is the primary way to iterate on the native bridge.

```bash
# iOS (installs pods and launches simulator)
yarn example:ios

# Android (launches emulator)
yarn example:android

# Typecheck the example app
yarn example:typecheck
```

The example app resolves the library from `src/` via Metro, so changes to TypeScript source are reflected through Fast Refresh without rebuilding the library.

## Project Areas

- `src`: TypeScript public API (JS/TS layer)
- `android`: Kotlin native bridge wrapping the Bunny Stream Android SDK (planned)
- `ios`: Swift/Objective-C native bridge wrapping the Bunny Stream iOS SDK (planned)

Try to keep changes scoped to the area they affect.

## Pull Request Guidelines

Before opening a pull request:

- Make sure the change solves one clear problem.
- Add or update tests when behavior changes.
- Update the README when public APIs or setup steps change.
- Avoid unrelated formatting-only changes in large files.

Pull requests should include:

- What changed
- Why the change is needed
- How it was tested
- Any migration notes for SDK users

## API and Compatibility

This repository will publish a package used by external applications. Please be careful with:

- Public API renames or removals, once an initial API is released
- Behavior changes in upload, playback, authentication, or camera flows
- Minimum React Native / iOS / Android version changes
- Dependency version upgrades

If a change may be breaking, call it out clearly in the PR description.

## Using AI Tools

AI tools are welcome when they help you work faster or improve quality, but contributors remain responsible for the final contribution.

When using AI:

- Review and understand all generated code before submitting it.
- Do not paste access keys, signing keys, customer data, private logs, or other secrets into AI tools.
- Prefer small, reviewable changes over large generated rewrites.
- Mention substantial AI assistance in the PR description when it materially shaped the implementation.
- Make sure generated code follows the existing style and architecture.

## Reporting Bugs

Please use the bug report template and include:

- Package version or commit
- React Native version
- iOS/Android version, if relevant
- Area affected (`src`, `android`, or `ios`)
- Minimal reproduction steps
- Expected and actual behavior
- Logs, screenshots, or sample code when useful

Never include Bunny access keys or other secrets in issues.

## Security Issues

Please do not report security vulnerabilities in public issues. See `SECURITY.md` for the private reporting process.

## License

By contributing, you agree that your contribution will be licensed under the MIT License used by this repository.
