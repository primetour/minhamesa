// CONFIGURAÇÃO: Insira sua URL NOVA AQUI
const API_URL = 'https://script.google.com/macros/s/AKfycbxJgpeVtLNwzOllMIYl9SQQ0qJZ_OBprTnYMmYag4fad7UH48miduo8ktqw8nOQE1t35w/exec'; 

// VALORES PADRÃO (FALLBACK DE SEGURANÇA)
// Se a planilha falhar, o sistema usa estes dados para não travar
const DEFAULT_CONFIG = [
    { area: "PTS", slots: 15, dias: "Seg a Sex" },
    { area: "Marketing", slots: 10, dias: "Ter, Qui" },
    { area: "TI", slots: 20, dias: "Seg a Sex" },
    { area: "Financeiro", slots: 8, dias: "Seg, Qua" },
    { area: "RH", slots: 5, dias: "Sex" }
];

const CAPACITIES = { Aquario: 48, Salao: 36, Gouvea: 24 };
const TOTAL_SEATS = 48 + 36 + 24;

const seatingConfig = {
    Aquario: { baias: 4, assentosPorBaia: 6, fileiras: 2 },
    Salao:   { baias: 3, assentosPorBaia: 6, fileiras: 2 },
    Gouvea:  { baias: 2, assentosPorBaia: 6, fileiras: 2 }
};

let allReservations = [];
let departmentRules = [];
let selectedSeat = null;

window.onload = function() {
    setupDateRestrictions();
    generateSeats();
    
    // Inicia carregamento
    const loadingText = document.querySelector('.loading-text');
    if(loadingText) loadingText.textContent = "Conectando ao servidor...";
    
    fetchData(); 
    setInterval(fetchData, 8000); 
};

function setupDateRestrictions() {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Domingo, 6 = Sábado
    
    // Início da Semana Atual (Domingo)
    const start = new Date(today);
    start.setDate(today.getDate() - currentDay);
    
    // Fim da Próxima Semana (Sábado da semana que vem)
    const end = new Date(start);
    end.setDate(start.getDate() + 13); // 6 dias (fim desta) + 7 dias (próxima) = 13
    
    const dateInput = document.getElementById('reservation-date');
    
    // Define os limites no calendário HTML
    dateInput.min = start.toISOString().split('T')[0];
    dateInput.max = end.toISOString().split('T')[0];
    
    // Define o valor inicial como Hoje (ajustado para fuso horário local)
    const localToday = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    dateInput.value = localToday;
    
    // Atualiza texto informativo
    document.getElementById('week-range-text').textContent = 
        `Período permitido: ${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}`;
}

async function fetchData() {
    try {
        // Adiciona um timestamp aleatório para EVITAR CACHE DO NAVEGADOR
        const antiCache = new Date().getTime();
        const res = await fetch(`${API_URL}?nocache=${antiCache}`, { redirect: 'follow' });
        const json = await res.json();
        
        // Debug no Console (Aperte F12 para ver se chegou)
        console.log("Dados recebidos:", json);

        if (json.reservations) allReservations = json.reservations;
        
        // Prioridade total para a Planilha
        if (json.config && json.config.length > 0) {
            departmentRules = json.config;
            console.log("Config carregada da Planilha:", departmentRules);
        } else {
            console.warn("Config vazia vinda da planilha. Usando padrão.");
            // Só usa padrão se a planilha falhar
            if (departmentRules.length === 0) departmentRules = DEFAULT_CONFIG;
        }
        
        updateVisuals();
        
        // Remove texto de carregamento se existir
        const loading = document.querySelector('.loading-text');
        if(loading) loading.style.display = 'none';

    } catch (e) { 
        console.error("Erro fatal:", e);
        // Fallback de emergência
        if(departmentRules.length === 0) departmentRules = DEFAULT_CONFIG;
        renderDashboard();
    }
}

function updateVisuals() {
    updateSeatsStatus();
    updateOccupancyBar();
    renderDashboard();
}

function updateOccupancyBar() {
    const date = document.getElementById('reservation-date').value;
    const dayRes = allReservations.filter(r => r.data === date);
    
    const counts = { Aquario: 0, Salao: 0, Gouvea: 0 };
    dayRes.forEach(r => { if(counts[r.local] !== undefined) counts[r.local]++; });
    
    const pctAquario = (counts.Aquario / TOTAL_SEATS) * 100;
    const pctSalao = (counts.Salao / TOTAL_SEATS) * 100;
    const pctGouvea = (counts.Gouvea / TOTAL_SEATS) * 100;
    const totalPct = ((dayRes.length / TOTAL_SEATS) * 100).toFixed(0);

    document.getElementById('prog-aquario').style.width = `${pctAquario}%`;
    document.getElementById('prog-salao').style.width = `${pctSalao}%`;
    document.getElementById('prog-gouvea').style.width = `${pctGouvea}%`;
    
    // Tooltips seguros
    const tooltipAq = document.querySelector('#prog-aquario .tooltip');
    if(tooltipAq) tooltipAq.textContent = `Aquário: ${counts.Aquario}/${CAPACITIES.Aquario}`;
    
    const tooltipSa = document.querySelector('#prog-salao .tooltip');
    if(tooltipSa) tooltipSa.textContent = `Salão: ${counts.Salao}/${CAPACITIES.Salao}`;
    
    const tooltipGo = document.querySelector('#prog-gouvea .tooltip');
    if(tooltipGo) tooltipGo.textContent = `Gouvêa: ${counts.Gouvea}/${CAPACITIES.Gouvea}`;
    
    document.getElementById('total-percent').textContent = `Total: ${totalPct}%`;
}

function renderDashboard() {
    const container = document.getElementById('dashboard-cards');
    if(!container) return;
    
    container.innerHTML = '';
    
    if(departmentRules.length === 0) {
        container.innerHTML = '<p class="error-text">Sem dados de setores.</p>';
        return;
    }
    
    const date = document.getElementById('reservation-date').value;
    const dayRes = allReservations.filter(r => r.data === date);
    
    departmentRules.forEach(rule => {
        const occupied = dayRes.filter(r => r.setor === rule.area).length;
        const total = rule.slots;
        const statusColor = (total - occupied) <= 0 ? '#e74c3c' : '#27ae60';
        
        const card = document.createElement('div');
        card.className = 'dash-card';
        card.innerHTML = `
            <div class="card-title">${rule.area}</div>
            <div class="card-slots" style="color:${statusColor}">${occupied}/${total}</div>
            <div class="card-sub">Ocupados</div>
            <div class="card-days">${rule.dias}</div>
        `;
        container.appendChild(card);
    });
}

// --- VISUAIS ---
document.getElementById('reservation-date').addEventListener('change', () => {
    updateVisuals();
    fetchData();
});

function generateSeats() {
    document.querySelectorAll('.row').forEach(row => {
        const loc = row.dataset.location;
        const rNum = row.dataset.row;
        const cont = row.querySelector('.seats');
        const cfg = seatingConfig[loc];
        cont.innerHTML = '';
        
        for (let f=1; f<=cfg.fileiras; f++) {
            const d = document.createElement('div'); d.className = 'seat-row';
            const s = (f-1)*cfg.assentosPorBaia+1; const e = f*cfg.assentosPorBaia;
            for(let i=s; i<=e; i++) {
                const seat = document.createElement('div');
                seat.className = 'seat available';
                seat.textContent = i;
                seat.dataset.id = `${loc}-${rNum}-${i}`;
                seat.dataset.loc = loc; seat.dataset.row = rNum; seat.dataset.num = i;
                seat.onclick = () => selectSeat(seat);
                d.appendChild(seat);
            }
            cont.appendChild(d);
        }
    });
}

function updateSeatsStatus() {
  const date = document.getElementById('reservation-date').value;
  document.querySelectorAll('.seat').forEach(seat => {
    const r = allReservations.find(res =>
      res.data === date &&
      String(res.local) === seat.dataset.loc &&
      String(res.baia) === seat.dataset.row &&
      String(res.assento) === seat.dataset.num
    );
    const isSel = selectedSeat === seat;
    seat.className = isSel ? 'seat selected' : 'seat available';
    seat.title = 'Livre';
    if (r) {
      if (r.checkin_ts) {
        seat.className = 'seat checkedin';
        seat.title = '✅ Check-in realizado: ' + r.nome + ' · ' + r.setor;
      } else {
        seat.className = 'seat occupied';
        seat.title = r.nome + ' · ' + r.setor;
      }
      if (isSel) { closeModal(); alert('Ocupado por ' + r.nome); selectedSeat = null; }
    }
  });
}

function selectSeat(seat) {
    if (seat.classList.contains('occupied') || seat.classList.contains('checkedin')) return alert('Ocupado!');

    if (selectedSeat) {
        selectedSeat.classList.remove('selected');
        selectedSeat.classList.add('available');
    }
    seat.classList.add('selected'); seat.classList.remove('available');
    selectedSeat = seat;
    
    const sel = document.getElementById('department');
    sel.innerHTML = '<option value="">Selecione...</option>';
    
    // Usa a lista carregada (ou padrão) para preencher o select
    departmentRules.forEach(r => {
        sel.innerHTML += `<option value="${r.area}">${r.area}</option>`;
    });
    
    document.getElementById('selected-seat').textContent = `${seat.dataset.loc} - Baia ${seat.dataset.row} - ${seat.dataset.num}`;
    document.getElementById('reservation-modal').style.display = 'block';
}

document.querySelector('.close').addEventListener('click', closeModal);
function closeModal() {
    document.getElementById('reservation-modal').style.display = 'none';
    if(selectedSeat) {
        selectedSeat.classList.remove('selected');
        selectedSeat.classList.add('available');
        selectedSeat = null;
    }
}

document.getElementById('reservation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!selectedSeat) return;
    
    const btn = e.target.querySelector('button');
    btn.textContent = 'Enviando...'; btn.disabled = true;
    
    const fd = new FormData();
    fd.append('data', document.getElementById('reservation-date').value);
    fd.append('nome', document.getElementById('full-name').value);
    fd.append('setor', document.getElementById('department').value);
    fd.append('local', selectedSeat.dataset.loc);
    fd.append('baia', selectedSeat.dataset.row);
    fd.append('assento', selectedSeat.dataset.num);
    
    try {
        const res = await fetch(API_URL, {method: 'POST', body: fd});
        const json = await res.json();
        if(json.success) {
            alert('Reserva OK!'); closeModal(); fetchData();
        } else {
            alert('Erro: ' + (json.message || json.error));
            if(json.error === 'DUPLICATE') fetchData();
        }
    } catch(err) { alert('Erro conexão'); }
    finally { btn.textContent = 'Confirmar'; btn.disabled = false; }
});

// ===== CHECK-IN MODULE =====

let checkinReservation = null;
let checkinSpeedData = { download: null, upload: null, tipo: null };

function openCheckinList() {
  const today = new Date();
  const todayStr = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString().split('T')[0];
  const todayRes = allReservations.filter(r => r.data === todayStr);
  const container = document.getElementById('checkin-list-content');

  if (todayRes.length === 0) {
    container.innerHTML = '<p style="color:#7f8c8d;text-align:center;padding:20px 0;">Nenhuma reserva encontrada para hoje.</p>';
  } else {
    const areas = {};
    todayRes.forEach(r => {
      if (!areas[r.local]) areas[r.local] = [];
      areas[r.local].push(r);
    });
    let html = '';
    Object.keys(areas).forEach(area => {
      html += `<div style="margin-bottom:14px;"><span class="checkin-area-title">📍 ${area}</span>`;
      areas[area].forEach(r => {
        const done = !!r.checkin_ts;
        const rJson = encodeURIComponent(JSON.stringify(r));
        const clickHandler = done ? '' : `onclick="selectCheckin('${rJson}')"`;
        html += `<div class="checkin-res-item${done ? ' done' : ''}" ${clickHandler}>
          <strong>${r.nome}</strong> — ${r.setor}
          <small>Baia ${r.baia} · Assento ${r.assento}</small>
          ${done ? '<span class="checkin-done-badge">✅ Check-in já realizado</span>' : ''}
        </div>`;
      });
      html += `</div>`;
    });
    container.innerHTML = html;
  }
  document.getElementById('checkin-list-modal').style.display = 'block';
}

function selectCheckin(encodedRes) {
  checkinReservation = JSON.parse(decodeURIComponent(encodedRes));
  checkinSpeedData = { download: null, upload: null, tipo: null };

  document.getElementById('checkin-form-detail').textContent =
    `${checkinReservation.nome} · ${checkinReservation.setor} · ${checkinReservation.local} › Baia ${checkinReservation.baia} · Assento ${checkinReservation.assento}`;

  const items = [
    { key: 'cabo_rede',    label: '🔌 Cabo de Rede' },
    { key: 'cabo_monitor', label: '🖥️ Cabo do Monitor' },
    { key: 'cadeira',      label: '🪑 Cadeira' }
  ];
  let html = '';
  items.forEach(item => {
    html += `<div class="checkin-item-block">
      <p>${item.label}</p>
      <div class="status-options">
        <label>
          <input type="radio" name="${item.key}" value="Verde" onchange="toggleDefeito('${item.key}',false)">
          <span class="status-badge badge-verde">✅ Funcionando</span>
        </label>
        <label>
          <input type="radio" name="${item.key}" value="Vermelho" onchange="toggleDefeito('${item.key}',true)">
          <span class="status-badge badge-vermelho">❌ Com Defeito</span>
        </label>
      </div>
      <textarea id="defeito_${item.key}" class="defeito-field" placeholder="Descreva o defeito..."></textarea>
    </div>`;
  });
  document.getElementById('checkin-items').innerHTML = html;

  const stResults = document.getElementById('st-results');
  stResults.style.display = 'none';
  const stBtn = document.getElementById('speedtest-btn');
  stBtn.textContent = '🚀 Iniciar Teste';
  stBtn.disabled = false;

  const submitBtn = document.getElementById('checkin-submit-btn');
  submitBtn.textContent = '✅ Confirmar Check-in';
  submitBtn.disabled = false;

  closeCheckinModal('checkin-list-modal');
  document.getElementById('checkin-form-modal').style.display = 'block';
}

function toggleDefeito(key, show) {
  const el = document.getElementById('defeito_' + key);
  el.style.display = show ? 'block' : 'none';
  if (!show) el.value = '';
}

async function runCheckinSpeedTest() {
  const btn = document.getElementById('speedtest-btn');
  btn.disabled = true;

  // Detecção de tipo de conexão
  let tipoConexao = 'Não identificado';
  if (navigator.connection) {
    const c = navigator.connection;
    const typeMap = { ethernet: 'Cabo', wifi: 'Wi-Fi', cellular: 'Celular', none: 'Sem conexão' };
    tipoConexao = typeMap[c.type] || (c.effectiveType ? c.effectiveType.toUpperCase() : 'Não identificado');
  }

  let dlMbps = 'N/A', ulMbps = 'N/A';

  // --- DOWNLOAD: 2MB via Cloudflare ---
  btn.textContent = '⏳ Testando download...';
  try {
    const DL_SIZE = 2000000;
    const url = `https://speed.cloudflare.com/__down?bytes=${DL_SIZE}&nocache=${Date.now()}`;
    const start = performance.now();
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    await resp.blob();
    const secs = (performance.now() - start) / 1000;
    dlMbps = ((DL_SIZE * 8) / secs / 1e6).toFixed(2);
  } catch (e) {
    console.warn('Erro download test:', e);
    dlMbps = 'Erro';
  }

  // --- UPLOAD: 500KB via Apps Script (sem CORS) ---
  btn.textContent = '⏳ Testando upload...';
  try {
    const UL_SIZE = 500000;
    const fd = new FormData();
    fd.append('action', 'speedtest_upload');
    fd.append('payload', new Blob([new Uint8Array(UL_SIZE)], { type: 'application/octet-stream' }));
    const start = performance.now();
    const resp = await fetch(API_URL, { method: 'POST', body: fd, redirect: 'follow' });
    await resp.json();
    // Desconta ~600ms de overhead do Apps Script (instância quente)
    const transferSecs = Math.max((performance.now() - start) / 1000 - 0.6, 0.05);
    ulMbps = ((UL_SIZE * 8) / transferSecs / 1e6).toFixed(2);
  } catch (e) {
    console.warn('Erro upload test:', e);
    ulMbps = 'Erro';
  }

  checkinSpeedData = { download: dlMbps, upload: ulMbps, tipo: tipoConexao };
  document.getElementById('st-download').textContent = dlMbps;
  document.getElementById('st-upload').textContent = ulMbps;
  document.getElementById('st-tipo').textContent = tipoConexao;
  document.getElementById('st-results').style.display = 'block';
  btn.textContent = '✅ Teste Concluído';
  btn.disabled = false;
}

async function submitCheckin() {
  if (!checkinReservation) return;

  const keys = ['cabo_rede', 'cabo_monitor', 'cadeira'];
  for (const key of keys) {
    if (!document.querySelector(`input[name="${key}"]:checked`)) {
      alert('Por favor, preencha todos os itens de verificação antes de confirmar.');
      return;
    }
  }

  const params = new URLSearchParams();
  params.append('action', 'checkin');
  params.append('data',    checkinReservation.data);
  params.append('nome',    checkinReservation.nome);
  params.append('local',   checkinReservation.local);
  params.append('baia',    checkinReservation.baia);
  params.append('assento', checkinReservation.assento);

  keys.forEach(key => {
    const val = document.querySelector(`input[name="${key}"]:checked`).value;
    const defeito = document.getElementById('defeito_' + key).value.trim();
    params.append(key + '_status',  val);
    params.append(key + '_defeito', val === 'Vermelho' ? defeito : '');
  });

  params.append('download',     checkinSpeedData.download || 'Não testado');
  params.append('upload',       checkinSpeedData.upload   || 'Não testado');
  params.append('conexao_tipo', checkinSpeedData.tipo     || 'Não testado');

  const btn = document.getElementById('checkin-submit-btn');
  btn.textContent = '⏳ Enviando...';
  btn.disabled = true;

  try {
    const res = await fetch(API_URL, { method: 'POST', body: params, redirect: 'follow' });
    const json = await res.json();
    if (json.success) {
      alert('✅ Check-in registrado com sucesso!');
      closeCheckinModal('checkin-form-modal');
      fetchData();
    } else {
      alert('❌ Erro: ' + (json.message || json.error || 'Tente novamente.'));
      btn.textContent = '✅ Confirmar Check-in';
      btn.disabled = false;
    }
  } catch (err) {
    alert('❌ Falha de conexão. Verifique a internet e tente novamente.');
    btn.textContent = '✅ Confirmar Check-in';
    btn.disabled = false;
  }
}

function closeCheckinModal(id) {
  document.getElementById(id).style.display = 'none';
}