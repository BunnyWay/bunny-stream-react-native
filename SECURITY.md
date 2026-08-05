# Security Policy

## Supported Versions

This project is currently in early, pre-release development. Security fixes are prioritized for the latest commit on the default branch. Once the package is published to npm, fixes will be prioritized for the latest released version, and backported to recent minor versions when practical.

## Reporting a Vulnerability

Please do not report security vulnerabilities in public GitHub issues.

To report a vulnerability, contact us privately at support@bunny.net with the subject line:

```text
[Security] bunny-stream-react-native
```

Include as much detail as you can safely share:

- Affected area (`src` TypeScript API, native Android bridge, native iOS bridge, or example app, once available)
- Affected version or commit
- Steps to reproduce
- Impact and possible attack scenario
- Any proof of concept, logs, or screenshots
- Suggested fix, if you have one

Do not include production access keys, signing keys, certificates, provisioning profiles, customer data, or other secrets.

## What to Expect

We aim to acknowledge security reports within a reasonable time and will follow up if we need more information. If the report is valid, we will work on a fix, coordinate disclosure timing where appropriate, and publish release notes or advisories when the issue is resolved.

## Scope

In scope:

- Authentication or authorization flaws in SDK API calls
- Unsafe handling of access keys, tokens, or signed URLs
- Upload or playback behavior that could expose private content
- Dependency or build configuration issues that affect SDK users
- Security-sensitive issues in the native bridge, once implemented

Out of scope:

- Vulnerabilities requiring a compromised developer machine
- Issues only present in unsupported SDK versions
- Denial-of-service scenarios with no practical impact on SDK users
- Reports without enough detail to reproduce or assess

## AI and Security

Maintainers may use AI-assisted tooling to triage reports or review patches, but vulnerability details should be handled carefully. Do not send secrets, private customer data, or unreleased vulnerability details to third-party AI systems unless explicitly approved by the maintainers responsible for the report.
