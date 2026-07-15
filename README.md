# Ubiquify AWS Pipeline

Terraform pipeline that provisions AWS IAM users, EC2 app servers (staging/production), and optional services — with a web interface on top.

## Web Interface

A Next.js app in [ubiquify_aws_pipeline/](ubiquify_aws_pipeline/) that lets you:

- Add IAM users, pick their group (Admin / Developer / QA), and choose a **temporary** (AWS-generated, reset on first login) or **custom** password per user
- Select which services to create: **EC2** (staging/production), **ECR**, **S3**
- Toggle **Elastic IP** attachment for the EC2 servers
- Watch the live Terraform log, see the resulting details (console URL, server IPs, credentials) in the browser, and have them **emailed** to a recipient

The backend writes `terraform.tfvars.json`, runs `terraform apply` against this repo, reads the outputs, applies custom passwords via the IAM API, and sends the details email over Gmail SMTP.

### Running

Requirements on the host: Node 18+, Terraform, and a `.env` in the repo root:

```
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
MAIL_USERNAME=you@gmail.com
MAIL_PASSWORD=<gmail app password>
# optional: TERRAFORM_BIN=/path/to/terraform
```

```bash
cd ubiquify_aws_pipeline
npm install
npm run build
npm start          # or: PORT=3001 npm start
```

### Deployment

Deployed on 206.189.71.40 (port 3001 behind NGINX, managed by pm2 as `ubiquify`):

```bash
pm2 restart ubiquify        # restart the app
pm2 logs ubiquify           # view logs
```

To redeploy after pushing changes:

```bash
cd /var/www/ubiquify && git pull
cd ubiquify_aws_pipeline && npm install && npm run build && pm2 restart ubiquify
```

## Terraform

Variable-driven config (see [variables.tf](variables.tf)): `users`, `create_ec2`, `environments`, `attach_eip`, `create_ecr`, `create_s3`. Defaults reproduce the original pipeline (3 users, 2 servers with Elastic IPs).

State is stored in the S3 backend (`new-terraform-bucket-1`, ap-south-1). The GitHub Actions workflow in [.github/workflows/terraform.yml](.github/workflows/terraform.yml) applies the **default** variable values — the web app's `terraform.tfvars.json` is gitignored, so a CI run will reset any custom selection made through the UI.
