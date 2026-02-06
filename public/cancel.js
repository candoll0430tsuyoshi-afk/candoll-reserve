const supabase = supabaseJs.createClient(
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY'
);

const params = new URLSearchParams(window.location.search);
const token = params.get('token');

document.getElementById('cancelBtn').addEventListener('click', async () => {
  if (!token) {
    alert('無効なURLです');
    return;
  }

  const { error } = await supabase
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('cancel_token', token)
    .eq('status', 'confirmed');

  if (error) {
    alert('キャンセルできませんでした');
  } else {
    alert('キャンセルしました');
  }
});

