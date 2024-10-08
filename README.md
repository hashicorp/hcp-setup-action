# Setup the `hcp` CLI for use in GitHub Actions

Configures the [`hcp` CLI](https://developer.hashicorp.com/hcp/docs/cli) for use
in GitHub Actions. The Action installs the specified version of `hcp` and
configures the `hcp` CLI for use in GitHub Actions. The downloaded `hcp` CLI is
cached in the GitHub Actions workspace for subsequent use. For a full list of
available `hcp` CLI commands, see the
[`hcp` CLI documentation](https://developer.hashicorp.com/hcp/docs/cli/commands).

## Usage

```yaml
jobs:
  job_id:
    permissions:
      contents: 'read'
      id-token: 'write'

    steps:
      - id: 'Authenticate to HCP'
      - uses: 'hashicorp/hcp-auth-action@v0'
        with:
          workload_identity_provider: 'iam/project/123456789/service-principal/my-sp/workload-identity-provider/github'

      - name: 'Download hcp CLI'
        uses: 'hashicorp/hcp-setup-action@v0'
        with:
          version: 'latest'

      - name: 'Use hcp CLI to read a secret'
        run: |
          MY_SECRET=$(hcp vault-secrets secrets open \
            --app=cli --format=json foo | jq -r '.static_version.value')
          echo "::add-mask::$MY_SECRET"
          echo "MY_SECRET=$MY_SECRET" >> $GITHUB_ENV
```

## Inputs

- `version` - (Optional) A string specifying which version of the `hcp` CLI to
  use. The following are valid version strings:

  - ``: Use the currently installed version of the `hcp`CLI. If the`hcp` CLI is
    not installed, the latest version will be installed.
  - `latest`: Use the latest version of the `hcp` CLI.
  - Specific version (e.g. `0.4.0`): Specifies the exact version of the `hcp`
    CLI to use.
  - Version constraint (e.g. `>= 0.3.0`): Specifies a version constraint for the
    `hcp` CLI. The latest version that satisfies the constraint will be used.
    See [SemVer](https://www.npmjs.com/package/semver) for details on
    constructing a version constraint string.

- `project_id` - (Optional) Configure the default HCP Project ID for the `hcp`
  CLI. This is equivalent to running `hcp profile set project_id <project_id>`.
  Individual commands can override this value by setting the `--project` flag.

## Authentication

To use the `hcp` CLI, it must first be authenticated using
[the `hcp-auth-action` Action](https://github.com/hashicorp/hcp-auth-action) The
`hcp-auth-action` Action supports authenticating the `hcp` CLI using Service
Principal credentials or using Workload Identity Federation.

See the
[`hcp-auth-action` Action documentation](https://github.com/hashicorp/hcp-auth-action)
for more information on authenticating the `hcp` CLI.
