// index.js

let nodes = [], connections = [], currentNode = null;

// ─── RENDER ────────────────────────────────────────────────────────────────
function render() {
    const ul = document.getElementById('nodesList');
    ul.innerHTML = '';
    nodes.forEach(n => {
        const li = document.createElement('li');
        let extra = '';
        if (n.type.endsWith('-gate') || n.type === 'gate') {
            extra = `[${n.rules.length} rules] → topic="${n.outputTopic||''}"`;
        } else if (n.type === 'switch') {
            extra = `[${n.rules.length} rules] → outputs=${n.outputs}`;
        } else if (n.type === 'inject') {
            extra = `payload=${n.payload}`;
        }
        li.innerText = `${n.label} (${n.type}) ${extra}`;
        if (n.type === 'switch' || n.type.endsWith('-gate') || n.type === 'gate') {
            const btn = document.createElement('button');
            btn.innerText = 'Configure';
            btn.onclick = () => openConfigPanel(n.label);
            li.appendChild(btn);
        }
        ul.appendChild(li);
    });

    ['fromNode','toNode'].forEach(id => {
        const sel = document.getElementById(id);
        sel.innerHTML = '';
        nodes.forEach(n => {
            const opt = document.createElement('option');
            opt.value = n.label; opt.text = n.label;
            sel.appendChild(opt);
        });
    });

    const cl = document.getElementById('connectionsList');
    cl.innerHTML = '';
    connections.forEach(c => {
        const li = document.createElement('li');
        li.innerText = `${c.from} → ${c.to}`;
        cl.appendChild(li);
    });

    document.getElementById('jsonPreview').innerText =
        JSON.stringify({ nodes, connections },null,2);
}

// Helper to generate unique IDs for all nodes
function makeId(prefix) {
    return prefix + "_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
}

// ─── NODE CREATORS ──────────────────────────────────────────────────────────
function addInject() {
    if (!confirm("Add Inject?")) return;
    const label = `Inject_${nodes.filter(n=>n.type==='inject').length+1}`;
    const payload = confirm("Payload TRUE? OK=true,Cancel=false");
    nodes.push({id: makeId('inject'), type:'inject',label,payload});
    render();
}

function addSwitch() {
    if (!confirm("Add Switch?")) return;
    const label = `Switch_${nodes.filter(n=>n.type==='switch').length+1}`;
    nodes.push({id: makeId('switch'), type:'switch',label,property:'',rules:[],outputs:1});
    render();
}

function addGate() {
    // Ask AND or OR
    const gateType = prompt("Gate type: and / or", "and");
    if (gateType === null) {
        // User hit Cancel
        return;
    }
    // Normalize input
    const typeLower = gateType.trim().toLowerCase();
    if (typeLower !== 'and' && typeLower !== 'or') {
        alert("Invalid gate type. Please enter 'and' or 'or'.");
        return;
    }

    // Always increment Gate_x regardless of gate type
    const gateCount = nodes.filter(n => n.label && n.label.startsWith('Gate_')).length;
    const label = `Gate_${gateCount + 1}`;
    const nodeType = typeLower + '-gate';
    nodes.push({
        id: makeId(nodeType),
        type: nodeType,
        label,
        gateType: typeLower,    // "and" or "or"
        rules: [],
        outputTopic: '',
        emitOnlyIfTrue: false
    });
    render();
}

function addDebug() {
    if (!confirm("Add a new Debug node?")) {
        return;
    }
    const label = 'Debug_' + (nodes.filter(n => n.type === 'debug').length + 1);
    nodes.push({ id: makeId('debug'), type: 'debug', inputs: [], label });
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
function sendConfig() { uibuilder.send({nodes,connections}); }

// ─── CONFIG PANEL ──────────────────────────────────────────────────────────
function openConfigPanel(label){
    currentNode = nodes.find(n=>n.label===label);
    if(!currentNode) return;
    document.getElementById('configLabel').innerText =
        `Configuring ${label} (${currentNode.type})`;
    const form = document.getElementById('ruleForm');
    form.innerHTML = '';

    if (currentNode.type === 'switch') {
        // 1) Top-level property field
        form.innerHTML += `
      <div>
        <label>Property to test:</label>
        <input id="switchProp" value="${currentNode.property}">
      </div>
    `;

        // 2) Existing rule rows
        currentNode.rules.forEach(rule => addSwitchRuleRow(rule));

        // 3) Wire Outputs header
        form.innerHTML += `<hr><h4>Wire Outputs</h4>`;

        // 4) Always show at least one output select (even if no rules yet)
        const numOutputs = Math.max(currentNode.rules.length, 1);
        for (let i = 0; i < numOutputs; i++) {
            const row = document.createElement('div');
            row.innerHTML = `
        <label>Output ${i + 1} →</label>
        <select id="wire_${i}">
          <option value="">— none —</option>
        </select>
      `;
            form.appendChild(row);

            // populate dropdown
            const sel = row.querySelector('select');
            nodes
                .filter(n2 => n2.label !== currentNode.label)
                .forEach(n2 => {
                    const opt = document.createElement('option');
                    opt.value = n2.label;
                    opt.text  = n2.label;
                    // pre-select if already wired
                    const exists = connections.find(c =>
                        c.from === currentNode.label &&
                        c.outputIndex === i &&
                        c.to === n2.label
                    );
                    if (exists) opt.selected = true;
                    sel.appendChild(opt);
                });
        }
    }
    else {
        // Gate config panel
        form.innerHTML += `
      <div><label>Output Topic:</label>
        <input id="gateTopic" value="${currentNode.outputTopic||''}">
      </div>
      <div><label>Emit Only If True:</label>
        <input id="gateEmit" type="checkbox"${currentNode.emitOnlyIfTrue?' checked':''}>
      </div>`;
        currentNode.rules.forEach(r=> addGateRuleRow(r));
    }
    document.getElementById('configPanel').style.display='block';
}

// ─── GATE RULES ─────────────────────────────────────────────────────────────
function addGateRuleRow(rule={}) {
    const form = document.getElementById('ruleForm'),
        div = document.createElement('div');
    div.classList.add('gate-rule');
    div.innerHTML = `
    <input class="prop" placeholder="property" value="${rule.property||''}">
    <select class="t">
      <option value="eq"${rule.t==='eq'?' selected':''}>eq</option>
      <option value="lt"${rule.t==='lt'?' selected':''}>lt</option>
      <option value="lte"${rule.t==='lte'?' selected':''}>lte</option>
      <option value="gt"${rule.t==='gt'?' selected':''}>gt</option>
      <option value="gte"${rule.t==='gte'?' selected':''}>gte</option>
      <option value="neq"${rule.t==='neq'?' selected':''}>neq</option>
      <option value="btwn"${rule.t==='btwn'?' selected':''}>between</option>
    </select>
    <input class="val1" placeholder="value1" value="${rule.v||''}">
    <select class="vt1">
      <option value="str"${rule.vt==='str'?' selected':''}>str</option>
      <option value="num"${rule.vt==='num'?' selected':''}>num</option>
      <option value="bool"${rule.vt==='bool'?' selected':''}>bool</option>
      <option value="prev"${rule.vt==='prev'?' selected':''}>prev</option>
    </select>
    <input class="val2" placeholder="value2" value="${rule.v2||''}" style="display:none">
    <select class="vt2" style="display:none">
      <option value="str"${rule.v2t==='str'?' selected':''}>str</option>
      <option value="num"${rule.v2t==='num'?' selected':''}>num</option>
    </select>
    <button class="removeRuleBtn">✕</button>`;
    form.appendChild(div);

    const t = div.querySelector('.t'),
        v1 = div.querySelector('.val1'),
        vt1 = div.querySelector('.vt1'),
        v2 = div.querySelector('.val2'),
        vt2 = div.querySelector('.vt2'),
        prop = div.querySelector('.prop'),
        rem = div.querySelector('.removeRuleBtn');

    function upd() {
        const bt = (t.value === 'btwn');
        v2.style.display = bt ? 'inline-block' : 'none';
        vt2.style.display = bt ? 'inline-block' : 'none';
        // If vt1 is 'prev', set property to 'payload', disable and grey out property and value
        if (vt1.value === 'prev') {
            prop.value = 'payload';
            prop.disabled = true;
            prop.style.background = '#eee';
            v1.disabled = true;
            v1.style.background = '#eee';
        } else {
            // Only restore property if not prev
            if (prop.disabled) {
                prop.value = rule.property || '';
            }
            prop.disabled = false;
            prop.style.background = '';
            v1.disabled = false;
            v1.style.background = '';
        }
    }
    t.onchange = upd;
    vt1.onchange = upd;
    upd();
    rem.onclick = () => div.remove();
}

function saveGateConfig(){
    const form=document.getElementById('ruleForm'),
        topicIn=document.getElementById('gateTopic'),
        emitIn =document.getElementById('gateEmit');

    currentNode.outputTopic = topicIn.value;
    currentNode.emitOnlyIfTrue = emitIn.checked;

    const rules=[];
    form.querySelectorAll('.gate-rule').forEach(div=>{
        let p = div.querySelector('.prop').value,
            t = div.querySelector('.t').value,
            v1 = div.querySelector('.val1').value,
            vt1 = div.querySelector('.vt1').value;
        // Always set propertyType to 'flow' for gates
        // If vt1 is 'prev', force property to 'payload'
        if (vt1 === 'prev') p = 'payload';
        const r={ property:p, propertyType:'flow', t, v:v1, vt:vt1 };
        if(t==='btwn'){
            r.v2=div.querySelector('.val2').value;
            r.v2t=div.querySelector('.vt2').value;
        }
        rules.push(r);
    });
    currentNode.rules=rules;
}

// ─── SWITCH RULES ───────────────────────────────────────────────────────────
function addSwitchRuleRow(rule={}){
    const form=document.getElementById('ruleForm'),
        div=document.createElement('div');
    div.classList.add('switch-rule');
    div.innerHTML=`
    <select class="t">
      <option value="eq"${rule.t==='eq'?' selected':''}>==</option>
      <option value="lt"${rule.t==='lt'?' selected':''}><</option>
      <option value="lte"${rule.t==='lte'?' selected':''}>&le;</option>
      <option value="gt"${rule.t==='gt'?' selected':''}>></option>
      <option value="gte"${rule.t==='gte'?' selected':''}>&ge;</option>
      <option value="neq"${rule.t==='neq'?' selected':''}>!=</option>
      <option value="btwn"${rule.t==='btwn'?' selected':''}>between</option>
      <option value="jsonata_exp"${rule.t==='jsonata_exp'?' selected':''}>JSONata</option>
    </select>
    <input class="val1" placeholder="value1" value="${rule.v||''}">
    <select class="vt1">
      <option value="str"${rule.vt==='str'?' selected':''}>str</option>
      <option value="num"${rule.vt==='num'?' selected':''}>num</option>
      <option value="bool"${rule.vt==='bool'?' selected':''}>bool</option>
      <option value="jsonata"${rule.vt==='jsonata'?' selected':''}>JSONata</option>
    </select>
    <input class="val2" placeholder="value2" value="${rule.v2||''}" style="display:none">
    <select class="vt2" style="display:none">
      <option value="str"${rule.v2t==='str'?' selected':''}>str</option>
      <option value="num"${rule.v2t==='num'?' selected':''}>num</option>
    </select>
    <button class="removeRuleBtn">✕</button>`;
    form.appendChild(div);

    const t=div.querySelector('.t'),
        v1=div.querySelector('.val1'),
        vt1=div.querySelector('.vt1'),
        v2=div.querySelector('.val2'),
        vt2=div.querySelector('.vt2'),
        rem=div.querySelector('.removeRuleBtn');

    function upd(){
        const bt=(t.value==='btwn');
        v2.style.display=bt?'inline-block':'none';
        vt2.style.display=bt?'inline-block':'none';
        if(t.value==='jsonata_exp'){
            vt1.value='jsonata'; v1.placeholder='JSONata expr';
        } else {
            if(vt1.value==='jsonata') vt1.value='str';
            v1.placeholder='value1';
        }
    }
    t.onchange=upd; upd();
    rem.onclick=()=>div.remove();
}

function saveSwitchConfig() {
    // 1) Grab the top‐level Property
    const propIn = document.getElementById('switchProp');
    currentNode.property = propIn.value;

    // 2) Rebuild the rules array
    const form = document.getElementById('ruleForm');
    const rules = [];
    form.querySelectorAll('.switch-rule').forEach(div => {
        const t   = div.querySelector('.t').value;
        const v1  = div.querySelector('.val1').value;
        const vt1 = div.querySelector('.vt1').value;
        const rule = {
            property: currentNode.property,
            propertyType: 'msg',
            t,
            v: v1,
            vt: vt1
        };
        if (t === 'btwn') {
            rule.v2  = div.querySelector('.val2').value;
            rule.v2t = div.querySelector('.vt2').value;
        }
        rules.push(rule);
    });
    currentNode.rules   = rules;
    currentNode.outputs = rules.length;  // auto‐derive outputs

    // 3) Rebuild connections for this switch
    //    Remove any old switch→* links
    connections = connections.filter(c => c.from !== currentNode.label);

    //    For each output dropdown, if non‐empty, push a connection
    rules.forEach((_, i) => {
        const sel = document.getElementById(`wire_${i}`);
        if (sel && sel.value) {
            connections.push({
                from:        currentNode.label,
                to:          sel.value,
                outputIndex: i
            });
        }
    });
}

// ─── SAVE/CLOSE DISPATCH ───────────────────────────────────────────────────
function saveConfig(){
    if(!currentNode) return;
    if(currentNode.type==='switch') saveSwitchConfig();
    else if(currentNode.type.endsWith('-gate') || currentNode.type === 'gate') saveGateConfig();
    closeConfigPanel(); render();
}

function closeConfigPanel(){
    document.getElementById('configPanel').style.display='none';
    currentNode=null;
}

// ─── HELPER FUNCTIONS ──────────────────────────────────────────────────────
// Helper to check if the receive alert trigger nodes already exist
function hasReceiveAlertNodes() {
    return nodes.some(n => n.type === 'http in' && n.label === 'Receive alert') &&
           nodes.some(n => n.type === 'function' && n.label === 'extract api data');
}

// Helper to add the receive alert trigger nodes
function addReceiveAlertNodes() {
    // Only add if not already present
    if (hasReceiveAlertNodes()) return;

    const httpInId = makeId("httpin");
    const funcId = makeId("func");

    // Add the function node first (extract api data)
    nodes.push({
        id: funcId,
        type: "function",
        label: "extract api data",
        name: "extract api data",
        func: `
const alert = msg.payload || {};
flow.set("message", alert.message || "No message");
flow.set("timestamp", alert.timestamp || new Date().toISOString());
flow.set("cameraName", alert.cameraName);
flow.set("area", alert.area);
flow.set("temperature", alert.temperature);
flow.set("humidity", alert.humidity);

// File attributes
msg.filedata = Buffer.from(alert.filedata, 'base64');
msg.filename = alert.filename;
msg.filetype = alert.filetype;


return msg;
        `,
        outputs: 1,
        timeout: 0,
        noerr: 0,
        initialize: "",
        finalize: "",
        libs: [],
        x: 440,
        y: 280,
        wires: [[]] // will fill after all nodes are present
    });

    // Add the http in node, wired to the function node
    nodes.push({
        id: httpInId,
        type: "http in",
        label: "Receive alert",
        name: "Receive alert",
        url: "/receive-alert",
        method: "post",
        upload: true,
        swaggerDoc: "",
        x: 230,
        y: 280,
        wires: [[funcId]]
    });

    // Now wire the extract api data node to all gate and switch nodes
    // (do this after both nodes are pushed so all ids are available)
    function wireExtractNode() {
        const extractNode = nodes.find(n => n.type === 'function' && n.label === 'extract api data');
        if (extractNode) {
            extractNode.wires[0] = nodes
                .filter(n => n.type === 'gate' || n.type.endsWith('-gate') || n.type === 'switch')
                .map(n => n.id);
        }
    }

    // Wire immediately in case gates/switches already exist
    wireExtractNode();

    // Also wire after next render in case user adds more gates/switches after
    setTimeout(() => {
        wireExtractNode();
        render();
    }, 0);

    render();
}

let actionConfig = null;
let credentials = {}; // { [nodeId]: { userid, password } }

function addEmailActionNode(cfg) {
    const fnId = makeId('func');
    nodes.push({
        id: fnId,
        type: "function",
        label: "prepare email",
        name: "prepare email",
        func:
            `// Ensure nested objects exist
msg.smtp = msg.smtp || {};
msg.smtp.auth = msg.smtp.auth || {};
msg.smtp.tls = msg.smtp.tls || {};

// SMTP settings (dynamic)
msg.smtp.host = ${JSON.stringify(cfg.smtpServer || "smtp.gmail.com")};
msg.smtp.port = ${JSON.stringify(cfg.smtpPort || 587)};                 // number, not string
msg.smtp.secure = false;             // STARTTLS on 587
msg.smtp.auth.user = ${JSON.stringify(cfg.userid)};
msg.smtp.auth.pass = ${JSON.stringify(cfg.password)}; // use a Gmail App Password
msg.smtp.tls.rejectUnauthorized = false;    // optional

// Email fields (root-level, not inside payload)
msg.to = ${JSON.stringify(cfg.to)} || "marcusaureliusduo@gmail.com";
msg.from = ${JSON.stringify(cfg.to)} || "dinhvanloc270303@gmail.com";
msg.topic = msg.topic || "Alert";                  // subject
msg.payload = msg.payload || "An alert was received."; // body text

return msg;`,
        outputs: 1, noerr: 0, initialize: "", finalize: "", libs: [],
        x: 620, y: 300, wires: [[]]
    });

    const emailNodeId = makeId('emaildyn');
    nodes.push({
        id: emailNodeId,
        type: "email-dynamic",
        label: "Send Email (dynamic)",
        name: "",
        smtpServer: "",
        smtpPort: "587",
        smtpUser: "",
        smtpPass: "",
        secure: false,
        tlsRejectUnauthorized: false,
        x: 820, y: 300, wires: [[]]
    });

    const prep = nodes.find(n => n.id === fnId);
    if (prep) prep.wires = [[emailNodeId]];
    render();
}

// ─── BIND EVENTS ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('addInjectBtn').onclick = addInject;
    document.getElementById('addGateBtn').onclick   = ()=>addGate('and-gate');
    document.getElementById('addDebugBtn').onclick  = addDebug;
    document.getElementById('addSwitchBtn').onclick = addSwitch;
    document.getElementById('addConnectionBtn').onclick = addConnectionFromDropdown;
    document.getElementById('clearPreviewBtn').onclick   = clearPreview;
    document.getElementById('clearAllBtn').onclick       = clearAll;
    document.getElementById('sendConfigBtn').onclick     = sendConfig;
    document.getElementById('addRuleRowBtn').onclick     = ()=>{
        if(currentNode?.type==='switch') addSwitchRuleRow();
        else                              addGateRuleRow();
    };
    document.getElementById('saveConfigBtn').onclick  = saveConfig;
    document.getElementById('closeConfigPanelBtn').onclick = closeConfigPanel;

    // Listen for changes to the triggerWhen dropdown
    const triggerWhen = document.getElementById('triggerWhen');
    if (triggerWhen) {
        triggerWhen.addEventListener('change', function() {
            if (this.value === 'receive_alert') {
                addReceiveAlertNodes();
            }
        });
        // Trigger on page load if already selected
        if (triggerWhen.value === 'receive_alert') {
            addReceiveAlertNodes();
        }
    }

    const actionSelect = document.getElementById('actionSelect');
    const saveEmailActionBtn = document.getElementById('saveEmailActionBtn');

    const emailConfigEl = document.getElementById('emailConfig');
    function toggleEmail(show) {
        emailConfigEl.style.display = show ? 'block' : 'none';
    }

    if (actionSelect) {
        actionSelect.addEventListener('change', () => {
            toggleEmail(actionSelect.value === 'send_email');
        });
    }

    if (saveEmailActionBtn) {
        saveEmailActionBtn.addEventListener('click', () => {
            const userid   = document.getElementById('emailFrom').value.trim();
            const password = document.getElementById('emailPass').value;
            const to       = document.getElementById('emailTo').value.trim();

            if (!userid || !password || !to) {
                alert('Please fill Gmail address, Password/App password, and To.');
                return;
            }

            actionConfig = { type: 'send_email', userid, password, to };
            addEmailActionNode(actionConfig);

            toggleEmail(false);
            actionSelect.value = '';
            ['emailFrom','emailPass','emailTo'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
        });
    }


    render();
});
