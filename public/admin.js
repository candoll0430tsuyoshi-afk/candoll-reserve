const SUPABASE_URL = window.CONFIG?.SUPABASE_URL;
const SUPABASE_KEY = window.CONFIG?.SUPABASE_KEY;
const adminClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const urlParams = new URLSearchParams(window.location.search);
const paramDate = urlParams.get("date");

let baseDate = paramDate ? new Date(paramDate.replace(/-/g, '/')) : new Date();

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
    const d = new Date(date.replace(/-/g, "/"));
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
    const d = new Date(date.replace(/-/g, "/"));
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
        
        const d = new Date(dateStr.replace(/-/g, '/'));
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

        // admin-navの実際の高さに合わせてstickyのtopを動的に設定
        const navEl = document.querySelector('.admin-nav');
        if (navEl) {
            headerRow.style.top = navEl.offsetHeight + 'px';
        }
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
        // overlappingResがある場合は予約の開始時間を渡す（スロットの時間ではなく）
        const modalTime = (exactRes || overlappingRes) ? (exactRes || overlappingRes).time : time;
        openSlotModal(date, modalTime, exactRes || overlappingRes, isOff);
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
async function fetchVisitHistory(name) {
    const password = localStorage.getItem('admin_password');
    try {
        const response = await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/admin-service", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": window.CONFIG?.SUPABASE_KEY,
                "Authorization": `Bearer ${window.CONFIG?.SUPABASE_KEY}`
            },
            body: JSON.stringify({ mode: "history", name: name, password: password })
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.history || [];
    } catch (e) {
        console.error("履歴取得エラー:", e);
        return [];
    }
}

async function openSlotModal(date, time, res, isOff) {
    const body = document.getElementById('modal-body');
    const dayOfWeek = ['日','月','火','水','木','金','土'][new Date(date.replace(/-/g, '/')).getDay()];

    // ★ 共通スタイル定数
    const S = {
        label: 'font-size:13px; font-weight:bold; color:#888; display:block; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;',
        input: 'width:100%; height:48px; font-size:15px; border:1px solid #ddd; border-radius:10px; padding:0 12px; box-sizing:border-box; background:#fff;',
        btnPrimary: 'background:#007aff; color:#fff; border:none; height:48px; width:100%; border-radius:10px; font-weight:bold; font-size:15px; cursor:pointer;',
        btnGreen: 'background:#34c759; color:#fff; border:none; height:48px; width:100%; border-radius:10px; font-weight:bold; font-size:15px; cursor:pointer;',
        btnGray: 'background:#8e8e93; color:#fff; border:none; height:48px; width:100%; border-radius:10px; font-weight:bold; font-size:15px; cursor:pointer;',
        btnDanger: 'background:none; color:#ff3b30; border:none; width:100%; padding:12px; cursor:pointer; font-size:15px;',
        btnClose: 'background:none; color:#007aff; border:none; width:100%; padding:12px; cursor:pointer; font-size:15px;',
        section: 'background:#f2f2f7; padding:16px; border-radius:12px; margin-bottom:12px;',
    };

    if (res) {
        const rawDur = res.manual_duration || (() => {
            let d = 0;
            res.menus.split(',').map(m => m.trim()).forEach(m => d += MENU_DURATION[m] || 60);
            return d;
        })();
        // 30分刻みに切り上げ（例：119→120, 50→60）
        const currentDur = Math.ceil(rawDur / 30) * 30;

        // タブUI
        let html = `
            <div style="position:relative; margin-bottom:16px;">
                <button onclick="closeModal()" style="position:absolute; top:-8px; right:-8px; background:none; border:none; font-size:20px; cursor:pointer; color:#999; line-height:1;">✕</button>
            </div>
            <div style="text-align:center; margin-bottom:16px;">
                <div style="font-size:20px; font-weight:bold; color:#000;">${res.name} 様</div>
                <div style="font-size:13px; color:#888; margin-top:4px;">${date}(${dayOfWeek}) ${time}</div>
            </div>

            <!-- タブ -->
            <div style="display:flex; border-bottom:2px solid #e0e0e0; margin-bottom:16px;">
                <button id="tab-edit" onclick="switchTab('edit')" style="flex:1; padding:10px; border:none; background:none; font-size:14px; font-weight:bold; color:#007aff; border-bottom:2px solid #007aff; margin-bottom:-2px; cursor:pointer;">予約変更</button>
                <button id="tab-history" onclick="switchTab('history')" style="flex:1; padding:10px; border:none; background:none; font-size:14px; font-weight:bold; color:#aaa; cursor:pointer;">来店履歴</button>
            </div>

            <!-- 予約変更タブ -->
            <div id="panel-edit">
                <div style="${S.section}">
                    <label style="${S.label}">メニュー</label>
                    <div id="admin-menu-container">
                        ${res.menus.split(',').map(m => m.trim()).filter(m => m).map((m, i) => `
                        <div style="display:flex; gap:6px; margin-bottom:6px; align-items:center;">
                            <select class="admin-menu-select" onchange="updateAdminDuration()" style="${S.input}; margin-top:0;">
                                <option value="">メニューを選択</option>
                                ${Object.keys(MENU_DURATION).map(menu => `<option value="${menu}" ${menu === m ? 'selected' : ''}>${menu}</option>`).join('')}
                            </select>
                            ${i > 0 ? `<button onclick="this.parentElement.remove(); updateAdminDuration();" style="flex-shrink:0; background:none; border:none; color:#ff3b30; font-size:20px; cursor:pointer; padding:0 6px;">×</button>` : '<div style="width:32px;"></div>'}
                        </div>`).join('')}
                    </div>
                    <div onclick="addAdminMenuRow()" style="color:#007aff; font-size:13px; cursor:pointer; text-align:right; margin-top:4px; font-weight:500;">＋ メニューを追加</div>
                </div>
                <div style="${S.section}">
                    <label style="${S.label}">日付・時間</label>
                    <div style="display:flex; gap:8px;">
                        <input type="date" id="new-date" value="${date}" style="${S.input}; flex:1 1 60%; width:auto; min-width:0;">
                        <select id="new-time" style="${S.input}; flex:1 1 40%; width:auto; min-width:0;">
                            ${['10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00'].map(t =>
                                `<option value="${t}" ${time === t ? 'selected' : ''}>${t}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                <div style="${S.section}">
                    <label style="${S.label}">所要時間</label>
                    <select id="new-duration" style="${S.input}">
                        ${[30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 210, 240].map(m =>
                            `<option value="${m}" ${currentDur == m ? 'selected' : ''}>${m}分</option>`
                        ).join('')}
                    </select>
                </div>
                <button onclick="saveAllChanges('${res.id}')" style="${S.btnGreen}">変更を保存</button>
                <button onclick="deleteRes('${res.id}')" style="${S.btnDanger}">この予約を削除する</button>
            </div>

            <!-- 来店履歴タブ -->
            <div id="panel-history" style="display:none;">
                <div id="visit-history-list" style="font-size:14px; color:#888; text-align:center; padding:20px 0;">読み込み中...</div>
            </div>
        `;

        body.innerHTML = html;
        document.getElementById('slot-modal').style.display = 'flex';

        // タブ切り替え関数
        window.switchTab = (tab) => {
            const isEdit = tab === 'edit';
            document.getElementById('panel-edit').style.display = isEdit ? 'block' : 'none';
            document.getElementById('panel-history').style.display = isEdit ? 'none' : 'block';
            document.getElementById('tab-edit').style.color = isEdit ? '#007aff' : '#aaa';
            document.getElementById('tab-edit').style.borderBottom = isEdit ? '2px solid #007aff' : 'none';
            document.getElementById('tab-history').style.color = isEdit ? '#aaa' : '#007aff';
            document.getElementById('tab-history').style.borderBottom = isEdit ? 'none' : '2px solid #007aff';

            // 履歴タブを開いた時に読み込む
            if (!isEdit) loadHistoryPanel(res.name, date);
        };

        // 履歴読み込み
        async function loadHistoryPanel(name, currentDate) {
            const el = document.getElementById('visit-history-list');
            if (!el || el.dataset.loaded) return;
            el.dataset.loaded = '1';
            const history = await fetchVisitHistory(name);
            const past = history.filter(h => h.date < currentDate || (h.date === currentDate ? false : true));
            if (past.length === 0) {
                el.innerHTML = '<span style="color:#aaa;">来店履歴はありません</span>';
            } else {
                el.innerHTML = past.slice(0, 10).map(h => {
                    const d = new Date(h.date.replace(/-/g, '/'));
                    const dow = ['日','月','火','水','木','金','土'][d.getDay()];
                    return `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #eee;">
                        <span style="color:#333; font-size:14px;">${h.date}(${dow}) ${h.time}</span>
                        <span style="color:#666; font-size:13px;">${h.menus}</span>
                    </div>`;
                }).join('') + (past.length > 10 ? `<div style="text-align:center; color:#aaa; font-size:12px; margin-top:8px;">他 ${past.length - 10} 件</div>` : '');
            }
        }

        return;

    } else {
        let html = `
            <div style="position:relative; margin-bottom:16px;">
                <button onclick="closeModal()" style="position:absolute; top:-8px; right:-8px; background:none; border:none; font-size:20px; cursor:pointer; color:#999; line-height:1;">✕</button>
            </div>
            <div style="text-align:center; margin-bottom:16px;">
                <div style="font-size:15px; color:#888;">${date}(${dayOfWeek}) ${time}</div>
            </div>
            <div style="${S.section}; display:flex; flex-direction:column; gap:10px;">
                <label style="${S.label}">新規予約の追加</label>
                <div style="position:relative;">
                    <input type="text" id="manual-name" placeholder="お客様名" style="${S.input}" autocomplete="off" oninput="suggestCustomer(this.value)" onblur="setTimeout(() => { const l = document.getElementById('suggest-list'); if(l) l.style.display='none'; }, 150)">
                    <div id="suggest-list" style="position:absolute; top:50px; left:0; right:0; background:#fff; border:1px solid #ddd; border-radius:10px; z-index:100; display:none; max-height:180px; overflow-y:auto; box-shadow:0 4px 12px rgba(0,0,0,0.1);"></div>
                </div>
                <input type="hidden" id="manual-customer-id">
                <select id="manual-menu" style="${S.input}">
                    ${Object.keys(MENU_DURATION).map(m => `<option value="${m}">${m}</option>`).join('')}
                </select>
                <button onclick="addManual('${date}', '${time}')" style="${S.btnPrimary}; margin-top:4px;">予約を追加</button>
            </div>
            <button onclick="toggleOffTime('${date}', '${time}', ${isOff})" style="background:${isOff ? '#ff9500' : '#8e8e93'}; color:white; border:none; height:48px; width:100%; border-radius:10px; font-weight:bold; font-size:15px; cursor:pointer;">
                ${isOff ? '予約可能に戻す' : '予約不可にする'}
            </button>
            <button onclick="closeModal()" style="${S.btnClose}; margin-top:8px;">閉じる</button>
        `;
        body.innerHTML = html;
        document.getElementById('slot-modal').style.display = 'flex';
    }
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
    let lastTarget = null;

    div.ontouchstart = () => {
      touchTimer = setTimeout(() => {
        // バイブレーション（対応機種のみ）
        if (navigator.vibrate) navigator.vibrate(50);
        // 移動モードをわかりやすく表示
        div.style.opacity = "0.5";
        div.style.outline = "3px solid #007aff";
        div.style.boxShadow = "0 0 12px rgba(0,122,255,0.5)";
        window.draggingId = exactRes.id;
      }, 800); // 500ms → 800msに延長
    };

    div.addEventListener('touchmove', (e) => {
        if (!window.draggingId) return;
        // ドラッグ中は画面スクロールを止める（横画面での横移動を可能にする）
        e.preventDefault();

        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.slot');

        // ハイライトを更新
        if (target !== lastTarget) {
            if (lastTarget) lastTarget.style.outline = "";
            if (target) target.style.outline = "2px dashed #007aff";
            lastTarget = target;
        }
    }, { passive: false });

    div.ontouchend = (e) => {
        clearTimeout(touchTimer);
        if (window.draggingId) {
            div.style.opacity = "1";
            div.style.outline = "";
            div.style.boxShadow = "";
            if (lastTarget) lastTarget.style.outline = "";

            const touch = e.changedTouches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.slot');
            if (target && window.draggingId) {
                const d = target.dataset.date, t = target.dataset.time;
                if (d && t) handleTouchDrop(window.draggingId, d, t);
            }
            window.draggingId = null;
            lastTarget = null;
        }
    };
}
window.addAdminMenuRow = function() {
    const container = document.getElementById('admin-menu-container');
    if (!container) return;
    const selects = container.querySelectorAll('.admin-menu-select');
    if (selects.length >= 3) { alert("メニューは最大3つまでです"); return; }
    const div = document.createElement('div');
    div.style.cssText = 'display:flex; gap:6px; margin-bottom:6px; align-items:center;';
    div.innerHTML = `
        <select class="admin-menu-select" onchange="updateAdminDuration()" style="font-size:16px; padding:12px; border:1px solid #ddd; border-radius:10px; width:100%; box-sizing:border-box; margin-top:0;">
            <option value="">メニューを選択</option>
            ${Object.keys(MENU_DURATION).map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>
        <button onclick="this.parentElement.remove(); updateAdminDuration();" style="flex-shrink:0; background:none; border:none; color:#ff3b30; font-size:20px; cursor:pointer; padding:0 6px;">×</button>
    `;
    container.appendChild(div);
    updateAdminDuration();
};

// メニュー選択に応じてduration(所要時間)を30分刻みで自動計算・反映
window.updateAdminDuration = function() {
    const durationSelect = document.getElementById('new-duration');
    if (!durationSelect) return;

    const selects = document.querySelectorAll('.admin-menu-select');
    const menus = Array.from(selects).map(s => s.value).filter(v => v !== "");
    if (menus.length === 0) return;

    let total = 0;
    menus.forEach(m => total += MENU_DURATION[m] || 0);
    if (total === 0) return;

    // 30分刻みに切り上げ
    const rounded = Math.ceil(total / 30) * 30;

    // セレクトの選択肢にあればそれを選択、なければ最も近い上位の値を選択
    const options = Array.from(durationSelect.options).map(o => Number(o.value));
    let target = options.find(v => v === rounded);
    if (!target) {
        target = options.find(v => v >= rounded) || options[options.length - 1];
    }
    durationSelect.value = target;
};

window.saveAllChanges = async function(id) {
    const dur = document.getElementById('new-duration').value;
    const newDate = document.getElementById('new-date').value;
    const newTime = document.getElementById('new-time').value;
    const password = localStorage.getItem('admin_password');

    // 複数メニューを取得
    const menuSelects = document.querySelectorAll('.admin-menu-select');
    const newMenus = Array.from(menuSelects).map(s => s.value).filter(v => v !== "");
    if (newMenus.length === 0) return alert("メニューを選択してください");
    const newMenu = newMenus.join(", ");

    if (!newDate || !newTime) return alert("日付・時間を入力してください");

    const [h, m] = newTime.split(':').map(Number);
    const endD = new Date(2000, 0, 1, h, m + Number(dur));
    const end_time = `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;

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
            menus: newMenu,
            date: newDate,
            time: newTime,
            end_time: end_time,
            manual_duration: Number(dur),
            password: password
        })
    });
    closeModal();
    await reloadWithPosition();
};
async function addManual(date, time) {
    const name = document.getElementById('manual-name').value;
    const menus = document.getElementById('manual-menu').value;
    const customerId = document.getElementById('manual-customer-id')?.value || null;
    const password = localStorage.getItem('admin_password');
    
    if (!name) return alert("名前を入力してください");

    // ★ 二重送信防止
    const addBtn = document.querySelector(`button[onclick="addManual('${date}', '${time}')"]`);
    if (addBtn) {
        if (addBtn.disabled) return;
        addBtn.disabled = true;
        addBtn.innerText = "追加中...";
    }
    
    const duration = MENU_DURATION[menus] || 60;
    const [h, m] = time.split(':').map(Number);
    const endD = new Date(2000, 0, 1, h, m + duration);
    const end_time = `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;
    
    await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/admin-service", {
        method: "POST",
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
            end_time,
            customer_user_id: customerId,
            password: password 
        })
    });
    closeModal(); 
    await reloadWithPosition();
}

// お客様名サジェスト
window.suggestCustomer = function(val) {
    const list = document.getElementById('suggest-list');
    const customerIdInput = document.getElementById('manual-customer-id');
    if (!list) return;

    // 入力が空またはLINE IDをリセット
    customerIdInput.value = '';

    if (!val || val.length < 1) {
        list.style.display = 'none';
        return;
    }

    // reservationsから名前でフィルタ（部分一致・重複なし）
    const seen = new Set();
    const matches = reservations
        .filter(r => r.name && r.name.includes(val) && r.customer_user_id)
        .filter(r => {
            if (seen.has(r.name)) return false;
            seen.add(r.name);
            return true;
        })
        .slice(0, 5);

    if (matches.length === 0) {
        list.style.display = 'none';
        return;
    }

    list.innerHTML = matches.map(r => `
        <div onclick="selectCustomer('${r.name.replace(/'/g, "\\'")}', '${r.customer_user_id}')"
            style="padding:12px 15px; font-size:15px; cursor:pointer; border-bottom:1px solid #f0f0f0; color:#333;">
            ${r.name}
            <span style="font-size:12px; color:#aaa; margin-left:8px;">LINE連携済み ✓</span>
        </div>
    `).join('');
    list.style.display = 'block';
};

window.selectCustomer = function(name, customerId) {
    document.getElementById('manual-name').value = name;
    document.getElementById('manual-customer-id').value = customerId;
    document.getElementById('suggest-list').style.display = 'none';
};
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
    const currentMins = now.getHours()*60 + now.getMinutes();
    const slots = col.querySelectorAll('.slot');
    if (slots.length === 0) return;

    // 各スロットの実際の時間とoffsetTopから、現在時刻の位置を線形補間で計算
    let topPosition = null;
    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const slotTime = slot.dataset.time; // "10:00" のような形式
        if (!slotTime) continue;
        const [sh, sm] = slotTime.split(':').map(Number);
        const slotMins = sh * 60 + sm;
        const slotEndMins = slotMins + 30; // 各スロットは30分単位

        if (currentMins >= slotMins && currentMins < slotEndMins) {
            // このスロット内に現在時刻がある → 比例配分で位置を計算
            const ratio = (currentMins - slotMins) / 30;
            topPosition = slot.offsetTop + slot.offsetHeight * ratio;
            break;
        } else if (currentMins < slotMins && i === 0) {
            // 最初のスロットより前
            topPosition = slot.offsetTop;
            break;
        }
    }

    // 現在時刻が最後のスロットより後の場合
    if (topPosition === null && slots.length > 0) {
        const lastSlot = slots[slots.length - 1];
        const lastTime = lastSlot.dataset.time;
        if (lastTime) {
            const [lh, lm] = lastTime.split(':').map(Number);
            const lastMins = lh * 60 + lm;
            if (currentMins >= lastMins + 30) {
                topPosition = lastSlot.offsetTop + lastSlot.offsetHeight;
            }
        }
    }

    if (topPosition !== null) {
        const line = document.createElement('div');
        line.className = 'now-line';
        line.style.top = `${topPosition}px`;
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

        // ★ 左端に近づいたら前の日を追加
        const nearLeft = container.scrollLeft <= 100;
        if (nearLeft) addPrevDayColumn();
    };

    // ★ ハンドラを保存して登録
    container._scrollHandler = scrollHandler;
    container.addEventListener("scroll", scrollHandler);
}

function addPrevDayColumn() {
    const wrap = document.getElementById('days-wrapper');
    if (!wrap) return;

    // baseDateの1日前を計算
    const d = new Date(baseDate);
    d.setDate(d.getDate() - 1);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    // 既に存在する場合はスキップ
    if (document.getElementById(`col-${dateStr}`)) return;

    const w = d.getDay();
    const isMobile = window.innerWidth < 600;
    const isClosed = (isRegularHoliday(dateStr) || holidays.some(h => h.date === dateStr)) && !specialOpens.some(s => s.date === dateStr);

    // カラム生成
    const col = document.createElement('div');
    col.className = 'day-column';
    col.id = `col-${dateStr}`;
    col.dataset.date = dateStr;
    col.style.minWidth = "320px";
    col.style.maxWidth = "320px";
    col.style.width = "320px";
    col.style.flex = "0 0 auto";
    col.style.padding = "0";
    col.style.margin = "0";
    col.style.boxSizing = "border-box";

    col.innerHTML = `
        <div style="background:#f2f2f7; padding:8px; text-align:center; border-bottom:1px solid #ddd;">
            <div onclick="toggleDay('${dateStr}', ${isClosed})"
                style="font-size:11px; text-decoration:underline; cursor:pointer; color:#007aff;">
                ${isClosed ? '営業にする' : '休みにする'}
            </div>
        </div>`;

    for (let h = 10; h <= 18; h++) {
        ['00', '30'].forEach(m => {
            renderSlot(col, dateStr, `${String(h).padStart(2, '0')}:${m}`, isClosed);
        });
    }

    // ★ 先頭に挿入
    wrap.insertBefore(col, wrap.firstChild);

    // ★ baseDateを1日戻す
    baseDate.setDate(baseDate.getDate() - 1);

    // ★ スクロール位置を維持（挿入した分だけ右にずらす）
    const container = document.getElementById("days-wrapper");
    container.scrollLeft += 320 + 15; // カラム幅 + gap

    // ★ ヘッダーも先頭に追加
    const headerRow = document.getElementById('date-header-row');
    if (headerRow && !isMobile) {
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
        headerCell.innerHTML = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} (${['日','月','火','水','木','金','土'][w]})`;
        headerRow.insertBefore(headerCell, headerRow.firstChild);
        headerRow.scrollLeft = container.scrollLeft;
    }
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

// ===== プルトゥリフレッシュ =====
(function setupPullToRefresh() {
    let startY = 0;
    let isPulling = false;
    let indicator = null;

    // インジケーター作成
    function createIndicator() {
        const el = document.createElement('div');
        el.id = 'ptr-indicator';
        el.style.cssText = 'position:fixed; top:0; left:0; right:0; height:0; background:#007aff; display:flex; align-items:flex-end; justify-content:center; overflow:hidden; z-index:9999; transition:height 0.1s; padding-bottom:0;';
        el.innerHTML = '<span id="ptr-text" style="color:#fff; font-size:13px; font-weight:bold; padding-bottom:8px; opacity:0; transition:opacity 0.2s;">↓ 引っ張って更新</span>';
        document.body.appendChild(el);
        return el;
    }

    // iPad対応：scrollYとscrollTopの両方をチェック
    function getScrollTop() {
        return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    }

    document.addEventListener('touchstart', (e) => {
        // ページ最上部かつモーダルが開いていない時のみ
        if (getScrollTop() === 0 && document.getElementById('slot-modal').style.display !== 'flex') {
            startY = e.touches[0].clientY;
            isPulling = false; // touchmoveで判定する
            if (!indicator) indicator = createIndicator();
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (getScrollTop() > 0) { isPulling = false; return; }
        if (document.getElementById('slot-modal').style.display === 'flex') return;

        const diff = e.touches[0].clientY - startY;
        if (diff <= 0) { isPulling = false; return; }

        isPulling = true;

        const height = Math.min(diff * 0.4, 60);
        indicator.style.height = height + 'px';

        const text = document.getElementById('ptr-text');
        if (height > 40) {
            text.style.opacity = '1';
            text.textContent = '✓ 離して更新';
        } else {
            text.style.opacity = height > 15 ? '1' : '0';
            text.textContent = '↓ 引っ張って更新';
        }
    }, { passive: true });

    document.addEventListener('touchend', async (e) => {
        if (!indicator) return;

        const height = parseFloat(indicator.style.height) || 0;
        if (isPulling && height > 40) {
            // 更新実行
            indicator.style.height = '44px';
            document.getElementById('ptr-text').textContent = '更新中...';
            await fetchData();
            baseDate = new Date(); // 今日に戻す
            render();
            indicator.style.height = '0';
        } else {
            indicator.style.height = '0';
        }
        isPulling = false;
    });
})();
