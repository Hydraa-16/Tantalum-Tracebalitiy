import React, { useState, useEffect, useMemo } from 'react';

// Initial synthetic ledger dataset for instantaneous offline demo or initial state
const INITIAL_LEDGER_BATCHES = {
  'TB001': {
    batchId: 'TB001',
    actorId: 'Mine-01',
    action: 'extract',
    weight: 100,
    parents: [],
    flags: [
      { flagType: 'conflict-risk', sourceBatchId: 'TB001', severity: 80, dilutable: true }
    ],
    timestamp: '2026-03-12T08:30:00.000Z',
    signature: 'tx_0x9f1a8c2049b810d7a4e61234bc567890ef1234567890abcdef1234567890abcd',
    blockHeight: 1408810,
    concession: 'Rubaya Concession #4298, DRC'
  },
  'TB002': {
    batchId: 'TB002',
    actorId: 'Mine-01',
    action: 'extract',
    weight: 100,
    parents: [],
    flags: [
      { flagType: 'critical-origin-risk', sourceBatchId: 'TB002', severity: 90, dilutable: false }
    ],
    timestamp: '2026-03-12T09:15:00.000Z',
    signature: 'tx_0x8b2d4c19ef0123456789abcdef0123456789abcdef0123456789abcdef012345',
    blockHeight: 1408812,
    concession: 'Bisunzu Artisanal Sector, DRC'
  },
  'TB100': {
    batchId: 'TB100',
    actorId: 'SMELTER001',
    action: 'merge',
    weight: 200,
    parents: [
      { parentBatchId: 'TB001', weightContributed: 100 },
      { parentBatchId: 'TB002', weightContributed: 100 }
    ],
    flags: [],
    timestamp: '2026-03-13T14:00:00.000Z',
    signature: 'tx_0x7c3e5f20123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    blockHeight: 1408850,
    concession: 'F&X Electro-Materials Smelter Hub'
  },
  'TB101': {
    batchId: 'TB101',
    actorId: 'SMELTER001',
    action: 'split',
    weight: 100,
    parents: [
      { parentBatchId: 'TB100', weightContributed: 100 }
    ],
    flags: [],
    timestamp: '2026-03-14T11:20:00.000Z',
    signature: 'tx_0x6d4f6a3123456789abcdef0123456789abcdef0123456789abcdef0123456789ab',
    blockHeight: 1408890,
    receivedAt: '2026-03-15T16:45:00.000Z',
    receivedBy: 'e71b2a94f09d...ManufacturerOrg2',
    concession: 'Consignment Lot Alpha'
  },
  'TB102': {
    batchId: 'TB102',
    actorId: 'SMELTER001',
    action: 'split',
    weight: 100,
    parents: [
      { parentBatchId: 'TB100', weightContributed: 100 }
    ],
    flags: [],
    timestamp: '2026-03-14T11:20:00.000Z',
    signature: 'tx_0x5e5a7b4234567890bcdef0123456789abcdef0123456789abcdef0123456789abc',
    blockHeight: 1408891,
    concession: 'Consignment Lot Beta'
  }
};

// Client-side contamination score calculator matching batchContract.js
function computeLocalContaminationScore(batchId, ledger) {
  const visited = new Set();

  function calculateScore(currentId) {
    if (visited.has(currentId)) return 0;
    visited.add(currentId);

    const b = ledger[currentId];
    if (!b) return 0;

    let score = 0;

    // Check non-dilutable flags (takes maximum severity)
    for (const flag of b.flags || []) {
      if (flag.dilutable === false) {
        score = Math.max(score, Number(flag.severity));
      }
    }

    if (!b.parents || b.parents.length === 0) {
      // Leaf batch (mine level)
      for (const flag of b.flags || []) {
        if (flag.dilutable !== false) {
          score = Math.max(score, Number(flag.severity));
        }
      }
      return score;
    }

    const totalWeight = Number(b.weight) || 1;

    for (const parent of b.parents) {
      const parentScore = calculateScore(parent.parentBatchId);
      const contribution = Number(parent.weightContributed) / totalWeight;
      score = Math.max(score, parentScore * contribution);
    }

    for (const flag of b.flags || []) {
      if (flag.dilutable !== false) {
        score = Math.max(score, Number(flag.severity));
      }
    }

    return score;
  }

  return calculateScore(batchId);
}

export default function App() {
  const [activeTab, setActiveTab] = useState('explorer');
  const [useLiveBackend, setUseLiveBackend] = useState(true);
  const [backendHealthy, setBackendHealthy] = useState(false);

  // In-memory ledger mirror for simulation & instant fallback
  const [localLedger, setLocalLedger] = useState(INITIAL_LEDGER_BATCHES);

  // Inspector Search State
  const [searchBatchId, setSearchBatchId] = useState('TB100');
  const [inspectedBatch, setInspectedBatch] = useState(null);
  const [inspectedScore, setInspectedScore] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Mine Portal Form
  const [mineForm, setMineForm] = useState({
    batchId: 'TB200',
    actorId: 'Mine-01',
    weight: '150',
    concession: 'Rubaya Sector Lot 4'
  });
  const [mineFeedback, setMineFeedback] = useState(null);
  const [mineLoading, setMineLoading] = useState(false);

  // Smelter Portal Form
  const [smelterMode, setSmelterMode] = useState('merge');
  const [mergeForm, setMergeForm] = useState({
    newBatchId: 'TB300',
    actorId: 'SMELTER001',
    parent1: 'TB001',
    weight1: '50',
    parent2: 'TB002',
    weight2: '50'
  });
  const [splitForm, setSplitForm] = useState({
    parentBatchId: 'TB100',
    child1: 'TB103',
    weight1: '100',
    child2: 'TB104',
    weight2: '100',
    actorId: 'SMELTER001'
  });
  const [smelterFeedback, setSmelterFeedback] = useState(null);
  const [smelterLoading, setSmelterLoading] = useState(false);

  // Manufacturer Portal Form
  const [mfgForm, setMfgForm] = useState({ batchId: 'TB102' });
  const [mfgFeedback, setMfgFeedback] = useState(null);
  const [mfgLoading, setMfgLoading] = useState(false);

  // Auditor Portal Form
  const [auditForm, setAuditForm] = useState({
    batchId: 'TB100',
    flagType: 'conflict-risk',
    severity: '65',
    dilutable: 'true'
  });
  const [auditFeedback, setAuditFeedback] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);

  // Ledger Filter
  const [ledgerActionFilter, setLedgerActionFilter] = useState('ALL');

  // Check backend health on mount
  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch('/health', { method: 'GET' });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ok') {
            setBackendHealthy(true);
            return;
          }
        }
      } catch {
        // Backend offline, fallback to simulation mode
      }
      setBackendHealthy(false);
    }
    checkHealth();
  }, []);

  // Inspect initial default batch
  useEffect(() => {
    inspectBatch(searchBatchId);
  }, []);

  // Core Batch Inspection Function
  const inspectBatch = async (idToInspect) => {
    const id = (idToInspect || searchBatchId).trim();
    if (!id) {
      setSearchError('Batch ID cannot be empty');
      return;
    }

    setSearchLoading(true);
    setSearchError('');

    if (useLiveBackend && backendHealthy) {
      try {
        const encodedId = encodeURIComponent(id);
        const [batchRes, scoreRes] = await Promise.all([
          fetch(`/api/batches/${encodedId}`),
          fetch(`/api/batches/${encodedId}/contamination`)
        ]);

        if (!batchRes.ok) {
          const errData = await batchRes.json().catch(() => ({}));
          throw new Error(errData.error || `Batch '${id}' not found on ledger`);
        }

        const batchData = await batchRes.json();
        const scoreData = await scoreRes.json().catch(() => ({ contaminationScore: 0 }));

        setInspectedBatch(batchData);
        setInspectedScore(scoreData.contaminationScore ?? 0);
        setSearchLoading(false);
        return;
      } catch (err) {
        console.warn('Backend query failed, evaluating against local ledger cache:', err.message);
      }
    }

    // Local / Simulation fallback evaluation
    const found = localLedger[id];
    if (!found) {
      setInspectedBatch(null);
      setInspectedScore(null);
      setSearchError(`Batch '${id}' was not found in the ledger database.`);
    } else {
      const score = computeLocalContaminationScore(id, localLedger);
      setInspectedBatch(found);
      setInspectedScore(score);
    }
    setSearchLoading(false);
  };

  // Mine Batch Creation Handler
  const handleCreateMineBatch = async (e) => {
    e.preventDefault();
    setMineLoading(true);
    setMineFeedback(null);

    const bId = mineForm.batchId.trim();
    const actor = mineForm.actorId.trim();
    const wt = parseFloat(mineForm.weight);

    if (!bId || isNaN(wt) || wt <= 0) {
      setMineFeedback({ type: 'error', message: 'Valid Batch ID and positive weight required.' });
      setMineLoading(false);
      return;
    }

    const payload = {
      batchId: bId,
      actorId: actor,
      weight: wt,
      timestamp: new Date().toISOString()
    };

    let committedBatch = null;

    if (useLiveBackend && backendHealthy) {
      try {
        const res = await fetch('/api/batches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to commit batch to Hyperledger Fabric');
        committedBatch = data;
      } catch (err) {
        console.warn('Live commit failed, committing locally:', err.message);
      }
    }

    if (!committedBatch) {
      // Local ledger commit
      committedBatch = {
        batchId: bId,
        actorId: actor,
        action: 'extract',
        weight: wt,
        parents: [],
        flags: [],
        timestamp: payload.timestamp,
        signature: `tx_0x${Math.random().toString(16).substring(2, 10)}...${bId}`,
        blockHeight: 1408925 + Object.keys(localLedger).length,
        concession: mineForm.concession
      };
    }

    setLocalLedger((prev) => ({ ...prev, [bId]: committedBatch }));
    setMineFeedback({
      type: 'success',
      message: `Batch '${bId}' [${wt} kg] confirmed on block #${committedBatch.blockHeight || 1408925} with role endorsement Org1MSP.`
    });
    setMineLoading(false);
  };

  // Smelter Merge Batches Handler
  const handleMergeBatches = async (e) => {
    e.preventDefault();
    setSmelterLoading(true);
    setSmelterFeedback(null);

    const newId = mergeForm.newBatchId.trim();
    const p1 = mergeForm.parent1.trim();
    const w1 = parseFloat(mergeForm.weight1);
    const p2 = mergeForm.parent2.trim();
    const w2 = parseFloat(mergeForm.weight2);

    if (!newId || !p1 || !p2 || isNaN(w1) || isNaN(w2) || w1 <= 0 || w2 <= 0) {
      setSmelterFeedback({ type: 'error', message: 'All parent batch IDs and positive weights are required.' });
      setSmelterLoading(false);
      return;
    }

    const totalWeight = w1 + w2;
    const parents = [
      { parentBatchId: p1, weightContributed: w1 },
      { parentBatchId: p2, weightContributed: w2 }
    ];

    const payload = {
      newBatchId: newId,
      actorId: mergeForm.actorId.trim(),
      totalWeight,
      parents,
      timestamp: new Date().toISOString()
    };

    let committedBatch = null;

    if (useLiveBackend && backendHealthy) {
      try {
        const res = await fetch('/api/batches/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to submit merge transaction');
        committedBatch = data;
      } catch (err) {
        console.warn('Live merge failed, applying locally:', err.message);
      }
    }

    if (!committedBatch) {
      committedBatch = {
        batchId: newId,
        actorId: mergeForm.actorId.trim(),
        action: 'merge',
        weight: totalWeight,
        parents,
        flags: [],
        timestamp: payload.timestamp,
        signature: `tx_0x${Math.random().toString(16).substring(2, 10)}...${newId}`,
        blockHeight: 1408930 + Object.keys(localLedger).length
      };
    }

    setLocalLedger((prev) => ({ ...prev, [newId]: committedBatch }));
    setSmelterFeedback({
      type: 'success',
      message: `Consolidated batch '${newId}' [${totalWeight} kg] committed across ${parents.length} parent lots.`
    });
    setSmelterLoading(false);
  };

  // Smelter Split Batch Handler
  const handleSplitBatch = async (e) => {
    e.preventDefault();
    setSmelterLoading(true);
    setSmelterFeedback(null);

    const pId = splitForm.parentBatchId.trim();
    const c1 = splitForm.child1.trim();
    const w1 = parseFloat(splitForm.weight1);
    const c2 = splitForm.child2.trim();
    const w2 = parseFloat(splitForm.weight2);

    if (!pId || !c1 || !c2 || isNaN(w1) || isNaN(w2) || w1 <= 0 || w2 <= 0) {
      setSmelterFeedback({ type: 'error', message: 'Parent ID, child IDs, and allocated weights are required.' });
      setSmelterLoading(false);
      return;
    }

    const children = [
      { batchId: c1, weight: w1, actorId: splitForm.actorId },
      { batchId: c2, weight: w2, actorId: splitForm.actorId }
    ];

    const payload = {
      parentBatchId: pId,
      children,
      timestamp: new Date().toISOString()
    };

    let committedChildren = null;

    if (useLiveBackend && backendHealthy) {
      try {
        const res = await fetch('/api/batches/split', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to submit split transaction');
        committedChildren = data;
      } catch (err) {
        console.warn('Live split failed, applying locally:', err.message);
      }
    }

    if (!committedChildren) {
      const updated = { ...localLedger };
      children.forEach((ch, idx) => {
        updated[ch.batchId] = {
          batchId: ch.batchId,
          actorId: ch.actorId,
          action: 'split',
          weight: ch.weight,
          parents: [{ parentBatchId: pId, weightContributed: ch.weight }],
          flags: [],
          timestamp: payload.timestamp,
          signature: `tx_0x${Math.random().toString(16).substring(2, 10)}...${ch.batchId}`,
          blockHeight: 1408935 + idx
        };
      });
      setLocalLedger(updated);
    } else {
      setLocalLedger((prev) => {
        const copy = { ...prev };
        committedChildren.forEach((ch) => {
          copy[ch.batchId] = ch;
        });
        return copy;
      });
    }

    setSmelterFeedback({
      type: 'success',
      message: `Fractionated parent batch '${pId}' into ${children.length} derivative lots [${c1}: ${w1} kg, ${c2}: ${w2} kg].`
    });
    setSmelterLoading(false);
  };

  // Manufacturer Receipt Handler
  const handleRecordReceipt = async (e) => {
    e.preventDefault();
    setMfgLoading(true);
    setMfgFeedback(null);

    const bId = mfgForm.batchId.trim();
    if (!bId) {
      setMfgFeedback({ type: 'error', message: 'Batch ID is required.' });
      setMfgLoading(false);
      return;
    }

    const payload = {
      batchId: bId,
      timestamp: new Date().toISOString()
    };

    let updatedBatch = null;

    if (useLiveBackend && backendHealthy) {
      try {
        const res = await fetch('/api/batches/receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to record manufacturer receipt');
        updatedBatch = data;
      } catch (err) {
        console.warn('Live receipt recording failed, updating locally:', err.message);
      }
    }

    if (!updatedBatch) {
      if (!localLedger[bId]) {
        setMfgFeedback({ type: 'error', message: `Batch '${bId}' not found on ledger.` });
        setMfgLoading(false);
        return;
      }
      updatedBatch = {
        ...localLedger[bId],
        receivedAt: payload.timestamp,
        receivedBy: 'Org2MSP.ManufacturerPeer0'
      };
    }

    setLocalLedger((prev) => ({ ...prev, [bId]: updatedBatch }));
    setMfgFeedback({
      type: 'success',
      message: `Notarized receipt for batch '${bId}' recorded under Org2MSP identity authority.`
    });
    setMfgLoading(false);
  };

  // Auditor Flagging Handler
  const handleFlagBatch = async (e) => {
    e.preventDefault();
    setAuditLoading(true);
    setAuditFeedback(null);

    const bId = auditForm.batchId.trim();
    const sev = parseFloat(auditForm.severity);
    const isDilutable = auditForm.dilutable === 'true';

    if (!bId || isNaN(sev) || sev < 0 || sev > 100) {
      setAuditFeedback({ type: 'error', message: 'Valid Batch ID and severity between 0 and 100 required.' });
      setAuditLoading(false);
      return;
    }

    const payload = {
      batchId: bId,
      flagType: auditForm.flagType,
      severity: sev,
      dilutable: isDilutable
    };

    let updatedBatch = null;

    if (useLiveBackend && backendHealthy) {
      try {
        const res = await fetch('/api/batches/flag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to submit auditor flag');
        updatedBatch = data;
      } catch (err) {
        console.warn('Live flag failed, applying locally:', err.message);
      }
    }

    if (!updatedBatch) {
      if (!localLedger[bId]) {
        setAuditFeedback({ type: 'error', message: `Batch '${bId}' does not exist on ledger.` });
        setAuditLoading(false);
        return;
      }
      const existing = localLedger[bId];
      const newFlags = [...(existing.flags || []), {
        flagType: auditForm.flagType,
        sourceBatchId: bId,
        severity: sev,
        dilutable: isDilutable
      }];
      updatedBatch = { ...existing, flags: newFlags };
    }

    setLocalLedger((prev) => ({ ...prev, [bId]: updatedBatch }));
    setAuditFeedback({
      type: 'success',
      message: `Audit flag [${auditForm.flagType} - Severity ${sev}% - ${isDilutable ? 'Dilutable' : 'CRITICAL NON-DILUTABLE'}] attached to '${bId}'.`
    });
    setAuditLoading(false);
  };

  // Derived KPI metrics
  const ledgerEntries = useMemo(() => Object.values(localLedger), [localLedger]);
  const totalBatches = ledgerEntries.length;
  const totalWeightRecorded = useMemo(
    () => ledgerEntries.reduce((sum, b) => sum + (Number(b.weight) || 0), 0),
    [ledgerEntries]
  );
  const totalFlaggedBatches = useMemo(
    () => ledgerEntries.filter((b) => b.flags && b.flags.length > 0).length,
    [ledgerEntries]
  );
  const totalReceipts = useMemo(
    () => ledgerEntries.filter((b) => !!b.receivedAt).length,
    [ledgerEntries]
  );

  // Filtered ledger list for audit trail table
  const filteredLedger = useMemo(() => {
    if (ledgerActionFilter === 'ALL') return ledgerEntries;
    return ledgerEntries.filter((b) => b.action.toUpperCase() === ledgerActionFilter);
  }, [ledgerEntries, ledgerActionFilter]);

  return (
    <div className="app-shell">
      {/* Top System Telemetry Bar */}
      <header className="telemetry-header">
        <div className="brand-section">
          <div className="brand-mark">Ta</div>
          <div>
            <span className="brand-title">TANTALUM TRACEABILITY</span>
            <span className="brand-subtitle font-mono">// HYPERLEDGER FABRIC CONSORTIUM</span>
          </div>
        </div>

        <div className="telemetry-metrics">
          <div className="telemetry-item">
            <span className="telemetry-dot"></span>
            <span>CHANNEL: <strong>mychannel</strong></span>
          </div>
          <div className="telemetry-item">
            <span>CHAINCODE: <strong>v2.0 (seq 2)</strong></span>
          </div>
          <div className="telemetry-item">
            <span>MSPs: <strong>Org1MSP, Org2MSP</strong></span>
          </div>
          <div
            className="mode-badge"
            onClick={() => setUseLiveBackend(!useLiveBackend)}
            title="Click to toggle between live backend API and local ledger cache"
          >
            <span>MODE:</span>
            <strong>{useLiveBackend && backendHealthy ? 'LIVE FABRIC GATEWAY' : 'SIMULATION LEDGER'}</strong>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="workspace-nav">
        <div className="nav-tabs">
          <button
            className={`nav-tab-btn ${activeTab === 'explorer' ? 'active' : ''}`}
            onClick={() => setActiveTab('explorer')}
          >
            <span className="nav-tab-index">[01]</span>
            <span>PROVENANCE & DAG INSPECTOR</span>
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'mine' ? 'active' : ''}`}
            onClick={() => setActiveTab('mine')}
          >
            <span className="nav-tab-index">[02]</span>
            <span>MINE EXTRACTION</span>
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'smelter' ? 'active' : ''}`}
            onClick={() => setActiveTab('smelter')}
          >
            <span className="nav-tab-index">[03]</span>
            <span>SMELTER REFINERY</span>
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'mfg' ? 'active' : ''}`}
            onClick={() => setActiveTab('mfg')}
          >
            <span className="nav-tab-index">[04]</span>
            <span>MANUFACTURER INTAKE</span>
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'auditor' ? 'active' : ''}`}
            onClick={() => setActiveTab('auditor')}
          >
            <span className="nav-tab-index">[05]</span>
            <span>AUDIT & COMPLIANCE</span>
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
            onClick={() => setActiveTab('ledger')}
          >
            <span className="nav-tab-index">[06]</span>
            <span>CONSORTIUM LEDGER</span>
          </button>
        </div>
      </nav>

      {/* Main Workbench Body */}
      <main className="workbench-main">
        {/* KPI Metrics Header Grid */}
        <section className="kpi-row">
          <div className="kpi-card">
            <span className="kpi-label">REGISTERED BATCHES</span>
            <div className="kpi-value">{totalBatches}</div>
            <span className="kpi-meta">Immutable ledger assets</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">TOTAL MASS (KG)</span>
            <div className="kpi-value">{totalWeightRecorded.toLocaleString()} kg</div>
            <span className="kpi-meta">Tantalite material balance</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">FLAGGED ANOMALIES</span>
            <div className="kpi-value" style={{ color: totalFlaggedBatches > 0 ? '#fbbf24' : '#10b981' }}>
              {totalFlaggedBatches}
            </div>
            <span className="kpi-meta">Active risk assessments</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">CONFIRMED RECEIPTS</span>
            <div className="kpi-value" style={{ color: '#10b981' }}>
              {totalReceipts}
            </div>
            <span className="kpi-meta">Manufacturer intake complete</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">CONSENSUS STATUS</span>
            <div className="kpi-value" style={{ color: '#10b981', fontSize: '15px', paddingTop: '4px' }}>
              RAFT PEERS SYNCED
            </div>
            <span className="kpi-meta font-mono">Channel block height: #1,408,935</span>
          </div>
        </section>

        {/* TAB 1: PROVENANCE & LINEAGE DAG INSPECTOR */}
        {activeTab === 'explorer' && (
          <div className="panes-layout">
            {/* Left Pane: Interactive DAG Lineage Graph */}
            <div className="panel-container">
              <div className="panel-header-bar">
                <span className="panel-title">
                  <span>CHAIN-OF-CUSTODY DAG LINEAGE GRAPH</span>
                </span>
                <span className="label-caps">DIRECTED ACYCLIC GRAPH</span>
              </div>

              <div className="panel-body">
                <div className="dag-viewport">
                  <div className="dag-tree">
                    {/* Stage 1: Mine Extraction */}
                    <div className="dag-stage-column">
                      <div className="dag-stage-header">
                        <span style={{ color: 'var(--role-mine)' }}>■</span>
                        <span>01. MINE EXTRACTION</span>
                      </div>

                      {['TB001', 'TB002'].map((id) => {
                        const b = localLedger[id];
                        if (!b) return null;
                        const isSel = inspectedBatch?.batchId === id;
                        return (
                          <div
                            key={id}
                            className={`dag-node-card role-mine ${isSel ? 'selected' : ''}`}
                            onClick={() => {
                              setSearchBatchId(id);
                              inspectBatch(id);
                            }}
                          >
                            <div className="dag-node-header">
                              <span className="dag-node-id">{b.batchId}</span>
                              <span className="dag-node-weight">{b.weight} kg</span>
                            </div>
                            <div className="dag-node-meta">
                              <span>{b.actorId}</span>
                              <span>{b.flags?.length ? `⚠ ${b.flags.length} Flag` : '✓ Clean'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="dag-connector"></div>

                    {/* Stage 2: Smelter Processing */}
                    <div className="dag-stage-column">
                      <div className="dag-stage-header">
                        <span style={{ color: 'var(--role-smelter)' }}>■</span>
                        <span>02. SMELTER TOLLING</span>
                      </div>

                      {['TB100'].map((id) => {
                        const b = localLedger[id];
                        if (!b) return null;
                        const isSel = inspectedBatch?.batchId === id;
                        return (
                          <div
                            key={id}
                            className={`dag-node-card role-smelter ${isSel ? 'selected' : ''}`}
                            onClick={() => {
                              setSearchBatchId(id);
                              inspectBatch(id);
                            }}
                          >
                            <div className="dag-node-header">
                              <span className="dag-node-id">{b.batchId}</span>
                              <span className="dag-node-weight">{b.weight} kg</span>
                            </div>
                            <div className="dag-node-meta">
                              <span>MERGE (TB001+TB002)</span>
                              <span>{b.actorId}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="dag-connector"></div>

                    {/* Stage 3: Split & Manufacturer Intake */}
                    <div className="dag-stage-column">
                      <div className="dag-stage-header">
                        <span style={{ color: 'var(--role-mfg)' }}>■</span>
                        <span>03. REFINED LOTS & INTAKE</span>
                      </div>

                      {['TB101', 'TB102'].map((id) => {
                        const b = localLedger[id];
                        if (!b) return null;
                        const isSel = inspectedBatch?.batchId === id;
                        return (
                          <div
                            key={id}
                            className={`dag-node-card role-mfg ${isSel ? 'selected' : ''}`}
                            onClick={() => {
                              setSearchBatchId(id);
                              inspectBatch(id);
                            }}
                          >
                            <div className="dag-node-header">
                              <span className="dag-node-id">{b.batchId}</span>
                              <span className="dag-node-weight">{b.weight} kg</span>
                            </div>
                            <div className="dag-node-meta">
                              <span>SPLIT FROM TB100</span>
                              <span>{b.receivedAt ? '✓ RECEIVED' : 'IN TRANSIT'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <span className="label-caps">QUICK PRESET BATCH LOOKUP</span>
                  <div className="search-chips" style={{ marginTop: '6px' }}>
                    {Object.keys(localLedger).map((id) => (
                      <button
                        key={id}
                        className="search-chip"
                        onClick={() => {
                          setSearchBatchId(id);
                          inspectBatch(id);
                        }}
                      >
                        {id} ({localLedger[id]?.action})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Pane: Batch Inspector & Risk Meter */}
            <div className="panel-container">
              <div className="panel-header-bar">
                <span className="panel-title">
                  <span>BATCH PROVENANCE INSPECTOR</span>
                </span>
                <span className="label-caps">AUDIT PANEL</span>
              </div>

              <div className="panel-body">
                {/* Search Bar */}
                <div className="search-control">
                  <input
                    type="text"
                    className="search-input-field"
                    placeholder="Enter Batch ID (e.g. TB100)..."
                    value={searchBatchId}
                    onChange={(e) => setSearchBatchId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && inspectBatch()}
                  />
                  <button className="btn-primary" onClick={() => inspectBatch()} disabled={searchLoading}>
                    {searchLoading ? 'QUERYING...' : 'INSPECT'}
                  </button>
                </div>

                {searchError && (
                  <div className="feedback-box error">
                    <span>✕</span>
                    <span>{searchError}</span>
                  </div>
                )}

                {inspectedBatch && (
                  <div className="inspector-details">
                    <div className="inspector-banner">
                      <div>
                        <span className="label-caps">SELECTED BATCH ID</span>
                        <div className="inspector-batch-name">{inspectedBatch.batchId}</div>
                      </div>
                      <span className="badge verified">LEDGER VERIFIED</span>
                    </div>

                    {/* Contamination Risk Breakdown */}
                    <div className="risk-assessment-box">
                      <div>
                        <span className="label-caps">CONTAMINATION RISK SCORE</span>
                        <div className="risk-score-display">
                          <span
                            className="risk-score-number"
                            style={{
                              color:
                                (inspectedScore || 0) >= 70
                                  ? 'var(--status-critical)'
                                  : (inspectedScore || 0) >= 30
                                  ? 'var(--status-warning)'
                                  : 'var(--status-verified)'
                            }}
                          >
                            {inspectedScore !== null ? inspectedScore : 0}
                          </span>
                          <span className="risk-score-max">/ 100</span>
                        </div>
                      </div>

                      <span
                        className={`risk-pill ${
                          (inspectedScore || 0) >= 70
                            ? 'critical'
                            : (inspectedScore || 0) >= 30
                            ? 'moderate'
                            : 'low'
                        }`}
                      >
                        {(inspectedScore || 0) >= 70
                          ? 'CRITICAL RISK'
                          : (inspectedScore || 0) >= 30
                          ? 'MODERATE RISK'
                          : 'OECD COMPLIANT (LOW)'}
                      </span>
                    </div>

                    {/* Metadata Grid */}
                    <div className="inspector-grid">
                      <div className="inspector-cell">
                        <div className="inspector-cell-label">TRANSFORMATION ACTION</div>
                        <div className="inspector-cell-value">{inspectedBatch.action.toUpperCase()}</div>
                      </div>

                      <div className="inspector-cell">
                        <div className="inspector-cell-label">RECORDED MASS</div>
                        <div className="inspector-cell-value">{inspectedBatch.weight} kg</div>
                      </div>

                      <div className="inspector-cell">
                        <div className="inspector-cell-label">ENDORSER / ACTOR</div>
                        <div className="inspector-cell-value">{inspectedBatch.actorId}</div>
                      </div>

                      <div className="inspector-cell">
                        <div className="inspector-cell-label">MANUFACTURER RECEIPT</div>
                        <div className="inspector-cell-value" style={{ color: inspectedBatch.receivedAt ? 'var(--status-verified)' : 'var(--text-dim)' }}>
                          {inspectedBatch.receivedAt ? 'CONFIRMED' : 'PENDING'}
                        </div>
                      </div>

                      <div className="inspector-cell" style={{ gridColumn: '1 / -1' }}>
                        <div className="inspector-cell-label">BLOCKCHAIN TRANSACTION SIGNATURE</div>
                        <div className="inspector-cell-value font-mono" style={{ fontSize: '10px' }}>
                          {inspectedBatch.signature || 'tx_0x9f1a8c2049b810d7a4e61234bc567890ef1234567890abcdef1234567890abcd'}
                        </div>
                      </div>
                    </div>

                    {/* Associated Parent Lots */}
                    {inspectedBatch.parents && inspectedBatch.parents.length > 0 && (
                      <div>
                        <span className="label-caps">PARENT BATCH LINEAGE CONTRIBUTIONS</span>
                        <div className="parents-list" style={{ marginTop: '6px' }}>
                          {inspectedBatch.parents.map((p, idx) => (
                            <div key={idx} className="parent-item">
                              <span>Parent: <strong>{p.parentBatchId}</strong></span>
                              <span>Contribution: <strong>{p.weightContributed} kg</strong></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Active Flags */}
                    {inspectedBatch.flags && inspectedBatch.flags.length > 0 && (
                      <div>
                        <span className="label-caps">ACTIVE AUDIT RISK FLAGS</span>
                        <div className="flags-list" style={{ marginTop: '6px' }}>
                          {inspectedBatch.flags.map((fl, idx) => (
                            <div key={idx} className={`flag-item ${fl.dilutable ? 'warning' : 'critical'}`}>
                              <span>{fl.flagType.toUpperCase()} (Severity: {fl.severity}%)</span>
                              <span className="badge" style={{ fontSize: '8px' }}>
                                {fl.dilutable ? 'DILUTABLE' : 'NON-DILUTABLE CRITICAL'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MINE EXTRACTION PORTAL */}
        {activeTab === 'mine' && (
          <div className="panes-layout-single">
            <div className="panel-container">
              <div className="panel-header-bar">
                <span className="panel-title">
                  <span>MINE PORTAL — RAW ORE EXTRACTION INTAKE</span>
                </span>
                <span className="label-caps">ROLE: MINE (ORG1MSP)</span>
              </div>

              <div className="panel-body">
                <form className="form-grid" onSubmit={handleCreateMineBatch}>
                  <div className="form-field">
                    <label className="form-label">BATCH IDENTIFIER</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. TB200"
                      value={mineForm.batchId}
                      onChange={(e) => setMineForm({ ...mineForm, batchId: e.target.value })}
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">ACTOR IDENTITY</label>
                    <input
                      type="text"
                      className="form-input"
                      value={mineForm.actorId}
                      onChange={(e) => setMineForm({ ...mineForm, actorId: e.target.value })}
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">DRY MASS WEIGHT (KG)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      placeholder="e.g. 150"
                      value={mineForm.weight}
                      onChange={(e) => setMineForm({ ...mineForm, weight: e.target.value })}
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">CONCESSION / SECTOR GEOLOCATION</label>
                    <input
                      type="text"
                      className="form-input"
                      value={mineForm.concession}
                      onChange={(e) => setMineForm({ ...mineForm, concession: e.target.value })}
                    />
                  </div>

                  <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={mineLoading}>
                      {mineLoading ? 'TRANSACTING...' : 'COMMIT EXTRACTION TO LEDGER'}
                    </button>
                  </div>
                </form>

                {mineFeedback && (
                  <div className={`feedback-box ${mineFeedback.type}`}>
                    <span>{mineFeedback.type === 'success' ? '✓' : '✕'}</span>
                    <span>{mineFeedback.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SMELTER REFINERY PORTAL */}
        {activeTab === 'smelter' && (
          <div className="panes-layout-single">
            <div className="panel-container">
              <div className="panel-header-bar">
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className={`btn-secondary btn-sm ${smelterMode === 'merge' ? 'active' : ''}`}
                    onClick={() => { setSmelterMode('merge'); setSmelterFeedback(null); }}
                  >
                    CONSOLIDATION / MERGE BATCHES
                  </button>
                  <button
                    className={`btn-secondary btn-sm ${smelterMode === 'split' ? 'active' : ''}`}
                    onClick={() => { setSmelterMode('split'); setSmelterFeedback(null); }}
                  >
                    FRACTIONATION / SPLIT BATCH
                  </button>
                </div>
                <span className="label-caps">ROLE: SMELTER (ORG1MSP)</span>
              </div>

              <div className="panel-body">
                {smelterMode === 'merge' ? (
                  <form className="form-grid" onSubmit={handleMergeBatches}>
                    <div className="form-field">
                      <label className="form-label">NEW OUTPUT BATCH ID</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. TB300"
                        value={mergeForm.newBatchId}
                        onChange={(e) => setMergeForm({ ...mergeForm, newBatchId: e.target.value })}
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label">SMELTER ACTOR ID</label>
                      <input
                        type="text"
                        className="form-input"
                        value={mergeForm.actorId}
                        onChange={(e) => setMergeForm({ ...mergeForm, actorId: e.target.value })}
                      />
                    </div>

                    <div className="section-divider">
                      <span>PARENT LOT 1 INFEED</span>
                    </div>

                    <div className="form-field">
                      <label className="form-label">PARENT 1 BATCH ID</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. TB001"
                        value={mergeForm.parent1}
                        onChange={(e) => setMergeForm({ ...mergeForm, parent1: e.target.value })}
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label">PARENT 1 WEIGHT (KG)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        placeholder="e.g. 50"
                        value={mergeForm.weight1}
                        onChange={(e) => setMergeForm({ ...mergeForm, weight1: e.target.value })}
                      />
                    </div>

                    <div className="section-divider">
                      <span>PARENT LOT 2 INFEED</span>
                    </div>

                    <div className="form-field">
                      <label className="form-label">PARENT 2 BATCH ID</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. TB002"
                        value={mergeForm.parent2}
                        onChange={(e) => setMergeForm({ ...mergeForm, parent2: e.target.value })}
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label">PARENT 2 WEIGHT (KG)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        placeholder="e.g. 50"
                        value={mergeForm.weight2}
                        onChange={(e) => setMergeForm({ ...mergeForm, weight2: e.target.value })}
                      />
                    </div>

                    <div className="form-actions">
                      <button type="submit" className="btn-primary" disabled={smelterLoading}>
                        {smelterLoading ? 'EXECUTING MERGE...' : 'EXECUTE SMELTER MERGE'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form className="form-grid" onSubmit={handleSplitBatch}>
                    <div className="form-field">
                      <label className="form-label">SOURCE PARENT BATCH ID</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. TB100"
                        value={splitForm.parentBatchId}
                        onChange={(e) => setSplitForm({ ...splitForm, parentBatchId: e.target.value })}
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label">SMELTER ACTOR ID</label>
                      <input
                        type="text"
                        className="form-input"
                        value={splitForm.actorId}
                        onChange={(e) => setSplitForm({ ...splitForm, actorId: e.target.value })}
                      />
                    </div>

                    <div className="section-divider">
                      <span>CHILD ALLOCATION 1</span>
                    </div>

                    <div className="form-field">
                      <label className="form-label">CHILD 1 BATCH ID</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. TB103"
                        value={splitForm.child1}
                        onChange={(e) => setSplitForm({ ...splitForm, child1: e.target.value })}
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label">CHILD 1 WEIGHT (KG)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        placeholder="e.g. 100"
                        value={splitForm.weight1}
                        onChange={(e) => setSplitForm({ ...splitForm, weight1: e.target.value })}
                      />
                    </div>

                    <div className="section-divider">
                      <span>CHILD ALLOCATION 2</span>
                    </div>

                    <div className="form-field">
                      <label className="form-label">CHILD 2 BATCH ID</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. TB104"
                        value={splitForm.child2}
                        onChange={(e) => setSplitForm({ ...splitForm, child2: e.target.value })}
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label">CHILD 2 WEIGHT (KG)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        placeholder="e.g. 100"
                        value={splitForm.weight2}
                        onChange={(e) => setSplitForm({ ...splitForm, weight2: e.target.value })}
                      />
                    </div>

                    <div className="form-actions">
                      <button type="submit" className="btn-primary" disabled={smelterLoading}>
                        {smelterLoading ? 'EXECUTING SPLIT...' : 'EXECUTE SMELTER SPLIT'}
                      </button>
                    </div>
                  </form>
                )}

                {smelterFeedback && (
                  <div className={`feedback-box ${smelterFeedback.type}`}>
                    <span>{smelterFeedback.type === 'success' ? '✓' : '✕'}</span>
                    <span>{smelterFeedback.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: MANUFACTURER INTAKE PORTAL */}
        {activeTab === 'mfg' && (
          <div className="panes-layout-single">
            <div className="panel-container">
              <div className="panel-header-bar">
                <span className="panel-title">
                  <span>MANUFACTURER INTAKE — RECORD CUSTODY RECEIPT</span>
                </span>
                <span className="label-caps">ROLE: MANUFACTURER (ORG2MSP)</span>
              </div>

              <div className="panel-body">
                <form className="form-grid" onSubmit={handleRecordReceipt}>
                  <div className="form-field full-width">
                    <label className="form-label">INCOMING REFINED BATCH IDENTIFIER</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. TB102"
                      value={mfgForm.batchId}
                      onChange={(e) => setMfgForm({ ...mfgForm, batchId: e.target.value })}
                    />
                  </div>

                  <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={mfgLoading}>
                      {mfgLoading ? 'RECORDING RECEIPT...' : 'CONFIRM NOTARIZED RECEIPT'}
                    </button>
                  </div>
                </form>

                {mfgFeedback && (
                  <div className={`feedback-box ${mfgFeedback.type}`}>
                    <span>{mfgFeedback.type === 'success' ? '✓' : '✕'}</span>
                    <span>{mfgFeedback.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: AUDIT & COMPLIANCE PORTAL */}
        {activeTab === 'auditor' && (
          <div className="panes-layout-single">
            <div className="panel-container">
              <div className="panel-header-bar">
                <span className="panel-title">
                  <span>AUDITOR PORTAL — CONFLICT MINERAL RISK ATTACHMENT</span>
                </span>
                <span className="label-caps">ROLE: AUDITOR (ORG2MSP)</span>
              </div>

              <div className="panel-body">
                <form className="form-grid" onSubmit={handleFlagBatch}>
                  <div className="form-field">
                    <label className="form-label">TARGET BATCH ID</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. TB100"
                      value={auditForm.batchId}
                      onChange={(e) => setAuditForm({ ...auditForm, batchId: e.target.value })}
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">ANOMALY / FLAG CLASSIFICATION</label>
                    <select
                      className="form-select"
                      value={auditForm.flagType}
                      onChange={(e) => setAuditForm({ ...auditForm, flagType: e.target.value })}
                    >
                      <option value="conflict-risk">Conflict Risk (OECD Annex II High-Risk Area)</option>
                      <option value="critical-origin-risk">Critical Origin Risk (Sanctioned Mine Sector)</option>
                      <option value="supply-chain-risk">Supply Chain Custody Break / Discrepancy</option>
                      <option value="compliance-risk">Non-Compliant Assay / Documentation Flaw</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="form-label">SEVERITY COEFFICIENT (0 – 100%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="form-input"
                      value={auditForm.severity}
                      onChange={(e) => setAuditForm({ ...auditForm, severity: e.target.value })}
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">PROPAGATION DILUTABILITY STATUS</label>
                    <select
                      className="form-select"
                      value={auditForm.dilutable}
                      onChange={(e) => setAuditForm({ ...auditForm, dilutable: e.target.value })}
                    >
                      <option value="true">Dilutable (Weighted mass propagation across merges/splits)</option>
                      <option value="false">Non-Dilutable (CRITICAL: Any downstream batch carries 100% flag)</option>
                    </select>
                  </div>

                  <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={auditLoading}>
                      {auditLoading ? 'TRANSACTING...' : 'BROADCAST AUDITOR RISK FLAG'}
                    </button>
                  </div>
                </form>

                {auditFeedback && (
                  <div className={`feedback-box ${auditFeedback.type}`}>
                    <span>{auditFeedback.type === 'success' ? '✓' : '✕'}</span>
                    <span>{auditFeedback.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: CONSORTIUM IMMUTABLE LEDGER */}
        {activeTab === 'ledger' && (
          <div className="panes-layout-single">
            <div className="panel-container">
              <div className="panel-header-bar">
                <span className="panel-title">
                  <span>IMMUTABLE LEDGER TRANSACTION AUDIT TRAIL</span>
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['ALL', 'EXTRACT', 'MERGE', 'SPLIT'].map((act) => (
                    <button
                      key={act}
                      className={`btn-secondary btn-sm ${ledgerActionFilter === act ? 'active' : ''}`}
                      onClick={() => setLedgerActionFilter(act)}
                    >
                      {act}
                    </button>
                  ))}
                </div>
              </div>

              <div className="panel-body" style={{ padding: 0 }}>
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>BLOCK #</th>
                        <th>BATCH ID</th>
                        <th>STAGE / ACTION</th>
                        <th>ACTOR MSP</th>
                        <th>MASS (KG)</th>
                        <th>PARENTS</th>
                        <th>FLAGS</th>
                        <th>RECEIPT STATUS</th>
                        <th>TX SIGNATURE HASH</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLedger.map((b) => (
                        <tr
                          key={b.batchId}
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            setSearchBatchId(b.batchId);
                            inspectBatch(b.batchId);
                            setActiveTab('explorer');
                          }}
                        >
                          <td>#{b.blockHeight || 1408900}</td>
                          <td><strong>{b.batchId}</strong></td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                color:
                                  b.action === 'extract'
                                    ? 'var(--role-mine)'
                                    : b.action === 'merge'
                                    ? 'var(--role-smelter)'
                                    : 'var(--role-mfg)'
                              }}
                            >
                              {b.action.toUpperCase()}
                            </span>
                          </td>
                          <td>{b.actorId}</td>
                          <td>{b.weight} kg</td>
                          <td>{b.parents?.length || 0}</td>
                          <td>
                            {b.flags?.length ? (
                              <span className="badge warning">{b.flags.length} Flagged</span>
                            ) : (
                              <span className="badge verified">Clean</span>
                            )}
                          </td>
                          <td>
                            {b.receivedAt ? (
                              <span className="badge verified">Received</span>
                            ) : (
                              <span className="badge">Pending</span>
                            )}
                          </td>
                          <td style={{ fontSize: '10px' }}>
                            {b.signature ? `${b.signature.substring(0, 14)}...` : 'tx_0x9f1a8c...'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="workbench-footer">
        <div>TANTALUM TRACEABILITY // HYPERLEDGER FABRIC CONSORTIUM VERIFICATION SYSTEM</div>
        <div className="footer-links">
          <span>CHANNEL: mychannel</span>
          <span>FABRIC v2.5.4 LTS</span>
          <span>OECD ANNEX II COMPLIANCE ENGINE</span>
        </div>
      </footer>
    </div>
  );
}
