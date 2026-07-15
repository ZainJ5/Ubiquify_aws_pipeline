# State moves so the refactor from hardcoded resources to for_each
# does not destroy and recreate the existing infrastructure.

moved {
  from = aws_iam_group.admin
  to   = aws_iam_group.groups["admin"]
}

moved {
  from = aws_iam_group.developers
  to   = aws_iam_group.groups["developers"]
}

moved {
  from = aws_iam_group.qa
  to   = aws_iam_group.groups["qa"]
}

moved {
  from = aws_iam_group_policy_attachment.admin_access
  to   = aws_iam_group_policy_attachment.access["admin"]
}

moved {
  from = aws_iam_group_policy_attachment.developer_access
  to   = aws_iam_group_policy_attachment.access["developers"]
}

moved {
  from = aws_iam_group_policy_attachment.qa_access
  to   = aws_iam_group_policy_attachment.access["qa"]
}

moved {
  from = aws_iam_user.admin
  to   = aws_iam_user.users["admin"]
}

moved {
  from = aws_iam_user.developer
  to   = aws_iam_user.users["developer"]
}

moved {
  from = aws_iam_user.qa
  to   = aws_iam_user.users["qa"]
}

moved {
  from = aws_iam_user_group_membership.admin_membership
  to   = aws_iam_user_group_membership.membership["admin"]
}

moved {
  from = aws_iam_user_group_membership.developer_membership
  to   = aws_iam_user_group_membership.membership["developer"]
}

moved {
  from = aws_iam_user_group_membership.qa_membership
  to   = aws_iam_user_group_membership.membership["qa"]
}

moved {
  from = aws_iam_user_login_profile.admin
  to   = aws_iam_user_login_profile.login["admin"]
}

moved {
  from = aws_iam_user_login_profile.developer
  to   = aws_iam_user_login_profile.login["developer"]
}

moved {
  from = aws_iam_user_login_profile.qa
  to   = aws_iam_user_login_profile.login["qa"]
}
