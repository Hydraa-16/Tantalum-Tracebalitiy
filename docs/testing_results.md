# Tantalum Traceability System — Testing Results

## 1. Testing Environment

The system was tested locally using:

- Hyperledger Fabric test-network
- Channel: `mychannel`
- Chaincode: `tantalum-traceability`
- Chaincode Version: `2.0`
- Sequence: `2`
- Backend: Node.js + Express + Fabric Gateway
- Frontend: React + Vite
- Backend URL: `http://localhost:3000`
- Frontend URL: `http://localhost:5173`

The Fabric network consisted of two organizations with role-based identities:

- Mine — Org1
- Smelter — Org1
- Manufacturer — Org2
- Auditor — Org2

## 2. End-to-End Functional Testing

A complete chain-of-custody workflow was tested using batches TB500, TB501, TB600, TB601, and TB602.

| Test | Operation | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| T1 | Create TB500 (100 kg) | Mine creates batch | Batch created successfully | PASS |
| T2 | Create TB501 (100 kg) | Mine creates second batch | Batch created successfully | PASS |
| T3 | Merge TB500 + TB501 into TB600 (200 kg) | Smelter creates merged batch | TB600 created successfully | PASS |
| T4 | Flag TB500 with severity 80, dilutable=true | Auditor records risk flag | Flag recorded successfully | PASS |
| T5 | Query contamination of TB600 | Weighted contamination should propagate | Contamination score = 40 | PASS |
| T6 | Split TB600 into TB601 and TB602 | Smelter creates two child batches | Both child batches created successfully | PASS |
| T7 | Query contamination of TB601 | Child should inherit contamination | Contamination score = 40 | PASS |
| T8 | Record receipt of TB601 | Manufacturer records receipt | Receipt recorded successfully | PASS |


## 3. Role-Based Authorization Testing

The chaincode enforces role-based access control using Fabric CA identity attributes.

| Test | Identity | Attempted Operation | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| T9 | Auditor | CreateBatch | Transaction rejected because only Mine can create batches | Transaction rejected | PASS |
| T10 | Manufacturer | RecordReceipt | Transaction accepted | Receipt recorded successfully | PASS |
| T11 | Auditor | FlagBatch | Transaction accepted | Flag recorded successfully | PASS |
| T12 | Smelter | MergeBatches | Transaction accepted | Merge completed successfully | PASS |
| T13 | Smelter | SplitBatch | Transaction accepted | Split completed successfully | PASS |

## 4. Contamination Propagation Test

The contamination calculation was tested using a weighted parent-child relationship.

TB500 and TB501 were each created with a weight of 100 kg.

TB500 was assigned a contamination flag:

- Severity: 80
- Dilutable: true

TB500 and TB501 were then merged into TB600 with a total weight of 200 kg.

The contamination contribution from TB500 was:

`80 × (100 / 200) = 40`

Therefore:

- TB600 contamination score = **40**
- TB601 contamination score after splitting TB600 = **40**

This confirmed that contamination information is inherited through the batch lineage.

## 5. Test Summary

The end-to-end workflow successfully demonstrated:

- Mine batch creation
- Smelter batch merging
- Auditor risk flagging
- Weighted contamination propagation
- Smelter batch splitting
- Manufacturer receipt recording
- Role-based authorization
- Batch and contamination querying

All tested operations produced the expected results.