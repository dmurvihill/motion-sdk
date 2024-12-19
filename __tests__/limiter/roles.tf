locals {
  base_url = "https//api.usemotion.com/v1"
  mock_base_url = "https//stoplight.io/mocks/motion/motion-rest-api/33447"
  test_runner_privs = [
    "+@read",
    "+@write",
    "+@transaction",
    "+eval",
    "+evalsha"
  ]
  test_runner_keys = [
    "~limiter:${local.base_url}:*",
    "~limiter:${local.mock_base_url}:*",
    "~limiter:limiter-tests:*",
    "~motion-sdk-dev:*"
  ]
}
resource "rediscloud_acl_rule" "test_runner" {
  name = "test-runner"
  rule = "${join(" ", local.test_runner_privs)} ${join(" ", local.test_runner_keys)}"
}

locals {
  databaseId = split("/", rediscloud_essentials_database.redis.id)[1]
}

resource "rediscloud_acl_role" "admin" {
  name = "admin"
  rule {
    name = "Full-Access"
    database {
      subscription = rediscloud_essentials_database.redis.subscription_id
      database = local.databaseId
    }
  }
}

resource "rediscloud_acl_role" "readonly" {
  name = "read-only"
  rule {
    name = "Read-Only"
    database {
      subscription = rediscloud_essentials_database.redis.subscription_id
      database = local.databaseId
    }
  }
}

resource "rediscloud_acl_role" "test_runner" {
  name = "test-runner"
  rule {
    name = rediscloud_acl_rule.test_runner.name
    database {
      subscription = rediscloud_essentials_database.redis.subscription_id
      database = local.databaseId
    }
  }
}
