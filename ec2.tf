# Create one server per selected environment
resource "aws_instance" "app_servers" {
  for_each = var.create_ec2 ? toset(var.environments) : toset([])

  ami           = "ami-0b6d9d3d33ba97d99"
  instance_type = "t3.micro"

  vpc_security_group_ids = [aws_security_group.web_ssh_access.id]

  tags = {
    Name        = "App-Server-${title(each.key)}"
    Environment = each.key
  }
}

# Optionally create an Elastic IP for each server and attach it
resource "aws_eip" "app_eips" {
  for_each = { for env, server in aws_instance.app_servers : env => server if var.attach_eip }

  instance = each.value.id
  domain   = "vpc"

  tags = {
    Name        = "EIP-${title(each.key)}"
    Environment = each.key
  }
}
