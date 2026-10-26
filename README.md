# OpsLedger

OpsLedger is a DevOps-focused transaction application built around an Express API, an operations dashboard, and MySQL persistence. The repository also contains a Docker image definition, a Helm chart for Kubernetes, Jenkins pipeline entry-point configuration, and Terraform documentation and infrastructure code for AWS.


## Features

- **Operations dashboard:** Shows API and database status, application version, environment, release identifier, process uptime, transaction count, and the total of recorded transactions.
- **Transaction API:** Create, list, retrieve, and delete transaction records stored in MySQL.
- **Health checks:** Separate liveness and database-readiness endpoints for local verification and Kubernetes probes.
- **Containerization:** A Node.js 20 Alpine-based image that runs the application as an unprivileged user.
- **Kubernetes packaging:** Helm templates for a Deployment, Service, ConfigMap, and CPU-based Horizontal Pod Autoscaler.
- **Infrastructure as code:** Terraform files and deployment guidance for AWS networking and application infrastructure. Review the module configuration before applying it.
- **CI/CD integration point:** A Jenkinsfile that delegates non-main-branch pipeline decisions to an external Jenkins shared library.

## Repository layout

| Path | Purpose |
| --- | --- |
| `index.js` | Express application, static dashboard hosting, health endpoints, and transaction routes |
| `TransactionService.js` | MySQL connection pool and transaction queries |
| `DbConfig.js` | Default database configuration values; environment variables take precedence |
| `public/` | Dashboard HTML, CSS, and client-side JavaScript |
| `schema/backend.sql` | Database, table, and sample application-user creation script |
| `Dockerfile` | Container image build definition |
| `helm/` | Kubernetes Helm chart and templates |
| `terraform/` | AWS infrastructure code and [`terraform/README.md`](terraform/README.md) deployment guide |
| `Jenkinsfile` | Jenkins shared-library integration point |
| `sonar-project.properties` | SonarQube project metadata |
| `package.json`, `package-lock.json` | Node.js dependencies and npm scripts |

## Application and API

The dashboard is served by Express at `/`. It remains available when MySQL is unavailable, but database-backed operations will fail until the database connection is restored.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness information, including service name, uptime, version, environment, and timestamp. Does not require a database query. |
| `GET` | `/ready` | Checks MySQL connectivity; returns `503` when the database is unavailable. |
| `GET` | `/api/status` | Dashboard runtime and database status, including version, release identifier, environment, uptime, and timestamp. |
| `GET` | `/transaction` | Lists transaction records in descending ID order. The records are returned in a `result` array. |
| `POST` | `/transaction` | Creates a transaction from `amount` and `desc`. The amount must be positive and the description must be 1–255 characters. |
| `GET` | `/transaction/:id` | Retrieves one transaction by positive integer ID. |
| `DELETE` | `/transaction/:id` | Deletes one transaction by ID. |
| `DELETE` | `/transaction` | Deletes all transaction records. This is a destructive operation. |

Example request to create a transaction:

```bash
curl -X POST http://localhost:8080/transaction \
  -H 'Content-Type: application/json' \
  -d '{"amount":12.50,"desc":"Local test transaction"}'
```

The request field is named `desc`; records returned by the API use the database column name `description`.

## Run locally

### Requirements

- Node.js 20 or later and npm
- A running MySQL server
- A MySQL account with permissions to create or access the `transactions` database and table

### 1. Prepare the database

Review [`schema/backend.sql`](schema/backend.sql) before executing it. The script creates the `transactions` database and table, and it includes a sample application account and password intended for local development. Replace that sample credential before use. If the account already exists in MySQL, update its password explicitly; `CREATE USER IF NOT EXISTS` does not reset an existing account's password.

After updating the schema and account credentials, run:

```bash
mysql -u root -p < schema/backend.sql
```

### 2. Install dependencies and start the API

Set `DB_PWD` to the password configured for the local application database account:

```bash
npm ci

DB_HOST=127.0.0.1 \
DB_USER=expense \
DB_PWD='your-local-password' \
DB_DATABASE=transactions \
PORT=8080 \
npm start
```

Open [http://localhost:8080](http://localhost:8080) to view the dashboard. Verify the service with:

```bash
curl -i http://localhost:8080/health
curl -i http://localhost:8080/ready
curl -i http://localhost:8080/api/status
```

The dashboard can display a degraded state when MySQL is unavailable. Transaction list, create, lookup, and delete operations require a working database connection.

### Configuration reference

| Variable | Purpose | Default or behavior |
| --- | --- | --- |
| `PORT` | HTTP listen port | `8080` |
| `DB_HOST` | MySQL hostname or address | Must identify a reachable database; the Docker image declares `mysql` as its default host. |
| `DB_USER` | MySQL username | `expense` in `DbConfig.js`, unless overridden by the environment |
| `DB_PWD` | MySQL password | Supply through the environment or a secrets manager; do not commit real credentials. |
| `DB_DATABASE` | Database name | `transactions` in `DbConfig.js`, unless overridden by the environment |
| `APP_VERSION` | Application version displayed in status information | Falls back to the version in `package.json` (`1.5.0` in the reviewed repository) |
| `GIT_COMMIT` | Release identifier displayed by the dashboard | Takes precedence over `BUILD_NUMBER`; falls back to `local` if neither is set |
| `BUILD_NUMBER` | Fallback release identifier | Used when `GIT_COMMIT` is not set |
| `NODE_ENV` | Runtime environment label | `development` when unset |

## Tests

Run the configured test command with:

```bash
npm test
```

The script invokes Node.js's built-in test runner (`node --test`). Test files were not visible in the public repository file listing reviewed for this README, so the presence and coverage of an automated test suite should be verified in the working checkout.

## Run with Docker

Build the image:

```bash
docker build -t opsledger:local .
```

Start the container and connect it to a MySQL instance running on the host:

```bash
docker run --rm -p 8080:8080 \
  -e DB_HOST=host.docker.internal \
  -e DB_USER=expense \
  -e DB_PWD='your-local-password' \
  -e DB_DATABASE=transactions \
  opsledger:local
```

The example assumes `host.docker.internal` resolves to the host from inside Docker, as it does by default in Docker Desktop. On Linux, you may need `--add-host=host.docker.internal:host-gateway`, or use a Docker network and address the database container by its service/container name. The image does **not** include a MySQL server; database configuration must be provided at runtime. The Dockerfile runs Node.js as an unprivileged user and copies the static dashboard into the image.

## Kubernetes with Helm

The chart is located in [`helm/`](helm/). Its templates define a backend Deployment and Service, a ConfigMap, and a Horizontal Pod Autoscaler. The Deployment configures `/health` as its liveness probe and `/ready` as its readiness probe, with CPU and memory requests/limits. The HPA targets 70% average CPU utilization and is configured for 1–10 replicas.

Before installing the chart, review and update the environment-specific values in the chart:

1. **Container image:** `helm/templates/deployment.yaml` hard-codes an ECR image repository. Replace it with the repository that contains your image. Set the image tag through `deployment.imageVersion` in `helm/values.yaml` or the Helm command line.
2. **Database host:** `helm/templates/configmap.yaml` contains a preconfigured `DB_HOST`. Replace it with the endpoint reachable from the Kubernetes cluster.
3. **Database credentials:** The Deployment imports a Secret named `backend` in the `expense` namespace. Create that Secret in the target cluster; do not store real credentials in the chart or repository.
4. **Namespace:** The templates explicitly use the `expense` namespace. Keep the namespace consistent across the release and its Secret.
5. **Cluster prerequisites:** Ensure the cluster can pull from the selected image registry and has metrics support configured for the HPA.

Example commands, after updating the image repository and database host:

```bash
kubectl create namespace expense --dry-run=client -o yaml | kubectl apply -f -

kubectl -n expense create secret generic backend \
  --from-literal=DB_USER=expense \
  --from-literal=DB_PWD='your-database-password' \
  --from-literal=DB_DATABASE=transactions

helm upgrade --install backend ./helm \
  --namespace expense \
  --set deployment.imageVersion=1.5.0
```

Use the actual image tag that you have pushed to the configured registry rather than assuming `1.5.0` is available. The commands above create a Secret only once; update or recreate it using your cluster's normal secret-management process if it already exists. Confirm that the database host value and account permissions match your MySQL deployment.

## AWS infrastructure with Terraform

The [`terraform/README.md`](terraform/README.md) describes a staged AWS setup covering networking, security groups, a bastion host, MySQL/RDS, EKS, certificates, ALB ingress, and ECR. Read that guide and review each module's variables, provider configuration, dependencies, and state configuration before running Terraform.

The checked-in configuration includes environment-specific assumptions, including a local Windows public-key path in the EKS configuration. Review that path along with region/account values, image registry references, network identifiers, database endpoints, cluster settings, and access policies. Replace them with values appropriate to your own environment and use a secure remote state backend before collaborating or managing shared infrastructure.

Terraform provisioning is separate from running the Node.js application and can create billable AWS resources. Start with `terraform plan` in the relevant module directory and inspect the proposed changes before applying them.

## CI/CD integration

The root [`Jenkinsfile`](Jenkinsfile) references a Jenkins shared library named `jenkins-shared-library`. For non-`main` branches, it calls `pipelineDecission.decidePipeline(configMap)` with configuration identifying the Node.js EKS backend project. The `main` branch currently only logs a message in this file; it does not define the full build-and-deploy stages itself.

The shared library, Jenkins credentials, required plugins, and any external quality or artifact services must be configured separately in Jenkins. `sonar-project.properties` supplies SonarQube project metadata, but the repository does not by itself configure a SonarQube server, Nexus, Prometheus, or Grafana. Set `APP_VERSION` and `GIT_COMMIT` in the delivery pipeline so the running dashboard can identify the deployed release.

## Security and deployment notes

- **No built-in authentication or authorization:** The transaction endpoints, including `DELETE /transaction`, should not be exposed to an untrusted network without an appropriate access-control layer.
- **CORS is permissive:** The Express application enables CORS without an origin allowlist. Configure a restrictive policy for deployments that are not local demonstrations.
- **Sample database credential:** Replace the credential embedded in `schema/backend.sql`; never reuse sample credentials in shared or production environments.
- **Do not commit secrets:** Keep database passwords and cloud credentials in environment variables or the platform's secret manager. The Kubernetes `backend` Secret should be created outside source control.
- **Review infrastructure defaults:** The Helm image path, ConfigMap database host, Terraform key path, and AWS-specific settings are environment-dependent and must be reviewed before deployment.

## Project status

OpsLedger demonstrates the integration of a small full-stack service with containerization, Kubernetes packaging, Jenkins integration, and infrastructure-as-code concepts. It should be treated as a development/portfolio project until access control, environment-specific configuration, automated test coverage, and production deployment requirements have been addressed.
