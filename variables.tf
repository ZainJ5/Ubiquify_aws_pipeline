variable "users" {
  description = "IAM users to create. Each user is placed in one of the predefined groups: admin, developers, qa. Custom passwords are applied by the web app after apply."
  type = list(object({
    name  = string
    group = string
  }))
  default = [
    { name = "admin", group = "admin" },
    { name = "developer", group = "developers" },
    { name = "qa", group = "qa" },
  ]

  validation {
    condition     = alltrue([for u in var.users : contains(["admin", "developers", "qa"], u.group)])
    error_message = "Each user's group must be one of: admin, developers, qa."
  }
}

variable "create_ec2" {
  description = "Whether to create the EC2 app servers"
  type        = bool
  default     = true
}

variable "environments" {
  description = "Environments to create an EC2 server for"
  type        = list(string)
  default     = ["staging", "production"]
}

variable "attach_eip" {
  description = "Whether to allocate and attach an Elastic IP to each EC2 server"
  type        = bool
  default     = true
}

variable "create_ecr" {
  description = "Whether to create an ECR repository"
  type        = bool
  default     = false
}

variable "ecr_repo_name" {
  description = "Name of the ECR repository"
  type        = string
  default     = "app-repo"
}

variable "create_s3" {
  description = "Whether to create an S3 bucket"
  type        = bool
  default     = false
}

variable "s3_bucket_name" {
  description = "Name of the S3 bucket. Leave empty to auto-generate a unique name."
  type        = string
  default     = ""
}
