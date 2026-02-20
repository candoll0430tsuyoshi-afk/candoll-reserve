const SUPABASE_URL = window.CONFIG?.SUPABASE_URL;
const SUPABASE_KEY = window.CONFIG?.SUPABASE_KEY;
const adminClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const urlParams = new URLSearchParams(window.location.search);
const paramDate = urlParams.get("date");

let baseDate = paramDate ? new Date(paramDate) : new Date();

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
                try {
                    localStorage.setItem('admin_password', passInput);
                } catch (e) {
                    console.log("localStorage 保存失敗:", e);
                }

                // ★ Safari 対策：保存が完了するまで少し待つ
                setTimeout(() => {
                    initAdmin();
                }, 150);

            } else {
                alert("パスワードが違うか、通信エラーです");
            }
        };
    }

    // すでにログイン済みなら管理画面へ
    if (localStorage.getItem('admin_password')) {
        initAdmin();
    }
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
headers: { 
    "Content-Type": "application/json",
    "apikey": window.CONFIG?.SUPABASE_KEY, 
    "Authorization": `Bearer ${window.CONFIG?.SUPABASE_KEY}` 
},
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

// 第1・第3火曜日かどうかを判定
function isFirstOrThirdTuesday(date) {
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    
    // 火曜日でなければfalse
    if (dayOfWeek !== 2) return false;
    
    // その月の何日目か
    const dayOfMonth = d.getDate();
    
    // 第何週かを計算（1-7日=第1週、8-14日=第2週...）
    const weekOfMonth = Math.ceil(dayOfMonth / 7);
    
    // 第1週または第3週ならtrue
    return weekOfMonth === 1 || weekOfMonth === 3;
}

// 定休日かどうかを判定
function isRegularHoliday(date) {
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    
    // 月曜日は毎週休み
    if (dayOfWeek === 1) return true;
    
    // 火曜日は第1・第3週のみ休み
    if (isFirstOrThirdTuesday(date)) return true;
    
    return false;
}

// データを再読み込みして表示位置を保持したままリロード
async function reloadWithPosition() {
    await fetchData();
    
    // 既存のカラムをすべて再描画（render()を使わない）
    const columns = document.querySelectorAll('.day-column');
    columns.forEach(col => {
        const dateStr = col.dataset.date;
        if (!dateStr) return;
        
        const d = new Date(dateStr);
        const w = d.getDay();
        const isClosed = (isRegularHoliday(dateStr) || holidays.some(h => h.date === dateStr)) && !specialOpens.some(s => s.date === dateStr);
        
        // ★ ヘッダー以外のスロットのみ削除
        const slots = col.querySelectorAll('.slot');
        slots.forEach(slot => slot.remove());
        
        // ★ 休み設定ボタンのテキストを更新
        const toggleBtn = col.querySelector('[onclick*="toggleDay"]');
        if (toggleBtn) {
            toggleBtn.textContent = isClosed ? '営業にする' : '休みにする';
        }
        
        // スロットを再生成
        for (let h = 10; h <= 18; h++) {
            ['00', '30'].forEach(m => {
                renderSlot(col, dateStr, `${String(h).padStart(2, '0')}:${m}`, isClosed);
            });
        }
    });
    
    // now-lineを更新
    setTimeout(updateNowLine, 300);
}

function render() {
    const wrap = document.getElementById('days-wrapper');
    if (!wrap) return;
    wrap.innerHTML = '';
    const isMobile = window.innerWidth < 600;

    // ★ lastDateをリセット（render = baseDateが変わった時）
    lastDate = new Date(baseDate);
    lastDate.setDate(lastDate.getDate() + 3); // 初期表示の4日目

    wrap.style.display = "flex";
    wrap.style.flexDirection = isMobile ? "column" : "row";
    wrap.style.gap = "15px";

    const navCurrent = document.getElementById('nav-current');

    // 既存ヘッダー削除
    const existingHeader = document.getElementById('date-header-row');
    if (existingHeader) existingHeader.remove();

    // PC の場合：ヘッダー生成
    if (!isMobile) {
        const d_banner = new Date(baseDate);
        const w_banner = d_banner.getDay();
        navCurrent.innerHTML =
            `${String(d_banner.getMonth() + 1).padStart(2, '0')}/${String(d_banner.getDate()).padStart(2, '0')} (${['日','月','火','水','木','金','土'][w_banner]})`;

        const headerRow = document.createElement('div');
        headerRow.id = 'date-header-row';
        headerRow.style.display = "flex";
        headerRow.style.gap = "15px";
        headerRow.style.marginBottom = "10px";
        headerRow.style.padding = "0";
        headerRow.style.overflowX = "hidden";
        headerRow.style.whiteSpace = "nowrap";

        // ★ 最初の4日分のヘッダー
        for (let i = 0; i < 4; i++) {
            const d = new Date(baseDate);
            d.setDate(d.getDate() + i);
            const w = d.getDay();

            const headerCell = document.createElement('div');
            headerCell.style.minWidth = "320px";
            headerCell.style.maxWidth = "320px";
            headerCell.style.flex = "none";
            headerCell.style.textAlign = "center";
            headerCell.style.fontWeight = "bold";
            headerCell.style.fontSize = "16px";
            headerCell.style.padding = "0";
            headerCell.style.background = "#f2f2f7";
            headerCell.style.borderRadius = "8px";

            headerCell.innerHTML =
                `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} (${['日','月','火','水','木','金','土'][w]})`;

            headerRow.appendChild(headerCell);
        }

        wrap.parentElement.insertBefore(headerRow, wrap);
    } else {
        // スマホは初期表示（1日目）
        const d = new Date(baseDate);
        const w = d.getDay();
        navCurrent.innerHTML =
            `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} (${['日','月','火','水','木','金','土'][w]})`;
    }

    // ★ カラム生成（最初の4日）
    for (let i = 0; i < 4; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + i);
        const dateStr =
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const col = document.createElement('div');
        col.className = 'day-column';
        col.id = `col-${dateStr}`;
        col.dataset.index = i;
        col.dataset.date = dateStr;

        // ★ iPhone Safari対策：スタイルを明示的に設定
        if (isMobile) {
            // モバイル縦向き時は画面幅いっぱい
            col.style.width = "100%";
            col.style.minWidth = "auto";
            col.style.maxWidth = "none";
            col.style.flex = "0 0 auto";
        } else {
            // PC/iPad横向き時は320px固定
            col.style.minWidth = "320px";
            col.style.maxWidth = "320px";
            col.style.width = "320px";
            col.style.flex = "0 0 auto";
        }
        col.style.padding = "0";
        col.style.margin = "0";
        col.style.boxSizing = "border-box";

        const w = d.getDay();
        const isClosed =
            (isRegularHoliday(dateStr) || holidays.some(h => h.date === dateStr)) &&
            !specialOpens.some(s => s.date === dateStr);

        if (isMobile) {
            col.innerHTML = `
                <div style="background:#f2f2f7; padding:12px; text-align:center; border-bottom:1px solid #ddd;">
                    <b style="font-size:16px;">${dateStr} (${['日','月','火','水','木','金','土'][w]})</b>
                    <div onclick="toggleDay('${dateStr}', ${isClosed})"
                        style="font-size:11px; text-decoration:underline; cursor:pointer; color:#007aff;">
                        ${isClosed ? '営業にする' : '休みにする'}
                    </div>
                </div>`;
        } else {
            col.innerHTML = `
                <div style="background:#f2f2f7; padding:8px; text-align:center; border-bottom:1px solid #ddd;">
                    <div onclick="toggleDay('${dateStr}', ${isClosed})"
                        style="font-size:11px; text-decoration:underline; cursor:pointer; color:#007aff;">
                        ${isClosed ? '営業にする' : '休みにする'}
                    </div>
                </div>`;
        }

        for (let h = 10; h <= 18; h++) {
            ['00', '30'].forEach(m => {
                renderSlot(col, dateStr, `${String(h).padStart(2, '0')}:${m}`, isClosed);
            });
        }

        wrap.appendChild(col);
    }

    // ★★★ 正しい位置はここ！ ★★★
    if (isMobile) {
        setupMobileScroll();  // スマホ：縦スクロール監視
    } else {
        setupScrollWatcher();  // PC/iPad：横スクロール監視
    }

    setTimeout(updateNowLine, 300);
}


// スマホ用：スクロールで日付バナーを更新 + 次の日を自動追加
function setupMobileScroll() {
    const wrap = document.getElementById('days-wrapper');
    wrap.style.gap = "15px";
    const navCurrent = document.getElementById('nav-current');
    
    let lastIndex = -1;
    
    const updateBanner = () => {
        const columns = Array.from(wrap.querySelectorAll('.day-column'));
        let currentIndex = 0;
        let minDistance = Infinity;
        
        // 画面の上から30%の位置に最も近いカラムを見つける
        columns.forEach((col, index) => {
            const rect = col.getBoundingClientRect();
            const switchPoint = window.innerHeight * 0.3; // 画面の上から30%
            const distance = Math.abs(rect.top - switchPoint);
            
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
        
        // ★ 縦スクロールで下に近づいたら次の日を追加
        const scrollBottom = window.scrollY + window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;
        const nearBottom = scrollBottom >= docHeight - 500;
        
        if (nearBottom) {
            addNextDayColumnMobile();
        }
    };
    
    // スクロールイベント（既存のリスナーを削除してから追加）
    window.removeEventListener('scroll', updateBanner);
    wrap.removeEventListener('scroll', updateBanner);
    window.addEventListener('scroll', updateBanner);
    wrap.addEventListener('scroll', updateBanner);
}

// スマホ用：次の日のカラムを追加（縦スクロール用）
function addNextDayColumnMobile() {
    const wrap = document.getElementById('days-wrapper');
    if (!wrap) return;
    
    // ★ 次に追加する日付 = lastDate + 1日
    const d = new Date(lastDate);
    d.setDate(d.getDate() + 1);
    
    // ★ lastDate を更新
    lastDate = new Date(d);
    
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    // 既に存在するかチェック
    if (document.getElementById(`col-${dateStr}`)) return;
    
    const w = d.getDay();
    const isClosed = (isRegularHoliday(dateStr) || holidays.some(h => h.date === dateStr)) && !specialOpens.some(s => s.date === dateStr);
    
    const col = document.createElement('div');
    col.className = 'day-column';
    col.id = `col-${dateStr}`;
    col.dataset.date = dateStr;
    
    // ★ スタイル設定
    col.style.width = "100%";
    col.style.padding = "0";
    col.style.margin = "0";
    col.style.boxSizing = "border-box";
    
    col.innerHTML = `
        <div style="background:#f2f2f7; padding:12px; text-align:center; border-bottom:1px solid #ddd;">
            <b style="font-size:16px;">${dateStr} (${['日','月','火','水','木','金','土'][w]})</b>
            <div onclick="toggleDay('${dateStr}', ${isClosed})" style="font-size:11px; text-decoration:underline; cursor:pointer; color:#007aff;">
                ${isClosed ? '営業にする' : '休みにする'}
            </div>
        </div>`;
    
    for (let h = 10; h <= 18; h++) {
        ['00', '30'].forEach(m => {
            renderSlot(col, dateStr, `${String(h).padStart(2, '0')}:${m}`, isClosed);
        });
    }
    
    wrap.appendChild(col);
}

function renderSlot(col, date, time, isClosed) {
    const timeMins = toMin(time);

    const exactRes = reservations.find(r => r.date === date && r.time === time);

    // ★ 予約の長さを正しく計算
    const overlappingRes = reservations.find(r => {
        if (r.date !== date) return false;

        const start = toMin(r.time);
        let dur = 0;

        if (r.manual_duration) {
            dur = Number(r.manual_duration);
        } else {
            const menuList = r.menus.split(',').map(m => m.trim());
            menuList.forEach(m => dur += MENU_DURATION[m] || 60);
        }

        const end = start + dur;
        return timeMins >= start && timeMins < end;
    });

    const isOff = offTimes.some(o => o.date === date && o.time === time);

    const div = document.createElement('div');
    div.className = 'slot';

    div.dataset.date = date;
    div.dataset.time = time;

    div.ondragover = (e) => e.preventDefault();
    div.ondrop = (e) => handleDrop(e, date, time);

    // ★ デフォルト（空き枠・不可枠） → 黒い四角い枠
    div.style.margin = "0";
    div.style.marginBottom = "6px";
    div.style.boxSizing = "border-box";
    div.style.border = "1px solid #000";   // ← 黒枠復活
    div.style.borderRadius = "12px";
    div.style.background = (isOff || isClosed) ? "#f2f2f7" : "#ffffff";

    // ★ 予約枠（pill）
    if (overlappingRes) {
        div.style.background = "#e5e5ea";

        const start = toMin(overlappingRes.time);
        let dur = 0;

        if (overlappingRes.manual_duration) {
            dur = Number(overlappingRes.manual_duration);
        } else {
            const menuList = overlappingRes.menus.split(',').map(m => m.trim());
            menuList.forEach(m => dur += MENU_DURATION[m] || 60);
        }

        const end = start + dur;
        const isStart = timeMins === start;
        const isEnd = timeMins + 30 >= end;

        // ★ pill の正しい仕様
        if (isStart) {
            // 開始 slot
            div.style.borderTop = "1px solid #000";
            div.style.borderBottom = isEnd ? "1px solid #000" : "none";
            div.style.borderLeft = "1px solid #000";
            div.style.borderRight = "1px solid #000";
            div.style.borderRadius = isEnd ? "15px" : "15px 15px 0 0";
            div.style.marginBottom = isEnd ? "6px" : "0";
        } else if (isEnd) {
            // 終了 slot
            div.style.borderTop = "none";
            div.style.borderBottom = "1px solid #000";
            div.style.borderLeft = "1px solid #000";
            div.style.borderRight = "1px solid #000";
            div.style.borderRadius = "0 0 15px 15px";
            div.style.marginBottom = "6px";
        } else {
            // 途中 slot（左右だけ黒線）
            div.style.borderTop = "none";
            div.style.borderBottom = "none";
            div.style.borderLeft = "1px solid #000";
            div.style.borderRight = "1px solid #000";
            div.style.borderRadius = "0";
            div.style.marginBottom = "0";
        }

        // ★ 開始 slot のみドラッグ可能
        if (exactRes) {
            div.draggable = true;
            div.ondragstart = (e) => {
                e.dataTransfer.setData("text/plain", exactRes.id);
                div.style.opacity = "0.4";
            };
            div.ondragend = () => div.style.opacity = "1";

            setupTouchEvents(div, exactRes, date, time);
        }
    }

    // ★ 内容
    let content = `<div class="time-label">${time}</div><div class="slot-info">`;
    if (overlappingRes && exactRes) {
        content += `<b style="color:#000;">${exactRes.name} 様</b><span class="menu-label">${exactRes.menus}</span>`;
    } else if (!overlappingRes) {
        content += `<span style="color:#666; font-size:13px;">${(isOff || isClosed) ? '不可' : '空き'}</span>`;
    }
    content += `</div>`;
    div.innerHTML = content;

    div.onclick = (e) => {
        if (div.style.opacity === "0.4") return;
        openSlotModal(date, time, exactRes || overlappingRes, isOff);
    };

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
headers: { 
    "Content-Type": "application/json",
    "apikey": "__SUPABASE_KEY__",
    "Authorization": "Bearer __SUPABASE_KEY__"
},
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

        await reloadWithPosition();
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
    
    // 移動する予約のデータを取得
    const reservation = reservations.find(r => r.id == id);
    if (!reservation) {
        alert('予約が見つかりません');
        return;
    }
    
    // end_timeを計算
    const duration = reservation.manual_duration || MENU_DURATION[reservation.menus.split(',')[0].trim()] || 60;
    const [h, m] = newTime.split(':').map(Number);
    const endD = new Date(2000, 0, 1, h, m + duration);
    const end_time = `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;
    
try {
        const response = await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/admin-service", {
            method: "POST",
headers: { 
    "Content-Type": "application/json",
    "apikey": window.CONFIG.SUPABASE_KEY, // 変数を使う
    "Authorization": `Bearer ${window.CONFIG.SUPABASE_KEY}` // 変数を使う
},
            body: JSON.stringify({ 
                mode: "edit", 
                id: Number(id), 
                date: newDate, 
                time: newTime, 
                end_time: end_time,
                password: password 
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        await fetchData(); 
        render();
    } catch (error) {
        console.error('予約移動エラー:', error);
        alert('予約の移動に失敗しました');
    }
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
headers: { 
    "Content-Type": "application/json",
    "apikey": window.CONFIG?.SUPABASE_KEY, 
    "Authorization": `Bearer ${window.CONFIG?.SUPABASE_KEY}` 
},
        body: JSON.stringify({ 
            mode: "edit", 
            id: Number(id), 
            manual_duration: Number(dur), 
            end_time: end_time,
            password: password 
        })
    });
    closeModal(); 
    await reloadWithPosition();
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
// headers の中を修正
headers: { 
    "Content-Type": "application/json",
    "apikey": window.CONFIG?.SUPABASE_KEY, 
    "Authorization": `Bearer ${window.CONFIG?.SUPABASE_KEY}` 
},
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
    await reloadWithPosition();
}
async function toggleDay(date, isClosed) {
    const password = localStorage.getItem('admin_password'), mode = isClosed ? "delHoliday" : "addHoliday";
    await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/admin-service", {
        method: "POST",
// headers の中を修正
headers: { 
    "Content-Type": "application/json",
    "apikey": window.CONFIG?.SUPABASE_KEY, 
    "Authorization": `Bearer ${window.CONFIG?.SUPABASE_KEY}` 
},
        body: JSON.stringify({ mode: mode, date: date, password: password })
    });
    await reloadWithPosition();
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
// headers の中を修正
headers: { 
    "Content-Type": "application/json",
    "apikey": window.CONFIG?.SUPABASE_KEY, 
    "Authorization": `Bearer ${window.CONFIG?.SUPABASE_KEY}` 
},
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
        await reloadWithPosition();

    } catch (err) {
        alert("保存に失敗しました。パスワードを確認してください。");
    }
}
async function deleteRes(id) {
    if (!confirm("削除しますか？")) return;
    const password = localStorage.getItem('admin_password');
    await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/admin-service", {
        method: "POST",
// headers の中を修正
headers: { 
    "Content-Type": "application/json",
    "apikey": window.CONFIG?.SUPABASE_KEY, 
    "Authorization": `Bearer ${window.CONFIG?.SUPABASE_KEY}` 
},
        body: JSON.stringify({ mode: "delete", id: id, password: password })
    });
    closeModal(); 
    await reloadWithPosition();
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
// ★ 今表示している最後の日付を覚えておく（最初は4日目）
let lastDate = new Date(baseDate);
lastDate.setDate(lastDate.getDate() + 3); // baseDate + 3日 = 4日目

function setupScrollWatcher() {
    const container = document.getElementById("days-wrapper");
    if (!container) return;

    // ★ 既存のリスナーを削除（重複防止）
    if (container._scrollHandler) {
        container.removeEventListener("scroll", container._scrollHandler);
    }

    // ★ スクロールハンドラを作成
    const scrollHandler = () => {
        const headerRow = document.getElementById("date-header-row");
        if (headerRow) headerRow.scrollLeft = container.scrollLeft;

        const nearRight =
            container.scrollLeft + container.clientWidth >= container.scrollWidth - 200;

        if (nearRight) addNextDayColumn();
    };

    // ★ ハンドラを保存して登録
    container._scrollHandler = scrollHandler;
    container.addEventListener("scroll", scrollHandler);
}

function addNextDayColumn() {
    const wrap = document.getElementById('days-wrapper');
    if (!wrap) return;
    wrap.style.gap = "15px";

    // ★ 次に追加する日付 = lastDate + 1日
    const d = new Date(lastDate);
    d.setDate(d.getDate() + 1);

    // ★ lastDate を更新（ここが超重要）
    lastDate = new Date(d);

    const dateStr =
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    const w = d.getDay();
    const isMobile = window.innerWidth < 600;

    const isClosed =
        (isRegularHoliday(dateStr) || holidays.some(h => h.date === dateStr)) &&
        !specialOpens.some(s => s.date === dateStr);

    // ★ カラム生成（320px 固定）
    const col = document.createElement('div');
    col.className = 'day-column';
    col.id = `col-${dateStr}`;
    col.dataset.date = dateStr;

    // ★ iPhone Safari対策：スタイルを明示的に設定
    col.style.minWidth = "320px";
    col.style.maxWidth = "320px";
    col.style.width = "320px";
    col.style.flex = "0 0 auto";
    col.style.padding = "0";
    col.style.margin = "0";
    col.style.boxSizing = "border-box";

    if (isMobile) {
        col.innerHTML = `
            <div style="background:#f2f2f7; padding:12px; text-align:center; border-bottom:1px solid #ddd;">
                <b style="font-size:16px;">${dateStr} (${['日','月','火','水','木','金','土'][w]})</b>
                <div onclick="toggleDay('${dateStr}', ${isClosed})"
                    style="font-size:11px; text-decoration:underline; cursor:pointer; color:#007aff;">
                    ${isClosed ? '営業にする' : '休みにする'}
                </div>
            </div>`;
    } else {
        col.innerHTML = `
            <div style="background:#f2f2f7; padding:8px; text-align:center; border-bottom:1px solid #ddd;">
                <div onclick="toggleDay('${dateStr}', ${isClosed})"
                    style="font-size:11px; text-decoration:underline; cursor:pointer; color:#007aff;">
                    ${isClosed ? '営業にする' : '休みにする'}
                </div>
            </div>`;
    }

    // ★ スロット生成
    for (let h = 10; h <= 18; h++) {
        ['00', '30'].forEach(m => {
            renderSlot(col, dateStr, `${String(h).padStart(2, '0')}:${m}`, isClosed);
        });
    }

    wrap.appendChild(col);

    // ★★★ PC の場合：ヘッダーも 320px 幅で追加（render と完全同期）★★★
    if (!isMobile) {
        const headerRow = document.getElementById('date-header-row');
        if (headerRow) {
            const headerCell = document.createElement('div');

            headerCell.style.minWidth = "320px";
            headerCell.style.maxWidth = "320px";
            headerCell.style.flex = "none";
            headerCell.style.textAlign = "center";
            headerCell.style.fontWeight = "bold";
            headerCell.style.fontSize = "16px";
            headerCell.style.padding = "0";
            headerCell.style.background = "#f2f2f7";
            headerCell.style.borderRadius = "8px";

            headerCell.innerHTML =
                `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} (${['日','月','火','水','木','金','土'][w]})`;

            headerRow.appendChild(headerCell);
        }
    }
}
