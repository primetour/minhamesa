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

let checkinFromLanding = false;

function showView(name) {
  ['landing', 'login', 'app', 'checkin-email', 'checkin-done'].forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.style.display = 'none';
  });
  const el = document.getElementById('view-' + name);
  if (el) el.style.display = 'block';
  if (name !== 'login') { const p = document.getElementById('login-password'); if (p) p.value = ''; }
  if (name !== 'checkin-email') { const e = document.getElementById('checkin-email-input'); if (e) e.value = ''; }
}

function doLogin() {
  const pwd = document.getElementById('login-password').value;
  if (pwd === 'Prime@2026') {
    showView('app');
  } else {
    alert('Senha incorreta. Tente novamente.');
    document.getElementById('login-password').value = '';
    document.getElementById('login-password').focus();
  }
}

async function verifyCheckinEmail() {
  const prefix = document.getElementById('checkin-email-input').value.trim().toLowerCase();
  if (!prefix) { alert('Digite seu e-mail para continuar.'); return; }
  const domain = document.getElementById('email-domain-checkin').value;
const email = prefix + domain;

  const today = new Date();
  const todayStr = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString().split('T')[0];

  const reservation = allReservations.find(r =>
    r.data === todayStr && r.nome.toLowerCase() === email
  );

  if (!reservation) {
    alert('Nenhuma reserva encontrada para hoje com este e-mail.\n\nVerifique o e-mail digitado ou entre em contato com o C&P.');
    return;
  }
  if (reservation.checkin_ts) {
    alert('Check-in já realizado para esta reserva.');
    return;
  }

  checkinFromLanding = true;
  selectCheckin(encodeURIComponent(JSON.stringify(reservation)));
}

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
    
    document.getElementById('selected-seat').textContent = `${seat.dataset.loc} - Fileira ${seat.dataset.row} - Posição ${seat.dataset.num}`;
    document.getElementById('reservation-modal').style.display = 'block';
}

document.getElementById('reservation-modal').querySelector('.close').addEventListener('click', closeModal);
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
    const domain = document.getElementById('email-domain-reserva').value;
    fd.append('nome', document.getElementById('full-name').value.trim().toLowerCase() + domain);
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
          <small>Fileira ${r.baia} · Posição ${r.assento}</small>
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
    `${checkinReservation.nome} · ${checkinReservation.setor} · ${checkinReservation.local} › Fileira ${checkinReservation.baia} · Posição ${checkinReservation.assento}`;

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

async function detectConnectionType() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    if (navigator.connection && navigator.connection.type === 'cellular') return 'celular-dados';
    return 'celular-wifi';
  }
  // Desktop: tenta tipo explícito primeiro
  if (navigator.connection && navigator.connection.type === 'ethernet') return 'desktop-cabo';
  if (navigator.connection && navigator.connection.type === 'wifi')     return 'desktop-wifi';
  // Fallback padrão desktop — usuário vai confirmar no seletor
  return 'desktop-cabo';
}

function measureUploadXHR(url, sizeBytes) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const data = new Uint8Array(sizeBytes);
    const startTime = performance.now();
    let firstProgressAt = null, lastLoaded = 0, lastTime = null;
    const samples = [];

    xhr.upload.onprogress = (e) => {
      const now = performance.now();
      if (firstProgressAt === null) {
        firstProgressAt = now; lastLoaded = e.loaded; lastTime = now; return;
      }
      const dt = (now - lastTime) / 1000;
      if (dt >= 0.05 && e.loaded > lastLoaded) {
        samples.push((e.loaded - lastLoaded) / dt);
        lastLoaded = e.loaded; lastTime = now;
      }
    };

    xhr.upload.onloadend = () => {
      if (samples.length >= 1) {
        const sorted = [...samples].sort((a, b) => b - a);
        const top = sorted.slice(0, Math.ceil(sorted.length * 0.7));
        const avg = top.reduce((a, b) => a + b) / top.length;
        resolve((avg * 8 / 1e6).toFixed(2));
      } else if (firstProgressAt !== null) {
        // Conexão muito rápida: sem amostras intermediárias, usa tempo total do upload
        const elapsed = Math.max((performance.now() - firstProgressAt) / 1000, 0.01);
        resolve((sizeBytes * 8 / elapsed / 1e6).toFixed(2));
      } else {
        reject(new Error('Sem dados de upload'));
      }
    };

    xhr.onerror   = () => reject(new Error('Erro XHR'));
    xhr.ontimeout = () => reject(new Error('Timeout'));
    xhr.timeout   = 30000;

    // FormData = multipart/form-data = "simple" content-type = sem CORS preflight
    const fd = new FormData();
    fd.append('action', 'speedtest_upload');
    fd.append('payload', new Blob([data], { type: 'application/octet-stream' }));
    xhr.open('POST', url);
    xhr.send(fd);
  });
}

function updateCheckinSpeedData() {
  const tipoMap = {
    'desktop-cabo':  '🖥️ Desktop · Cabo de Rede',
    'desktop-wifi':  '💻 Desktop · Wi-Fi',
    'celular-wifi':  '📱 Celular · Wi-Fi',
    'celular-dados': '📱 Celular · Dados móveis'
  };
  const sel = document.getElementById('st-conexao-selector');
  if (sel) checkinSpeedData.tipo = tipoMap[sel.value] || sel.value;
}

async function runCheckinSpeedTest() {
  const btn = document.getElementById('speedtest-btn');
  btn.disabled = true;

  let dlMbps = 'N/A', ulMbps = 'N/A';

  // --- DOWNLOAD: 6 streams × 5MB ---
  btn.textContent = '⏳ Testando download...';
  try {
    const STREAMS = 6, SIZE = 5000000, ts = Date.now();
    const start = performance.now();
    const blobs = await Promise.all(
      Array.from({ length: STREAMS }, (_, i) =>
        fetch(`https://speed.cloudflare.com/__down?bytes=${SIZE}&r=${ts}${i}`, { cache: 'no-store' })
          .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
      )
    );
    const elapsed = (performance.now() - start) / 1000;
    dlMbps = ((blobs.reduce((s, b) => s + b.size, 0) * 8) / elapsed / 1e6).toFixed(2);
  } catch (e) {
    console.warn('Erro download:', e);
    dlMbps = 'Erro';
  }

  // --- UPLOAD: Cloudflare no-cors (sem preflight, latência mínima) ---
  btn.textContent = '⏳ Testando upload...';
  try {
    // no-cors = sem bloqueio CORS, FormData = content-type simples permitido
    const STREAMS = 4, SIZE = 8000000, ts = Date.now(); // 4 × 8MB = 32MB
    const start = performance.now();
    await Promise.all(
      Array.from({ length: STREAMS }, (_, i) => {
        const fd = new FormData();
        fd.append('d', new Blob([new Uint8Array(SIZE)]));
        return fetch(`https://speed.cloudflare.com/__up?r=${ts}${i}`, {
          method: 'POST',
          body: fd,
          mode: 'no-cors',
          cache: 'no-store'
        });
      })
    );
    const elapsed = (performance.now() - start) / 1000;
    ulMbps = ((STREAMS * SIZE * 8) / elapsed / 1e6).toFixed(2);
  } catch (e) {
    // Fallback: Apps Script com XHR corrigido
    console.warn('Cloudflare upload falhou, usando fallback:', e);
    try {
      ulMbps = await measureUploadXHR(API_URL, 3000000);
    } catch (e2) {
      ulMbps = 'Erro';
    }
  }

  // --- TIPO DE CONEXÃO ---
  const tipoKey = await detectConnectionType();
  const tipoLabels = {
    'desktop-cabo':  '🖥️ Desktop · Cabo de Rede',
    'desktop-wifi':  '💻 Desktop · Wi-Fi',
    'celular-wifi':  '📱 Celular · Wi-Fi',
    'celular-dados': '📱 Celular · Dados móveis'
  };

  document.getElementById('st-download').textContent = dlMbps;
  document.getElementById('st-upload').textContent = ulMbps;
  document.getElementById('st-tipo').textContent = tipoLabels[tipoKey] || tipoKey;

  const sel = document.getElementById('st-conexao-selector');
  if (sel) sel.value = tipoKey;

  checkinSpeedData = { download: dlMbps, upload: ulMbps, tipo: tipoLabels[tipoKey] };
  updateCheckinSpeedData();

  document.getElementById('st-results').style.display = 'block';  // ← linha que faltava
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
      closeCheckinModal('checkin-form-modal');
      fetchData();
      if (checkinFromLanding) {
        document.getElementById('done-name').textContent = checkinReservation.nome.split('@')[0];
        showView('checkin-done');
      } else {
        alert('✅ Check-in registrado com sucesso!');
      }
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