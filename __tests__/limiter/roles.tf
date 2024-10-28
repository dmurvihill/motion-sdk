locals {
  base_url = "https//api.usemotion.com/v1"
  mock_base_url = "https//stoplight.io/mocks/motion/motion-rest-api/33447"
}
resource "rediscloud_acl_rule" "test_runner" {
  name = "test-runner"
  rule = "+@read +@write +@transaction +eval +evalsha ~limiter:${local.base_url}:* ~limiter:${local.mock_base_url}:* ~limiter:limiter-tests:*"
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
