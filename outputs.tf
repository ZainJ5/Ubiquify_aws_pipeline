data "aws_caller_identity" "current" {}

locals {
  # Prefer the Elastic IP when attached, otherwise the instance public IP
  server_ips = var.attach_eip ? {
    for env, eip in aws_eip.app_eips : env => eip.public_ip
    } : {
    for env, server in aws_instance.app_servers : env => server.public_ip
  }

  console_url = "https://${data.aws_caller_identity.current.account_id}.signin.aws.amazon.com/console"
}

output "console_signin_url" {
  description = "AWS console sign-in URL"
  value       = local.console_url
}

output "server_ips" {
  description = "Public IP address of each environment's server"
  value       = local.server_ips
}

output "ecr_repository_url" {
  description = "URL of the ECR repository (null if not created)"
  value       = var.create_ecr ? aws_ecr_repository.repo[0].repository_url : null
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket (null if not created)"
  value       = var.create_s3 ? aws_s3_bucket.bucket[0].bucket : null
}

output "user_credentials" {
  description = "Temporary console passwords per user"
  sensitive   = true
  value       = { for name, lp in aws_iam_user_login_profile.login : name => lp.password }
}

output "onboarding_details" {
  description = "Environment details and user credentials for the onboarding email"
  sensitive   = true
  value       = join("\n", concat(
    ["Console Sign-in URL: ${local.console_url}", ""],
    [for env, ip in local.server_ips : "${title(env)} Server IP: ${ip}${var.attach_eip ? " (Elastic IP)" : ""}"],
    var.create_ecr ? ["ECR Repository: ${aws_ecr_repository.repo[0].repository_url}"] : [],
    var.create_s3 ? ["S3 Bucket: ${aws_s3_bucket.bucket[0].bucket}"] : [],
    [""],
    [for name, lp in aws_iam_user_login_profile.login : "${name} -> username: ${name} | temporary password: ${lp.password}"],
    ["", "All temporary passwords must be changed on first login."],
  ))
}
