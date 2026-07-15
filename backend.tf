terraform {
  backend "s3" {
    bucket = "new-terraform-bucket-1"
    key    = "prod/terraform.tfstate"
    region = "ap-south-1"
  }
}