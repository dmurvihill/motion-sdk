# `motion-sdk` Contributor's Guide

`motion-sdk` is just a piece of glue code for some app, but it's made
with love and care.

Bug reports are welcome and handled on an as-available basis. Pull
requests are even better. When contributing, please honor the guarantees
at the top of the [README](./README.md), and be sure to update the
[Changelog](./CHANGELOG.md).

Setup is three steps:

- [Node Setup](#node-setup)
- [Redis Setup](#redis-setup) (required for the integration tests)
- [Development](#development)

## Node Setup

Install dependencies:

```
npm ci
```

Set up your config:

```
cp .env.example .env
chmod 600 .env
```

Edit `.env` to add your credentials for Redis and Motion.

## Redis Setup

Because the integration tests share the same Motion user across several
environments, they use [Redis](https://redis.io/) to coordinate
themselves to stay beneath the rate limit. Even when running locally,
Redis is needed to remember the rate limiter state between test runs. To
run the test suite, you must configure it to use an appropriate Redis instance.

If you wish to use an existing Redis instance, you can find the required
privileges and keys for the test runner at the top of [**tests**/limiter/roles.tf](__tests__/limiter/roles.tf).

If you need a new Redis instance, you can use [Redis Cloud](https://redis.io/cloud/). The free tier
easily meets the test suite's needs.

A turnkey Tofu definition is provided in `__tests__/limiter`.
This is the same configuration that's used to manage the maintainer's
own test harness. If you have [OpenTofu](https://opentofu.org/) or
[Terraform](https://www.terraform.io/), you can deploy in a few steps:

### Create a Redis Cloud account and configure the Terraform provider

1. [Install OpenTofu](https://opentofu.org/docs/intro/install/).
2. [Create a Redis Cloud account](https://redis.io/docs/latest/operate/rc/rc-quickstart/#create-an-account).
3. [Enable the Redis Cloud API](https://redis.io/docs/latest/operate/rc/api/get-started/enable-the-api/).
4. [Get your Redis Cloud API keys](https://redis.io/docs/latest/operate/rc/api/get-started/manage-api-keys/). Set them to the following environment variables:
   - Set `REDISCLOUD_ACCESS_KEY` to your API account key.
   - Set `REDISCLOUD_SECRET_KEY` to your API user key.

_(copied from the [Redis Cloud docs](https://redis.io/docs/latest/integrate/terraform-provider-for-redis-cloud/get-started/))_

### Create the cluster

```
cd __tests__/limiter
```

Set up the variables:

```
cp example.tfvars terraform.tfvars
```

Edit the `terraform.tfvars`:

```hcl
subscription_name = "my-redis-name" # Can be anything you want
database_name = "my-redis-name" # Can be anything you want

# Map of username -> permission level
users = {
   "root": "admin"
   "me": "test-runner"
   "ci": "test-runner"
   "boss": "read-only"
}
```

Allowed permission levels are `admin`, `test-runner`, and `read-only`.

Apply the configuration:

```
tofu plan -out redis_cluster.tfplan
tofu apply redis_cluster.tfplan
```

Retrieve the passwords from the [Data Access Control](https://app.redislabs.com/#/data-access-control/users)
page in the Redis Cloud console. Store them in your password manager.

Add the test runner's credentials to the `.env` file in the project root
directory (see [Node Setup](#node-setup)). The values for `REDIS_HOST`
and `REDIS_PORT` are available from the [Databases](https://app.redislabs.com/#/databases)
tab. Click on the integration test database and look for the "Public
endpoint" field.

### Verify the integration tests are working with Redis

[Install Redis](https://redis.io/docs/latest/operate/oss_and_stack/install/install-redis/) to get `redis-cli`.

Check Redis connectivity:

```
redis-cli -h <redis_host> -p <redis_port> --user <redis_user> --askpass
```

Check the test suite's Redis configuration:

```
npm test -- __tests__/{ioredis,limiter}.test.ts --no-collect-coverage
```

## Development

Node 20 and later:

```
npm test  # Unit tests and integration tests against the mock server
npm test:live  # Integration tests against the live server
npm run pre-commit  # Format, lint, autodoc, build, and test
```

Node 18:

```
npm test:node18
npm test:live:node18
npm run pre-commit:node18
```

Node 18 prints some warnings to the console about `--experimental-vm-modules`.
This config is needed for Jest to support ESM, and the warning can only
be suppressed in Node 20 or later.
