# Optional ECR repository
resource "aws_ecr_repository" "repo" {
  count = var.create_ecr ? 1 : 0

  name         = var.ecr_repo_name
  force_delete = true

  tags = {
    Name = var.ecr_repo_name
  }
}

# Optional S3 bucket (auto-generates a unique name when none is given)
resource "aws_s3_bucket" "bucket" {
  count = var.create_s3 ? 1 : 0

  bucket        = var.s3_bucket_name != "" ? var.s3_bucket_name : null
  bucket_prefix = var.s3_bucket_name == "" ? "ubiquify-app-" : null

  tags = {
    Name = var.s3_bucket_name != "" ? var.s3_bucket_name : "ubiquify-app"
  }
}
