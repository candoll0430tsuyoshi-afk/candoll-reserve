const SUPABASE_URL = window.CONFIG?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.CONFIG?.SUPABASE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = window.CONFIG?.SUPABASE_SERVICE_ROLE_KEY;
const adminClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    
    console.log('fetchData - Sending password:', password);
    
    try {
        const response = await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/admin-service", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ mode: "list", password: password })
        });
        
        console.log('fetchData - Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('fetchData - Error response:', errorText);
            return false;
        }
        
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

        return true;
    } catch (e) {
        console.error("fetchData - Fetch error:", e);
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
    
    // PCの場合：ナビゲーションには基準日を表示し、予約エリアの直前に3日分のヘッダーを追加
    if (!isMobile) {
        // バナーには基準日（1日目）を表示
        const d_banner = new Date(baseDate);
        const w_banner = d_banner.getDay();
        navCurrent.innerHTML = `${String(d_banner.getMonth() + 1).padStart(2, '0')}/${String(d_banner.getDate()).padStart(2, '0')} (${['日','月','火','水','木','金','土'][w_banner]})`;
        
        // 3日分のヘッダーを作成
        const headerRow = document.createElement('div');
        headerRow.id = 'date-header-row';
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
    
    // スクロールイベント（既存のリスナーを削除してから追加）
    window.removeEventListener('scroll', updateBanner);
    wrap.removeEventListener('scroll', updateBanner);
    window.addEventListener('scroll', updateBanner);
    wrap.addEventListener('scroll', updateBanner);
}

function renderSlot(col, date, time, isClosed) {
    const timeMins = toMin(time);
    const exactRes = reservations.find(r => r.date === date && r.time === time);
    const overlappingRes = reservations.filter(r => {
        if (r.date !== date || !r.end_time) return false;
        const s = toMin(r.time), e = toMin(r.end_time);
        return timeMins >= s && timeMins < e;
    }).sort((a, b) => toMin(a.time) - toMin(b.time));
    
    if (exactRes) overlappingRes.unshift(exactRes);
    const first = overlappingRes[0];
    
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.date = date;
    slot.dataset.time = time;
    slot.style.cssText = `position:relative; border:1px solid #ddd; padding:8px; min-height:60px; background:${isClosed ? '#f0f0f0' : '#fff'}; cursor:pointer; opacity:${isClosed ? '0.5' : '1'};`;
    
    const conflictOffTime = offTimes.find(o => o.date === date && o.time === time);
    if (conflictOffTime) {
        slot.style.background = '#ffd700';
        slot.innerHTML = `<div style="color:#000; font-weight:bold; font-size:11px;">臨時休み</div>`;
        slot.onclick = () => alert("この時間は臨時休みです");
        col.appendChild(slot);
        return;
    }
    
    if (!first) {
        const label = document.createElement('div');
        label.textContent = time;
        label.style.cssText = 'font-size:11px; color:#999;';
        slot.appendChild(label);
        if (!isClosed) {
            slot.onclick = () => openModal(date, time);
        }
        col.appendChild(slot);
        return;
    }
    
    if (exactRes) {
        slot.style.background = '#007aff';
        slot.style.color = '#fff';
        slot.draggable = true;
        slot.ondragstart = e => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", JSON.stringify({ id: exactRes.id, date: date, time: time }));
        };
        setupTouchEvents(slot, exactRes, date, time);
        
        const info = document.createElement('div');
        info.style.cssText = 'position:relative; z-index:10;';
        info.innerHTML = `
            <div style="font-size:12px; font-weight:bold;">${exactRes.name}</div>
            <div style="font-size:10px;">${exactRes.menus || ''}</div>
            <div style="font-size:10px;">${time} ~ ${exactRes.end_time || ''}</div>
        `;
        slot.appendChild(info);
        slot.onclick = () => editModal(exactRes.id);
    } else {
        slot.style.background = '#ffcccc';
        slot.style.color = '#000';
        slot.style.cursor = 'default';
        const info = document.createElement('div');
        info.innerHTML = `<div style="font-size:11px; color:#666;">${time}</div><div style="font-size:10px; color:#999;">予約あり</div>`;
        slot.appendChild(info);
    }
    
    slot.ondragover = e => { e.preventDefault(); slot.style.background = '#cce5ff'; };
    slot.ondragleave = () => { slot.style.background = exactRes ? '#007aff' : (first ? '#ffcccc' : '#fff'); };
    slot.ondrop = e => {
        e.preventDefault();
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        if (data.id) handleDrop(data.id, date, time);
        slot.style.background = exactRes ? '#007aff' : (first ? '#ffcccc' : '#fff');
    };
    
    col.appendChild(slot);
}

function openModal(date, time) {
    const modal = document.getElementById('slot-modal');
    modal.style.display = 'block';
    modal.innerHTML = `
        <div style="background:#fff; width:90%; max-width:500px; margin:80px auto; padding:20px; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0;">${date} ${time} に予約を追加</h3>
            <label>名前<br><input type="text" id="manual-name" style="width:100%; padding:8px; margin-bottom:10px; box-sizing:border-box;"></label><br>
            <label>メニュー<br><input type="text" id="manual-menu" placeholder="カット, カラーなど" style="width:100%; padding:8px; margin-bottom:10px; box-sizing:border-box;"></label><br>
            <button onclick="addManual('${date}', '${time}')" style="padding:10px 20px; background:#007aff; color:#fff; border:none; border-radius:8px; cursor:pointer;">保存</button>
            <button onclick="closeModal()" style="padding:10px 20px; background:#ccc; color:#000; border:none; border-radius:8px; cursor:pointer; margin-left:10px;">キャンセル</button>
        </div>
    `;
}

function editModal(id) {
    const res = reservations.find(r => r.id == id);
    if (!res) return;
    
    const duration = res.manual_duration || (MENU_DURATION[res.menus] || 60);
    
    const modal = document.getElementById('slot-modal');
    modal.style.display = 'block';
    modal.innerHTML = `
        <div style="background:#fff; width:90%; max-width:500px; margin:80px auto; padding:20px; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0;">予約の編集</h3>
            <div><b>名前:</b> ${res.name}</div>
            <div><b>日時:</b> ${res.date} ${res.time}</div>
            <div><b>メニュー:</b> ${res.menus || ''}</div>
            <br>
            <label>施術時間 (分)<br>
                <input type="number" id="new-duration" value="${duration}" style="width:100%; padding:8px; margin-bottom:10px; box-sizing:border-box;">
            </label><br>
            <button onclick="saveChanges(${id})" style="padding:10px 20px; background:#007aff; color:#fff; border:none; border-radius:8px; cursor:pointer;">保存</button>
            <button onclick="deleteRes(${id})" style="padding:10px 20px; background:#ff3b30; color:#fff; border:none; border-radius:8px; cursor:pointer; margin-left:10px;">削除</button>
            <button onclick="closeModal()" style="padding:10px 20px; background:#ccc; color:#000; border:none; border-radius:8px; cursor:pointer; margin-left:10px;">閉じる</button>
        </div>
    `;
}

async function handleDrop(id, newDate, newTime) {
    const password = localStorage.getItem('admin_password');
    if (!password) return alert("パスワードが設定されていません");
    
    const res = reservations.find(r => r.id == id);
    if (!res) return;
    
    const duration = res.manual_duration || (MENU_DURATION[res.menus] || 60);
    const [h, m] = newTime.split(':').map(Number);
    const endD = new Date(2000, 0, 1, h, m + duration);
    const end_time = `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;
    
    console.log('handleDrop - Sending password:', password);
    
    try {
        const response = await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/admin-service", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ 
                mode: "edit", 
                id: Number(id),
                name: res.name,
                menus: res.menus,
                date: newDate, 
                time: newTime, 
                end_time: end_time,
                manual_duration: res.manual_duration,
                password: password
            })
        });
        
        console.log('handleDrop - Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('handleDrop - Error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        await fetchData(); 
        render();
    } catch (error) {
        console.error('予約移動エラー:', error);
        alert('予約の移動に失敗しました');
    }
}

async function handleTouchDrop(id, newDate, newTime) {
    await handleDrop(id, newDate, newTime);
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

    const res = reservations.find(r => r.id == id);
    if (!res) return alert("予約が見つかりません");
    
    const [h, m] = res.time.split(':').map(Number);
    const endD = new Date(2000, 0, 1, h, m + Number(dur));
    const end_time = `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;

    console.log('saveChanges - Sending password:', password);

    try {
        const response = await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/admin-service", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ 
                mode: "edit", 
                id: Number(id),
                name: res.name,
                menus: res.menus,
                date: res.date,
                time: res.time,
                manual_duration: Number(dur), 
                end_time: end_time,
                password: password
            })
        });

        console.log('saveChanges - Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('saveChanges - Error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        closeModal(); 
        await fetchData(); 
        render();
    } catch (error) {
        console.error('保存エラー:', error);
        alert('保存に失敗しました');
    }
};

async function addManual(date, time) {
    const name = document.getElementById('manual-name').value;
    const menus = document.getElementById('manual-menu').value;
    const password = localStorage.getItem('admin_password');
    
    if (!name) return alert("名前を入力してください");
    
    const duration = MENU_DURATION[menus] || 60;
    const [h, m] = time.split(':').map(Number);
    const endD = new Date(2000, 0, 1, h, m + duration);
    const end_time = `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;
    
    console.log('addManual - Sending password:', password);
    
    try {
        const response = await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/admin-service", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ 
                mode: "add", 
                name, 
                date, 
                time, 
                menus, 
                end_time,
                password: password
            })
        });

        console.log('addManual - Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('addManual - Error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        closeModal(); 
        await fetchData(); 
        render();
    } catch (error) {
        console.error('予約追加エラー:', error);
        alert('予約の追加に失敗しました');
    }
}

async function toggleDay(date, isClosed) {
    const password = localStorage.getItem('admin_password');
    const mode = isClosed ? "delHoliday" : "addHoliday";
    
    console.log('toggleDay - mode:', mode, 'date:', date, 'password:', password);
    
    try {
        const response = await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/admin-service", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ mode: mode, date: date, password: password })
        });

        console.log('toggleDay - Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('toggleDay - Error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        await fetchData(); 
        render();
    } catch (error) {
        console.error('営業日変更エラー:', error);
        alert('営業日の変更に失敗しました');
    }
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
    
    let totalMin = 0;
    selectedMenus.forEach(m => {
        const d = MENU_DURATION[m] || 30;
        totalMin += d;
    });

    const [h, min] = time.split(':').map(Number);
    const endD = new Date(2000, 0, 1, h, min + totalMin);
    const end_time = `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;

    console.log('addReservation - Sending password:', password);

    try {
        const response = await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/admin-service", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({
                mode: "add",
                name: name,
                menus: selectedMenus.join(','),
                date: date,
                time: time,
                end_time: end_time,
                password: password
            })
        });

        console.log('addReservation - Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('addReservation - Error response:', errorText);
            throw new Error("保存失敗");
        }

        alert("予約を保存しました");
        closeModal();
        await fetchData();
        render();

    } catch (err) {
        console.error('予約保存エラー:', err);
        alert("保存に失敗しました。パスワードを確認してください。");
    }
}

async function deleteRes(id) {
    if (!confirm("削除しますか？")) return;
    const password = localStorage.getItem('admin_password');
    
    console.log('deleteRes - Deleting id:', id, 'password:', password);
    
    try {
        const response = await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/admin-service", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ mode: "delete", id: id, password: password })
        });

        console.log('deleteRes - Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('deleteRes - Error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        closeModal(); 
        await fetchData(); 
        render();
    } catch (error) {
        console.error('削除エラー:', error);
        alert('予約の削除に失敗しました');
    }
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
