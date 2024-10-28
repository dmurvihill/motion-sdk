variable "subscription_name" {
  type = string
}

variable "database_name" {
  type = string
}

variable "users" {
  type = map(string)
  description = "Map of usernames to role names ('admin', 'read-only', or 'test-runner')"

  validation {
    condition = alltrue([ for user, role in var.users : contains(["admin", "read-only", "test-runner"], role) ])
    error_message = "All users must map to one of 'admin', 'read-only', or 'test-runner'"
  }
}
