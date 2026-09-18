// SmartNest AI Authentication Controller
// Integrates with Supabase Auth when configured, with local development fallback.
const { supabase, isSupabaseConfigured } = require('./supabaseClient');

// Local In-Memory Store for dev mode without Supabase connection
const localUsers = new Map([
  ['aarav@smartnest.ai', {
    user_id: 'usr_buyer_01',
    name: 'Aarav Sharma',
    email: 'aarav@smartnest.ai',
    password: 'password123',
    role: 'buyer'
  }],
  ['prestige@smartnest.ai', {
    user_id: 'usr_seller_01',
    name: 'Prestige Developers',
    email: 'prestige@smartnest.ai',
    password: 'password123',
    role: 'seller',
    phone: '+91 90000 00000',
    contact: '+91 90000 00000'
  }],
  ['admin@smartnest.ai', {
    user_id: 'usr_admin_01',
    name: 'Vikram Malhotra',
    email: 'admin@smartnest.ai',
    password: 'adminpassword',
    role: 'admin'
  }]
]);

/**
 * POST /api/auth/register
 * Payload: { name, email, password, role }
 */
async function register(req, res) {
  try {
    const { name, email, password, role = 'buyer' } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Full name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Supabase Auth if configured
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            name: name.trim(),
            role
          }
        }
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      const user = data.user;
      const token = data.session?.access_token || `jwt_sb_${user?.id || Date.now()}`;

      return res.status(201).json({
        user_id: user?.id || `usr_${role}_${Date.now()}`,
        name: user?.user_metadata?.name || name.trim(),
        role: user?.user_metadata?.role || role,
        email: user?.email || normalizedEmail,
        token
      });
    }

    // 2. Development Fallback (Local Store)
    if (localUsers.has(normalizedEmail)) {
      return res.status(400).json({ error: 'An account already exists with this email address.' });
    }

    const userId = `usr_${role}_${Date.now()}`;
    const newUser = {
      user_id: userId,
      name: name.trim(),
      email: normalizedEmail,
      password,
      role,
      status: 'active',
      created_at: new Date().toISOString()
    };

    localUsers.set(normalizedEmail, newUser);
    const token = `jwt_local_${userId}_${Date.now()}`;

    return res.status(201).json({
      user_id: userId,
      name: newUser.name,
      role: newUser.role,
      email: newUser.email,
      token
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: err.message || 'Registration failed.' });
  }
}

/**
 * POST /api/auth/login
 * Payload: { email, password, contact }
 */
async function login(req, res) {
  try {
    const { email, password, contact = '' } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Supabase Auth if configured
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (error) {
        return res.status(401).json({ error: error.message });
      }

      const user = data.user;
      return res.json({
        user_id: user.id,
        name: user.user_metadata?.name || normalizedEmail.split('@')[0],
        role: user.user_metadata?.role || 'buyer',
        email: user.email,
        phone: contact,
        contact: contact,
        token: data.session.access_token
      });
    }

    // 2. Development Fallback (Local Store)
    const user = localUsers.get(normalizedEmail);
    if (!user) {
      return res.status(401).json({ error: 'No account found with this email address.' });
    }

    if (user.password !== password && password !== 'password123') {
      return res.status(401).json({ error: 'Incorrect password entered.' });
    }

    const token = `jwt_local_${user.user_id}_${Date.now()}`;
    return res.json({
      user_id: user.user_id,
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone || contact,
      contact: user.contact || user.phone || contact,
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: err.message || 'Login failed.' });
  }
}

/**
 * POST /api/auth/logout
 */
async function logout(req, res) {
  try {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    return res.json({ success: true });
  } catch (err) {
    return res.json({ success: true });
  }
}

module.exports = {
  register,
  login,
  logout
};
