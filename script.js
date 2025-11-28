okBtn.addEventListener('click', async function () {
    const name = document.getElementById('name').value;
    const menus = Array.from(menuContainer.querySelectorAll('.menu-select'))
        .map(s => s.value)
        .filter(v => v !== "");
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;

    // --- ① Supabase へ予約保存 ---
    const { data, error } = await supabase
        .from('reservations')
        .insert([{ name, menus: menus.join(', '), date, time }]);

    if (error) {
        console.error(error);
        alert("予約の保存に失敗しました。\n時間をおいて再度お試しください。");
        return;
    }

    // --- ② LINE通知（Edge Function 呼び出し）---
    try {
        await fetch("https://bcahztezptfuklipjmxx.supabase.co/functions/v1/send_line_notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, menus: menus.join(', '), date, time })
        });
    } catch (e) {
        console.error("LINE通知エラー:", e);
        // 通知失敗しても予約は成功しているので、ここではエラーにしない
    }

    // --- ③ 完了画面へ ---
    confirmScreen.style.display = "none";
    showCompleteScreen();
});
