terraform {
  required_providers {
    rediscloud = {
      source = "RedisLabs/rediscloud"
      version = "~> 1.9.0"
    }

    random = {
      source = "hashicorp/random"
      version = "~> 3.6.3"
    }
  }
}

provider "rediscloud" {
}

provider "random" {
}

data "rediscloud_essentials_plan" "redis" {
  size = 30
  size_measurement_unit = "MB"
  cloud_provider = "AWS"
  region = "us-east-1"
}

resource "rediscloud_essentials_subscription" "redis" {
  name = var.subscription_name
  plan_id = data.rediscloud_essentials_plan.redis.id
}

resource "rediscloud_essentials_database" "redis" {
  subscription_id = rediscloud_essentials_subscription.redis.id
  name = var.database_name
  data_persistence = "none"
  replication = false
  enable_tls = true
  enable_default_user = false
}
