const SUPABASE_URL = "https://bcahztzetpfuklipjmxx.supabase.co";
const SUPABASE_KEY = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";
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
        loginBtn.onclick = async () => {
            const passInput = document.getElementById('admin-pass').value;
            const success = await fetchData(passInput); 
            if (success) {
                localStorage.setItem('admin_password', passInput);
                initAdmin();
            } else {
                alert("パスワードが違うか、通信エラーです");
            }
        };
    }
    if (localStorage.getItem('admin_password')) { initAdmin(); }
});

async function initAdmin() {
    const screen = document.getElementById('login-screen');
    if (screen) screen.style.display = 'none';
    const success = await fetchData();
    if (success) {
        render();
        setInterval(updateNowLine, 60000);
    }
}

async function fetchData(pass = null) {
    const password = pass || localStorage.getItem('admin_password');
    if (!password) return false;
    try {
        const response = await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/admin-service", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "list", password: password })
        });
        if (!response.ok) return false;
        const data = await response.json();
        
        // データを各変数に正しく格納
        reservations = data.reservations || [];
        holidays = data.holidays || [];
        specialOpens = data.special_open || [];
        offTimes = data.off_times || [];

        // Supabaseから受け取ったメニュー情報を MENU_DURATION に同期
        if (data.menus) {
            MENU_DURATION = {};
            data.menus.forEach(m => {
                MENU_DURATION[m.name] = m.duration;
            });
        }

        return true; // ここで初めて終わる
    } catch (e) {
        console.error("Fetch error:", e);
        return false;
    }
}

const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function render() {
    const wrap = document.getElementById('days-wrapper');
    if (!wrap) return;
    wrap.innerHTML = '';
    const isMobile = window.innerWidth < 600;
    wrap.style.display = "flex";
    wrap.style.flexDirection = isMobile ? "column" : "row";
    wrap.style.gap = "15px";
    
const navCurrent = document.getElementById('nav-current');
    
    // 既存の日付ヘッダーを削除（重複防止）
    const existingHeader = document.getElementById('date-header-row');
    if (existingHeader) existingHeader.remove();
    
    // PCの場合：ナビゲーションには何も表示せず、予約エリアの直前にヘッダーを追加
    if (!isMobile) {
        navCurrent.innerHTML = '';  // ナビゲーションバナーを空に
        
        // 3日分のヘッダーを作成
        const headerRow = document.createElement('div');
        headerRow.id = 'date-header-row';  // IDを追加して削除できるように
        headerRow.style.display = "flex";
        headerRow.style.gap = "15px";
        headerRow.style.marginBottom = "10px";
        headerRow.style.padding = "0 10px";
        
        for (let i = 0; i < 3; i++) {
            const d = new Date(baseDate);
            d.setDate(d.getDate() + i);
            const w = d.getDay();
            const headerCell = document.createElement('div');
            headerCell.style.flex = "1";
            headerCell.style.textAlign = "center";
            headerCell.style.fontWeight = "bold";
            headerCell.style.fontSize = "16px";
            headerCell.style.padding = "10px";
            headerCell.style.background = "#f2f2f7";
            headerCell.style.borderRadius = "8px";
            headerCell.innerHTML = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} (${['日','月','火','水','木','金','土'][w]})`;
            headerRow.appendChild(headerCell);
        }
        
        // days-wrapperの直前に挿入
        wrap.parentElement.insertBefore(headerRow, wrap);
    } else {
        // スマホは初期表示（1日目）
        const d = new Date(baseDate);
        const w = d.getDay();
        navCurrent.innerHTML = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} (${['日','月','火','水','木','金','土'][w]})`;
    }
    
    for (let i = 0; i < 3; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const col = document.createElement('div');
        col.className = 'day-column';
        col.id = `col-${dateStr}`;
        col.dataset.index = i;
        col.dataset.date = dateStr;
        col.style.flex = "1";
        const w = d.getDay();
        const isClosed = (w === 1 || w === 2 || holidays.some(h => h.date === dateStr)) && !specialOpens.some(s => s.date === dateStr);
        
        if (isMobile) {
            // スマホは各カラムに日付を表示
            col.innerHTML = `<div style="background:#f2f2f7; padding:12px; text-align:center; border-bottom:1px solid #ddd;">
                <b style="font-size:16px;">${dateStr} (${['日','月','火','水','木','金','土'][w]})</b>
                <div onclick="toggleDay('${dateStr}', ${isClosed})" style="font-size:11px; text-decoration:underline; cursor:pointer; color:#007aff;">${isClosed ? '営業にする' : '休みにする'}</div>
            </div>`;
        } else {
            // PCは「営業にする/休みにする」ボタンのみ
            col.innerHTML = `<div style="background:#f2f2f7; padding:8px; text-align:center; border-bottom:1px solid #ddd;">
                <div onclick="toggleDay('${dateStr}', ${isClosed})" style="font-size:11px; text-decoration:underline; cursor:pointer; color:#007aff;">${isClosed ? '営業にする' : '休みにする'}</div>
            </div>`;
        }
        
        for (let h = 10; h <= 18; h++) {
            ['00', '30'].forEach(m => { renderSlot(col, dateStr, `${String(h).padStart(2, '0')}:${m}`, isClosed); });
        }
        wrap.appendChild(col);
    }
    
    // スマホ用：スクロールで日付バナーを切り替え
    if (isMobile) {
        setupMobileScroll();
    }
    
    setTimeout(updateNowLine, 300); 
}

// スマホ用：スクロールで日付バナーを更新
function setupMobileScroll() {
    const wrap = document.getElementById('days-wrapper');
    const navCurrent = document.getElementById('nav-current');
    
    let lastIndex = -1;
    
    const updateBanner = () => {
        const columns = Array.from(wrap.querySelectorAll('.day-column'));
        let currentIndex = 0;
        let minDistance = Infinity;
        
        // 画面上部に最も近いカラムを見つける
        columns.forEach((col, index) => {
            const rect = col.getBoundingClientRect();
            const distance = Math.abs(rect.top - 60); // ナビゲーションバーの高さを考慮
            
            if (distance < minDistance) {
                minDistance = distance;
                currentIndex = index;
            }
        });
        
        // 日付が変わった時だけバナーを更新
        if (currentIndex !== lastIndex) {
            lastIndex = currentIndex;
            const d = new Date(baseDate);
            d.setDate(d.getDate() + currentIndex);
            const w = d.getDay();
            navCurrent.innerHTML = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} (${['日','月','火','水','木','金','土'][w]})`;
        }
    };
    
    // スクロールイベント
    window.addEventListener('scroll', updateBanner);
    wrap.addEventListener('scroll', updateBanner);
}

function renderSlot(col, date, time, isClosed) {
    const timeMins = toMin(time);
    const exactRes = reservations.find(r => r.date === date && r.time === time);
    const overlappingRes = reservations.find(r => {
        if (r.date !== date) return false;
        const start = toMin(r.time);
        const firstMenu = r.menus.split(',')[0].trim();
        const duration = r.manual_duration || MENU_DURATION[firstMenu] || 60;
        return timeMins >= start && timeMins < start + duration;
    });

    const isOff = offTimes.some(o => o.date === date && o.time === time);
    const div = document.createElement('div');
    div.className = 'slot';
    div.style.border = "1px solid #000"; 
    div.style.boxSizing = "border-box";
    div.dataset.date = date;
    div.dataset.time = time;
    div.ondragover = (e) => e.preventDefault();
    div.ondrop = (e) => handleDrop(e, date, time);

    // ★角丸とデザインの修正ポイント
    if (overlappingRes) {
        div.style.background = "#e5e5ea";
        const resStart = toMin(overlappingRes.time);
        const dur = overlappingRes.manual_duration || MENU_DURATION[overlappingRes.menus.split(',')[0].trim()] || 60;
        const resEnd = resStart + dur;
        const isLastSlot = (timeMins + 30 >= resEnd);

        if (exactRes) {
            div.draggable = true;
            // カプセル状の角丸を適用
            div.style.borderRadius = isLastSlot ? "15px" : "15px 15px 0 0";
            div.style.marginTop = "8px";
            if (!isLastSlot) div.style.borderBottom = "none";
            div.ondragstart = (e) => { e.dataTransfer.setData("text/plain", exactRes.id); div.style.opacity = "0.4"; };
            div.ondragend = () => div.style.opacity = "1";
            setupTouchEvents(div, exactRes, date, time);
        } else {
            div.style.marginTop = "0";
            div.style.borderTop = "none";
            div.style.borderRadius = isLastSlot ? "0 0 15px 15px" : "0";
            if (isLastSlot) div.style.marginBottom = "8px";
            else div.style.borderBottom = "none";
        }
    } else {
        div.style.background = (isOff || isClosed) ? "#f2f2f7" : "#ffffff";
        div.style.borderRadius = "12px";
        div.style.marginBottom = "6px";
    }

    let content = `<div class="time-label">${time}</div><div class="slot-info">`;
    if (overlappingRes && exactRes) content += `<b style="color:#000;">${exactRes.name} 様</b><span class="menu-label">${exactRes.menus}</span>`;
    else if (!overlappingRes) content += `<span style="color:#666; font-size:13px;">${(isOff || isClosed) ? '不可' : '空き'}</span>`;
    content += `</div>`;
    div.innerHTML = content;
    div.onclick = (e) => { if (div.style.opacity === "0.4") return; openSlotModal(date, time, exactRes || overlappingRes, isOff); };
    col.appendChild(div);
}

async function toggleOffTime(date, time) {
    const password = localStorage.getItem('admin_password');
    const isOff = offTimes.some(o => o.date === date && o.time === time);
    
    // サーバーの仕様に合わせたモード名
    const mode = isOff ? "delOff" : "addOff";

    // 29分設定の計算
    const [h, m] = time.split(':').map(Number);
    const endD = new Date(2000, 0, 1, h, m + 29); 
    const end_t = `${String(endD.getHours()).padStart(2,'0')}:${String(endD.getMinutes()).padStart(2,'0')}`;

    try {
        await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/admin-service", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                mode: mode, 
                date: date, 
                time: time, 
                end_time: end_t, 
                password: password 
            })
        });

        // --- ここから追加 ---
        if (window.closeModal) {
            closeModal(); // 画面上のボックスを閉じる
        }
        // ------------------

        await fetchData(); 
        render();
    } catch (err) {
        console.error("送信エラー:", err);
        alert("設定の保存に失敗しました。");
    }
}
async function openSlotModal(date, time, res, isOff) {
    const body = document.getElementById('modal-body');
    const dayOfWeek = ['日','月','火','水','木','金','土'][new Date(date.replace(/-/g, '/')).getDay()];
    let html = `<h3 style="margin:0 0 20px 0; text-align:center; color:#333; font-size:18px;">${date}(${dayOfWeek}) ${time}</h3>`;

    if (res) {
        const currentDur = res.manual_duration || MENU_DURATION[res.menus.split(',')[0].trim()] || 60;
        html += `
            <div style="font-size:18px; margin-bottom:20px; text-align:center; color:#000;"><b>${res.name} 様</b></div>
            <div style="background:#f2f2f7; padding:20px; border-radius:15px; margin-bottom:15px;">
                <label style="font-size:14px; font-weight:bold; color:#666; display:block; margin-bottom:8px;">所要時間の変更</label>
                <select id="new-duration" style="width:100%; height:45px; font-size:16px; border:1px solid #ddd; border-radius:8px; padding:0 10px; margin-bottom:15px; background:#fff;">
                    ${[30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 210, 240].map(m => 
                        `<option value="${m}" ${currentDur == m ? 'selected' : ''}>${m}分</option>`
                    ).join('')}
                </select>
                <button onclick="saveChanges('${res.id}')" style="background:#34c759; color:white; border:none; height:50px; width:100%; border-radius:10px; font-weight:bold; font-size:16px; cursor:pointer; margin-top:20px;">変更を保存</button>
            </div>
            <button onclick="deleteRes('${res.id}')" style="background:none; color:#ff3b30; border:none; width:100%; padding:10px; cursor:pointer; font-size:14px;">この予約を削除する</button>`;
    } else {
        html += `
            <div style="display:flex; flex-direction:column; gap:12px; background:#f2f2f7; padding:20px; border-radius:15px; margin-bottom:15px;">
                <label style="font-size:14px; font-weight:bold; color:#666; display:block;">新規予約の追加</label>
                <input type="text" id="manual-name" placeholder="お客様名" style="width:100%; height:45px; font-size:16px; border:1px solid #ddd; border-radius:8px; padding:0 10px; box-sizing:border-box;">
                <select id="manual-menu" style="width:100%; height:45px; font-size:16px; border:1px solid #ddd; border-radius:8px; padding:0 10px; box-sizing:border-box; background:#fff;">
                    ${Object.keys(MENU_DURATION).map(m => `<option value="${m}">${m}</option>`).join('')}
                </select>
                <button onclick="addManual('${date}', '${time}')" style="background:#007aff; color:white; border:none; height:50px; width:100%; border-radius:10px; font-weight:bold; font-size:16px; margin-top:10px; cursor:pointer;">予約を追加</button>
            </div>
            <button onclick="toggleOffTime('${date}', '${time}', ${isOff})" style="background:${isOff ? '#ff9500' : '#8e8e93'}; color:white; border:none; height:45px; width:100%; border-radius:10px; font-weight:bold; font-size:15px; cursor:pointer;">
                ${isOff ? '予約可能に戻す' : '予約不可にする'}
            </button>`;
    }
    html += `<button onclick="closeModal()" style="margin-top:15px; width:100%; padding:10px; border:none; background:none; color:#007aff; font-size:16px; cursor:pointer;">閉じる</button>`;
    body.innerHTML = html;
    document.getElementById('slot-modal').style.display = 'flex';
}

// 補助関数
async function handleDrop(e, newDate, newTime) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) handleTouchDrop(id, newDate, newTime);
}
async function handleTouchDrop(id, newDate, newTime) {
    if (!confirm(`${newDate} ${newTime} に移動しますか？`)) return;
    const password = localStorage.getItem('admin_password');
    await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/admin-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "edit", id: Number(id), date: newDate, time: newTime, password: password })
    });
    await fetchData(); render();
}
function setupTouchEvents(div, exactRes, date, time) {
    let touchTimer; 
    div.ontouchstart = () => { touchTimer = setTimeout(() => { div.style.opacity = "0.4"; window.draggingId = exactRes.id; }, 500); };
    div.ontouchend = (e) => {
        clearTimeout(touchTimer);
        if (window.draggingId) {
            div.style.opacity = "1";
            const touch = e.changedTouches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.slot');
            if (target && window.draggingId) {
                const d = target.dataset.date, t = target.dataset.time;
                if (d && t) handleTouchDrop(window.draggingId, d, t);
            }
            window.draggingId = null;
        }
    };
}
window.saveChanges = async function(id) {
    const dur = document.getElementById('new-duration').value;
    const password = localStorage.getItem('admin_password');

    // --- 修正：既存の予約データから時間を取得 ---
    const res = reservations.find(r => r.id == id);
    if (!res) return alert("予約が見つかりません");
    
    const [h, m] = res.time.split(':').map(Number);
    const endD = new Date(2000, 0, 1, h, m + Number(dur));
    const end_time = `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;
    // -------------------------

    await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/admin-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            mode: "edit", 
            id: Number(id), 
            manual_duration: Number(dur), 
            end_time: end_time,
            password: password 
        })
    });
    closeModal(); await fetchData(); render();
};
async function addManual(date, time) {
    const name = document.getElementById('manual-name').value;
    const menus = document.getElementById('manual-menu').value;
    const password = localStorage.getItem('admin_password');
    
    if (!name) return alert("名前を入力してください");
    
    // ★ end_timeを計算（この部分を追加）
    const duration = MENU_DURATION[menus] || 60;
    const [h, m] = time.split(':').map(Number);
    const endD = new Date(2000, 0, 1, h, m + duration);
    const end_time = `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;
    
    await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/admin-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            mode: "add", 
            name, 
            date, 
            time, 
            menus, 
            end_time,  // ← これを追加
            password: password 
        })
    });
    closeModal(); 
    await fetchData(); 
    render();
}
async function toggleDay(date, isClosed) {
    const password = localStorage.getItem('admin_password'), mode = isClosed ? "delHoliday" : "addHoliday";
    await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/admin-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: mode, date: date, password: password })
    });
    await fetchData(); render();
}
async function addReservation() {
    const name = document.getElementById('res-name').value;
    const date = document.getElementById('res-date').value;
    const time = document.getElementById('res-time').value;
    const menuEls = document.querySelectorAll('.res-menu:checked');
    const password = localStorage.getItem('admin_password');

    if (!name || menuEls.length === 0) {
        alert("名前とメニューを選択してください");
        return;
    }

    const selectedMenus = Array.from(menuEls).map(el => el.value);
    
    // 読み込んだ MENU_DURATION を使って計算
    let totalMin = 0;
    selectedMenus.forEach(m => {
        const d = MENU_DURATION[m] || 30; // データがなければ30分
        totalMin += d;
    });

    const [h, min] = time.split(':').map(Number);
    const endD = new Date(2000, 0, 1, h, min + totalMin);
    const end_time = `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;

    try {
        const response = await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/admin-service", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                mode: "add",
                name: name,
                menus: selectedMenus.join(','),
                date: date,
                time: time,
                end_time: end_time, // ここで計算した値が入る
                password: password
            })
        });

        if (!response.ok) throw new Error("保存失敗");

        alert("予約を保存しました");
        closeModal();
        await fetchData();
        render();

    } catch (err) {
        alert("保存に失敗しました。パスワードを確認してください。");
    }
}
async function deleteRes(id) {
    if (!confirm("削除しますか？")) return;
    const password = localStorage.getItem('admin_password');
    await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/admin-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "delete", id: id, password: password })
    });
    closeModal(); await fetchData(); render();
}
window.handleCalendarChange = v => { if(v) { baseDate = new Date(v.replace(/-/g, '/')); render(); } };
window.moveDate = n => { baseDate.setDate(baseDate.getDate() + n); render(); };
window.closeModal = () => document.getElementById('slot-modal').style.display = 'none';

function updateNowLine() {
    document.querySelectorAll('.now-line').forEach(el => el.remove());
    const now = new Date(), dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`, col = document.getElementById(`col-${dateStr}`);
    if (!col) return;
    const currentMins = now.getHours()*60 + now.getMinutes(), startMins = 10*60;
    const slots = col.querySelectorAll('.slot');
    if (slots.length > 0) {
        const line = document.createElement('div');
        line.className = 'now-line';
        line.style.top = `${((currentMins - startMins) / 30) * slots[0].offsetHeight + slots[0].offsetTop}px`;
        col.appendChild(line);
    }
}
