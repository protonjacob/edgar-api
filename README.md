# edgar-api

An API for looking up companies and their SEC filings, backed by [SEC EDGAR](https://www.sec.gov/edgar). Built with [Nest](https://github.com/nestjs/nest).

## Getting started

Requires Node.js 20 or later (the minimum for Nest 12).

```bash
# install dependencies
$ npm install

# run in watch mode for development
$ npm run start:dev

# or build and run for production
$ npm run build
$ npm run start:prod
```

The API listens on port 3000 by default; set `PORT` to change it. No API keys or configuration are needed: data comes from SEC's public EDGAR endpoints.

### Run the tests

```bash
# unit tests
$ npm run test

# e2e tests (SEC is faked, no network access needed)
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

### Example requests

```bash
# look up a company by ticker (case-insensitive)
$ curl http://localhost:3000/api/companies/aapl

# list a company's filings, newest first
$ curl "http://localhost:3000/api/companies/aapl/filings"

# only 10-K and 8-K filings filed during 2024, 10 per page
$ curl "http://localhost:3000/api/companies/aapl/filings?form-type=10-K,8-K&start-date=2024-01-01&end-date=2024-12-31&limit=10"

# fetch the next page by following pagination.next from the previous response
$ curl "http://localhost:3000/api/companies/aapl/filings?form-type=10-K,8-K&start-date=2024-01-01&end-date=2024-12-31&limit=10&cursor=<nextCursor>"

# fetch a single filing by accession number (with or without dashes)
$ curl http://localhost:3000/api/companies/aapl/filings/0000320193-25-000079
```

## API

Every response, successful or not, uses the same envelope. `status` mirrors the HTTP status code:

```json
{ "data": { ... }, "error": null, "status": 200 }
{ "data": null, "error": { "message": "...", "status": 404 }, "status": 404 }
```

Errors from SEC are forwarded with SEC's status code and message.

### `GET /api/companies/{ticker}`

Looks up a company. The ticker is case-insensitive.

```json
{ "cik": 320193, "ticker": "AAPL", "name": "Apple Inc." }
```

### `GET /api/companies/{ticker}/filings`

Lists the company's filings, newest first by filing date.

| Query parameter | Description |
| --- | --- |
| `form-type` | Form types to include, comma-separated or repeated (`10-K,8-K`). Matching is exact and case-insensitive: amendments such as `10-K/A` are only included when requested explicitly. |
| `start-date`, `end-date` | Inclusive `YYYY-MM-DD` range on the **filing date**. |
| `limit` | Page size, 1 to 200. Defaults to 50. |
| `cursor` | The `nextCursor` from the previous page. It must be used with the same filters as the first page, otherwise the request fails with 400. |

```json
{
  "items": [
    {
      "accessionNumber": "0000320193-25-000079",
      "formType": "10-K",
      "filingDate": "2025-10-31",
      "reportDate": "2025-09-27",
      "primaryDocumentUrl": "https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm"
    }
  ],
  "pagination": { "limit": 50, "total": 1, "nextCursor": null, "next": null }
}
```

`total` counts all matching filings. To read every page, follow `next` (a relative URL) until it is `null`.

`reportDate` is the end of the period the filing covers. It is `null` for filings without one, such as many prospectuses.

> **Date filter changed:** `start-date` and `end-date` used to filter on the report date and left out filings without one. They now filter on the filing date, the same date the list is sorted by, so every filing can match a date range.

### `GET /api/companies/{ticker}/filings/{accessionNumber}`

Fetches one filing of the company. The accession number may be written with or without dashes (`0000320193-25-000079` or `000032019325000079`). The response is a single filing, shaped like an item above.

### Limitations

- **Only recent filings are available.** The API reads SEC's "recent" filings, which hold a company's latest 1,000 filings or its last year of filings, whichever is more. For most companies that reaches back several years (Apple: to 2015), but for very frequent filers it can be about a year (JPMorgan: to late 2025). Older filings are not listed and cannot be fetched by accession number.
- SEC data is cached in memory: the ticker list for 24 hours and each company's filings for 10 minutes, so new filings can take up to 10 minutes to appear.
- Requests to SEC are limited to 7 per second per running instance.

## Future work

These were deliberately left out of the current version and are planned for later:

- **Older filings.** Only SEC's "recent" filings are read (see Limitations). SEC lists older filings in additional files that are not fetched yet.
- **Cache invalidation.** Cached SEC data only expires by time; there is no way to evict a company's filings early, for example when a new filing is known to exist.
- **Cache memory limit.** Cached entries are not capped; a limit (for example least-recently-used eviction) is needed before serving many distinct companies.
- **Hardening from code review.** Known smaller items: a timeout on SEC requests, tying a pagination cursor to its company, checking the shape of SEC responses, logging upstream errors, and clearer validation messages.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

To add it to this project, run this and approve the code it prints at [observe.nestjs.com/link](https://observe.nestjs.com/link) - signing up for free if you have no account:

```bash
$ npx @nestjs/observe link
```

It installs `@nestjs/observe`, wires it into `AppModule` and `main.ts`, and writes the app key and secret into `.env`, which every `nest start` script (`start`, `start:dev`, `start:debug`) then loads. In production, set `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` in the environment instead.

Or do it by hand:

```bash
$ npm install @nestjs/observe
```

Then follow the [setup guide](https://docs.nestjs.com/observability/sdk) - it takes a single import and an app key.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
