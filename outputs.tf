output "server_elastic_ips" {
  description = "The Elastic IP addresses of the 2 environments"
  value = {
    for env, eip in aws_eip.app_eips : env => eip.public_ip
  }
}
