# Security Policy

## Reporting a vulnerability

If you discover a security issue in this repository, its workflows, or the `has-a.link` DNS service, please report it privately.

- **Email:** security@has-a.link
- **GitHub:** use the repository's [private security advisory](../../security/advisories/new) form.

Please **do not** open a public issue for security problems. Include:

- a description of the issue and its impact,
- steps to reproduce,
- any proof of concept,
- your contact details (optional).

We aim to acknowledge reports within a few days.

## Report abuse

To report a subdomain being used for phishing, malware, spam, or other abuse, open an issue using the [abuse report template](ISSUE_TEMPLATE/report-abuse.md) with supporting evidence.

## Scope

In scope:

- the `domains/`, `utils/`, `tests/`, `dnsconfig.js`, and `.github/` contents of this repository,
- the GitHub Actions workflows and their handling of credentials,
- DNS records managed by this service.

Out of scope:

- vulnerabilities in third-party services users point their subdomains at,
- social engineering,
- denial of service against individual user-hosted sites.

## Handling

- Never include real secrets or credentials in reports, issues, or pull requests.
- If a secret is exposed in a pull request comment, maintainers will rotate it immediately; assume any previously posted secret is compromised.
