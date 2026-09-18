// Notification Controller for SmartNest AI Backend
const { supabase, isSupabaseConfigured } = require('./supabaseClient');

// In-memory notifications store for local development
const notificationsDb = new Map();

function getUserNotifications(userId) {
  if (!notificationsDb.has(userId)) {
    notificationsDb.set(userId, [
      {
        id: `notif_welcome_${userId}`,
        user_id: userId,
        type: 'system',
        title: 'Welcome to SmartNest AI',
        message: 'Your account is connected to the backend API. Explore properties matching your lifestyle.',
        read: false,
        created_at: new Date().toISOString()
      }
    ]);
  }
  return notificationsDb.get(userId);
}

async function getNotifications(req, res) {
  try {
    const { userId } = req.params;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('lifestyle_events')
        .select('*')
        .eq('buyer_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return res.json(data);
      }
    }

    const notifs = getUserNotifications(userId);
    return res.json(notifs);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
}

async function markRead(req, res) {
  try {
    const { id } = req.params;
    for (const [userId, notifs] of notificationsDb.entries()) {
      const updated = notifs.map((n) => (n.id === id ? { ...n, read: true } : n));
      notificationsDb.set(userId, updated);
    }
    return res.json({ success: true });
  } catch (err) {
    return res.json({ success: true });
  }
}

async function markAllRead(req, res) {
  try {
    const { user_id } = req.body || {};
    if (user_id && notificationsDb.has(user_id)) {
      const updated = notificationsDb.get(user_id).map((n) => ({ ...n, read: true }));
      notificationsDb.set(user_id, updated);
    }
    return res.json({ success: true });
  } catch (err) {
    return res.json({ success: true });
  }
}

module.exports = {
  getNotifications,
  markRead,
  markAllRead
};
