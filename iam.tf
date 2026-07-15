# Predefined groups and their permission levels
locals {
  groups = {
    admin      = { name = "Admin-Group", policy = "arn:aws:iam::aws:policy/AdministratorAccess" }
    developers = { name = "Developer-Group", policy = "arn:aws:iam::aws:policy/PowerUserAccess" }
    qa         = { name = "QA-Group", policy = "arn:aws:iam::aws:policy/ReadOnlyAccess" }
  }

  users_by_name = { for u in var.users : u.name => u }
}

# 1. Create the Groups
resource "aws_iam_group" "groups" {
  for_each = local.groups
  name     = each.value.name
}

# 2. Attach Appropriate Permissions to Groups
resource "aws_iam_group_policy_attachment" "access" {
  for_each   = local.groups
  group      = aws_iam_group.groups[each.key].name
  policy_arn = each.value.policy
}

# 3. Create the Users
resource "aws_iam_user" "users" {
  for_each = local.users_by_name
  name     = each.key
}

# 4. Add Users to their respective Groups
resource "aws_iam_user_group_membership" "membership" {
  for_each = local.users_by_name
  user     = aws_iam_user.users[each.key].name
  groups   = [aws_iam_group.groups[each.value.group].name]
}

# 5. Create temporary console passwords (must be reset on first login).
# Users who chose a custom password get it applied by the web app right
# after apply, replacing the generated one.
resource "aws_iam_user_login_profile" "login" {
  for_each                = local.users_by_name
  user                    = aws_iam_user.users[each.key].name
  password_reset_required = true

  lifecycle {
    ignore_changes = [password_reset_required]
  }
}
