'use strict';

const { Contract } = require('fabric-contract-api');

class BatchContract extends Contract {

    _checkRole(ctx, requiredRole) {
        const role = ctx.clientIdentity.getAttributeValue('role');

        if (role !== requiredRole) {
            throw new Error(
                `Access denied: this action requires role '${requiredRole}', caller has role '${role}'`
            );
        }
    }

    async CreateBatch(ctx, batchId, actorId, weight, timestamp) {
        this._checkRole(ctx, 'mine');

        const existing = await ctx.stub.getState(batchId);
        if (existing && existing.length > 0) {
            throw new Error(`Batch ${batchId} already exists`);
        }

        const batch = {
            batchId,
            actorId,
            action: 'extract',
            weight: Number(weight),
            parents: [],
            flags: [],
            timestamp,
            signature: ctx.stub.getTxID()
        };

        await ctx.stub.putState(
            batchId,
            Buffer.from(JSON.stringify(batch))
        );

        return JSON.stringify(batch);
    }

    async MergeBatches(ctx, newBatchId, actorId, totalWeight, parents, timestamp) {
        this._checkRole(ctx, 'smelter');

        const existing = await ctx.stub.getState(newBatchId);
        if (existing && existing.length > 0) {
            throw new Error(`Batch ${newBatchId} already exists`);
        }

        const parentList = JSON.parse(parents);

        if (!Array.isArray(parentList) || parentList.length === 0) {
            throw new Error('At least one parent batch is required');
        }

        for (const parent of parentList) {
            const parentData = await ctx.stub.getState(parent.parentBatchId);

            if (!parentData || parentData.length === 0) {
                throw new Error(`Parent batch ${parent.parentBatchId} does not exist`);
            }
        }

        const batch = {
            batchId: newBatchId,
            actorId,
            action: 'merge',
            weight: Number(totalWeight),
            parents: parentList,
            flags: [],
            timestamp,
            signature: ctx.stub.getTxID()
        };

        await ctx.stub.putState(
            newBatchId,
            Buffer.from(JSON.stringify(batch))
        );

        return JSON.stringify(batch);
    }


    async SplitBatch(ctx, parentBatchId, childBatches, timestamp) {
        this._checkRole(ctx, 'smelter');

        const parentData = await ctx.stub.getState(parentBatchId);

        if (!parentData || parentData.length === 0) {
            throw new Error(`Parent batch ${parentBatchId} does not exist`);
        }

        const parentBatch = JSON.parse(parentData.toString());
        const children = JSON.parse(childBatches);

        if (!Array.isArray(children) || children.length === 0) {
            throw new Error('At least one child batch is required');
        }

        for (const child of children) {
            const existing = await ctx.stub.getState(child.batchId);

            if (existing && existing.length > 0) {
                throw new Error(`Batch ${child.batchId} already exists`);
            }
        }

        for (const child of children) {
            const batch = {
                batchId: child.batchId,
                actorId: child.actorId,
                action: 'split',
                weight: Number(child.weight),
                parents: [
                    {
                        parentBatchId: parentBatchId,
                        weightContributed: Number(child.weight)
                    }
                ],
                flags: [],
                timestamp,
                signature: ctx.stub.getTxID()
            };

            await ctx.stub.putState(
                child.batchId,
                Buffer.from(JSON.stringify(batch))
            );
        }

        return JSON.stringify(children);
    }


    async RecordReceipt(ctx, batchId, timestamp) {
        this._checkRole(ctx, 'manufacturer');

        const batchJSON = await ctx.stub.getState(batchId);

        if (!batchJSON || batchJSON.length === 0) {
            throw new Error(`Batch ${batchId} does not exist`);
        }

        const batch = JSON.parse(batchJSON.toString());

        batch.receivedBy = ctx.clientIdentity.getID();
        batch.receivedAt = timestamp;

        await ctx.stub.putState(
            batchId,
            Buffer.from(JSON.stringify(batch))
        );

        return JSON.stringify(batch);
    }


    async FlagBatch(ctx, batchId, flagType, severity, dilutable) {
        this._checkRole(ctx, 'auditor');

        const batchJSON = await ctx.stub.getState(batchId);

        if (!batchJSON || batchJSON.length === 0) {
            throw new Error(`Batch ${batchId} does not exist`);
        }

        const batch = JSON.parse(batchJSON.toString());

        batch.flags.push({
            flagType,
            sourceBatchId: batchId,
            severity: parseFloat(severity),
            dilutable: dilutable === 'true'
        });

        await ctx.stub.putState(
            batchId,
            Buffer.from(JSON.stringify(batch))
        );

        return JSON.stringify(batch);
    }


    async QueryBatch(ctx, batchId) {
        const batchJSON = await ctx.stub.getState(batchId);

        if (!batchJSON || batchJSON.length === 0) {
            throw new Error(`Batch ${batchId} does not exist`);
        }

        return batchJSON.toString();
    }


    async GetContaminationScore(ctx, batchId) {
        const visited = new Set();

        const calculateScore = async (currentBatchId) => {
            if (visited.has(currentBatchId)) {
                return 0;
            }

            visited.add(currentBatchId);

            const batchJSON = await ctx.stub.getState(currentBatchId);

            if (!batchJSON || batchJSON.length === 0) {
                throw new Error(`Batch ${currentBatchId} does not exist`);
            }

            const batch = JSON.parse(batchJSON.toString());

            let score = 0;

            for (const flag of batch.flags || []) {
                if (flag.dilutable === false) {
                    score = Math.max(score, Number(flag.severity));
                }
            }

            if (!batch.parents || batch.parents.length === 0) {
                for (const flag of batch.flags || []) {
                    if (flag.dilutable !== false) {
                        score = Math.max(score, Number(flag.severity));
                    }
                }

                return score;
            }

            const totalWeight = batch.weight;

            for (const parent of batch.parents) {
                const parentScore = await calculateScore(parent.parentBatchId);
                const contribution =
                    Number(parent.weightContributed) / Number(totalWeight);

                score = Math.max(
                    score,
                    parentScore * contribution
                );
            }

            for (const flag of batch.flags || []) {
                if (flag.dilutable !== false) {
                    score = Math.max(score, Number(flag.severity));
                }
            }

            return score;
        };

        const score = await calculateScore(batchId);

        return JSON.stringify({
            batchId,
            contaminationScore: score
        });
    }

}

module.exports = BatchContract;
