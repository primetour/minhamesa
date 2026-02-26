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
            seat.className = 'seat occupied';
            seat.title = `${r.nome} (${r.setor})`;
            if (isSel) {
                closeModal();
                alert(`Ocupado por ${r.nome}`);
                selectedSeat = null;
            }
        }
    });
}

function selectSeat(seat) {
    if (seat.classList.contains('occupied')) return alert('Ocupado!');
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
