// 変数の重複宣言を防ぐため、存在しない場合のみ作成する
if (typeof supabase === 'undefined') {
    const SUPABASE_URL = "https://bcahztzetpfuklipjmxx.supabase.co";
    const SUPABASE_KEY = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";
    // windowオブジェクトに持たせることで重複エラーを回避
    window.supabaseClientAdmin = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

const ADMIN_PASSWORD = "candoll2026"; // ログインパスワード

let baseDate = new Date();
let reservations = [];
let offTimes = [];
let holidays = [];
let specialOpens = [];

// 1. ログイン処理
document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.getElementById('login-btn');
    const passInput = document.getElementById('admin-pass');

    if (loginBtn) {
        loginBtn.onclick = () => {
            if (passInput.value === ADMIN_PASSWORD) {
                localStorage.setItem('admin_auth_status', 'true'); // キー名を変更して競合回避
                document.getElementById('login-screen').style.display = 'none';
                initAdmin();
            } else {
                alert("パスワードが違います");
            }
        };
    }

    // 自動ログインチェック
    if (localStorage.getItem('admin_auth_status') === 'true') {
        initAdmin();
    }
});

async function initAdmin() {
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) loginScreen.style.display = 'none';
    await fetchData();
    render();
}

// 2. データ取得
async function fetchData() {
    const client = window.supabaseClientAdmin;
    const [res, off, hol, spec] = await Promise.all([
        client.from('reservations').select('*'),
        client.from('off_times').select('*'),
        client.from('holidays').select('*'),
        client.from('special_open').select('*')
    ]);
    reservations = res.data || [];
    offTimes = off.data || [];
    holidays = hol.data || [];
    specialOpens = spec.data || [];
}

// 3. 描画ロジック
function render() {
    const wrap = document.getElementById('days-wrapper');
    if (!wrap) return;
    wrap.innerHTML = '';
    
    document.getElementById('nav-current').innerText = baseDate.toLocaleDateString('ja-JP', { 
        year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' 
    });

    for (let i = 0; i < 3; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        
        const col = document.createElement('div');
        col.className = 'day-column';
        
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

async function openSlotModal(date, time, res, isOff) {
    const body = document.getElementById('modal-body');
    let html = `<h3>${date} ${time}</h3>`;
    const client = window.supabaseClientAdmin;

    if (res) {
        const { data: history } = await client.from('reservations')
            .select('*').eq('name', res.name).lt('created_at', res.created_at)
            .order('created_at', { ascending: false }).limit(1);
        
        const lastVisit = history && history[0] ? `${history[0].date} (${history[0].menus})` : "なし";

        html += `
            <p><b>お名前:</b> ${res.name} 様</p>
            <p><b>メニュー:</b> ${res.menus}</p>
            <div class="history-box" style="background:#f5f5f7; padding:10px; border-radius:8px; margin:10px 0; color:#333;">前回: ${lastVisit}</div>
            <button onclick="deleteRes('${res.id}')" style="background:#ff3b30; color:white; border:none; padding:12px; width:100%; border-radius:8px; font-weight:bold;">この予約を削除</button>
        `;
    } else {
        html += `
            <button onclick="toggleOffTime('${date}', '${time}', ${isOff})" style="background:#007aff; color:white; border:none; padding:15px; width:100%; border-radius:8px; font-weight:bold;">
                ${isOff ? '予約可能に戻す' : 'ここを休憩にする'}
            </button>
        `;
    }
    html += `<button onclick="closeModal()" style="margin-top:15px; width:100%; padding:10px; border-radius:8px; border:1px solid #ccc; background:none;">閉じる</button>`;
    body.innerHTML = html;
    document.getElementById('slot-modal').style.display = 'flex';
}

async function toggleOffTime(date, time, isOff) {
    const client = window.supabaseClientAdmin;
    if (isOff) {
        await client.from('off_times').delete().match({ date, time });
    } else {
        await client.from('off_times').insert([{ date, time }]);
    }
    closeModal();
    initAdmin();
}

async function toggleDay(date, isClosed) {
    const client = window.supabaseClientAdmin;
    if (isClosed) {
        await client.from('holidays').delete().eq('date', date);
        await client.from('special_open').insert([{ date }]);
    } else {
        await client.from('holidays').insert([{ date }]);
        await client.from('special_open').delete().eq('date', date);
    }
    initAdmin();
}

async function deleteRes(id) {
    if (!confirm("本当に削除しますか？")) return;
    await window.supabaseClientAdmin.from('reservations').delete().eq('id', id);
    closeModal();
    initAdmin();
}

function moveDate(n) { baseDate.setDate(baseDate.getDate() + n); render(); }
function closeModal() { document.getElementById('slot-modal').style.display = 'none'; }
