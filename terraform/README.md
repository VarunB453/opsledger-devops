# 🏗️ Infrastructure Setup Guide

![Infrastructure Architecture](k8-infra.drawio.svg)

## 📋 Overview

This directory contains the Terraform configurations for setting up the complete cloud infrastructure. The infrastructure is created in a specific sequence to ensure proper dependency management and resource availability.

## 🔧 Components

### Required Components
1. **VPC** (00-vpc/)
   - Multi-AZ setup
   - Public, Private, and DB subnets
   - Internet and NAT Gateways
   - Route tables and associations

2. **Security Groups** (10-sg/)
   - Properly segmented security rules
   - Least privilege access
   - Service-specific ingress/egress rules

3. **Bastion Host** (20-bastion/)
   - Secure jump server for cluster access
   - Used for RDS and EKS management
   - Hardened security configuration

4. **RDS** (30-db/)
   - MySQL database in private subnet
   - Multi-AZ deployment
   - Automated backups
   - Custom parameter groups

5. **EKS** (40-eks/)
   - Managed Kubernetes cluster
   - Auto-scaling node groups
   - OIDC provider configuration
   - Add-ons management

6. **ACM** (50-acm/)
   - SSL/TLS certificates
   - Domain validation
   - Wildcard certificates
   - Auto-renewal setup

7. **ALB Ingress Controller** (60-ingress-alb/)
   - Application Load Balancer
   - SSL termination
   - Path-based routing
   - Health checks

8. **ECR** (70-ecr/)
   - Container registry
   - Image scanning
   - Lifecycle policies
   - Cross-account access

### Optional Components
1. **VPN**
   - Alternative to Bastion host
   - Direct access from Windows laptops
   - Secure connection to private resources

2. **CloudFront CDN**
   - Global content delivery
   - Edge caching
   - HTTPS enforcement
   - Custom domain support

## 🚀 Deployment Sequence

### 1. VPC Setup (Required)
```bash
cd 00-vpc
terraform init
terraform plan
terraform apply
```

### 2. Security Groups (Required)
```bash
cd ../10-sg
terraform init
terraform plan
terraform apply
```

### 3. Bastion Host (Required)
```bash
cd ../20-bastion
terraform init
terraform plan
terraform apply
```

### 4. Database (Required)
```bash
cd ../30-db
terraform init
terraform plan
terraform apply
```

### 5. EKS Cluster (Required)
```bash
cd ../40-eks
terraform init
terraform plan
terraform apply
```

### 6. SSL Certificates (Required)
```bash
cd ../50-acm
terraform init
terraform plan
terraform apply
```

### 7. Ingress Controller (Required)
```bash
cd ../60-ingress-alb
terraform init
terraform plan
terraform apply
```

### 8. Container Registry (Required)
```bash
cd ../70-ecr
terraform init
terraform plan
terraform apply
```

## 🛠️ Administrative Tasks

### Bastion Host Access
1. SSH to bastion:
   ```bash
   ssh -i "path/to/key.pem" ubuntu@<bastion-public-ip>
   ```

2. Configure AWS CLI:
   ```bash
   aws configure
   # Enter your AWS credentials when prompted
   ```

3. Configure kubectl:
   ```bash
   aws eks update-kubeconfig --region us-east-1 --name <cluster-name>
   ```

4. Verify cluster access:
   ```bash
   kubectl get nodes
   ```

### Database Management
1. Connect to RDS through bastion:
   ```bash
   mysql -h <db-r53-address> -u root -p
   ```
   Enter the master password managed by AWS Secrets Manager when prompted. The backend
   deployment expects `DB_PWD` in the Kubernetes Secret named `backend` in the `expense`
   namespace; keep that secret out of source control.

2. Initialize database:
   - Schema is created during RDS provisioning
   - Execute backend.sql for:
     - Table creation
     - User setup
     - Privilege configuration

### Ingress Controller Setup

1. Create OIDC provider:
   ```bash
   eksctl utils associate-iam-oidc-provider \
     --region us-east-1 \
     --cluster <cluster-name> \
     --approve
   ```

2. Download IAM policy:
   ```bash
   curl -o iam-policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.8.1/docs/install/iam_policy.json
   ```

3. Create IAM policy:
   ```bash
   aws iam create-policy \
     --policy-name AWSLoadBalancerControllerIAMPolicy \
     --policy-document file://iam-policy.json
   ```

4. Create service account:
   ```bash
   eksctl create iamserviceaccount \
     --cluster=<cluster-name> \
     --namespace=kube-system \
     --name=aws-load-balancer-controller \
     --attach-policy-arn=arn:aws:iam::<AWS_ACCOUNT_ID>:policy/AWSLoadBalancerControllerIAMPolicy \
     --override-existing-serviceaccounts \
     --approve
   ```

5. Install Load Balancer Controller:
   ```bash
   # Add Helm repo
   helm repo add eks https://aws.github.io/eks-charts

   # Install controller
   helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
     -n kube-system \
     --set clusterName=<cluster-name> \
     --set serviceAccount.create=false \
     --set serviceAccount.name=aws-load-balancer-controller
   ```

6. Verify installation:
   ```bash
   kubectl get pods -n kube-system | grep aws-load-balancer-controller
   ```

## 📝 Notes
- Always follow the deployment sequence to avoid dependency issues
- Back up Terraform state files regularly
- Use consistent tagging for resources
- Monitor costs and resource usage
- Keep security groups and access rules updated
- Regularly rotate credentials and keys
