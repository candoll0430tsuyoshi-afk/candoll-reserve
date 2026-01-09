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
    
    // レイアウト調整
    wrap.style.display = "flex";
    wrap.style.flexDirection = window.innerWidth < 600 ? "column" : "row";
    wrap.style.gap = "20px"; // 日付ごとの間隔を少し広げる

    // 日付表示（クリックでカレンダー起動）を更新
    const currentNav = document.getElementById('nav-current');
    currentNav.innerText = baseDate.toLocaleDateString('ja-JP', { 
        year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' 
    });
    currentNav.style.cursor = "pointer";
    currentNav.onclick = () => document.getElementById('calendar-input').showPicker();

    for (let i = 0; i < 3; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const col = document.createElement('div');
        col.className = 'day-column';
        col.style.flex = "1";

        const w = d.getDay();
        const isClosed = (w === 1 || w === 2 || holidays.some(h => h.date === dateStr)) && !specialOpens.some(s => s.date === dateStr);

        col.innerHTML = `<div class="day-header" style="background:#f2f2f7; padding:12px; color:#333; border-radius:10px 10px 0 0; text-align:center; border:1px solid #ddd; border-bottom:none;">
            <b style="font-size:16px;">${dateStr} (${['日','月','火','水','木','金','土'][w]})</b>
            <div onclick="toggleDay('${dateStr}', ${isClosed})" style="font-size:11px; text-decoration:underline; cursor:pointer; color:#007aff; margin-top:4px;">${isClosed ? '営業にする' : '休みにする'}</div>
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
        const duration = MENU_DURATION[r.menus.split(',')[0]] || 60;
        return timeMins >= start && timeMins < start + duration;
    });

    const isOff = offTimes.some(o => o.date === date && o.time === time);
    const div = document.createElement('div');
    
    // --- デザインの変更 ---
    // 予約：薄いグレー(#e5e5ea) / 空き：白(#fff) / 休み：少し暗いグレー
    const status = overlappingRes ? 'reserved' : (isOff || isClosed ? 'off' : 'free');
    div.className = `slot ${status}`;
    div.style.border = "1px solid #ddd";
    div.style.marginBottom = "4px"; // 枠同士に少し隙間を作る
    div.style.borderRadius = "4px";

    if (overlappingRes) {
        div.style.background = "#e5e5ea"; // 薄いグレー
        div.style.color = "#333";
        if (!exactRes) {
            // 連続する枠は少しだけ上の隙間を詰める（でも別の予約とは離れる）
            div.style.marginTop = "-4px";
            div.style.borderRadius = "0 0 4px 4px";
        } else {
            div.style.borderRadius = "4px 4px 0 0";
        }
    } else if (isOff || isClosed) {
        div.style.background = "#d1d1d6";
    } else {
        div.style.background = "#ffffff";
    }

    let content = `<div class="time-label" style="font-size:10px; color:#8e8e93;">${time}</div><div class="slot-info">`;
    if (overlappingRes) {
        if (exactRes) content += `<b style="font-size:13px;">${exactRes.name} 様</b>`;
        else content += `<span style="font-size:14px; color:#aaa;">↓</span>`;
    } else if (isOff || isClosed) {
        content += `<span style="font-size:11px; color:#8e8e93;">不可</span>`;
    } else {
        content += `<span style="font-size:11px; color:#cecece;">空き</span>`;
    }
    content += `</div>`;
    
    div.innerHTML = content;
    div.onclick = () => openSlotModal(date, time, exactRes || overlappingRes, isOff);
    col.appendChild(div);
}

// カレンダー変更イベント
function handleCalendarChange(val) {
    if(!val) return;
    baseDate = new Date(val);
    render();
}

// (以下の関数は前回のコードとほぼ同じですが、modal部分のボタン配置なども少し整えています)
async function openSlotModal(date, time, res, isOff) {
    const body = document.getElementById('modal-body');
    let html = `<h3 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:10px;">${date} ${time}</h3>`;

    if (res) {
        html += `
            <p style="margin:10px 0;"><b>お名前:</b> ${res.name} 様</p>
            <p style="margin:10px 0;"><b>メニュー:</b> ${res.menus}</p>
            <div style="background:#f2f2f7; padding:10px; border-radius:8px; margin:15px 0; font-size:13px;">
                <label>時間変更:</label>
                <input type="time" id="new-time" value="${res.time}" style="width:100%; padding:8px; margin-top:5px; border:1px solid #ddd; border-radius:5px;">
                <button onclick="updateTime('${res.id}')" style="background:#34c759; color:white; border:none; padding:10px; width:100%; border-radius:8px; margin-top:10px; font-weight:bold;">時間を保存</button>
            </div>
            <button onclick="deleteRes('${res.id}')" style="background:#ff3b30; color:white; border:none; padding:12px; width:100%; border-radius:8px; font-weight:bold;">予約を削除する</button>
        `;
    } else {
        html += `
            <input type="text" id="manual-name" placeholder="お客様名を入力" style="width:100%; padding:12px; margin-bottom:10px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
            <select id="manual-menu" style="width:100%; padding:12px; margin-bottom:15px; border:1px solid #ddd; border-radius:8px;">
                ${Object.keys(MENU_DURATION).map(m => `<option value="${m}">${m}</option>`).join('')}
            </select>
            <button onclick="addManual('${date}', '${time}')" style="background:#007aff; color:white; border:none; padding:15px; width:100%; border-radius:8px; font-weight:bold; margin-bottom:10px;">手動で予約を入れる</button>
            <button onclick="toggleOffTime('${date}', '${time}', ${isOff})" style="background:#8e8e93; color:white; border:none; padding:10px; width:100%; border-radius:8px;">
                ${isOff ? '予約可能に戻す' : 'ここを休憩にする'}
            </button>
        `;
    }
    html += `<button onclick="closeModal()" style="margin-top:15px; width:100%; padding:10px; border:none; background:none; color:#007aff;">閉じる</button>`;
    body.innerHTML = html;
    document.getElementById('slot-modal').style.display = 'flex';
}

async function addManual(date, time) {
    const name = document.getElementById('manual-name').value;
    const menus = document.getElementById('manual-menu').value;
    if (!name) return alert("お名前を入力してください");
    await adminClient.from('reservations').insert([{ name, date, time, menus, customer_user_id: 'manual' }]);
    closeModal(); initAdmin();
}

async function updateTime(id) {
    const newTime = document.getElementById('new-time').value;
    if (!newTime) return;
    await adminClient.from('reservations').update({ time: newTime }).eq('id', id);
    closeModal(); initAdmin();
}

async function toggleOffTime(date, time, isOff) {
    if (isOff) { await adminClient.from('off_times').delete().match({ date, time }); }
    else { await adminClient.from('off_times').insert([{ date, time }]); }
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
    if (!confirm("本当に削除しますか？")) return;
    await adminClient.from('reservations').delete().eq('id', id);
    closeModal(); initAdmin();
}

function moveDate(n) { baseDate.setDate(baseDate.getDate() + n); render(); }
function closeModal() { document.getElementById('slot-modal').style.display = 'none'; }
