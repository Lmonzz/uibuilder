// index.js
/**
 * @type {any}
 */
let uibuilder;

uibuilder.start();
uibuilder.onChange('msg', msg => {
    document.getElementById('status').innerText = msg.payload;
});

let nodes = [], connections = [], currentGate = null;

function render() {
    // Render nodes
    const ul = document.getElementById('nodesList');
    ul.innerHTML = '';
    nodes.forEach(n => {
        const li = document.createElement('li');
        const extra = n.gateType ? `(${n.gateType.toUpperCase()})` :
            n.payload !== undefined ? `payload=${n.payload}` : '';
        li.innerHTML = `${n.label} - ${n.type} ${extra}`;
        if (n.type === 'gate' && Array.isArray(n.rules)) {
            li.innerHTML += ` [${n.rules.length} rule${n.rules.length > 1 ? 's' : ''}]`;
        }
        if (n.type === 'gate') {
            const btn = document.createElement('button');
            btn.innerText = 'Configure';
            btn.onclick = () => openConfigPanel(n.label);
            li.appendChild(btn);
        }
        ul.appendChild(li);
    });

    // Render select options
    const selFrom = document.getElementById('fromNode');
    const selTo = document.getElementById('toNode');
    [selFrom, selTo].forEach(sel => {
        sel.innerHTML = '';
        nodes.forEach(n => {
            const opt = document.createElement('option');
            opt.value = n.label;
            opt.text = n.label;
            sel.appendChild(opt);
        });
    });

    // Render connections
    const cl = document.getElementById('connectionsList');
    cl.innerHTML = '';
    connections.forEach((c, i) => {
        const li = document.createElement('li');
        li.innerText = `${c.from} → ${c.to}`;
        cl.appendChild(li);
    });

    // Render JSON preview
    document.getElementById('jsonPreview').innerText = JSON.stringify({ nodes, connections }, null, 2);
}

function addInject() {
    const label = 'Inject_' + (nodes.filter(n => n.type === 'inject').length + 1);
    const payload = confirm("Payload TRUE? Click OK for true, Cancel for false.");
    nodes.push({ type: 'inject', payload, label });
    render();
}
function addGate() {
    const label = 'Gate_' + (nodes.filter(n => n.type === 'gate').length + 1);
    const gateType = prompt("Gate type: and / or", "and");
    const inputs = [];
    nodes.push({ type: 'gate', gateType, inputs, label });
    render();
}
function addDebug() {
    const label = 'Debug_' + (nodes.filter(n => n.type === 'debug').length + 1);
    const inputs = [];
    nodes.push({ type: 'debug', inputs, label });
    render();
}
function clearPreview() {
    document.getElementById('jsonPreview').innerText = '';
}
function clearAll() {
    if (confirm("Are you sure you want to clear all nodes and connections?")) {
        nodes = [];
        connections = [];
        render();
        clearPreview();
    }
}
function addConnectionFromDropdown() {
    const from = document.getElementById('fromNode').value;
    const to = document.getElementById('toNode').value;
    if (!from || !to || from === to) return;
    connections.push({ from, to });
    render();
}
function sendConfig() {
    uibuilder.send({ nodes, connections });
}

// Gate config panel
function openConfigPanel(label) {
    currentGate = nodes.find(n => n.label === label && n.type === 'gate');
    if (!currentGate) return;
    document.getElementById('configLabel').innerText = `Configuring ${label}`;
    document.getElementById('ruleForm').innerHTML = '';
    (currentGate.rules || []).forEach(rule => addRuleRow(rule));
    document.getElementById('configPanel').style.display = 'block';
}
function addRuleRow(rule = {}) {
    const form = document.getElementById('ruleForm');
    const div = document.createElement('div');
    div.innerHTML = `
        <input class="prop" placeholder="property" value="${rule.property || ''}">
        <select class="t">
            <option value="eq"${rule.t === 'eq' ? ' selected' : ''}>eq</option>
            <option value="lt"${rule.t === 'lt' ? ' selected' : ''}>lt</option>
            <option value="lte"${rule.t === 'lte' ? ' selected' : ''}>lte</option>
            <option value="gt"${rule.t === 'gt' ? ' selected' : ''}>gt</option>
            <option value="gte"${rule.t === 'gte' ? ' selected' : ''}>gte</option>
            <option value="neq"${rule.t === 'neq' ? ' selected' : ''}>neq</option>
        </select>
        <input class="val" placeholder="value" value="${rule.v || ''}">
        <select class="vt">
            <option value="str"${rule.vt === 'str' ? ' selected' : ''}>str</option>
            <option value="num"${rule.vt === 'num' ? ' selected' : ''}>num</option>
            <option value="bool"${rule.vt === 'bool' ? ' selected' : ''}>bool</option>
            <option value="prev"${rule.vt === 'prev' ? ' selected' : ''}>prev</option>
        </select>
    `;
    form.appendChild(div);
    const propInput = div.querySelector('.prop');
    const valInput = div.querySelector('.val');
    const vtSelect = div.querySelector('.vt');
    function handlePrevMode() {
        if (vtSelect.value === 'prev') {
            propInput.value = 'payload';
            propInput.disabled = true;
            valInput.value = '';
            valInput.disabled = true;
        } else {
            propInput.disabled = false;
            valInput.disabled = false;
        }
    }
    vtSelect.addEventListener('change', handlePrevMode);
    handlePrevMode();
}
function saveConfig() {
    if (!currentGate) return;
    const form = document.getElementById('ruleForm');
    const rules = [];
    Array.from(form.children).forEach(function (div) {
        // Convert NodeList to Array and use indexing for destructuring
        const inputs = Array.from(div.querySelectorAll('input, select'));
        const propertyInput = inputs[0];
        const tSelect = inputs[1];
        const valueInput = inputs[2];
        const vtSelect = inputs[3];
        rules.push({
            property: propertyInput.value,
            propertyType: "flow",
            t: tSelect.value,
            v: valueInput.value,
            vt: vtSelect.value
        });
    });
    currentGate.rules = rules;
    closeConfigPanel();
    render();
}

function closeConfigPanel() {
    document.getElementById('configPanel').style.display = 'none';
    currentGate = null;
}

// Bind UI events on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('addInjectBtn').onclick = addInject;
    document.getElementById('addGateBtn').onclick = addGate;
    document.getElementById('addDebugBtn').onclick = addDebug;
    document.getElementById('addConnectionBtn').onclick = addConnectionFromDropdown;
    document.getElementById('clearPreviewBtn').onclick = clearPreview;
    document.getElementById('clearAllBtn').onclick = clearAll;
    document.getElementById('sendConfigBtn').onclick = sendConfig;
    document.getElementById('addRuleRowBtn').onclick = () => addRuleRow();
    document.getElementById('saveConfigBtn').onclick = saveConfig;
    document.getElementById('closeConfigPanelBtn').onclick = closeConfigPanel;
    render();
});
