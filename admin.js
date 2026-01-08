const SUPABASE_URL = "https://bcahztzetpfuklipjmxx.supabase.co";
const SUPABASE_KEY = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";
const ADMIN_PASSWORD = "candoll2026";
const adminClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let baseDate = new Date();
let reservations = [];
let offTimes = [];
let holidays = [];
let specialOpens = [];

// メニューごとの所要時間（分）の設定
const MENU_DURATION = {
    "カット": 60,
    "カラー": 90,
    "パーマ": 120,
    "縮毛矯正": 180,
    "トリートメント": 30,
    "ヘッドスパ": 30
};

document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.getElementById('login-btn');
    const passInput = document.getElementById('admin-pass');
    if (loginBtn) {
        loginBtn.onclick = () => {
            if (passInput.value === ADMIN_PASSWORD) {
                localStorage.setItem('admin_auth_status', 'true');
                initAdmin();
            } else { alert("パスワードが違います"); }
        };
    }
    if (localStorage.getItem('admin_auth_status') === 'true') { initAdmin(); }
});

async function initAdmin() {
    const screen = document.getElementById('login-screen');
    if (screen) screen.style.display = 'none';
    await fetchData();
    render();
}

async function fetchData() {
    const [res, off, hol, spec] = await Promise.all([
        adminClient.from('reservations').select('*'),
        adminClient.from('off_times').select('*'),
        adminClient.from('holidays').select('*'),
        adminClient.from('special_open').select('*')
    ]);
    reservations = res.data || [];
    offTimes = off.data || [];
    holidays = hol.data || [];
    specialOpens = spec.data || [];
}

// 時間を分に変換するヘルパー
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function render() {
    const wrap = document.getElementById('days-wrapper');
    if (!wrap) return;
    wrap.innerHTML = '';
    
    // スマホで見やすくするためのスタイル調整
    wrap.style.display = "flex";
    wrap.style.flexDirection = window.innerWidth < 600 ? "column" : "row";
    wrap.style.gap = "15px";

    document.getElementById('nav-current').innerText = baseDate.toLocaleDateString('ja-JP', { 
        year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' 
    });

    for (let i = 0; i < 3; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const col = document.createElement('div');
        col.className = 'day-column';
        col.style.flex = "1"; // 横並び時の幅を均等に

        const w = d.getDay();
        const isClosed = (w === 1 || w === 2 || holidays.some(h => h.date === dateStr)) && !specialOpens.some(s => s.date === dateStr);

        col.innerHTML = `
            <div class="day-header" style="background:${isClosed ? '#999' : '#000'}; padding:10px; color:white; border-radius:8px 8px 0 0;">
                ${dateStr} (${['日','月','火','水','木','金','土'][w]})
                <div class="day-toggle-btn" onclick="toggleDay('${dateStr}', ${isClosed})" style="font-size:12px; text-decoration:underline; cursor:pointer;">
                    ${isClosed ? '営業にする' : '休みにする'}
                </div>
            </div>
        `;

        for (let h = 10; h <= 18; h++) {
            ['00', '30'].forEach(m => {
                const time = `${String(h).padStart(2, '0')}:${m}`;
                renderSlot(col, dateStr, time, isClosed);
            });
        }
        wrap.appendChild(col);
    }
}

function renderSlot(col, date, time, isClosed) {
    const timeMins = toMin(time);
    
    // 1. その時間に「開始」する予約があるか
    const exactRes = reservations.find(r => r.date === date && r.time === time);
    
    // 2. 他の予約の「所要時間内」に含まれているかチェック（枠を繋げる処理）
    const overlappingRes = reservations.find(r => {
        if (r.date !== date) return false;
        const start = toMin(r.time);
        // メニュー名から時間を取得（不明なら60分とする）
        const duration = MENU_DURATION[r.menus] || 60;
        return timeMins >= start && timeMins < start + duration;
    });

    const isOff = offTimes.some(o => o.date === date && o.time === time);
    const div = document.createElement('div');
    
    // 予約がある、または所要時間内なら「reserved (赤)」
    const status = overlappingRes ? 'reserved' : (isOff || isClosed ? 'off' : 'free');
    div.className = `slot ${status}`;
    
    // デザイン調整（枠が繋がっているように見せる）
    if (overlappingRes && !exactRes) {
        div.style.borderTop = "none"; // 続きの枠は上の線を取る
        div.style.opacity = "0.9";
    }

    let content = `<div class="time-label">${time}</div><div class="slot-info">`;
    if (overlappingRes) {
        content += `<b>${overlappingRes.name} 様</b><br>${overlappingRes.menus}`;
    } else if (isOff || isClosed) {
        content += `不可`;
    } else {
        content += `空き`;
    }
    content += `</div>`;
    
    div.innerHTML = content;
    div.onclick = () => openSlotModal(date, time, overlappingRes, isOff);
    col.appendChild(div);
}

// ... (残りの openSlotModal, toggleOffTime, toggleDay, deleteRes, moveDate, closeModal は前回と同じ) ...

async function openSlotModal(date, time, res, isOff) {
    const body = document.getElementById('modal-body');
    let html = `<h3>${date} ${time}</h3>`;

    if (res) {
        const { data: history } = await adminClient.from('reservations')
            .select('*').eq('name', res.name).lt('created_at', res.created_at)
            .order('created_at', { ascending: false }).limit(1);
        
        const lastVisit = history && history[0] ? `${history[0].date} (${history[0].menus})` : "なし";

        html += `
            <p><b>お名前:</b> ${res.name} 様</p>
            <p><b>メニュー:</b> ${res.menus}</p>
            <div style="background:#f5f5f7; padding:10px; border-radius:8px; margin:10px 0; color:#333;">前回: ${lastVisit}</div>
            <button onclick="deleteRes('${res.id}')" style="background:#ff3b30; color:white; border:none; padding:12px; width:100%; border-radius:8px;">予約削除</button>
        `;
    } else {
        html += `
            <button onclick="toggleOffTime('${date}', '${time}', ${isOff})" style="background:#007aff; color:white; border:none; padding:15px; width:100%; border-radius:8px;">
                ${isOff ? '予約可能に戻す' : 'ここを休憩にする'}
            </button>
        `;
    }
    html += `<button onclick="closeModal()" style="margin-top:15px; width:100%; padding:10px; border:1px solid #ccc; background:none; border-radius:8px;">閉じる</button>`;
    body.innerHTML = html;
    document.getElementById('slot-modal').style.display = 'flex';
}

// 5. アクション関数 (すべて adminClient を使用)
async function toggleOffTime(date, time, isOff) {
    if (isOff) {
        await adminClient.from('off_times').delete().match({ date, time });
    } else {
        await adminClient.from('off_times').insert([{ date, time }]);
    }
    closeModal();
    initAdmin();
}

async function toggleDay(date, isClosed) {
    if (isClosed) {
        await adminClient.from('holidays').delete().eq('date', date);
        await adminClient.from('special_open').insert([{ date }]);
    } else {
        await adminClient.from('holidays').insert([{ date }]);
        await adminClient.from('special_open').delete().eq('date', date);
    }
    initAdmin();
}

async function deleteRes(id) {
    if (!confirm("本当に削除しますか？")) return;
    await adminClient.from('reservations').delete().eq('id', id);
    closeModal();
    initAdmin();
}

function moveDate(n) { baseDate.setDate(baseDate.getDate() + n); render(); }
function closeModal() { document.getElementById('slot-modal').style.display = 'none'; }
