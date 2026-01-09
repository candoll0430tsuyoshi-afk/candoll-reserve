const SUPABASE_URL = "https://bcahztzetpfuklipjmxx.supabase.co";
const SUPABASE_KEY = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";
const ADMIN_PASSWORD = "candoll2026";
const adminClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let baseDate = new Date();
let reservations = [];
let offTimes = [];
let holidays = [];
let specialOpens = [];

const MENU_DURATION = {
    "カット": 60, "カラー": 90, "パーマ": 120, "縮毛矯正": 180, "トリートメント": 30, "ヘッドスパ": 30
};

document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.onclick = () => {
            if (document.getElementById('admin-pass').value === ADMIN_PASSWORD) {
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

const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function render() {
    const wrap = document.getElementById('days-wrapper');
    if (!wrap) return;
    wrap.innerHTML = '';
    
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
        col.style.flex = "1";

        const w = d.getDay();
        const isClosed = (w === 1 || w === 2 || holidays.some(h => h.date === dateStr)) && !specialOpens.some(s => s.date === dateStr);

        col.innerHTML = `<div class="day-header" style="background:${isClosed ? '#999' : '#000'}; padding:10px; color:white; border-radius:12px 12px 0 0; text-align:center;">
            ${dateStr} (${['日','月','火','水','木','金','土'][w]})
            <div onclick="toggleDay('${dateStr}', ${isClosed})" style="font-size:11px; text-decoration:underline; cursor:pointer; opacity:0.8;">${isClosed ? '営業にする' : '休みにする'}</div>
        </div>`;

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
    const exactRes = reservations.find(r => r.date === date && r.time === time);
    const overlappingRes = reservations.find(r => {
        if (r.date !== date) return false;
        const start = toMin(r.time);
        let duration = 60;
        for (let k in MENU_DURATION) { if (r.menus.includes(k)) { duration = MENU_DURATION[k]; break; } }
        return timeMins >= start && timeMins < start + duration;
    });

    const isOff = offTimes.some(o => o.date === date && o.time === time);
    const div = document.createElement('div');
    const status = overlappingRes ? 'reserved' : (isOff || isClosed ? 'off' : 'free');
    div.className = `slot ${status}`;

    // --- 連結ブロックデザインの適用 ---
    if (overlappingRes) {
        div.style.backgroundColor = "#ff3b30";
        div.style.color = "white";
        div.style.borderLeft = "4px solid #b01a11";
        if (exactRes) {
            div.style.borderRadius = "12px 12px 0 0";
            div.style.borderBottom = "none";
            div.innerHTML = `<div class="time-label">${time}</div><div class="slot-info"><b>${exactRes.name} 様</b><br><small>${exactRes.menus}</small></div>`;
        } else {
            div.style.borderRadius = "0";
            div.style.borderTop = "none";
            div.style.borderBottom = "none";
            div.innerHTML = `<div class="time-label">${time}</div><div class="slot-info" style="font-size:18px; opacity:0.6;">┃</div>`;
            
            // 終了枠か判定
            const start = toMin(overlappingRes.time);
            let dur = 60;
            for (let k in MENU_DURATION) { if (overlappingRes.menus.includes(k)) { dur = MENU_DURATION[k]; break; } }
            if (timeMins + 30 >= start + dur) {
                div.style.borderRadius = "0 0 12px 12px";
                div.style.borderBottom = "1px solid rgba(0,0,0,0.1)";
            }
        }
    } else {
        div.innerHTML = `<div class="time-label">${time}</div><div class="slot-info">${isOff || isClosed ? '不可' : '空き'}</div>`;
    }

    div.onclick = () => openSlotModal(date, time, exactRes || overlappingRes, isOff);
    col.appendChild(div);
}

async function openSlotModal(date, time, res, isOff) {
    const body = document.getElementById('modal-body');
    let html = `<h3 style="margin:0 0 15px;">${date} ${time}</h3>`;

    if (res) {
        html += `
            <div style="background:#f2f2f7; padding:12px; border-radius:8px; margin-bottom:15px; text-align:left;">
                <b>${res.name} 様</b><br>メニュー: ${res.menus}
            </div>
            <div style="text-align:left; font-size:13px; margin-bottom:5px;">▼ 日付・時間を変更</div>
            <div style="display:flex; gap:5px; margin-bottom:15px;">
                <input type="date" id="new-date" value="${res.date}" style="flex:2; padding:8px; border-radius:5px; border:1px solid #ccc;">
                <input type="time" id="new-time" value="${res.time}" style="flex:1; padding:8px; border-radius:5px; border:1px solid #ccc;">
            </div>
            <button onclick="updateReservation('${res.id}')" style="background:#34c759; color:white; width:100%; padding:12px; border:none; border-radius:10px; font-weight:bold; margin-bottom:10px;">変更を保存する</button>
            <button onclick="deleteRes('${res.id}')" style="background:none; color:#ff3b30; width:100%; border:none; font-size:13px;">この予約を削除</button>
        `;
    } else {
        html += `
            <input type="text" id="manual-name" placeholder="お客様名" style="width:100%; padding:12px; margin-bottom:10px; border:1px solid #ccc; border-radius:8px; box-sizing:border-box;">
            <select id="manual-menu" style="width:100%; padding:12px; margin-bottom:15px; border:1px solid #ccc; border-radius:8px;">
                ${Object.keys(MENU_DURATION).map(m => `<option value="${m}">${m} (${MENU_DURATION[m]}分)</option>`).join('')}
            </select>
            <button onclick="addManual('${date}', '${time}')" style="background:#007aff; color:white; width:100%; padding:12px; border:none; border-radius:10px; font-weight:bold; margin-bottom:10px;">予約を登録</button>
            <button onclick="toggleOffTime('${date}', '${time}', ${isOff})" style="background:#8e8e93; color:white; width:100%; padding:10px; border:none; border-radius:10px;">
                ${isOff ? '予約可能に戻す' : 'ここを休憩にする'}
            </button>
        `;
    }
    html += `<button onclick="closeModal()" style="width:100%; margin-top:10px; border:none; background:none; color:#007aff;">閉じる</button>`;
    body.innerHTML = html;
    document.getElementById('slot-modal').style.display = 'flex';
}

async function updateReservation(id) {
    const date = document.getElementById('new-date').value;
    const time = document.getElementById('new-time').value;
    const { error } = await adminClient.from('reservations').update({ date, time }).eq('id', id);
    if (error) alert(error.message); else { closeModal(); initAdmin(); }
}

async function addManual(date, time) {
    const name = document.getElementById('manual-name').value;
    const menus = document.getElementById('manual-menu').value;
    if (!name) return alert("名前を入力してください");
    await adminClient.from('reservations').insert([{ name, date, time, menus, customer_user_id: 'manual' }]);
    closeModal(); initAdmin();
}

async function toggleOffTime(date, time, isOff) {
    if (isOff) await adminClient.from('off_times').delete().match({ date, time });
    else await adminClient.from('off_times').insert([{ date, time }]);
    closeModal(); initAdmin();
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
    if (confirm("予約を削除しますか？")) {
        await adminClient.from('reservations').delete().eq('id', id);
        closeModal(); initAdmin();
    }
}

function moveDate(n) { baseDate.setDate(baseDate.getDate() + n); render(); }
function closeModal() { document.getElementById('slot-modal').style.display = 'none'; }
