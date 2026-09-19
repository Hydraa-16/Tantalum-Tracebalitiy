# Project Decisions Reference

## 1. Project Scope

- Project: Blockchain-Based Chain-of-Custody Verification System for Tantalum Traceability
- Mineral used for the project scenario: Tantalum
- All project data is synthetic/simulated.
- The system focuses on traceability, chain-of-custody verification, and contamination/risk propagation.

## 2. Blockchain Platform

**Hyperledger Fabric** was selected as the blockchain platform.

Reasons:

- Permissioned blockchain suitable for known organizations.
- Supports identity management through Certificate Authorities.
- Supports role-based access control.
- Provides an immutable and auditable transaction history.
- Suitable for business-to-business supply-chain workflows.

## 3. Network Organization

The project uses the standard Hyperledger Fabric test-network with two organizations.

Actor roles are not implemented as separate Fabric organizations.

Instead, roles are represented using Fabric CA identity attributes:

- Mine
- Smelter
- Manufacturer
- Auditor

This allows role-based authorization while keeping the network architecture practical.

## 4. Supply Chain Roles

The physical supply-chain flow is:

```text
Mine → Smelter → Manufacturer