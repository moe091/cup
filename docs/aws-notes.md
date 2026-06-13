# AWS NOTES



#### ECR repos
- API: 755350934435.dkr.ecr.us-east-1.amazonaws.com/cup/api
- Bouncer: 755350934435.dkr.ecr.us-east-1.amazonaws.com/cup/bouncer-server

#### Docker login
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 755350934435.dkr.ecr.us-east-1.amazonaws.com

#### Docker logs (api)
docker-compose -f docker-compose.prod.yml logs api

#### ec2 instance ip / ssh
ssh -i ~/.ssh/cup-ec2.pem ec2-user@54.227.64.244

#### docker startup (.yml is in /home/ec2-user/cup)
docker-compose -f docker-compose.prod.yml up -d

#### pull new docker image (api here)
docker-compose -f docker-compose.prod.yml pull api

#### startup a specific image
docker-compose -f docker-compose.prod.yml up -d api


#### exec docker command(api = container name, node ... = command)y
docker-compose -f docker-compose.prod.yml exec api node node_modules/.bin/prisma migrate deploy



### Data dump
EC2 instance
- Instance ID: i-086d4116b0d6c5848
- Public IP: 54.227.64.244 (⚠️ this changes if you stop/start the instance — more on this below)
- SSH command: ssh -i ~/.ssh/cup-ec2.pem ec2-user@54.227.64.244
- Region: us-east-1

ECR repos
- API: 755350934435.dkr.ecr.us-east-1.amazonaws.com/cup/api
- Bouncer: 755350934435.dkr.ecr.us-east-1.amazonaws.com/cup/bouncer-server

AWS account
- Account ID: 755350934435
- CLI user: moe-admin
