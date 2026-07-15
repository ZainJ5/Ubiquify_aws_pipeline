data "aws_caller_identity" "current" {}

# SNS topic that emails the environment details
resource "aws_sns_topic" "onboarding" {
  name = "environment-onboarding"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.onboarding.arn
  protocol  = "email"
  endpoint  = "zainjamshaid55@gmail.com"
}

# Write the details to a file, then publish it to the topic
resource "local_sensitive_file" "details" {
  filename = "${path.module}/onboarding-details.txt"
  content  = <<EOT
Console Sign-in URL: https://${data.aws_caller_identity.current.account_id}.signin.aws.amazon.com/console

Staging Server IP:    ${aws_eip.app_eips["staging"].public_ip}
Production Server IP: ${aws_eip.app_eips["production"].public_ip}

Admin     -> username: ${aws_iam_user.admin.name}     | temporary password: ${aws_iam_user_login_profile.admin.password}
Developer -> username: ${aws_iam_user.developer.name} | temporary password: ${aws_iam_user_login_profile.developer.password}
QA        -> username: ${aws_iam_user.qa.name}        | temporary password: ${aws_iam_user_login_profile.qa.password}

All passwords must be changed on first login.
EOT
}

resource "null_resource" "send_email" {
  triggers = {
    details = sha256(local_sensitive_file.details.content)
  }

  provisioner "local-exec" {
    command = "aws sns publish --topic-arn ${aws_sns_topic.onboarding.arn} --subject 'AWS Environment Details' --message file://${local_sensitive_file.details.filename}"
  }

  depends_on = [aws_sns_topic_subscription.email]
}
