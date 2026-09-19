# Tantalum Traceability System — Setup Guide

## 1. Prerequisites

The project was developed and tested on macOS using Apple Silicon.

Required software:

- Homebrew
- Docker Desktop
- Git
- Node.js 18
- npm
- Go
- jq
- Visual Studio Code

Verify the installations:

```bash
brew --version
docker --version
git --version
node --version
npm --version
go version
jq --version
code --version



Then paste:

```markdown
## 2. Hyperledger Fabric Setup

The project uses Hyperledger Fabric's test-network with Certificate Authorities (CA).

The Fabric samples, binaries, and Docker images were installed before setting up the project.

Enter the Fabric test network:

```bash
cd ~/projects/fabric-samples/test-network


## 3. Project Repository

The project repository is located at:

```text
~/projects/tantalum-traceability

## 4. Chaincode

The custom chaincode implements the following operations:

- CreateBatch
- MergeBatches
- SplitBatch
- RecordReceipt
- FlagBatch
- QueryBatch
- GetContaminationScore

The deployed chaincode configuration is:

```text
Channel: mychannel
Chaincode: tantalum-traceability
Version: 2.0
Sequence: 2

## 5. Backend

The backend is implemented using Node.js, Express, and the Hyperledger Fabric Gateway SDK.

Enter the backend directory:

```bash
cd ~/projects/tantalum-traceability/backend

## 6. Frontend

The frontend is implemented using React and Vite.

Enter the frontend directory:

```bash
cd ~/projects/tantalum-traceability/frontend


## 7. Running the Complete System

The complete system requires:

1. Docker Desktop running.
2. The Hyperledger Fabric network running.
3. The backend running on port 3000.
4. The frontend running on port 5173.

Open the frontend in a web browser:

```text
http://localhost:5173