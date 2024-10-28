resource "rediscloud_acl_user" "test_runner" {
  for_each = var.users
  name = each.key
  role = each.value
  password = random_password.user[each.key].result

  lifecycle {
    ignore_changes = [password]
  }
}

resource "random_password" "user" {
  for_each = var.users
  length = 16
  min_lower = 1
  min_upper = 1
  min_numeric = 1
  min_special = 1
}
