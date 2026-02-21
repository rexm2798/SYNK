const factoryData = {
  products: {
    "P-100": { baseCost: 210, qaHoursPerUnit: 0.45, bom: { steel: 1.1, motor: 0.3, seal: 1.8 } },
    "P-200": { baseCost: 260, qaHoursPerUnit: 0.5, bom: { steel: 1.5, copper: 0.6, coolant: 0.4 } },
    "P-300": { baseCost: 160, qaHoursPerUnit: 0.4, bom: { steel: 0.8, polymer: 1.2, seal: 1.2 } },
  },
  production: { maxUnitsPerDay: 800, scheduledLoadPct: 90, overtimeUnitsPerDay: 250 },
  materials: {
    steel: { inventory: 900, cost: 18, spotMultiplier: 1.25 },
    motor: { inventory: 140, cost: 44, spotMultiplier: 1.45 },
    seal: { inventory: 1800, cost: 6, spotMultiplier: 1.4 },
    copper: { inventory: 420, cost: 27, spotMultiplier: 1.35 },
    coolant: { inventory: 250, cost: 21, spotMultiplier: 1.3 },
    polymer: { inventory: 550, cost: 13, spotMultiplier: 1.32 },
  },
  logistics: { standard: { days: 3, costPerUnit: 5 }, expedited: { days: 1, costPerUnit: 12 } },
  qa: { dailyCapacityHours: 300, overtimeHours: 110 },
};

const AGENTS = ["Production", "Procurement", "Logistics", "Quality", "Finance", "Orchestrator"];
const $ = (id) => document.getElementById(id);
const timeline = $("timeline");
const agentGrid = $("agentGrid");
const sharedMemoryEl = $("sharedMemory");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Agent {
  constructor(name, evaluateFn) {
    this.name = name;
    this.evaluateFn = evaluateFn;
  }

  async act(sharedMemory) {
    await wait(120 + Math.random() * 200);
    return this.evaluateFn(sharedMemory);
  }
}

function renderAgents(results = {}) {
  agentGrid.innerHTML = "";
  AGENTS.forEach((name) => {
    const info = results[name] || { status: "Pending", note: "Waiting for simulation run." };
    const cls = info.status === "Yes" ? "yes" : info.status === "No" ? "no" : (info.status === "Pending" ? "pending" : "cond");
    agentGrid.innerHTML += `
      <article class="agent">
        <span class="badge ${cls}">${info.status}</span>
        <h3>${name}</h3>
        <p>${info.note}</p>
      </article>`;
  });
}

function writeMemory(sharedMemory) {
  sharedMemoryEl.textContent = JSON.stringify({
    round: sharedMemory.round,
    order: sharedMemory.order,
    proposals: sharedMemory.proposals,
    metrics: sharedMemory.metrics,
    consensus: sharedMemory.consensus,
  }, null, 2);
}

function addLog(message) {
  const li = document.createElement("li");
  li.textContent = message;
  timeline.appendChild(li);
}

function evaluateProduction(memory) {
  const { order } = memory;
  const available = Math.floor(factoryData.production.maxUnitsPerDay * (1 - factoryData.production.scheduledLoadPct / 100) * order.dueDays);
  const gap = Math.max(0, order.quantity - available);
  const overtimeCap = factoryData.production.overtimeUnitsPerDay * order.dueDays;

  memory.proposals.production = { available, gap, overtimeCap, delayDays: 0, overtimeUnits: 0 };

  if (gap === 0) return { status: "Yes", note: "Schedule can absorb order without displacement." };
  if (gap <= overtimeCap) {
    memory.proposals.production.overtimeUnits = gap;
    return { status: "Conditional", note: `Needs ${gap} overtime units.` };
  }

  memory.proposals.production.overtimeUnits = overtimeCap;
  memory.proposals.production.delayDays = Math.ceil((gap - overtimeCap) / factoryData.production.maxUnitsPerDay);
  return { status: "No", note: `Needs overtime + delay existing order by ${memory.proposals.production.delayDays} day(s).` };
}

function evaluateProcurement(memory) {
  const { order } = memory;
  const product = factoryData.products[order.productId];
  let extraMaterialCost = 0;
  const shortages = [];

  Object.entries(product.bom).forEach(([material, qtyPerUnit]) => {
    const needed = qtyPerUnit * order.quantity;
    const materialRow = factoryData.materials[material];
    if (needed > materialRow.inventory) {
      const shortage = needed - materialRow.inventory;
      extraMaterialCost += shortage * materialRow.cost * (materialRow.spotMultiplier - 1);
      shortages.push(`${material} short by ${Math.ceil(shortage)}`);
    }
  });

  memory.proposals.procurement = { shortages, extraMaterialCost };
  return shortages.length
    ? { status: "Conditional", note: `Spot-buy required (${shortages.join(", ")}).` }
    : { status: "Yes", note: "Materials available from inventory." };
}

function evaluateLogistics(memory) {
  const { order } = memory;
  const shippingMode = order.dueDays < factoryData.logistics.standard.days ? "expedited" : "standard";
  memory.proposals.logistics = { shippingMode };

  return shippingMode === "standard"
    ? { status: "Yes", note: "Standard shipping achieves commitment." }
    : { status: "Conditional", note: "Requires expedited shipping to hit SLA." };
}

function evaluateQuality(memory) {
  const { order } = memory;
  const product = factoryData.products[order.productId];
  const qaHoursNeeded = order.quantity * product.qaHoursPerUnit;
  const baseQaCap = factoryData.qa.dailyCapacityHours * order.dueDays;
  const fullQaCap = (factoryData.qa.dailyCapacityHours + factoryData.qa.overtimeHours) * order.dueDays;
  const qaOvertime = Math.max(0, qaHoursNeeded - baseQaCap);

  memory.proposals.quality = { qaHoursNeeded, qaOvertime, overload: Math.max(0, qaHoursNeeded - fullQaCap) };

  if (qaHoursNeeded <= baseQaCap) return { status: "Yes", note: "QA capacity is sufficient." };
  if (qaHoursNeeded <= fullQaCap) return { status: "Conditional", note: `Needs ${Math.ceil(qaOvertime)} QA overtime hours.` };
  return { status: "No", note: `QA overload by ${Math.ceil(qaHoursNeeded - fullQaCap)} hours.` };
}

function evaluateFinance(memory) {
  const { order } = memory;
  const product = factoryData.products[order.productId];
  const overtimeUnits = memory.proposals.production?.overtimeUnits || 0;
  const qaOvertime = memory.proposals.quality?.qaOvertime || 0;
  const shippingMode = memory.proposals.logistics?.shippingMode || "standard";
  const extraMaterialCost = memory.proposals.procurement?.extraMaterialCost || 0;

  const revenue = order.quantity * order.price;
  const baseCost = order.quantity * product.baseCost;
  const overtimeCost = overtimeUnits * 24;
  const shippingCost = order.quantity * (shippingMode === "expedited" ? factoryData.logistics.expedited.costPerUnit : factoryData.logistics.standard.costPerUnit);
  const qaCost = qaOvertime * 18;
  const totalCost = baseCost + overtimeCost + shippingCost + qaCost + extraMaterialCost;
  const marginPct = ((revenue - totalCost) / revenue) * 100;

  memory.metrics = { revenue, totalCost, marginPct, overtimeCost, shippingCost, qaCost, extraMaterialCost };

  return {
    status: marginPct >= order.marginFloor ? "Yes" : "No",
    note: `Margin ${marginPct.toFixed(1)}% vs floor ${order.marginFloor}%.`,
  };
}

function evaluateOrchestrator(memory, agentResults) {
  const statuses = Object.entries(agentResults)
    .filter(([name]) => name !== "Orchestrator")
    .map(([name, result]) => ({ name, status: result.status }));

  const hardBlocks = statuses.filter((item) => item.status === "No");
  const hasConsensus = hardBlocks.length === 0 && memory.metrics.marginPct >= memory.order.marginFloor;
  memory.consensus = {
    reached: hasConsensus,
    blockers: hardBlocks.map((item) => item.name),
  };

  return hasConsensus
    ? { status: "Yes", note: "Consensus reached. Exit negotiation loop." }
    : { status: "Conditional", note: `Continue negotiation. Blockers: ${memory.consensus.blockers.join(", ") || "none"}.` };
}

const productionAgent = new Agent("Production", evaluateProduction);
const procurementAgent = new Agent("Procurement", evaluateProcurement);
const logisticsAgent = new Agent("Logistics", evaluateLogistics);
const qualityAgent = new Agent("Quality", evaluateQuality);
const financeAgent = new Agent("Finance", evaluateFinance);

function finalizeDashboard(memory) {
  const m = memory.metrics;
  const delayDays = memory.proposals.production?.delayDays || 0;
  const shipMode = memory.proposals.logistics?.shippingMode || "standard";
  const qaHours = memory.proposals.quality?.qaHoursNeeded || 0;
  const risk = memory.consensus.reached ? (m.marginPct < memory.order.marginFloor + 3 ? "Medium" : "Low") : "High";

  $("dashboard").classList.remove("empty");
  $("dashboard").innerHTML = `
    <div class="metrics">
      <div class="metric"><small>Margin</small><strong>${m.marginPct.toFixed(1)}%</strong></div>
      <div class="metric"><small>Revenue</small><strong>$${Math.round(m.revenue).toLocaleString()}</strong></div>
      <div class="metric"><small>Total Cost</small><strong>$${Math.round(m.totalCost).toLocaleString()}</strong></div>
      <div class="metric"><small>Material Delta</small><strong>$${Math.round(m.extraMaterialCost).toLocaleString()}</strong></div>
      <div class="metric"><small>Shipping Mode</small><strong>${shipMode === "expedited" ? "Air Freight" : "Standard"}</strong></div>
      <div class="metric"><small>QA Load</small><strong>${Math.ceil(qaHours)} hrs</strong></div>
      <div class="metric"><small>Risk Score</small><strong>${risk}</strong></div>
      <div class="metric"><small>Delay Existing Order</small><strong>${delayDays ? `${delayDays} day(s)` : "No"}</strong></div>
      <div class="metric"><small>Consensus</small><strong>${memory.consensus.reached ? "Reached" : "Not Reached"}</strong></div>
    </div>
    <div class="verdict ${memory.consensus.reached ? "approve" : "reject"}">
      ${memory.consensus.reached ? "✅ APPROVE RUSH ORDER" : "⚠️ CONDITIONAL / REJECT"}
      ${delayDays ? ` • Delay order #4471 by ${delayDays} day(s)` : ""}
    </div>`;
}

async function runNegotiation(order) {
  timeline.innerHTML = "";
  const sharedMemory = {
    round: 0,
    order,
    proposals: {},
    metrics: {},
    consensus: { reached: false, blockers: [] },
  };

  addLog(`Rush order submitted: ${order.productId} × ${order.quantity}, due in ${order.dueDays} day(s).`);
  addLog("Shared context initialized. Dispatching agents in parallel.");

  let results = {};
  const maxRounds = 3;

  for (let round = 1; round <= maxRounds; round += 1) {
    sharedMemory.round = round;
    addLog(`--- Negotiation Round ${round} ---`);

    const [production, procurement, logistics, quality] = await Promise.all([
      productionAgent.act(sharedMemory),
      procurementAgent.act(sharedMemory),
      logisticsAgent.act(sharedMemory),
      qualityAgent.act(sharedMemory),
    ]);

    const finance = await financeAgent.act(sharedMemory);

    results = {
      Production: production,
      Procurement: procurement,
      Logistics: logistics,
      Quality: quality,
      Finance: finance,
    };

    results.Orchestrator = evaluateOrchestrator(sharedMemory, results);
    renderAgents(results);
    writeMemory(sharedMemory);

    addLog(`Production: ${production.note}`);
    addLog(`Procurement: ${procurement.note}`);
    addLog(`Logistics: ${logistics.note}`);
    addLog(`Quality: ${quality.note}`);
    addLog(`Finance: ${finance.note}`);
    addLog(`Orchestrator: ${results.Orchestrator.note}`);

    if (sharedMemory.consensus.reached) break;

    // policy-based negotiation adjustments for next round
    if (results.Production.status === "No") {
      sharedMemory.order.dueDays = Math.min(sharedMemory.order.dueDays + 1, 14);
      addLog("Orchestrator policy: extend due date by +1 day for next round.");
    }
    if (results.Finance.status === "No") {
      sharedMemory.order.price += 12;
      addLog("Orchestrator policy: propose price uplift of +$12/unit to protect margin.");
    }
  }

  $("roundsRan").textContent = String(sharedMemory.round);
  $("decisionTime").textContent = `${sharedMemory.round * 10}s`;
  $("finalMargin").textContent = `${(sharedMemory.metrics.marginPct || 0).toFixed(1)}%`;
  finalizeDashboard(sharedMemory);
}

$("orderForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const order = {
    productId: $("productId").value,
    quantity: Number($("quantity").value),
    dueDays: Number($("dueDays").value),
    price: Number($("price").value),
    marginFloor: Number($("marginFloor").value),
  };
  runNegotiation(order);
});

$("sampleScenario").addEventListener("click", () => {
  $("productId").value = "P-200";
  $("quantity").value = 1300;
  $("dueDays").value = 1;
  $("price").value = 335;
  $("marginFloor").value = 18;
});

renderAgents();
