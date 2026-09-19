# Tantalum Traceability System — Project Progress

## Development Progress

### Phase 1 — Environment Setup
- Set up the development environment on macOS Apple Silicon.
- Installed and verified Docker Desktop, Git, Node.js 18, Go, jq, and Visual Studio Code.
- Installed Hyperledger Fabric samples, binaries, and Docker images.

### Phase 2 — Hyperledger Fabric Network
- Set up the Hyperledger Fabric test-network.
- Configured the network to use Certificate Authorities.
- Started Org1, Org2, Orderer, and CA services.
- Created and verified the `mychannel` application channel.

### Phase 3 — Project Structure
- Created the Tantalum Traceability project repository.
- Created separate directories for:
  - Backend
  - Chaincode
  - Frontend
  - Documentation
- Initialized Git repository and connected it to GitHub.

### Phase 4 — Identity and Role Setup
- Created Fabric CA identities for the required project roles.
- Configured role attributes for:
  - Mine
  - Smelter
  - Manufacturer
  - Auditor
- Verified the role attributes in the enrolled certificates.

### Phase 5 — Smart Contract Development
- Implemented the Tantalum traceability chaincode.
- Implemented batch creation, merging, splitting, receipt recording, flagging, querying, and contamination-score calculation.
- Added role-based authorization checks.
- Implemented weighted parent-child batch relationships.
- Implemented recursive contamination propagation.

### Phase 6 — Chaincode Deployment
- Packaged and deployed the `tantalum-traceability` chaincode.
- Deployed Version 2.0 with Sequence 2 on `mychannel`.
- Verified the chaincode installation and approval on the required organizations.

### Phase 7 — Backend Development
- Developed the REST backend using Node.js and Express.
- Integrated the backend with Hyperledger Fabric using the Fabric Gateway SDK.
- Implemented role-specific blockchain interactions.
- Added REST endpoints for batch creation, merging, splitting, receipt recording, flagging, querying, and contamination verification.
- Verified the backend health endpoint and blockchain connectivity.

### Phase 8 — Frontend Development
- Developed the frontend using React and Vite.
- Added interfaces for:
  - Batch verification
  - Mine batch creation
  - Smelter merging
  - Smelter splitting
  - Manufacturer receipt
  - Auditor flagging
- Added contamination score and risk-level display.
- Connected the frontend to the backend REST API.

### Phase 9 — End-to-End Testing
- Tested the complete Mine → Smelter → Manufacturer chain-of-custody workflow.
- Verified weighted contamination propagation through merge and split operations.
- Verified manufacturer receipt recording.
- Tested role-based authorization and unauthorized operations.
- Documented the testing results in `testing_results.md`.

### Phase 10 — Documentation
- Created the project setup documentation.
- Created the testing results documentation.
- Created the project progress documentation.
- Prepared the project for final submission and demonstration.