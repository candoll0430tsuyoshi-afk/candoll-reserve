// 1. 設定（あなたの環境に合わせた設定です）
const SUPABASE_URL = "https://bcahztzetpfuklipjmxx.supabase.co";
const SUPABASE_KEY = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";
const ADMIN_PASSWORD = "candoll2026";

// クライアントを一度だけ作成
const adminClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let baseDate = new Date();
let reservations = [];
let offTimes = [];
let holidays = [];
let specialOpens = [];
let MENU_DATA = {}; // ★Supabaseから読み込んだ所要時間をここに入れる

// 2. ログイン・初期化処理
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

// 3. データ取得（メニューテーブルからも読み込む）
async function fetchData() {
    const [res, off, hol, spec, menus] = await Promise.all([
        adminClient.from('reservations').select('*'),
        adminClient.from('off_times').select('*'),
        adminClient.from('holidays').select('*'),
        adminClient.from('special_open').select('*'),
        adminClient.from('menus').select('name, duration') // ★menusテーブルから取得
    ]);
    
    reservations = res.data || [];
    offTimes = off.data || [];
    holidays = hol.data || [];
    specialOpens = spec.data || [];

    // メニューデータを「名前: 時間」の形式に整理
    MENU_DATA = {};
    if (menus.data) {
        menus.data.forEach(m => { MENU_DATA[m.name] = m.duration; });
    }
}

const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

// 4. カレンダー描画（連結ブロックデザイン）
function render() {
    const wrap = document.getElementById('days-wrapper');
    if (!wrap) return;
    wrap.innerHTML = '';
    
    // スマホ対応
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
    
    // その時間に「開始」する予約
    const exactRes = reservations.find(r => r.date === date && r.time === time);
    
    // Supabaseから取得した所要時間で範囲をチェック
    const overlappingRes = reservations.find(r => {
        if (r.date !== date) return false;
        const start = toMin(r.time);
        
        // メニューが複数ある場合は一番長いものを採用（または合計など、必要に応じて調整）
        let duration = 60; 
        const reservedMenus = r.menus.split(',');
        reservedMenus.forEach(mName => {
            const name = mName.trim();
            if (MENU_DATA[name]) { duration = Math.max(duration, MENU_DATA[name]); }
        });

        return timeMins >= start && timeMins < start + duration;
    });

    const isOff = offTimes.some(o => o.date === date && o.time === time);
    const div = document.createElement('div');
    const status = overlappingRes ? 'reserved' : (isOff || isClosed ? 'off' : 'free');
    div.className = `slot ${status}`;

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
            overlappingRes.menus.split(',').forEach(m => {
                if(MENU_DATA[m.trim()]) dur = Math.max(dur, MENU_DATA[m.trim()]);
            });
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

// 5. モーダル（日付・時間の変更対応）
async function openSlotModal(date, time, res, isOff) {
    const body = document.getElementById('modal-body');
    let html = `<h3 style="margin:0 0 15px;">${date} ${time}</h3>`;

    if (res) {
        html += `
            <div style="background:#f2f2f7; padding:12px; border-radius:8px; margin-bottom:15px; text-align:left; color:#333;">
                <b>${res.name} 様</b><br>メニュー: ${res.menus}
            </div>
            <div style="text-align:left; font-size:13px; margin-bottom:5px;">▼ 日時を変更</div>
            <div style="display:flex; gap:5px; margin-bottom:15px;">
                <input type="date" id="new-date" value="${res.date}" style="flex:2; padding:8px; border-radius:5px; border:1px solid #ccc;">
                <input type="time" id="new-time" value="${res.time}" style="flex:1; padding:8px; border-radius:5px; border:1px solid #ccc;">
            </div>
            <button onclick="updateReservation('${res.id}')" style="background:#34c759; color:white; width:100%; padding:12px; border:none; border-radius:10px; font-weight:bold; margin-bottom:10px;">変更を保存</button>
            <button onclick="deleteRes('${res.id}')" style="background:none; color:#ff3b30; width:100%; border:none; font-size:13px;">予約を削除</button>
        `;
    } else {
        html += `
            <input type="text" id="manual-name" placeholder="お客様名" style="width:100%; padding:12px; margin-bottom:10px; border:1px solid #ccc; border-radius:8px;">
            <select id="manual-menu" style="width:100%; padding:12px; margin-bottom:15px; border:1px solid #ccc; border-radius:8px;">
                ${Object.keys(MENU_DATA).map(m => `<option value="${m}">${m} (${MENU_DATA[m]}分)</option>`).join('')}
            </select>
            <button onclick="addManual('${date}', '${time}')" style="background:#007aff; color:white; width:100%; padding:12px; border:none; border-radius:10px; font-weight:bold; margin-bottom:10px;">予約を追加</button>
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
    await adminClient.from('reservations').update({ date, time }).eq('id', id);
    closeModal(); initAdmin();
}

async function addManual(date, time) {
    const name = document.getElementById('manual-name').value;
    const menus = document.getElementById('manual-menu').value;
    if (!name) return alert("お名前をいれてください");
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
    if (confirm("削除しますか？")) {
        await adminClient.from('reservations').delete().eq('id', id);
        closeModal(); initAdmin();
    }
}

function moveDate(n) { baseDate.setDate(baseDate.getDate() + n); render(); }
function closeModal() { document.getElementById('slot-modal').style.display = 'none'; }
