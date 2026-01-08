const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_KEY = "YOUR_SUPABASE_KEY";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let baseDate = new Date();
let reservations = [];
let offTimes = [];
let holidays = [];
let specialOpens = [];

// 1. ログイン処理
document.getElementById('login-btn').onclick = async () => {
    const pass = document.getElementById('admin-pass').value;
    if (pass === "YOUR_ADMIN_PASSWORD") { // パスワードは任意
        localStorage.setItem('admin_auth', 'true');
        document.getElementById('login-screen').style.display = 'none';
        init();
    } else {
        alert("パスワードが違います");
    }
};

async function init() {
    if (localStorage.getItem('admin_auth') !== 'true') return;
    document.getElementById('login-screen').style.display = 'none';
    await fetchData();
    render();
}

// 2. データ取得（全テーブル）
async function fetchData() {
    const res = await supabase.from('reservations').select('*');
    reservations = res.data || [];
    const off = await supabase.from('off_times').select('*');
    offTimes = off.data || [];
    const hol = await supabase.from('holidays').select('*');
    holidays = hol.data || [];
    const spec = await supabase.from('special_open').select('*');
    specialOpens = spec.data || [];
}

// 3. 描画処理
function render() {
    const wrap = document.getElementById('days-wrapper');
    wrap.innerHTML = '';
    document.getElementById('nav-current').innerText = baseDate.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });

    for (let i = 0; i < 3; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        
        const col = document.createElement('div');
        col.className = 'day-column';
        
        // 休日判定
        const w = d.getDay();
        const isDefaultHoliday = (w === 1 || w === 2); // 月火
        const isCustomHoliday = holidays.some(h => h.date === dateStr);
        const isSpecialOpen = specialOpens.some(s => s.date === dateStr);
        const isClosed = (isDefaultHoliday || isCustomHoliday) && !isSpecialOpen;

        col.innerHTML = `
            <div class="day-header" style="background:${isClosed ? '#999' : '#000'}">
                ${dateStr} (${['日','月','火','水','木','金','土'][w]})
                <div class="day-toggle-btn" onclick="toggleDay('${dateStr}', ${isClosed})">
                    ${isClosed ? '営業にする' : '休みにする'}
                </div>
            </div>
        `;

        // 10:00 - 19:00 の枠生成
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
    const res = reservations.find(r => r.date === date && r.time === time);
    const isOff = offTimes.some(o => o.date === date && o.time === time);
    
    const div = document.createElement('div');
    div.className = `slot ${res ? 'reserved' : (isOff || isClosed ? 'off' : 'free')}`;
    
    let content = `<div class="time-label">${time}</div><div class="slot-info">`;
    if (res) content += `<b>${res.name} 様</b><br>${res.menus}`;
    else if (isOff || isClosed) content += `不可`;
    else content += `空き`;
    content += `</div>`;
    
    div.innerHTML = content;
    div.onclick = () => openSlotModal(date, time, res, isOff);
    col.appendChild(div);
}

// 4. モーダル（履歴表示 & ポチポチ切替）
async function openSlotModal(date, time, res, isOff) {
    const body = document.getElementById('modal-body');
    let html = `<h3>${date} ${time}</h3>`;

    if (res) {
        // 【履歴取得】
        const { data: history } = await supabase.from('reservations')
            .select('*').eq('name', res.name).lt('created_at', res.created_at)
            .order('created_at', { ascending: false }).limit(1);
        
        const lastVisit = history && history[0] ? `${history[0].date} (${history[0].menus})` : "なし";

        html += `
            <p><b>お名前:</b> ${res.name} 様</p>
            <p><b>メニュー:</b> ${res.menus}</p>
            <div class="history-box">前回ご来店: ${lastVisit}</div>
            <div class="btn-group">
                <button class="btn-danger" onclick="deleteRes('${res.id}')">予約削除</button>
            </div>
        `;
    } else {
        html += `
            <div class="btn-group">
                <button class="btn-main" onclick="toggleOffTime('${date}', '${time}', ${isOff})">
                    ${isOff ? '予約可能に戻す' : 'ここを休憩にする'}
                </button>
                <button class="btn-sub" onclick="openAddManual('${date}', '${time}')">手動で予約を入れる</button>
            </div>
        `;
    }
    html += `<button class="btn-sub" onclick="closeModal()" style="margin-top:10px; width:100%;">閉じる</button>`;
    body.innerHTML = html;
    document.getElementById('slot-modal').style.display = 'flex';
}

// 5. 操作アクション
async function toggleOffTime(date, time, isOff) {
    if (isOff) {
        await supabase.from('off_times').delete().match({ date, time });
    } else {
        await supabase.from('off_times').insert([{ date, time }]);
    }
    closeModal();
    init();
}

async function toggleDay(date, isClosed) {
    if (isClosed) {
        // 営業にする -> holidaysにあれば消す、デフォルト休日ならspecial_openに入れる
        await supabase.from('holidays').delete().eq('date', date);
        await supabase.from('special_open').insert([{ date }]);
    } else {
        // 休みにする
        await supabase.from('holidays').insert([{ date }]);
        await supabase.from('special_open').delete().eq('date', date);
    }
    init();
}

function moveDate(n) { baseDate.setDate(baseDate.getDate() + n); render(); }
function closeModal() { document.getElementById('slot-modal').style.display = 'none'; }
function openCalendar() { document.getElementById('calendar-input').showPicker(); }
document.getElementById('calendar-input').onchange = (e) => { baseDate = new Date(e.target.value); render(); };

window.onload = init;
