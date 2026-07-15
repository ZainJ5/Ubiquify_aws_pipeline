# 1. Create the Groups
resource "aws_iam_group" "admin" {
  name = "Admin-Group"
}

resource "aws_iam_group" "developers" {
  name = "Developer-Group"
}

resource "aws_iam_group" "qa" {
  name = "QA-Group"
}

# 2. Attach Appropriate Permissions to Groups
resource "aws_iam_group_policy_attachment" "admin_access" {
  group      = aws_iam_group.admin.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

resource "aws_iam_group_policy_attachment" "developer_access" {
  group      = aws_iam_group.developers.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

resource "aws_iam_group_policy_attachment" "qa_access" {
  group      = aws_iam_group.qa.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

# 3. Create the Users
resource "aws_iam_user" "admin" {
  name = "admin"
}

resource "aws_iam_user" "developer" {
  name = "developer"
}

resource "aws_iam_user" "qa" {
  name = "qa"
}

# 4. Add Users to their respective Groups
resource "aws_iam_user_group_membership" "admin_membership" {
  user   = aws_iam_user.admin.name
  groups = [aws_iam_group.admin.name]
}

resource "aws_iam_user_group_membership" "developer_membership" {
  user   = aws_iam_user.developer.name
  groups = [aws_iam_group.developers.name]
}

resource "aws_iam_user_group_membership" "qa_membership" {
  user   = aws_iam_user.qa.name
  groups = [aws_iam_group.qa.name]
}

# 5. Create temporary console passwords (must be reset on first login)
resource "aws_iam_user_login_profile" "admin" {
  user                    = aws_iam_user.admin.name
  password_reset_required = true
}

resource "aws_iam_user_login_profile" "developer" {
  user                    = aws_iam_user.developer.name
  password_reset_required = true
}

resource "aws_iam_user_login_profile" "qa" {
  user                    = aws_iam_user.qa.name
  password_reset_required = true
}
