data "aws_caller_identity" "current" {}

output "server_elastic_ips" {
  description = "The Elastic IP addresses of the 2 environments"
  value = {
    for env, eip in aws_eip.app_eips : env => eip.public_ip
  }
}

output "onboarding_details" {
  description = "Environment details and user credentials for the onboarding email"
  sensitive   = true
  value       = <<EOT
Console Sign-in URL: https://${data.aws_caller_identity.current.account_id}.signin.aws.amazon.com/console

Staging Server IP:    ${aws_eip.app_eips["staging"].public_ip}
Production Server IP: ${aws_eip.app_eips["production"].public_ip}

Admin     -> username: ${aws_iam_user.admin.name}     | temporary password: ${aws_iam_user_login_profile.admin.password}
Developer -> username: ${aws_iam_user.developer.name} | temporary password: ${aws_iam_user_login_profile.developer.password}
QA        -> username: ${aws_iam_user.qa.name}        | temporary password: ${aws_iam_user_login_profile.qa.password}

All passwords must be changed on first login.
EOT
}
