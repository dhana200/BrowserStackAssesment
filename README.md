# BrowserStackAssesment

## Setup

1. **Install dependencies**  
   Run the following command in your project directory:
   ```sh
   npm install
   ```

2. **Set up environment variables**  
   - For BrowserStack, set `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY` in your environment or update them in `browserstack.yml`.
   - For RapidAPI, set `RAPID_API_KEY` if you want to use your own key.

## Running Tests

### Run tests locally (using Playwright)
```sh
npx playwright test --config=playwright.config.js
```

### Run tests on BrowserStack
```sh
npm run sample-test
```
or
```sh
npx browserstack-node-sdk playwright test --config=playwright.config.js
```

### Run local tests with BrowserStack Local enabled
```sh
npm run sample-local-test
```
or
```sh
npx browserstack-node-sdk playwright test --config=playwright.local.config.js
```

## Test Files

- All tests are located in the `tests` directory.
- Main test: `tests/Assignment.js`

## Output

- Test results and logs are saved in the `test-results` and `log` directories.
- Downloaded images will appear in the project root as `article-*.jpg`.

## Notes

- Make sure your credentials are correct in `browserstack.yml` or set as environment variables.
- For more details,