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
    setTimeout(updateNowLine, 300); 
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
    
    div.ondragover = (e) => e.preventDefault();
    div.ondrop = (e) => handleDrop(e, date, time);
    div.dataset.date = date;
    div.dataset.time = time;

    if (overlappingRes) {
        div.style.background = "#e5e5ea";
        const resStart = toMin(overlappingRes.time);
        const dur = overlappingRes.manual_duration || MENU_DURATION[overlappingRes.menus.split(',')[0].trim()] || 60;
        const resEnd = resStart + dur;
        const isLastSlot = (timeMins + 30 >= resEnd);

        if (exactRes) {
            div.draggable = true;
            div.style.borderRadius = isLastSlot ? "15px" : "15px 15px 0 0";
            div.style.marginTop = "8px";
            if (!isLastSlot) div.style.borderBottom = "none";

            div.ondragstart = (e) => { e.dataTransfer.setData("text/plain", exactRes.id); div.style.opacity = "0.4"; };
            div.ondragend = () => div.style.opacity = "1";
            setupTouchEvents(div, exactRes, date, time); 
        } else {
            div.style.marginTop = "0";
            div.style.borderTop = "none";
            if (isLastSlot) {
                div.style.borderRadius = "0 0 15px 15px";
                div.style.marginBottom = "8px";
            } else {
                div.style.borderRadius = "0";
                div.style.borderBottom = "none";
            }
        }
    } else {
        div.style.background = (isOff || isClosed) ? "#f2f2f7" : "#ffffff";
        div.style.borderRadius = "12px";
        div.style.marginBottom = "6px";
    }

    let content = `<div class="time-label">${time}</div><div class="slot-info">`;
    if (overlappingRes && exactRes) {
        content += `<b style="color:#000;">${exactRes.name} 様</b><span class="menu-label">${exactRes.menus}</span>`;
    } else if (!overlappingRes) {
        content += `<span style="color:#666; font-size:13px;">${(isOff || isClosed) ? '不可' : '空き'}</span>`;
    }
    content += `</div>`;
    div.innerHTML = content;
    div.onclick = (e) => { if (div.style.opacity === "0.4") return; openSlotModal(date, time, exactRes || overlappingRes, isOff); };
    col.appendChild(div);
}

function setupTouchEvents(div, exactRes, date, time) {
    let touchTimer; 
    div.ontouchstart = (e) => {
        touchTimer = setTimeout(() => {
            div.style.opacity = "0.4";
            window.draggingId = exactRes.id;
            if (navigator.vibrate) navigator.vibrate(50);
        }, 500); 
    };
    div.ontouchend = (e) => {
        clearTimeout(touchTimer);
        if (window.draggingId) {
            div.style.opacity = "1";
            const touch = e.changedTouches[0];
            const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
            const dropTarget = targetEl ? targetEl.closest('.slot') : null;
            if (dropTarget && window.draggingId) {
                const d = dropTarget.dataset.date;
                const t = dropTarget.dataset.time;
                if (!(d === date && t === time) && d && t) handleTouchDrop(window.draggingId, d, t);
            }
            window.draggingId = null;
        }
    };
    div.ontouchmove = () => clearTimeout(touchTimer);
}

async function handleDrop(e, newDate, newTime) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    handleTouchDrop(id, newDate, newTime);
}

async function handleTouchDrop(id, newDate, newTime) {
    if (!confirm(`${newDate} ${newTime} に移動しますか？`)) return;
    const { error } = await adminClient.from('reservations').update({ date: newDate, time: newTime }).eq('id', Number(id));
    if (error) alert("移動失敗: " + error.message);
    else { await fetchData(); render(); }
}

async function openSlotModal(date, time, res, isOff) {
    const body = document.getElementById('modal-body');
    const dayOfWeek = ['日','月','火','水','木','金','土'][new Date(date).getDay()];
    let html = `<h3 style="margin:0 0 20px 0; text-align:center; color:#333; font-size:18px;">${date}(${dayOfWeek}) ${time}</h3>`;

    if (res) {
        const currentDur = res.manual_duration || MENU_DURATION[res.menus.split(',')[0].trim()] || 60;
        html += `
            <div style="font-size:18px; margin-bottom:20px; text-align:center; color:#000;"><b>${res.name} 様</b></div>
            <div style="background:#f2f2f7; padding:20px; border-radius:15px; margin-bottom:15px;">
                <label style="font-size:14px; font-weight:bold; color:#666; display:block; margin-bottom:8px;">所要時間の変更</label>
                <select id="new-duration" style="width:100%; height:45px; font-size:16px; border:1px solid #ddd; border-radius:8px; padding:0 10px; margin-bottom:15px; background:#fff;">
                    ${[30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 210, 240].map(m => 
                        `<option value="${m}" ${currentDur == m ? 'selected' : ''}>${Math.floor(m/60)>0 ? Math.floor(m/60)+'時間':''}${m%60>0 ? m%60+'分':''}(${m}分)</option>`
                    ).join('')}
                </select>
                <label style="font-size:14px; font-weight:bold; color:#666; display:block; margin-bottom:8px;">予約日時の変更</label>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <input type="date" id="new-date" value="${res.date}" style="width:100%; height:45px; font-size:16px; border:1px solid #ddd; border-radius:8px; padding:0 10px; box-sizing:border-box;">
                    <input type="time" id="new-time" value="${res.time}" style="width:100%; height:45px; font-size:16px; border:1px solid #ddd; border-radius:8px; padding:0 10px; box-sizing:border-box;">
                </div>
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
            <div style="padding: 0 20px;">
                <button onclick="toggleOffTime('${date}', '${time}', ${isOff})" style="background:${isOff ? '#ff9500' : '#8e8e93'}; color:white; border:none; height:45px; width:100%; border-radius:10px; font-weight:bold; font-size:15px; cursor:pointer;">
                    ${isOff ? 'この枠を予約可能に戻す' : 'この枠を予約不可にする'}
                </button>
            </div>`;
    }
    html += `<button onclick="closeModal()" style="margin-top:15px; width:100%; padding:10px; border:none; background:none; color:#007aff; font-size:16px; cursor:pointer;">閉じる</button>`;
    body.innerHTML = html;
    document.getElementById('slot-modal').style.display = 'flex';
}

window.saveChanges = async function(id) {
    const newDate = document.getElementById('new-date').value;
    const newTime = document.getElementById('new-time').value;
    const newDuration = document.getElementById('new-duration').value;
    const { error } = await adminClient.from('reservations').update({ 
        date: newDate, 
        time: newTime,
        manual_duration: Number(newDuration)
    }).eq('id', Number(id));
    if (error) alert("保存エラー: " + error.message);
    else { closeModal(); await fetchData(); render(); }
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

function updateNowLine() {
    document.querySelectorAll('.now-line').forEach(el => el.remove());
    const now = new Date();
    const dateStr = now.toLocaleDateString('sv-SE'); 
    const col = document.getElementById(`col-${dateStr}`);
    if (!col) return;
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const startMins = 10 * 60;
    const endMins = 19 * 60;
    if (currentMins < startMins || currentMins > endMins) return;
    const slots = col.querySelectorAll('.slot');
    if (slots.length === 0) return;
    const slotHeight = slots[0].offsetHeight;
    const offset = ((currentMins - startMins) / 30) * slotHeight + slots[0].offsetTop;
    const line = document.createElement('div');
    line.className = 'now-line';
    line.style.top = `${offset}px`;
    col.appendChild(line);
}
