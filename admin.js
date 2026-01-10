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
    setInterval(updateNowLine, 60000); // 1分更新
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
    setTimeout(updateNowLine, 300); 
}

function renderSlot(col, date, time, isClosed) {
    const timeMins = toMin(time);
    
    // 1. その時間に「ピッタリ」始まる予約（お名前などの表示用）
    const exactRes = reservations.find(r => r.date === date && r.time === time);
    
    // 2. その時間を含んでいる予約（背景色などの判定用）
    const overlappingRes = reservations.find(r => {
        if (r.date !== date) return false;
        const start = toMin(r.time);
        const firstMenu = r.menus.split(',')[0].trim();
        const duration = MENU_DURATION[firstMenu] || 60;
        return timeMins >= start && timeMins < start + duration;
    });

    const isOff = offTimes.some(o => o.date === date && o.time === time);
    const div = document.createElement('div');
    div.className = 'slot';

    if (overlappingRes) {
        div.style.background = "#e5e5ea";
        div.style.borderLeft = "1px solid #d1d1d6";
        div.style.borderRight = "1px solid #d1d1d6";
        div.style.marginBottom = "0";
        
        // --- 修正版：予約ID（同一人物）に基づいた角丸判定 ---
        
        // A. 予約の開始地点（exactResがある ＝ 予約データそのものの開始時間）
        if (exactRes) {
            div.style.borderTop = "1px solid #d1d1d6";
            div.style.borderBottom = "none";
            div.style.borderRadius = "15px 15px 0 0"; // 上を丸く
            div.style.marginTop = "8px"; // 予約の塊の上に少し隙間
        } else {
            div.style.borderTop = "none";
            div.style.marginTop = "0";

            // B. 予約の終了地点の判定
            // 「次の30分後」が「同じ予約ID」に含まれていないなら、そこが終点
            const nextTimeMins = timeMins + 30;
            const resStart = toMin(overlappingRes.time);
            const firstMenuName = overlappingRes.menus.split(',')[0].trim();
            const resDuration = MENU_DURATION[firstMenuName] || 60;
            const resEnd = resStart + resDuration;

            if (nextTimeMins >= resEnd) {
                // ここがこの予約の最後の30分枠
                div.style.borderBottom = "1px solid #d1d1d6";
                div.style.borderRadius = "0 0 15px 15px"; // 下を丸く
                div.style.marginBottom = "8px"; // 予約の塊の下に隙間
            } else {
                // まだ同じ人の予約が続いている途中
                div.style.borderBottom = "none";
                div.style.borderRadius = "0";
            }
        }
    } else {
        // 空き枠・休憩枠（常に独立したカプセル）
        div.style.background = (isOff || isClosed) ? "#f2f2f7" : "#ffffff";
        div.style.border = "1px solid #eee";
        div.style.borderRadius = "12px";
        div.style.marginBottom = "6px";
        div.style.marginTop = "0";
    }

    // 文字表示ロジック
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

async function openSlotModal(date, time, res, isOff) {
    const body = document.getElementById('modal-body');
    let html = `<h3 style="margin:0 0 15px 0; text-align:center;">${date} ${time}</h3>`;

    if (res) {
        html += `
            <div style="font-size:16px; margin-bottom:15px; text-align:center;"><b>${res.name} 様</b></div>
            <div style="background:#f2f2f7; padding:15px; border-radius:10px; margin-bottom:15px;">
                <label style="font-size:13px; font-weight:bold;">顧客メモ</label>
                <textarea id="res-notes">${res.notes || ""}</textarea>
                <label style="font-size:13px; font-weight:bold; margin-top:10px; display:block;">日付・時間変更</label>
                <input type="date" id="new-date" value="${res.date}">
                <input type="time" id="new-time" value="${res.time}">
                <button onclick="saveChanges('${res.id}')" style="background:#34c759; color:white; border:none; padding:15px; width:100%; border-radius:10px; margin-top:15px; font-weight:bold; font-size:16px; cursor:pointer;">変更を保存</button>
            </div>
            <button onclick="deleteRes('${res.id}')" style="background:none; color:#ff3b30; border:none; width:100%; padding:10px; cursor:pointer;">予約を削除</button>
        `;
    } else {
        html += `
            <input type="text" id="manual-name" placeholder="お名前">
            <select id="manual-menu">
                ${Object.keys(MENU_DURATION).map(m => `<option value="${m}">${m}</option>`).join('')}
            </select>
            <button onclick="addManual('${date}', '${time}')" style="background:#007aff; color:white; border:none; padding:15px; width:100%; border-radius:10px; font-weight:bold; margin-top:15px; cursor:pointer;">予約を追加</button>
            <button onclick="toggleOffTime('${date}', '${time}', ${isOff})" style="background:none; color:#666; border:none; width:100%; padding:15px; cursor:pointer;">${isOff ? '可能に戻す' : '休憩にする'}</button>
        `;
    }
    html += `<button onclick="closeModal()" style="margin-top:10px; width:100%; padding:10px; border:none; background:none; color:#007aff; font-size:16px; cursor:pointer;">閉じる</button>`;
    body.innerHTML = html;
    document.getElementById('slot-modal').style.display = 'flex';
}

// 変更保存ボタン用
window.saveChanges = async function(id) {
    const d = document.getElementById('new-date').value;
    const t = document.getElementById('new-time').value;
    const n = document.getElementById('res-notes').value;
    const { error } = await adminClient.from('reservations').update({ date: d, time: t, notes: n }).eq('id', id);
    if (error) { alert("保存に失敗しました"); console.error(error); }
    else { closeModal(); initAdmin(); }
};

window.handleCalendarChange = function(val) { if(!val) return; baseDate = new Date(val); render(); };
window.moveDate = function(n) { baseDate.setDate(baseDate.getDate() + n); render(); };
window.closeModal = function() { document.getElementById('slot-modal').style.display = 'none'; };

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
