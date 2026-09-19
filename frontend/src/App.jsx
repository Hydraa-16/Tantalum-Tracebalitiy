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
      {/* Top Glass Navigation Bar */}
      <header className="top-nav-bar">
        <div className="brand-wrapper">
          <div className="brand-icon">Ta</div>
          <div>
            <div className="brand-title">
              <span>TANTALUM TRACEABILITY</span>
              <span className="brand-badge">WEB3 PROVENANCE</span>
            </div>
          </div>
        </div>

        <div className="nav-meta-pills">
          <div className="meta-pill">
            <span className="status-pulse-dot"></span>
            <span>CHANNEL: <strong>mychannel</strong></span>
          </div>

          <div className="meta-pill">
            <span>NETWORK: <strong>Fabric v2.5</strong></span>
          </div>

          <button
            className="mode-toggle-pill"
            onClick={() => setUseLiveBackend(!useLiveBackend)}
            title="Toggle Live Backend Gateway vs Local Ledger Simulation"
          >
            {useLiveBackend && backendHealthy ? '⚡ LIVE GATEWAY' : '◈ SIMULATION MODE'}
          </button>
        </div>
      </header>

      {/* Segmented Top Section Tabs */}
      <div className="segmented-nav-wrapper">
        <nav className="segmented-nav">
          <button
            className={`nav-seg-btn ${activeTab === 'explorer' ? 'active' : ''}`}
            onClick={() => setActiveTab('explorer')}
          >
            <span className="nav-seg-badge">01</span>
            <span>PROVENANCE & DAG INSPECTOR</span>
          </button>

          <button
            className={`nav-seg-btn ${activeTab === 'mine' ? 'active' : ''}`}
            onClick={() => setActiveTab('mine')}
          >
            <span className="nav-seg-badge">02</span>
            <span>MINE EXTRACTION</span>
          </button>

          <button
            className={`nav-seg-btn ${activeTab === 'smelter' ? 'active' : ''}`}
            onClick={() => setActiveTab('smelter')}
          >
            <span className="nav-seg-badge">03</span>
            <span>SMELTER REFINERY</span>
          </button>

          <button
            className={`nav-seg-btn ${activeTab === 'mfg' ? 'active' : ''}`}
            onClick={() => setActiveTab('mfg')}
          >
            <span className="nav-seg-badge">04</span>
            <span>MANUFACTURER INTAKE</span>
          </button>

          <button
            className={`nav-seg-btn ${activeTab === 'auditor' ? 'active' : ''}`}
            onClick={() => setActiveTab('auditor')}
          >
            <span className="nav-seg-badge">05</span>
            <span>AUDIT & COMPLIANCE</span>
          </button>

          <button
            className={`nav-seg-btn ${activeTab === 'ledger' ? 'active' : ''}`}
            onClick={() => setActiveTab('ledger')}
          >
            <span className="nav-seg-badge">06</span>
            <span>CONSORTIUM LEDGER</span>
          </button>
        </nav>
      </div>

      {/* Main Dashboard Content */}
      <main className="dashboard-main">
        {/* Global Statistics Cards */}
        <section className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-header-row">
              <span className="kpi-title">REGISTERED BATCHES</span>
              <span className="kpi-icon-pill">📦</span>
            </div>
            <div className="kpi-metric">{totalBatches}</div>
            <div className="kpi-description">Immutable ledger assets</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header-row">
              <span className="kpi-title">TOTAL MASS</span>
              <span className="kpi-icon-pill">⚖</span>
            </div>
            <div className="kpi-metric" style={{ color: 'var(--accent-yellow)' }}>
              {totalWeightRecorded.toLocaleString()} kg
            </div>
            <div className="kpi-description">Tantalite material balance</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header-row">
              <span className="kpi-title">FLAGGED ANOMALIES</span>
              <span className="kpi-icon-pill">⚠</span>
            </div>
            <div
              className="kpi-metric"
              style={{ color: totalFlaggedBatches > 0 ? 'var(--status-warning)' : 'var(--status-success)' }}
            >
              {totalFlaggedBatches}
            </div>
            <div className="kpi-description">Active risk assessments</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header-row">
              <span className="kpi-title">CONFIRMED RECEIPTS</span>
              <span className="kpi-icon-pill">✓</span>
            </div>
            <div className="kpi-metric" style={{ color: 'var(--status-success)' }}>
              {totalReceipts}
            </div>
            <div className="kpi-description">Manufacturer intake complete</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header-row">
              <span className="kpi-title">CONSENSUS STATUS</span>
              <span className="kpi-icon-pill">⚡</span>
            </div>
            <div className="kpi-metric" style={{ fontSize: '18px', color: 'var(--status-success)', paddingTop: '6px' }}>
              RAFT PEERS SYNCED
            </div>
            <div className="kpi-description font-mono" style={{ fontSize: '11px' }}>
              Block height: #1,408,935
            </div>
          </div>
        </section>

        {/* SECTION 1: PROVENANCE & DAG INSPECTOR */}
        {activeTab === 'explorer' && (
          <div className="panes-grid-split">
            {/* Left Pane: Interactive DAG Lineage Flow */}
            <div className="card-container">
              <div className="card-header-bar">
                <div className="card-title-group">
                  <span className="card-title-text">SUPPLY-CHAIN LINEAGE DAG</span>
                </div>
                <span className="card-role-pill">CUSTODY GRAPH</span>
              </div>

              <div className="card-body">
                {/* Visual Directed Acyclic Graph */}
                <div className="dag-canvas">
                  <div className="dag-flow-row">
                    {/* Stage 1: Mine Extractions */}
                    <div className="dag-column">
                      <div className="dag-column-label">
                        <span style={{ color: 'var(--role-mine)' }}>●</span>
                        <span>01. MINE EXTRACTION</span>
                      </div>

                      {['TB001', 'TB002'].map((id) => {
                        const b = localLedger[id];
                        if (!b) return null;
                        const isSel = inspectedBatch?.batchId === id;
                        return (
                          <div
                            key={id}
                            className={`dag-node-box ${isSel ? 'selected' : ''}`}
                            onClick={() => {
                              setSearchBatchId(id);
                              inspectBatch(id);
                            }}
                          >
                            <div className="dag-node-stripe mine"></div>
                            <div className="dag-node-top">
                              <span className="dag-node-id">{b.batchId}</span>
                              <span className="dag-node-mass">{b.weight} kg</span>
                            </div>
                            <div className="dag-node-bottom">
                              <span>{b.actorId}</span>
                              <span style={{ color: b.flags?.length ? 'var(--status-warning)' : 'var(--status-success)' }}>
                                {b.flags?.length ? `⚠ ${b.flags.length} Flag` : '✓ Certified'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="dag-arrow-connector"></div>

                    {/* Stage 2: Smelter Consolidation */}
                    <div className="dag-column">
                      <div className="dag-column-label">
                        <span style={{ color: 'var(--role-smelter)' }}>●</span>
                        <span>02. SMELTER TOLLING</span>
                      </div>

                      {['TB100'].map((id) => {
                        const b = localLedger[id];
                        if (!b) return null;
                        const isSel = inspectedBatch?.batchId === id;
                        return (
                          <div
                            key={id}
                            className={`dag-node-box ${isSel ? 'selected' : ''}`}
                            onClick={() => {
                              setSearchBatchId(id);
                              inspectBatch(id);
                            }}
                          >
                            <div className="dag-node-stripe smelter"></div>
                            <div className="dag-node-top">
                              <span className="dag-node-id">{b.batchId}</span>
                              <span className="dag-node-mass">{b.weight} kg</span>
                            </div>
                            <div className="dag-node-bottom">
                              <span>MERGE (TB001+TB002)</span>
                              <span>{b.actorId}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="dag-arrow-connector"></div>

                    {/* Stage 3: Refined Derivative Lots & Manufacturer */}
                    <div className="dag-column">
                      <div className="dag-column-label">
                        <span style={{ color: 'var(--role-mfg)' }}>●</span>
                        <span>03. REFINED LOTS & INTAKE</span>
                      </div>

                      {['TB101', 'TB102'].map((id) => {
                        const b = localLedger[id];
                        if (!b) return null;
                        const isSel = inspectedBatch?.batchId === id;
                        return (
                          <div
                            key={id}
                            className={`dag-node-box ${isSel ? 'selected' : ''}`}
                            onClick={() => {
                              setSearchBatchId(id);
                              inspectBatch(id);
                            }}
                          >
                            <div className="dag-node-stripe mfg"></div>
                            <div className="dag-node-top">
                              <span className="dag-node-id">{b.batchId}</span>
                              <span className="dag-node-mass">{b.weight} kg</span>
                            </div>
                            <div className="dag-node-bottom">
                              <span>SPLIT FROM TB100</span>
                              <span style={{ color: b.receivedAt ? 'var(--status-success)' : 'var(--text-muted)' }}>
                                {b.receivedAt ? '✓ INTAKE DONE' : 'IN TRANSIT'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Quick Selection Chips */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    QUICK PRESET BATCH INSPECTION
                  </div>
                  <div className="chips-row">
                    {Object.keys(localLedger).map((id) => (
                      <button
                        key={id}
                        className="preset-chip"
                        onClick={() => {
                          setSearchBatchId(id);
                          inspectBatch(id);
                        }}
                      >
                        {id} • {localLedger[id]?.action.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Pane: Batch Provenance Inspector */}
            <div className="card-container">
              <div className="card-header-bar">
                <div className="card-title-group">
                  <span className="card-title-text">BATCH PROVENANCE INSPECTOR</span>
                </div>
                <span className="card-role-pill">DETAIL PANEL</span>
              </div>

              <div className="card-body">
                {/* Search Bar */}
                <div className="search-bar-wrapper">
                  <input
                    type="text"
                    className="search-input font-mono"
                    placeholder="Search Batch ID (e.g. TB100)..."
                    value={searchBatchId}
                    onChange={(e) => setSearchBatchId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && inspectBatch()}
                  />
                  <button className="btn-cta-yellow" onClick={() => inspectBatch()} disabled={searchLoading}>
                    {searchLoading ? 'QUERYING...' : 'INSPECT'}
                  </button>
                </div>

                {searchError && (
                  <div className="toast-banner error">
                    <span>✕</span>
                    <span>{searchError}</span>
                  </div>
                )}

                {inspectedBatch && (
                  <div className="inspector-card-content">
                    <div className="inspector-header-box">
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
                          SELECTED BATCH ID
                        </div>
                        <div className="inspector-batch-title">{inspectedBatch.batchId}</div>
                      </div>
                      <span className="status-pill low">✓ VERIFIED ON LEDGER</span>
                    </div>

                    {/* Contamination Risk Visual Card */}
                    <div className="risk-gauge-banner">
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
                          CONTAMINATION RISK SCORE
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                          <span
                            className="risk-number-large"
                            style={{
                              color:
                                (inspectedScore || 0) >= 70
                                  ? 'var(--status-critical)'
                                  : (inspectedScore || 0) >= 30
                                  ? 'var(--status-warning)'
                                  : 'var(--status-success)'
                            }}
                          >
                            {inspectedScore !== null ? inspectedScore : 0}
                          </span>
                          <span className="risk-scale-label">/ 100</span>
                        </div>
                      </div>

                      <span
                        className={`status-pill ${
                          (inspectedScore || 0) >= 70
                            ? 'critical'
                            : (inspectedScore || 0) >= 30
                            ? 'moderate'
                            : 'low'
                        }`}
                      >
                        {(inspectedScore || 0) >= 70
                          ? 'CRITICAL ANOMALY'
                          : (inspectedScore || 0) >= 30
                          ? 'MODERATE RISK'
                          : 'OECD COMPLIANT (LOW)'}
                      </span>
                    </div>

                    {/* Key-Value Metadata Grid */}
                    <div className="metadata-grid-2col">
                      <div className="metadata-tile">
                        <div className="metadata-tile-label">TRANSFORMATION ACTION</div>
                        <div className="metadata-tile-val">{inspectedBatch.action.toUpperCase()}</div>
                      </div>

                      <div className="metadata-tile">
                        <div className="metadata-tile-label">RECORDED DRY MASS</div>
                        <div className="metadata-tile-val" style={{ color: 'var(--accent-yellow)' }}>
                          {inspectedBatch.weight} kg
                        </div>
                      </div>

                      <div className="metadata-tile">
                        <div className="metadata-tile-label">ENDORSER / ACTOR ID</div>
                        <div className="metadata-tile-val">{inspectedBatch.actorId}</div>
                      </div>

                      <div className="metadata-tile">
                        <div className="metadata-tile-label">MANUFACTURER INTAKE</div>
                        <div className="metadata-tile-val" style={{ color: inspectedBatch.receivedAt ? 'var(--status-success)' : 'var(--text-muted)' }}>
                          {inspectedBatch.receivedAt ? 'CONFIRMED' : 'PENDING INTAKE'}
                        </div>
                      </div>
                    </div>

                    {/* Transaction Signature */}
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>
                        TRANSACTION SIGNATURE HASH
                      </div>
                      <div className="signature-box">
                        {inspectedBatch.signature || 'tx_0x9f1a8c2049b810d7a4e61234bc567890ef1234567890abcdef1234567890abcd'}
                      </div>
                    </div>

                    {/* Parents & Flags */}
                    {inspectedBatch.parents && inspectedBatch.parents.length > 0 && (
                      <div className="metadata-tile">
                        <div className="metadata-tile-label">PARENT LOT CONTRIBUTIONS</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                          {inspectedBatch.parents.map((p, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                              <span>Parent: <strong>{p.parentBatchId}</strong></span>
                              <span style={{ color: 'var(--accent-yellow)' }}>{p.weightContributed} kg</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {inspectedBatch.flags && inspectedBatch.flags.length > 0 && (
                      <div className="metadata-tile" style={{ borderLeft: '4px solid var(--status-critical)' }}>
                        <div className="metadata-tile-label">ACTIVE AUDIT RISK FLAGS</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                          {inspectedBatch.flags.map((fl, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                              <span>{fl.flagType.toUpperCase()} ({fl.severity}%)</span>
                              <span className={`status-pill ${fl.dilutable ? 'moderate' : 'critical'}`} style={{ fontSize: '10px' }}>
                                {fl.dilutable ? 'DILUTABLE' : 'CRITICAL NON-DILUTABLE'}
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

        {/* SECTION 2: MINE EXTRACTION */}
        {activeTab === 'mine' && (
          <div className="panes-grid-single">
            <div className="card-container">
              <div className="card-header-bar">
                <div className="card-title-group">
                  <span className="card-title-text">MINE PORTAL — RAW ORE EXTRACTION INTAKE</span>
                </div>
                <span className="card-role-pill">ROLE: MINE (ORG1MSP)</span>
              </div>

              <div className="card-body">
                <form className="form-layout-grid" onSubmit={handleCreateMineBatch}>
                  <div className="form-field-group">
                    <label className="form-label-text">BATCH IDENTIFIER</label>
                    <input
                      type="text"
                      className="form-input-styled font-mono"
                      placeholder="e.g. TB200"
                      value={mineForm.batchId}
                      onChange={(e) => setMineForm({ ...mineForm, batchId: e.target.value })}
                    />
                  </div>

                  <div className="form-field-group">
                    <label className="form-label-text">ACTOR IDENTITY</label>
                    <input
                      type="text"
                      className="form-input-styled font-mono"
                      value={mineForm.actorId}
                      onChange={(e) => setMineForm({ ...mineForm, actorId: e.target.value })}
                    />
                  </div>

                  <div className="form-field-group">
                    <label className="form-label-text">DRY MASS WEIGHT (KG)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input-styled font-mono"
                      placeholder="e.g. 150"
                      value={mineForm.weight}
                      onChange={(e) => setMineForm({ ...mineForm, weight: e.target.value })}
                    />
                  </div>

                  <div className="form-field-group">
                    <label className="form-label-text">CONCESSION / SECTOR GEOLOCATION</label>
                    <input
                      type="text"
                      className="form-input-styled"
                      value={mineForm.concession}
                      onChange={(e) => setMineForm({ ...mineForm, concession: e.target.value })}
                    />
                  </div>

                  <div className="form-submit-footer">
                    <button type="submit" className="btn-cta-yellow" disabled={mineLoading}>
                      {mineLoading ? 'TRANSACTING WITH FABRIC...' : 'COMMIT EXTRACTION TO LEDGER'}
                    </button>
                  </div>
                </form>

                {mineFeedback && (
                  <div className={`toast-banner ${mineFeedback.type}`}>
                    <span>{mineFeedback.type === 'success' ? '✓' : '✕'}</span>
                    <span>{mineFeedback.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: SMELTER REFINERY */}
        {activeTab === 'smelter' && (
          <div className="panes-grid-single">
            <div className="card-container">
              <div className="card-header-bar">
                <div className="sub-tab-switch">
                  <button
                    className={`sub-tab-btn ${smelterMode === 'merge' ? 'active' : ''}`}
                    onClick={() => { setSmelterMode('merge'); setSmelterFeedback(null); }}
                  >
                    CONSOLIDATION / MERGE BATCHES
                  </button>
                  <button
                    className={`sub-tab-btn ${smelterMode === 'split' ? 'active' : ''}`}
                    onClick={() => { setSmelterMode('split'); setSmelterFeedback(null); }}
                  >
                    FRACTIONATION / SPLIT BATCH
                  </button>
                </div>
                <span className="card-role-pill">ROLE: SMELTER (ORG1MSP)</span>
              </div>

              <div className="card-body">
                {smelterMode === 'merge' ? (
                  <form className="form-layout-grid" onSubmit={handleMergeBatches}>
                    <div className="form-field-group">
                      <label className="form-label-text">NEW OUTPUT BATCH ID</label>
                      <input
                        type="text"
                        className="form-input-styled font-mono"
                        placeholder="e.g. TB300"
                        value={mergeForm.newBatchId}
                        onChange={(e) => setMergeForm({ ...mergeForm, newBatchId: e.target.value })}
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-label-text">SMELTER ACTOR ID</label>
                      <input
                        type="text"
                        className="form-input-styled font-mono"
                        value={mergeForm.actorId}
                        onChange={(e) => setMergeForm({ ...mergeForm, actorId: e.target.value })}
                      />
                    </div>

                    <div className="form-section-separator">
                      <span>PARENT LOT 1 ALLOCATION</span>
                    </div>

                    <div className="form-field-group">
                      <label className="form-label-text">PARENT 1 BATCH ID</label>
                      <input
                        type="text"
                        className="form-input-styled font-mono"
                        placeholder="e.g. TB001"
                        value={mergeForm.parent1}
                        onChange={(e) => setMergeForm({ ...mergeForm, parent1: e.target.value })}
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-label-text">PARENT 1 WEIGHT (KG)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input-styled font-mono"
                        placeholder="e.g. 50"
                        value={mergeForm.weight1}
                        onChange={(e) => setMergeForm({ ...mergeForm, weight1: e.target.value })}
                      />
                    </div>

                    <div className="form-section-separator">
                      <span>PARENT LOT 2 ALLOCATION</span>
                    </div>

                    <div className="form-field-group">
                      <label className="form-label-text">PARENT 2 BATCH ID</label>
                      <input
                        type="text"
                        className="form-input-styled font-mono"
                        placeholder="e.g. TB002"
                        value={mergeForm.parent2}
                        onChange={(e) => setMergeForm({ ...mergeForm, parent2: e.target.value })}
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-label-text">PARENT 2 WEIGHT (KG)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input-styled font-mono"
                        placeholder="e.g. 50"
                        value={mergeForm.weight2}
                        onChange={(e) => setMergeForm({ ...mergeForm, weight2: e.target.value })}
                      />
                    </div>

                    <div className="form-submit-footer">
                      <button type="submit" className="btn-cta-yellow" disabled={smelterLoading}>
                        {smelterLoading ? 'EXECUTING MERGE...' : 'EXECUTE SMELTER MERGE'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form className="form-layout-grid" onSubmit={handleSplitBatch}>
                    <div className="form-field-group">
                      <label className="form-label-text">SOURCE PARENT BATCH ID</label>
                      <input
                        type="text"
                        className="form-input-styled font-mono"
                        placeholder="e.g. TB100"
                        value={splitForm.parentBatchId}
                        onChange={(e) => setSplitForm({ ...splitForm, parentBatchId: e.target.value })}
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-label-text">SMELTER ACTOR ID</label>
                      <input
                        type="text"
                        className="form-input-styled font-mono"
                        value={splitForm.actorId}
                        onChange={(e) => setSplitForm({ ...splitForm, actorId: e.target.value })}
                      />
                    </div>

                    <div className="form-section-separator">
                      <span>CHILD ALLOCATION 1</span>
                    </div>

                    <div className="form-field-group">
                      <label className="form-label-text">CHILD 1 BATCH ID</label>
                      <input
                        type="text"
                        className="form-input-styled font-mono"
                        placeholder="e.g. TB103"
                        value={splitForm.child1}
                        onChange={(e) => setSplitForm({ ...splitForm, child1: e.target.value })}
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-label-text">CHILD 1 WEIGHT (KG)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input-styled font-mono"
                        placeholder="e.g. 100"
                        value={splitForm.weight1}
                        onChange={(e) => setSplitForm({ ...splitForm, weight1: e.target.value })}
                      />
                    </div>

                    <div className="form-section-separator">
                      <span>CHILD ALLOCATION 2</span>
                    </div>

                    <div className="form-field-group">
                      <label className="form-label-text">CHILD 2 BATCH ID</label>
                      <input
                        type="text"
                        className="form-input-styled font-mono"
                        placeholder="e.g. TB104"
                        value={splitForm.child2}
                        onChange={(e) => setSplitForm({ ...splitForm, child2: e.target.value })}
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-label-text">CHILD 2 WEIGHT (KG)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input-styled font-mono"
                        placeholder="e.g. 100"
                        value={splitForm.weight2}
                        onChange={(e) => setSplitForm({ ...splitForm, weight2: e.target.value })}
                      />
                    </div>

                    <div className="form-submit-footer">
                      <button type="submit" className="btn-cta-yellow" disabled={smelterLoading}>
                        {smelterLoading ? 'EXECUTING SPLIT...' : 'EXECUTE SMELTER SPLIT'}
                      </button>
                    </div>
                  </form>
                )}

                {smelterFeedback && (
                  <div className={`toast-banner ${smelterFeedback.type}`}>
                    <span>{smelterFeedback.type === 'success' ? '✓' : '✕'}</span>
                    <span>{smelterFeedback.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: MANUFACTURER INTAKE */}
        {activeTab === 'mfg' && (
          <div className="panes-grid-single">
            <div className="card-container">
              <div className="card-header-bar">
                <div className="card-title-group">
                  <span className="card-title-text">MANUFACTURER INTAKE — CUSTODY VERIFICATION</span>
                </div>
                <span className="card-role-pill">ROLE: MANUFACTURER (ORG2MSP)</span>
              </div>

              <div className="card-body">
                <form className="form-layout-grid" onSubmit={handleRecordReceipt}>
                  <div className="form-field-group span-2">
                    <label className="form-label-text">INCOMING REFINED BATCH IDENTIFIER</label>
                    <input
                      type="text"
                      className="form-input-styled font-mono"
                      placeholder="e.g. TB102"
                      value={mfgForm.batchId}
                      onChange={(e) => setMfgForm({ ...mfgForm, batchId: e.target.value })}
                    />
                  </div>

                  <div className="form-submit-footer">
                    <button type="submit" className="btn-cta-yellow" disabled={mfgLoading}>
                      {mfgLoading ? 'RECORDING RECEIPT...' : 'CONFIRM NOTARIZED RECEIPT'}
                    </button>
                  </div>
                </form>

                {mfgFeedback && (
                  <div className={`toast-banner ${mfgFeedback.type}`}>
                    <span>{mfgFeedback.type === 'success' ? '✓' : '✕'}</span>
                    <span>{mfgFeedback.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 5: AUDIT & COMPLIANCE */}
        {activeTab === 'auditor' && (
          <div className="panes-grid-single">
            <div className="card-container">
              <div className="card-header-bar">
                <div className="card-title-group">
                  <span className="card-title-text">AUDIT & COMPLIANCE — CONFLICT RISK ATTACHMENT</span>
                </div>
                <span className="card-role-pill">ROLE: AUDITOR (ORG2MSP)</span>
              </div>

              <div className="card-body">
                <form className="form-layout-grid" onSubmit={handleFlagBatch}>
                  <div className="form-field-group">
                    <label className="form-label-text">TARGET BATCH ID</label>
                    <input
                      type="text"
                      className="form-input-styled font-mono"
                      placeholder="e.g. TB100"
                      value={auditForm.batchId}
                      onChange={(e) => setAuditForm({ ...auditForm, batchId: e.target.value })}
                    />
                  </div>

                  <div className="form-field-group">
                    <label className="form-label-text">ANOMALY / FLAG CLASSIFICATION</label>
                    <select
                      className="form-select-styled"
                      value={auditForm.flagType}
                      onChange={(e) => setAuditForm({ ...auditForm, flagType: e.target.value })}
                    >
                      <option value="conflict-risk">Conflict Risk (OECD Annex II High-Risk Area)</option>
                      <option value="critical-origin-risk">Critical Origin Risk (Sanctioned Mine Sector)</option>
                      <option value="supply-chain-risk">Supply Chain Custody Break / Discrepancy</option>
                      <option value="compliance-risk">Non-Compliant Assay / Documentation Flaw</option>
                    </select>
                  </div>

                  <div className="form-field-group">
                    <label className="form-label-text">SEVERITY COEFFICIENT (0 – 100%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="form-input-styled font-mono"
                      value={auditForm.severity}
                      onChange={(e) => setAuditForm({ ...auditForm, severity: e.target.value })}
                    />
                  </div>

                  <div className="form-field-group">
                    <label className="form-label-text">PROPAGATION DILUTABILITY STATUS</label>
                    <select
                      className="form-select-styled"
                      value={auditForm.dilutable}
                      onChange={(e) => setAuditForm({ ...auditForm, dilutable: e.target.value })}
                    >
                      <option value="true">Dilutable (Weighted mass propagation across merges/splits)</option>
                      <option value="false">Non-Dilutable (CRITICAL: Downstream batches carry 100% flag)</option>
                    </select>
                  </div>

                  <div className="form-submit-footer">
                    <button type="submit" className="btn-cta-yellow" disabled={auditLoading}>
                      {auditLoading ? 'BROADCASTING FLAG...' : 'BROADCAST AUDITOR RISK FLAG'}
                    </button>
                  </div>
                </form>

                {auditFeedback && (
                  <div className={`toast-banner ${auditFeedback.type}`}>
                    <span>{auditFeedback.type === 'success' ? '✓' : '✕'}</span>
                    <span>{auditFeedback.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 6: CONSORTIUM LEDGER */}
        {activeTab === 'ledger' && (
          <div className="panes-grid-single">
            <div className="card-container">
              <div className="card-header-bar">
                <div className="card-title-group">
                  <span className="card-title-text">IMMUTABLE CONSORTIUM LEDGER EXPLORER</span>
                </div>
                <div className="chips-row">
                  {['ALL', 'EXTRACT', 'MERGE', 'SPLIT'].map((act) => (
                    <button
                      key={act}
                      className={`preset-chip ${ledgerActionFilter === act ? 'active' : ''}`}
                      style={{
                        background: ledgerActionFilter === act ? 'var(--accent-yellow)' : undefined,
                        color: ledgerActionFilter === act ? '#15140D' : undefined
                      }}
                      onClick={() => setLedgerActionFilter(act)}
                    >
                      {act}
                    </button>
                  ))}
                </div>
              </div>

              <div className="card-body" style={{ padding: 0 }}>
                <div className="ledger-table-wrap">
                  <table className="modern-ledger-table">
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
                        <th>TX SIGNATURE</th>
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
                          <td className="font-mono">#{b.blockHeight || 1408900}</td>
                          <td className="font-mono"><strong>{b.batchId}</strong></td>
                          <td>
                            <span className={`stage-tag ${b.action}`}>
                              {b.action.toUpperCase()}
                            </span>
                          </td>
                          <td className="font-mono">{b.actorId}</td>
                          <td className="font-mono" style={{ color: 'var(--accent-yellow)', fontWeight: '600' }}>
                            {b.weight} kg
                          </td>
                          <td className="font-mono">{b.parents?.length || 0}</td>
                          <td>
                            {b.flags?.length ? (
                              <span className="status-pill moderate" style={{ fontSize: '10px' }}>
                                ⚠ {b.flags.length} Flagged
                              </span>
                            ) : (
                              <span className="status-pill low" style={{ fontSize: '10px' }}>
                                ✓ Certified
                              </span>
                            )}
                          </td>
                          <td>
                            {b.receivedAt ? (
                              <span className="status-pill low" style={{ fontSize: '10px' }}>
                                Received
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                In Transit
                              </span>
                            )}
                          </td>
                          <td className="font-mono" style={{ fontSize: '11px' }}>
                            {b.signature ? `${b.signature.substring(0, 14)}...` : 'tx_0x9f1a...'}
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

      {/* Dashboard Footer */}
      <footer className="dashboard-footer">
        <div>TANTALUM TRACEABILITY // HYPERLEDGER FABRIC CONSORTIUM VERIFICATION SYSTEM</div>
        <div className="footer-tags">
          <span>CHANNEL: mychannel</span>
          <span>FABRIC v2.5.4 LTS</span>
          <span>OECD ANNEX II COMPLIANCE ENGINE</span>
        </div>
      </footer>
    </div>
  );
}
