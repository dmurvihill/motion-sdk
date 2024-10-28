resource "rediscloud_acl_rule" "test_runner" {
  name = "test-runner"
  rule = "+@read +@write ~motion-sdk-tests:*"
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
