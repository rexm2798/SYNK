const data = {
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
    polymer: { inventory: 550, cost: 13, spotMultiplier: 1.32 }
  },
  logistics: {
    standard: { days: 3, costPerUnit: 5 },
    expedited: { days: 1, costPerUnit: 12 },
  },
  qa: { dailyCapacityHours: 300, overtimeHours: 110 },
};

const agents = ["Production", "Procurement", "Logistics", "Quality", "Finance", "Orchestrator"];
const $ = (id) => document.getElementById(id);
const timeline = $("timeline");
const agentGrid = $("agentGrid");

function renderAgents(results = {}) {
  agentGrid.innerHTML = "";
  agents.forEach((name) => {
    const info = results[name] || { status: "Pending", note: "Waiting for simulation run." };
    const cls = info.status === "Yes" ? "yes" : info.status === "No" ? "no" : "cond";
    agentGrid.innerHTML += `
      <article class="agent">
        <span class="badge ${cls}">${info.status}</span>
        <h3>${name}</h3>
        <p>${info.note}</p>
      </article>`;
  });
}

function addLog(msg) {
  const li = document.createElement("li");
  li.textContent = msg;
  timeline.appendChild(li);
}

function evaluate(order) {
  const product = data.products[order.productId];
  const results = {};
  const constraints = { extraMaterialCost: 0, delayDays: 0, shipMode: "standard", overtimeUnits: 0, qaOvertime: 0 };

  // Production
  const baseAvailable = Math.floor(data.production.maxUnitsPerDay * (1 - data.production.scheduledLoadPct / 100) * order.dueDays);
  if (baseAvailable >= order.quantity) {
    results.Production = { status: "Yes", note: "Existing schedule can absorb rush order." };
  } else {
    const gap = order.quantity - baseAvailable;
    const overtimeCap = data.production.overtimeUnitsPerDay * order.dueDays;
    if (gap <= overtimeCap) {
      constraints.overtimeUnits = gap;
      results.Production = { status: "Conditional", note: `Needs ${gap} overtime units across ${order.dueDays} day(s).` };
    } else {
      constraints.delayDays = Math.ceil((gap - overtimeCap) / data.production.maxUnitsPerDay);
      constraints.overtimeUnits = overtimeCap;
      results.Production = { status: "No", note: `Requires overtime + delaying existing order by ${constraints.delayDays} day(s).` };
    }
  }

  // Procurement
  let shortages = [];
  Object.entries(product.bom).forEach(([mat, qtyPerUnit]) => {
    const req = qtyPerUnit * order.quantity;
    const inv = data.materials[mat]?.inventory || 0;
    if (req > inv) {
      const shortage = req - inv;
      const unitCost = data.materials[mat].cost;
      constraints.extraMaterialCost += shortage * unitCost * (data.materials[mat].spotMultiplier - 1);
      shortages.push(`${mat} short by ${Math.ceil(shortage)}`);
    }
  });
  results.Procurement = shortages.length
    ? { status: "Conditional", note: `Spot buy required: ${shortages.join(", ")}.` }
    : { status: "Yes", note: "All materials available in current inventory." };

  // Logistics
  const standardPossible = order.dueDays >= data.logistics.standard.days;
  constraints.shipMode = standardPossible ? "standard" : "expedited";
  results.Logistics = standardPossible
    ? { status: "Yes", note: "Standard shipping meets SLA." }
    : { status: "Conditional", note: "Need expedited shipping to meet due date." };

  // Quality
  const qaHoursNeeded = order.quantity * product.qaHoursPerUnit;
  const qaCap = (data.qa.dailyCapacityHours + data.qa.overtimeHours) * order.dueDays;
  if (qaHoursNeeded <= qaCap) {
    constraints.qaOvertime = Math.max(0, qaHoursNeeded - (data.qa.dailyCapacityHours * order.dueDays));
    results.Quality = { status: constraints.qaOvertime ? "Conditional" : "Yes", note: constraints.qaOvertime ? `Needs ${Math.ceil(constraints.qaOvertime)} QA overtime hrs.` : "QA capacity is sufficient." };
  } else {
    results.Quality = { status: "No", note: `Inspection overload of ${Math.ceil(qaHoursNeeded - qaCap)} hrs.` };
  }

  // Finance
  const revenue = order.quantity * order.price;
  const baseCost = order.quantity * product.baseCost;
  const overtimeCost = constraints.overtimeUnits * 24;
  const shippingCost = order.quantity * (constraints.shipMode === "expedited" ? data.logistics.expedited.costPerUnit : data.logistics.standard.costPerUnit);
  const qaCost = constraints.qaOvertime * 18;
  const totalCost = baseCost + overtimeCost + shippingCost + qaCost + constraints.extraMaterialCost;
  const marginPct = ((revenue - totalCost) / revenue) * 100;

  const financeYes = marginPct >= order.marginFloor;
  results.Finance = {
    status: financeYes ? "Yes" : "No",
    note: `Projected margin ${marginPct.toFixed(1)}% vs floor ${order.marginFloor}%.`,
  };

  // Orchestrator consensus
  const blockers = Object.entries(results).filter(([_, r]) => r.status === "No");
  const approval = blockers.length === 0 && financeYes;
  results.Orchestrator = {
    status: approval ? "Yes" : "Conditional",
    note: approval ? "Consensus reached across all agents." : `Negotiation needed: ${blockers.map(([k]) => k).join(", ") || "Trade-offs pending"}.`
  };

  return { results, metrics: { marginPct, revenue, totalCost, ...constraints, qaHoursNeeded, approval } };
}

function runSimulation(order) {
  timeline.innerHTML = "";
  addLog(`Rush order created: ${order.productId} × ${order.quantity} units, due in ${order.dueDays} days.`);

  const { results, metrics } = evaluate(order);

  renderAgents(results);
  addLog("All departmental agents evaluated constraints in parallel.");
  if (metrics.delayDays) addLog(`Production proposes delaying order #4471 by ${metrics.delayDays} day(s).`);
  if (metrics.extraMaterialCost > 0) addLog(`Procurement proposes spot buying materials (+$${Math.round(metrics.extraMaterialCost).toLocaleString()}).`);
  if (metrics.shipMode === "expedited") addLog("Logistics switched to expedited shipping mode.");
  addLog(`Finance recalculated margin at ${metrics.marginPct.toFixed(1)}% (floor ${order.marginFloor}%).`);
  addLog(metrics.approval ? "Consensus reached. Plant Head can approve." : "Consensus not reached. Plant Head decision required with risk warnings.");

  $("roundsRan").textContent = metrics.approval ? "2" : "3";
  $("decisionTime").textContent = `${metrics.approval ? 24 : 30}s`;
  $("finalMargin").textContent = `${metrics.marginPct.toFixed(1)}%`;

  const risk = metrics.approval ? (metrics.marginPct < order.marginFloor + 3 ? "Medium" : "Low") : "High";
  $("dashboard").classList.remove("empty");
  $("dashboard").innerHTML = `
    <div class="metrics">
      <div class="metric"><small>Margin</small><strong>${metrics.marginPct.toFixed(1)}%</strong></div>
      <div class="metric"><small>Revenue</small><strong>$${Math.round(metrics.revenue).toLocaleString()}</strong></div>
      <div class="metric"><small>Extra Material Cost</small><strong>$${Math.round(metrics.extraMaterialCost).toLocaleString()}</strong></div>
      <div class="metric"><small>Shipping Mode</small><strong>${metrics.shipMode === "expedited" ? "Air Freight" : "Standard"}</strong></div>
      <div class="metric"><small>QA Hours</small><strong>${Math.ceil(metrics.qaHoursNeeded)} hrs</strong></div>
      <div class="metric"><small>Risk Score</small><strong>${risk}</strong></div>
    </div>
    <div class="verdict ${metrics.approval ? "approve" : "reject"}">
      ${metrics.approval ? "✅ APPROVE RUSH ORDER" : "⚠️ CONDITIONAL / REJECT"}
      ${metrics.delayDays ? ` • Delay existing order #4471 by ${metrics.delayDays} day(s)` : ""}
    </div>`;
}

$("orderForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const order = {
    productId: $("productId").value,
    quantity: Number($("quantity").value),
    dueDays: Number($("dueDays").value),
    price: Number($("price").value),
    marginFloor: Number($("marginFloor").value),
  };
  runSimulation(order);
});

$("sampleScenario").addEventListener("click", () => {
  $("productId").value = "P-200";
  $("quantity").value = 1200;
  $("dueDays").value = 2;
  $("price").value = 360;
  $("marginFloor").value = 18;
});

renderAgents();
