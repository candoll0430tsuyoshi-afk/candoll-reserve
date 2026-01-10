const SUPABASE_URL = "https://bcahztzetpfuklipjmxx.supabase.co";
const SUPABASE_KEY = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";
const ADMIN_PASSWORD = "candoll2026";
const adminClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let baseDate = new Date();
let reservations = [];
let offTimes = [];
let holidays = [];
let specialOpens = [];
let MENU_DURATION = {}; 

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
    // 1分ごとに現在時刻の線を更新
    setInterval(updateNowLine, 60000);
}

async function fetchData() {
    const [res, off, hol, spec, mData] = await Promise.all([
        adminClient.from('reservations').select('*'),
        adminClient.from('off_times').select('*'),
        adminClient.from('holidays').select('*'),
        adminClient.from('special_open').select('*'),
        adminClient.from('menus').select('name, duration')
    ]);
    reservations = res.data || [];
    offTimes = off.data || [];
    holidays = hol.data || [];
    specialOpens = spec.data || [];
    if (mData.data) {
        MENU_DURATION = {};
        mData.data.forEach(m => { MENU_DURATION[m.name] = m.duration; });
    }
}

const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function render() {
    const wrap = document.getElementById('days-wrapper');
    if (!wrap) return;
    wrap.innerHTML = '';
    wrap.style.display = "flex";
    wrap.style.flexDirection = window.innerWidth < 600 ? "column" : "row";
    wrap.style.gap = "15px";

    document.getElementById('nav-current').innerText = baseDate.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', weekday: 'short' });

    for (let i = 0; i < 3; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const col = document.createElement('div');
        col.className = 'day-column';
        col.id = `col-${dateStr}`;
        col.style.flex = "1";

        const w = d.getDay();
        const isClosed = (w === 1 || w === 2 || holidays.some(h => h.date === dateStr)) && !specialOpens.some(s => s.date === dateStr);

        col.innerHTML = `<div style="background:#f2f2f7; padding:12px; text-align:center; border-bottom:1px solid #ddd;">
            <b style="font-size:16px;">${dateStr} (${['日','月','火','水','木','金','土'][w]})</b>
            <div onclick="toggleDay('${dateStr}', ${isClosed})" style="font-size:11px; text-decoration:underline; cursor:pointer; color:#007aff;">${isClosed ? '営業にする' : '休みにする'}</div>
        </div>`;

        for (let h = 10; h <= 18; h++) {
            ['00', '30'].forEach(m => {
                const time = `${String(h).padStart(2, '0')}:${m}`;
                renderSlot(col, dateStr, time, isClosed);
            });
        }
        wrap.appendChild(col);
    }
    setTimeout(updateNowLine, 100); 
}

function renderSlot(col, date, time, isClosed) {
    const timeMins = toMin(time);
    const exactRes = reservations.find(r => r.date === date && r.time === time);
    const overlappingRes = reservations.find(r => {
        if (r.date !== date) return false;
        const start = toMin(r.time);
        const duration = MENU_DURATION[r.menus.split(',')[0].trim()] || 60;
        return timeMins >= start && timeMins < start + duration;
    });

    const isOff = offTimes.some(o => o.date === date && o.time === time);
    const div = document.createElement('div');
    div.className = 'slot';
    div.dataset.time = time;

    if (overlappingRes) {
        div.style.background = "#e5e5ea";
        if (!exactRes) { div.style.borderTop = "none"; }
    } else if (isOff || isClosed) {
        div.style.background = "#f2f2f7";
    }

    let content = `<div class="time-label">${time}</div><div class="slot-info">`;
    if (overlappingRes && exactRes) {
        content += `${exactRes.name} 様<span class="menu-label">${exactRes.menus}</span>`;
    } else if (!overlappingRes) {
        content += `<span style="color:#ddd; font-size:13px; font-weight:normal;">${(isOff || isClosed) ? '不可' : '空き'}</span>`;
    }
    content += `</div>`;
    div.innerHTML = content;
    div.onclick = () => openSlotModal(date, time, exactRes || overlappingRes, isOff);
    col.appendChild(div);
}

// 現在時刻の線を引く
function updateNowLine() {
    document.querySelectorAll('.now-line').forEach(el => el.remove());
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const col = document.getElementById(`col-${dateStr}`);
    if (!col) return;

    const currentMins = now.getHours() * 60 + now.getMinutes();
    const startMins = 10 * 60; // 10:00開始
    if (currentMins < startMins || currentMins > 19 * 60) return;

    const slots = col.querySelectorAll('.slot');
    const slotHeight = slots[0].offsetHeight;
    const offset = ((currentMins - startMins) / 30) * slotHeight + slots[0].offsetTop;

    const line = document.createElement('div');
    line.className = 'now-line';
    line.style.top = `${offset}px`;
    col.appendChild(line);
}

async function openSlotModal(date, time, res, isOff) {
    const body = document.getElementById('modal-body');
    let html = `<h3 style="margin:0 0 15px 0; text-align:center;">${date} ${time}</h3>`;

    if (res) {
        html += `
            <div style="font-size:16px; margin-bottom:15px; text-align:center;"><b>${res.name} 様</b><br>${res.menus}</div>
            <div style="background:#f2f2f7; padding:15px; border-radius:10px; margin-bottom:15px;">
                <label style="font-size:13px; font-weight:bold;">顧客メモ</label>
                <textarea id="res-notes" placeholder="カラー配合、注意点など">${res.notes || ""}</textarea>
                <label style="font-size:13px; font-weight:bold; margin-top:10px; display:block;">日付・時間の変更</label>
                <input type="date" id="new-date" value="${res.date}" style="margin:5px 0;">
                <input type="time" id="new-time" value="${res.time}">
                <button onclick="updateReservation('${res.id}')" style="background:#34c759; color:white; border:none; padding:12px; width:100%; border-radius:8px; margin-top:15px; font-weight:bold; font-size:16px;">内容を保存</button>
            </div>
            <button onclick="deleteRes('${res.id}')" style="background:none; color:#ff3b30; border:none; width:100%; padding:10px;">予約を削除する</button>
        `;
    } else {
        html += `
            <input type="text" id="manual-name" placeholder="お名前" style="margin-bottom:10px;">
            <select id="manual-menu">
                ${Object.keys(MENU_DURATION).map(m => `<option value="${m}">${m}</option>`).join('')}
            </select>
            <button onclick="addManual('${date}', '${time}')" style="background:#007aff; color:white; border:none; padding:15px; width:100%; border-radius:10px; font-weight:bold; margin-top:15px;">手動予約を追加</button>
            <button onclick="toggleOffTime('${date}', '${time}', ${isOff})" style="background:none; color:#666; border:none; width:100%; padding:15px;">${isOff ? '予約可能に戻す' : 'ここを休憩にする'}</button>
        `;
    }
    html += `<button onclick="closeModal()" style="margin-top:10px; width:100%; padding:10px; border:none; background:none; color:#007aff; font-size:16px;">閉じる</button>`;
    body.innerHTML = html;
    document.getElementById('slot-modal').style.display = 'flex';
}

async function updateReservation(id) {
    const newDate = document.getElementById('new-date').value;
    const newTime = document.getElementById('new-time').value;
    const notes = document.getElementById('res-notes').value;
    await adminClient.from('reservations').update({ date: newDate, time: newTime, notes: notes }).eq('id', id);
    closeModal(); initAdmin();
}

// その他の補助関数
function handleCalendarChange(val) { if(!val) return; baseDate = new Date(val); render(); }
function moveDate(n) { baseDate.setDate(baseDate.getDate() + n); render(); }
function closeModal() { document.getElementById('slot-modal').style.display = 'none'; }
async function addManual(date, time) {
    const name = document.getElementById('manual-name').value;
    const menus = document.getElementById('manual-menu').value;
    if (!name) return alert("お名前を入力してください");
    await adminClient.from('reservations').insert([{ name, date, time, menus, customer_user_id: 'manual' }]);
    closeModal(); initAdmin();
}
async function toggleOffTime(date, time, isOff) {
    if (isOff) { await adminClient.from('off_times').delete().match({ date, time }); }
    else { await adminClient.from('off_times').insert([{ date, time }]); }
    closeModal(); initAdmin();
}
async function toggleDay(date, isClosed) {
    if (isClosed) { await adminClient.from('holidays').delete().eq('date', date); await adminClient.from('special_open').insert([{ date }]); }
    else { await adminClient.from('holidays').insert([{ date }]); await adminClient.from('special_open').delete().eq('date', date); }
    initAdmin();
}
async function deleteRes(id) { if (!confirm("本当に削除しますか？")) return; await adminClient.from('reservations').delete().eq('id', id); closeModal(); initAdmin(); }
