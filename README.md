<div align="center">

# OpsLedger

### Track transactions. Observe the system. Ship with confidence.

A DevOps-minded transaction app that brings an Express API, a live operations dashboard, and MySQL together—with Docker, Helm, Jenkins integration, and Terraform for the journey from laptop to AWS.

<br />

<<<<<<< HEAD
![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/API-Express-222222?logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/Data-MySQL-4479A1?logo=mysql&logoColor=white)
![Docker](https://img.shields.io/badge/Containers-Docker-2496ED?logo=docker&logoColor=white)
![Helm](https://img.shields.io/badge/Kubernetes-Helm-0F1689?logo=helm&logoColor=white)
![Terraform](https://img.shields.io/badge/Infrastructure-Terraform-844FBA?logo=terraform&logoColor=white)
=======
- **Operations dashboard:** Shows API and database status, application version, environment, release identifier, process uptime, transaction count, and the total of recorded transactions.
- **Transaction management:** Create, list, retrieve, edit, and delete transaction records stored in MySQL.
- **Health checks:** Separate liveness and database-readiness endpoints for local verification and Kubernetes probes.
- **Containerization:** A Node.js 20 Alpine-based image that runs the application as an unprivileged user.
- **Kubernetes packaging:** Helm templates for a Deployment, Service, ConfigMap, and CPU-based Horizontal Pod Autoscaler.
- **Infrastructure as code:** Terraform files and deployment guidance for AWS networking and application infrastructure. Review the module configuration before applying it.
- **CI/CD integration point:** A Jenkinsfile that delegates non-main-branch pipeline decisions to an external Jenkins shared library.
>>>>>>> 596854d (Update README.md to enhance transaction management section and add local development instructions; modify styles.css for improved action cell layout and new edit row styles.)

**A hands-on portfolio project for exploring application delivery and operational visibility.**

</div>

---

## 🧭 Welcome to the Ops Room

OpsLedger is a small transaction service with an operations-first mindset. Open the dashboard at `/` to check application and database health, see release details and uptime, and manage transaction records.

The repository also contains the building blocks for containerization, Kubernetes packaging, and AWS infrastructure. Some delivery components depend on external tools and configuration; this README marks those boundaries instead of pretending everything is turnkey.

> **Project status:** Portfolio / learning project. Authentication and authorization are not implemented. Review the security and environment-specific settings before exposing the app to a network or provisioning cloud infrastructure.

## ✨ What’s inside?

| Area | What it does |
| --- | --- |
| 🖥️ **Operations dashboard** | Displays service and database status, runtime version, environment, release identity, uptime, transaction count, and total transaction amount. |
| 🔌 **Express API** | Provides health checks and endpoints to create, list, retrieve, and delete transactions. |
| 🗄️ **MySQL persistence** | Stores transaction records through a database connection pool. |
| 📦 **Docker** | Packages the app and static dashboard in a Node.js 20 Alpine image that runs as an unprivileged user. |
| ☸️ **Helm & Kubernetes** | Includes Deployment, Service, ConfigMap, and CPU-based Horizontal Pod Autoscaler templates. |
| 🏗️ **Terraform & AWS** | Includes infrastructure code and guidance for networking, security groups, bastion access, database, EKS, certificates, ingress, and ECR. |
| 🛠️ **Jenkins integration** | Provides a pipeline entry point that relies on an external Jenkins shared library for non-`main` branch decisions. |

## 🗺️ How the pieces connect

```mermaid
flowchart TD
    U[Browser / API client] --> APP[Express application]
    APP --> UI[Static operations dashboard]
    APP --> HEALTH[Health and status endpoints]
    APP --> ROUTES[Transaction endpoints]
    ROUTES --> SVC[Transaction service]
    SVC --> DB[(MySQL database)]

<<<<<<< HEAD
    DOCKER[Docker image] -. packages .-> APP
    HELM[Helm chart] -. deploys to .-> K8S[Kubernetes / EKS]
    K8S --> APP
    TF[Terraform] -. provisions infrastructure for .-> K8S
    JENKINS[Jenkinsfile] -. delegates pipeline decisions to .-> LIB[External shared library]
=======
| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness information, including service name, uptime, version, environment, and timestamp. Does not require a database query. |
| `GET` | `/ready` | Checks MySQL connectivity; returns `503` when the database is unavailable. |
| `GET` | `/api/status` | Dashboard runtime and database status, including version, release identifier, environment, uptime, and timestamp. |
| `GET` | `/transaction` | Lists transaction records in descending ID order. The records are returned in a `result` array. |
| `POST` | `/transaction` | Creates a transaction from `amount` and `desc`. The amount must be positive and the description must be 1–255 characters. |
| `GET` | `/transaction/:id` | Retrieves one transaction by positive integer ID. |
| `PUT` | `/transaction/:id` | Updates a transaction from `amount` and `desc`, using the same validation as create. |
| `DELETE` | `/transaction/:id` | Deletes one transaction by ID. |
| `DELETE` | `/transaction` | Deletes all transaction records. This is a destructive operation. |
>>>>>>> 596854d (Update README.md to enhance transaction management section and add local development instructions; modify styles.css for improved action cell layout and new edit row styles.)

    classDef app fill:#e0f2fe,stroke:#0284c7,color:#0c4a6e;
    classDef data fill:#dcfce7,stroke:#16a34a,color:#14532d;
    classDef ops fill:#f3e8ff,stroke:#9333ea,color:#581c87;
    class APP,UI,HEALTH,ROUTES,SVC app;
    class DB data;
    class DOCKER,HELM,K8S,TF,JENKINS,LIB ops;
```

*The infrastructure and CI/CD resources are configuration and integration points; successful deployment depends on configuring the target environment and external services.*

## 🚀 Get it running locally

<<<<<<< HEAD
### Prerequisites
=======
### Start the complete local stack

For local development on Linux with Docker Compose, build and start the API and MySQL database together:

```bash
docker compose up --build
```

Open [http://localhost:8080](http://localhost:8080). The database is initialized from `schema/backend.sql` on its first start, and records persist in a Docker volume. Stop the services with `Ctrl+C`; run `docker compose down` to remove the containers while keeping data, or `docker compose down -v` to also delete the database volume.

This Compose configuration is for local development only: it uses a sample database credential and Linux host networking for MySQL. The application has no built-in authentication, so do not expose it or reuse these credentials in a shared or production environment.

### Requirements
>>>>>>> 596854d (Update README.md to enhance transaction management section and add local development instructions; modify styles.css for improved action cell layout and new edit row styles.)

- Node.js 20 or later and npm
- A reachable MySQL server
- A MySQL account that can access the `transactions` database and table

### 1. Prepare the database

Review [`schema/backend.sql`](schema/backend.sql) before running it. It creates the `transactions` database and table and includes a sample application account for local development. Replace the sample credential before use, and do not reuse it in a shared or production environment.

```bash
mysql -u root -p < schema/backend.sql
```

If the MySQL account already exists, update its password explicitly: `CREATE USER IF NOT EXISTS` does not reset the password of an existing account.

### 2. Install and start OpsLedger

Set `DB_PWD` to the password configured for your local database user:

```bash
npm ci

DB_HOST=127.0.0.1 \
DB_USER=expense \
DB_PWD='your-local-password' \
DB_DATABASE=transactions \
PORT=8080 \
npm start
```

Open **[http://localhost:8080](http://localhost:8080)** and enter the Ops Room.

Check the service endpoints:

```bash
curl -i http://localhost:8080/health
curl -i http://localhost:8080/ready
curl -i http://localhost:8080/api/status
```

The dashboard can still load when MySQL is unavailable and indicate a degraded database state. Database-backed transaction operations require a working database connection.

## 🛰️ API field guide

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness information, including service name, uptime, version, environment, and timestamp; does not require a database query. |
| `GET` | `/ready` | Checks MySQL connectivity; returns `503` when the database is unavailable. |
| `GET` | `/api/status` | Returns dashboard runtime information and database status. |
| `GET` | `/transaction` | Lists transaction records in descending ID order; records are returned in a `result` array. |
| `POST` | `/transaction` | Creates a transaction using `amount` and `desc`. Amount must be positive; description must contain 1–255 characters. |
| `GET` | `/transaction/:id` | Retrieves a transaction by positive integer ID. |
| `DELETE` | `/transaction/:id` | Deletes one transaction by ID. |
| `DELETE` | `/transaction` | Deletes all transaction records. **Destructive operation.** |

### Try a transaction

```bash
curl -X POST http://localhost:8080/transaction \
  -H 'Content-Type: application/json' \
  -d '{"amount":12.50,"desc":"First OpsLedger test"}'
```

The create request uses `desc`; records returned by the API use the database column name `description`.

## ⚙️ Configuration dashboard

| Variable | Purpose | Behavior |
| --- | --- | --- |
| `PORT` | HTTP listen port | Defaults to `8080`. |
| `DB_HOST` | MySQL hostname or address | Must resolve to a reachable database. The Docker image declares `mysql` as its default host. |
| `DB_USER` | MySQL username | Defaults to `expense` in `DbConfig.js`, unless overridden. |
| `DB_PWD` | MySQL password | Supply at runtime or through a secrets manager; do not commit real credentials. |
| `DB_DATABASE` | Database name | Defaults to `transactions` in `DbConfig.js`, unless overridden. |
| `APP_VERSION` | Application version shown in status details | Falls back to the version in `package.json` (`1.5.0` in the reviewed repository). |
| `GIT_COMMIT` | Release identifier | Takes precedence over `BUILD_NUMBER`; falls back to `local` if neither is set. |
| `BUILD_NUMBER` | Fallback release identifier | Used when `GIT_COMMIT` is not set. |
| `NODE_ENV` | Runtime environment label | Defaults to `development`. |

## 🧪 Tests

Run the configured Node.js test command:

```bash
npm test
```

This invokes Node.js's built-in test runner (`node --test`). Automated test files and coverage should be verified in the working checkout before treating the test suite as a release gate.

## 🐳 Launch it in Docker

Build the image:

```bash
docker build -t opsledger:local .
```

Run it with a MySQL instance accessible from the container:

```bash
docker run --rm -p 8080:8080 \
  -e DB_HOST=host.docker.internal \
  -e DB_USER=expense \
  -e DB_PWD='your-local-password' \
  -e DB_DATABASE=transactions \
  opsledger:local
```

The example assumes `host.docker.internal` resolves to the host from inside Docker, as it normally does in Docker Desktop. On Linux, you may need `--add-host=host.docker.internal:host-gateway`, or use a Docker network and connect to the database container by its service/container name.

**Heads-up:** The image packages the application, not a MySQL server. Provide database connectivity and credentials at runtime; never bake secrets into the image.

## ☸️ Take it to Kubernetes with Helm

The chart lives in [`helm/`](helm/) and includes a backend Deployment and Service, a ConfigMap, and a CPU-based Horizontal Pod Autoscaler. The Deployment configures `/health` for liveness and `/ready` for readiness, sets resource requests and limits, and the HPA targets 70% average CPU utilization across a configured range of 1–10 replicas.

Before installing, review these environment-specific values:

1. **Image repository:** `helm/templates/deployment.yaml` currently hard-codes an ECR image repository. Replace it with your registry path.
2. **Image tag:** Set `deployment.imageVersion` in `helm/values.yaml` or with Helm's `--set` option.
3. **Database host:** Update the `DB_HOST` value in `helm/templates/configmap.yaml` to the endpoint reachable from the cluster.
4. **Credentials:** The Deployment expects a Secret named `backend` in the `expense` namespace. Create it outside source control.
5. **Cluster readiness:** Ensure the cluster can pull the image and has metrics support available for the HPA.

Example, after updating the chart for your environment and pushing the image:

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

Use the tag you actually pushed to the registry. The Secret command above creates the Secret if it does not exist; handle updates according to your cluster's secret-management process. Confirm that the database account, host, and permissions match the target environment.

## ☁️ AWS infrastructure with Terraform

The [`terraform/README.md`](terraform/README.md) describes a staged AWS setup that includes networking, security groups, a bastion, a database, EKS, certificates, ingress, and ECR.

Before provisioning, inspect provider configuration, variables, dependencies, network identifiers, region/account assumptions, access policies, database endpoints, and state configuration. The checked-in EKS configuration includes a machine-specific Windows public-key path; replace it with a valid path for your environment. For collaborative infrastructure work, configure an appropriate secure remote state backend.

Terraform provisioning is separate from running the application and may create billable AWS resources. Review the plan in the relevant module directory before applying changes.

## 🔄 CI/CD: what is wired in?

The root [`Jenkinsfile`](Jenkinsfile) references an external Jenkins shared library named `jenkins-shared-library`. Non-`main` branches delegate pipeline decisions to that library. The current `main` branch path only logs a message; this repository does not contain the complete build-and-deploy pipeline implementation.

The shared library, Jenkins credentials, plugins, and external services must be configured in Jenkins separately. `sonar-project.properties` provides SonarQube project metadata, but the repository does not itself configure SonarQube, Nexus, Prometheus, or Grafana. Set `APP_VERSION` and `GIT_COMMIT` in the pipeline to display useful release identity in the dashboard.

## 🔐 Before going beyond local development

- **Add access control.** Authentication and authorization are not implemented. Transaction endpoints—including `DELETE /transaction`—must not be exposed to untrusted users without an appropriate access-control layer.
- **Restrict CORS.** The Express app currently enables CORS without an origin allowlist. Configure a policy appropriate to your deployment.
- **Replace sample credentials.** Update the example database account in `schema/backend.sql`; never reuse its sample password in shared environments.
- **Keep secrets out of Git.** Use runtime environment variables or a secret manager for passwords and cloud credentials.
- **Review deployment defaults.** Update the Helm image path and database host, Terraform key path, and AWS-specific values before deploying.

## 🧰 Repository map

| Path | Purpose |
| --- | --- |
| `index.js` | Express application, static dashboard hosting, health endpoints, and transaction routes |
| `TransactionService.js` | MySQL connection pool and transaction queries |
| `DbConfig.js` | Default database configuration values; environment variables take precedence |
| `public/` | Dashboard HTML, CSS, and client-side JavaScript |
| `schema/backend.sql` | Database, table, and sample application-user creation script |
| `Dockerfile` | Container image build definition |
| `helm/` | Kubernetes Helm chart and templates |
| `terraform/` | AWS infrastructure code and deployment guide |
| `Jenkinsfile` | Jenkins shared-library integration point |
| `sonar-project.properties` | SonarQube project metadata |
| `package.json`, `package-lock.json` | Node.js dependencies and npm scripts |

## 🎯 The mission

OpsLedger brings application development and DevOps practices into one place: build a service, observe its health, package it, describe its infrastructure, and connect it to a delivery pipeline. It is a foundation for experimentation—not a claim that every cloud resource or external integration is ready out of the box.

**Build thoughtfully. Ship safely. Keep the system observable.**

<div align="center">

Made for learning, building, and improving one deployment at a time.

</div>
