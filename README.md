# Run Elsetest

A GitHub Action that tests your website with [Elsetest](https://elsetest.com) on every push, pull request or schedule.

You test the use cases. Elsetest tests everything else: it uses your site in a real Chrome for as long as you choose, clicking, typing, selecting and submitting, and checks every page it reaches for

- **accessibility** problems (WCAG 2.1 AA with axe-core),
- **broken text**: `{0}` placeholders, `[object Object]`, `NaN`, broken character encoding (`VÃ¤lkommen`), missing translations,
- **spelling** mistakes (English and Swedish),
- **invalid HTML**,
- **overlapping text**,
- **JavaScript errors**, console errors and **server errors** (5xx),
- and, with your own AI key, what an AI model sees as a tester would.

Each run gives a log and a **video** of the run, uploaded as an artifact, and lists the problems in the job summary.

## Usage

```yaml
- uses: wwwclaes/elsetest-action@v1
  with:
    url: https://staging.example.com
    api-key: ${{ secrets.ELSETEST_API_KEY }}
```

That tests the site for 5 minutes, and fails the job if it logs an error. With a config file, e.g. one with the login that `elsetest --setup` made for you:

```yaml
name: Elsetest
on:
  push:
    branches: [ main ]
  schedule:
    - cron: '0 3 * * *'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: wwwclaes/elsetest-action@v1
        with:
          config: elsetest/staging.json
          duration: 10m
          fail-on: warn
          api-key: ${{ secrets.ELSETEST_API_KEY }}
```

Keep passwords out of the config file in the repository: give them on the command line from a secret, e.g. `args: --plugin alias=Login password=${{ secrets.STAGING_PASSWORD }}`.

### Your API key

Elsetest needs an account: [download Elsetest](https://elsetest.com), run `elsetest --login you@example.com`, and copy the API key it stored in `credentials.json` in your settings folder (`~/.config/elsetest` on Linux, `%APPDATA%\elsetest` on Windows, `~/Library/Application Support/elsetest` on macOS) into a repository secret named `ELSETEST_API_KEY`. Runs use your testing time, per started minute.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `url` | | The site to test. Not needed when the config file has it. |
| `config` | | A config file (JSON). See [the options](https://elsetest.com/docs/options). |
| `duration` | `5m` | How long to test, e.g. `5m` or `1h`. |
| `fail-on` | `error` | Fail the job when the run logs messages at this level or above: `warn` or `error`, or `none` to fail only when the test can't run. |
| `api-key` | | Your Elsetest API key, from a secret. |
| `args` | | More command-line options, quoted as in a shell, e.g. `--scope /shop --ignoreLogs "Mixed Content"`. |
| `version` | `latest` | The Elsetest version, e.g. `0.9.8`. |
| `upload-results` | `true` | Upload the log and video as an artifact. |
| `artifact-name` | `elsetest` | The artifact's name. |

## Outputs

| Output | Description |
| --- | --- |
| `exit-code` | `0` the test ran to its end, `1` it couldn't go on (the site didn't load or stopped answering, the login failed...), `2` your testing time ran out, `3` problems found (`fail-on`). |
| `results-dir` | The folder with the log (`elsetest.log`) and the video (`elsetest.mp4`). |
| `errors`, `warnings` | How many errors and warnings the run logged. |
| `version` | The Elsetest version that ran. |

## Notes

- Runs on GitHub's Linux, Windows and macOS runners (x64, and arm64 on macOS). Elsetest's Chrome is cached between runs.
- The download is checked against Elsetest's signed release manifest (Ed25519), as `elsetest --update` does. Only the latest release has one, so a pinned older `version` isn't checked.
- To hide messages you don't want reported, use the [`ignoreLogs`](https://elsetest.com/docs/options#ignoreLogs) option.
- Elsetest uses your site as a user would, so it may create, change or delete data there. Test a staging site, or block writes on a live one with `args: --blockRequests POST,PUT,PATCH,DELETE`.

[Documentation](https://elsetest.com/docs/) · [All options](https://elsetest.com/docs/options)

## License

The action is MIT licensed. Elsetest itself is commercial software: see [elsetest.com](https://elsetest.com).
