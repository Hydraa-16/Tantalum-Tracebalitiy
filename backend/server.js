'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const grpc = require('@grpc/grpc-js');
const {
    connect,
    signers,
} = require('@hyperledger/fabric-gateway');

const app = express();
app.use(express.json());

const channelName = 'mychannel';
const chaincodeName = 'tantalum-traceability';

function getFirstFile(directoryPath) {
    return fs.readdirSync(directoryPath)[0];
}

function createContract(identityName, orgNumber, mspId, peerEndpoint, peerHostAlias) {
    const orgName = `org${orgNumber}.example.com`;

    const cryptoPath = path.resolve(
        __dirname,
        `../../fabric-samples/test-network/organizations/peerOrganizations/${orgName}`
    );

    const userPath = path.join(
        cryptoPath,
        `users/${identityName}@${orgName}/msp`
    );

    const keyDirectoryPath = path.join(userPath, 'keystore');
    const certDirectoryPath = path.join(userPath, 'signcerts');

    const tlsCertPath = path.join(
        cryptoPath,
        `peers/peer0.${orgName}/tls/ca.crt`
    );

    const keyPath = path.join(keyDirectoryPath, getFirstFile(keyDirectoryPath));
    const certPath = path.join(certDirectoryPath, getFirstFile(certDirectoryPath));

    const privateKeyPem = fs.readFileSync(keyPath);
    const certificatePem = fs.readFileSync(certPath);
    const tlsRootCert = fs.readFileSync(tlsCertPath);

    const credentials = grpc.credentials.createSsl(tlsRootCert);

    const client = new grpc.Client(
        peerEndpoint,
        credentials,
        {
            'grpc.ssl_target_name_override': peerHostAlias,
        }
    );

    const signer = signers.newPrivateKeySigner(
        crypto.createPrivateKey(privateKeyPem)
    );

    const gateway = connect({
        client,
        identity: {
            mspId,
            credentials: certificatePem,
        },
        signer,
    });

    const network = gateway.getNetwork(channelName);
    return network.getContract(chaincodeName);
}

const contracts = {
    mine: createContract(
        'Mine',
        1,
        'Org1MSP',
        'localhost:7051',
        'peer0.org1.example.com'
    ),

    smelter: createContract(
        'Smelter',
        1,
        'Org1MSP',
        'localhost:7051',
        'peer0.org1.example.com'
    ),

    manufacturer: createContract(
        'Manufacturer',
        2,
        'Org2MSP',
        'localhost:9051',
        'peer0.org2.example.com'
    ),

    auditor: createContract(
        'Auditor',
        2,
        'Org2MSP',
        'localhost:9051',
        'peer0.org2.example.com'
    ),
};

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        blockchain: 'connected'
    });
});

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Backend API running on http://localhost:${PORT}`);
});

app.post('/api/batches', async (req, res) => {
    try {
        const { batchId, actorId, weight, timestamp } = req.body;

        const result = await contracts.mine.submitTransaction(
            'CreateBatch',
            batchId,
            actorId,
            String(weight),
            timestamp
        );

        res.status(201).json(JSON.parse(Buffer.from(result).toString('utf8')));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/batches/merge', async (req, res) => {
    try {
        const { newBatchId, actorId, totalWeight, parents, timestamp } = req.body;

        const result = await contracts.smelter.submitTransaction(
            'MergeBatches',
            newBatchId,
            actorId,
            String(totalWeight),
            JSON.stringify(parents),
            timestamp
        );

        res.status(201).json(JSON.parse(Buffer.from(result).toString('utf8')));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/batches/split', async (req, res) => {
    try {
        const { parentBatchId, children, timestamp } = req.body;

        const result = await contracts.smelter.submitTransaction(
            'SplitBatch',
            parentBatchId,
            JSON.stringify(children),
            timestamp
        );

        res.status(201).json(JSON.parse(Buffer.from(result).toString('utf8')));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/batches/receipt', async (req, res) => {
    try {
        const { batchId, timestamp } = req.body;

        const result = await contracts.manufacturer.submitTransaction(
            'RecordReceipt',
            batchId,
            timestamp
        );

        res.status(200).json(JSON.parse(Buffer.from(result).toString('utf8')));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/batches/flag', async (req, res) => {
    try {
        const { batchId, flagType, severity, dilutable } = req.body;

        const result = await contracts.auditor.submitTransaction(
            'FlagBatch',
            batchId,
            flagType,
            String(severity),
            String(dilutable)
        );

        res.status(200).json(JSON.parse(Buffer.from(result).toString('utf8')));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/batches/:batchId', async (req, res) => {
    try {
        const result = await contracts.auditor.evaluateTransaction(
            'QueryBatch',
            req.params.batchId
        );

        res.status(200).json(JSON.parse(Buffer.from(result).toString('utf8')));
    } catch (error) {
        console.error(error);
        res.status(404).json({ error: error.message });
    }
});

app.get('/api/batches/:batchId/contamination', async (req, res) => {
    try {
        const result = await contracts.auditor.evaluateTransaction(
            'GetContaminationScore',
            req.params.batchId
        );

        res.status(200).json(JSON.parse(Buffer.from(result).toString('utf8')));
    } catch (error) {
        console.error(error);
        res.status(404).json({ error: error.message });
    }
});
