// Enquiry & Two-Way Messaging Controller for SmartNest AI
// Connects Buyer & Seller via Express REST API and Supabase PostgreSQL with persistent storage
const fs = require('fs');
const path = require('path');
const { supabase, isSupabaseConfigured } = require('./supabaseClient');
const { dispatchLeadWebhook } = require('./leadController');

const DATA_DIR = path.join(__dirname, 'data');
const ENQUIRIES_FILE = path.join(DATA_DIR, 'enquiries.json');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('[EnquiryController] Error creating data directory:', err.message);
  }
}

// Property metadata map loaded from smartnest_properties.csv
const propertiesMap = new Map();

function loadPropertiesLookup() {
  try {
    const csvPath = path.join(__dirname, '..', 'smartnest_properties.csv');
    if (fs.existsSync(csvPath)) {
      const content = fs.readFileSync(csvPath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
        const vals = [];
        let match;
        while ((match = regex.exec(line)) !== null && match.index < line.length) {
          let val = match[1] || '';
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/""/g, '"');
          vals.push(val.trim());
        }
        const propId = vals[1] || vals[0] || `P${i < 10 ? '0' + i : i}`;
        const legacyId = vals[0] || propId;
        const title = vals[2] || `SmartNest Residence ${i}`;
        const price = Number(vals[4]) || 5500000;
        const location = vals[9] || vals[10] || 'Coimbatore';
        const sellerId = vals[24] || (i % 3 === 0 ? 'usr_seller_03' : i % 2 === 0 ? 'usr_seller_02' : 'usr_seller_01');
        const sellerName = vals[25] || 'Prestige Developers';
        const sellerEmail = vals[28] || 'sales@prestigedevelopers.in';
        const sellerPhone = vals[27] || '+91 98765 43210';
        const images = vals[33] ? vals[33].split(';').map((s) => s.trim()) : [];

        const propData = {
          property_id: propId,
          legacy_id: legacyId,
          title,
          price,
          location,
          seller_id: sellerId,
          seller_name: sellerName,
          seller_email: sellerEmail,
          seller_phone: sellerPhone,
          image: images[0] || ''
        };

        propertiesMap.set(propId, propData);
        propertiesMap.set(legacyId, propData);
      }
    }
  } catch (err) {
    console.warn('[EnquiryController] Property lookup notice:', err.message);
  }
}

loadPropertiesLookup();

// Persistent Store Helpers
function readJson(filePath, defaultValue = []) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`[EnquiryController] Error reading ${filePath}:`, err.message);
  }
  return defaultValue;
}

function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[EnquiryController] Error writing ${filePath}:`, err.message);
  }
}

// In-Memory sync stores initialized from files or baseline
let enquiriesStore = readJson(ENQUIRIES_FILE, [
  {
    enquiry_id: 'enq_01',
    property_id: 'prestige_prop_001',
    property_title: 'Emerald Palms Executive Suite',
    property_price: 5500000,
    property_location: 'Avinashi Road, Peelamedu',
    buyer_id: 'usr_buyer_01',
    buyer_name: 'Aarav Sharma',
    buyer_email: 'aarav@smartnest.ai',
    buyer_phone: '+91 98401 23456',
    seller_id: 'usr_seller_01',
    seller_name: 'Prestige Developers',
    message: "Hello, I took the SmartNest lifestyle quiz and this property came out as a 96% match. I'd love to schedule an on-site visit this Saturday afternoon to inspect the pre-school facility.",
    date: '2026-09-02T14:15:00Z',
    created_at: '2026-09-02T14:15:00Z',
    status: 'new',
    response: null
  },
  {
    enquiry_id: 'enq_02',
    property_id: 'prestige_prop_002',
    property_title: 'The Urban Zenith Residences',
    property_price: 5800000,
    property_location: 'Saravanampatti Tech Zone',
    buyer_id: 'usr_buyer_02',
    buyer_name: 'Kavitha Ramaswamy',
    buyer_email: 'kavitha@example.com',
    buyer_phone: '+91 98402 34567',
    seller_id: 'usr_seller_01',
    seller_name: 'Prestige Developers',
    message: 'Does this apartment have dedicated covered EV parking slots near the tower lobby? Also curious about the internet provider options in the co-working lounge.',
    date: '2026-08-30T10:00:00Z',
    created_at: '2026-08-30T10:00:00Z',
    status: 'responded',
    response: 'Hi Kavitha! Yes, both Level 1 basements have EV-ready chargers. We have dual redundant fiber lines from ACT and Airtel in the co-working center.'
  }
]);

let conversationsStore = readJson(CONVERSATIONS_FILE, [
  {
    conversation_id: 'conv_01',
    enquiry_id: 'enq_01',
    buyer_id: 'usr_buyer_01',
    buyer_name: 'Aarav Sharma',
    buyer_email: 'aarav@smartnest.ai',
    seller_id: 'usr_seller_01',
    seller_name: 'Prestige Developers',
    seller_email: 'sales@prestigedevelopers.in',
    property_id: 'prestige_prop_001',
    property_title: 'Emerald Palms Executive Suite',
    property_image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80',
    property_price: 5500000,
    property_location: 'Avinashi Road, Peelamedu',
    status: 'active',
    unread_for_buyer: false,
    unread_for_seller: true,
    last_message: "Hello, I took the SmartNest lifestyle quiz and this property came out as a 96% match. I'd love to schedule an on-site visit this Saturday afternoon to inspect the pre-school facility.",
    last_message_at: '2026-09-02T14:15:00Z',
    created_at: '2026-09-02T14:15:00Z',
    messages: [
      {
        message_id: 'msg_01_01',
        conversation_id: 'conv_01',
        sender_id: 'usr_buyer_01',
        sender_role: 'buyer',
        sender_name: 'Aarav Sharma',
        receiver_id: 'usr_seller_01',
        text: "Hello, I took the SmartNest lifestyle quiz and this property came out as a 96% match. I'd love to schedule an on-site visit this Saturday afternoon to inspect the pre-school facility.",
        created_at: '2026-09-02T14:15:00Z',
        read_at: null,
        status: 'delivered'
      }
    ]
  },
  {
    conversation_id: 'conv_02',
    enquiry_id: 'enq_02',
    buyer_id: 'usr_buyer_02',
    buyer_name: 'Kavitha Ramaswamy',
    buyer_email: 'kavitha@example.com',
    seller_id: 'usr_seller_01',
    seller_name: 'Prestige Developers',
    seller_email: 'sales@prestigedevelopers.in',
    property_id: 'prestige_prop_002',
    property_title: 'The Urban Zenith Residences',
    property_image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80',
    property_price: 5800000,
    property_location: 'Saravanampatti Tech Zone',
    status: 'responded',
    unread_for_buyer: false,
    unread_for_seller: false,
    last_message: 'Hi Kavitha! Yes, both Level 1 basements have EV-ready chargers. We have dual redundant fiber lines from ACT and Airtel in the co-working center.',
    last_message_at: '2026-08-30T10:30:00Z',
    created_at: '2026-08-30T10:00:00Z',
    messages: [
      {
        message_id: 'msg_02_01',
        conversation_id: 'conv_02',
        sender_id: 'usr_buyer_02',
        sender_role: 'buyer',
        sender_name: 'Kavitha Ramaswamy',
        receiver_id: 'usr_seller_01',
        text: 'Does this apartment have dedicated covered EV parking slots near the tower lobby? Also curious about the internet provider options in the co-working lounge.',
        created_at: '2026-08-30T10:00:00Z',
        read_at: '2026-08-30T10:15:00Z',
        status: 'read'
      },
      {
        message_id: 'msg_02_02',
        conversation_id: 'conv_02',
        sender_id: 'usr_seller_01',
        sender_role: 'seller',
        sender_name: 'Prestige Developers',
        receiver_id: 'usr_buyer_02',
        text: 'Hi Kavitha! Yes, both Level 1 basements have EV-ready chargers. We have dual redundant fiber lines from ACT and Airtel in the co-working center.',
        created_at: '2026-08-30T10:30:00Z',
        read_at: '2026-08-30T11:00:00Z',
        status: 'read'
      }
    ]
  }
]);

// Persist initial state
writeJson(ENQUIRIES_FILE, enquiriesStore);
writeJson(CONVERSATIONS_FILE, conversationsStore);

// Helper to normalize seller ID matching (supports 'usr_seller_01' and legacy 'S001')
function isSellerMatch(sellerIdA, sellerIdB) {
  if (!sellerIdA || !sellerIdB) return false;
  if (sellerIdA === sellerIdB) return true;
  if ((sellerIdA === 'usr_seller_01' && sellerIdB === 'S001') || (sellerIdA === 'S001' && sellerIdB === 'usr_seller_01')) return true;
  if ((sellerIdA === 'usr_seller_02' && sellerIdB === 'S002') || (sellerIdA === 'S002' && sellerIdB === 'usr_seller_02')) return true;
  if ((sellerIdA === 'usr_seller_03' && sellerIdB === 'S003') || (sellerIdA === 'S003' && sellerIdB === 'usr_seller_03')) return true;
  return false;
}

/**
 * GET /api/seller/:sellerId/enquiries and GET /api/enquiries
 * Returns all enquiries for properties owned by the seller
 */
async function getSellerEnquiries(req, res) {
  try {
    const sellerId = req.params.sellerId || req.query.seller_id || req.query.sellerId;

    // Try Supabase first if configured
    if (isSupabaseConfigured && supabase && sellerId && sellerId !== 'undefined') {
      try {
        const { data, error } = await supabase
          .from('enquiries')
          .select('*')
          .eq('seller_id', sellerId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return res.json(data);
        }
      } catch (dbErr) {
        console.warn('[EnquiryController] Supabase enquiries query note:', dbErr.message);
      }
    }

    // Filter local persistent store
    if (!sellerId || sellerId === 'undefined') {
      return res.json(enquiriesStore);
    }

    const filtered = enquiriesStore.filter((e) => isSellerMatch(e.seller_id, sellerId));
    return res.json(filtered);
  } catch (err) {
    console.error('Error in getSellerEnquiries:', err);
    return res.status(500).json({ error: 'Failed to fetch enquiries' });
  }
}

/**
 * POST /api/property/:id/enquiry and POST /api/leads/enquiry
 * Buyer sends enquiry on a property
 */
async function createEnquiry(req, res) {
  try {
    const propertyId = req.params.id || req.body.property_id || req.body.propertyId || 'P01';
    const {
      message,
      session_id,
      buyer_id,
      buyer_name,
      buyer_email,
      buyer_phone,
      seller_id,
      seller_name,
      property_title,
      property_price,
      property_location
    } = req.body || {};

    const propLookup = propertiesMap.get(propertyId) || {};
    const effectiveSellerId = seller_id || propLookup.seller_id || 'usr_seller_01';
    const effectiveSellerName = seller_name || propLookup.seller_name || 'Prestige Developers';
    const effectivePropertyTitle = property_title || propLookup.title || 'SmartNest Residence';
    const effectivePrice = property_price || propLookup.price || 5500000;
    const effectiveLocation = property_location || propLookup.location || 'Coimbatore';
    const effectiveBuyerId = buyer_id || session_id || 'usr_buyer_01';
    const effectiveBuyerName = buyer_name || 'Interested Buyer';
    const effectiveBuyerEmail = buyer_email || 'buyer@smartnest.ai';
    const now = new Date().toISOString();

    const enquiryId = `enq_${Date.now()}`;
    const newEnquiry = {
      enquiry_id: enquiryId,
      property_id: propertyId,
      property_title: effectivePropertyTitle,
      property_price: effectivePrice,
      property_location: effectiveLocation,
      buyer_id: effectiveBuyerId,
      buyer_name: effectiveBuyerName,
      buyer_email: effectiveBuyerEmail,
      buyer_phone: buyer_phone || '+91 98401 23456',
      seller_id: effectiveSellerId,
      seller_name: effectiveSellerName,
      message: message || 'Hello, I am interested in viewing this property.',
      date: now,
      created_at: now,
      status: 'new',
      response: null
    };

    // Save in Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('enquiries').insert([newEnquiry]);
      } catch (dbErr) {
        console.warn('[EnquiryController] Supabase insert enquiry note:', dbErr.message);
      }
    }

    // Update and persist local store
    enquiriesStore.unshift(newEnquiry);
    writeJson(ENQUIRIES_FILE, enquiriesStore);

    // Create or link conversation for two-way messaging
    const convId = `conv_${enquiryId}`;
    let conv = conversationsStore.find(
      (c) => c.buyer_id === effectiveBuyerId && c.property_id === propertyId
    );

    const initialMessage = {
      message_id: `msg_${Date.now()}_01`,
      conversation_id: conv ? conv.conversation_id : convId,
      sender_id: effectiveBuyerId,
      sender_role: 'buyer',
      sender_name: effectiveBuyerName,
      receiver_id: effectiveSellerId,
      text: newEnquiry.message,
      created_at: now,
      read_at: null,
      status: 'delivered'
    };

    if (conv) {
      conv.last_message = newEnquiry.message;
      conv.last_message_at = now;
      conv.unread_for_seller = true;
      conv.messages.push(initialMessage);
    } else {
      conv = {
        conversation_id: convId,
        enquiry_id: enquiryId,
        buyer_id: effectiveBuyerId,
        buyer_name: effectiveBuyerName,
        buyer_email: effectiveBuyerEmail,
        seller_id: effectiveSellerId,
        seller_name: effectiveSellerName,
        seller_email: propLookup.seller_email || 'sales@developer.com',
        property_id: propertyId,
        property_title: effectivePropertyTitle,
        property_image: propLookup.image || '',
        property_price: effectivePrice,
        property_location: effectiveLocation,
        status: 'active',
        unread_for_buyer: false,
        unread_for_seller: true,
        last_message: newEnquiry.message,
        last_message_at: now,
        created_at: now,
        messages: [initialMessage]
      };
      conversationsStore.unshift(conv);
    }

    writeJson(CONVERSATIONS_FILE, conversationsStore);

    // Dispatch auxiliary SNS agent webhook asynchronously
    dispatchLeadWebhook({
      enquiry_id: enquiryId,
      message: newEnquiry.message,
      conversation_id: conv.conversation_id,
      buyer_id: effectiveBuyerId,
      buyer_name: effectiveBuyerName,
      buyer_email: effectiveBuyerEmail,
      buyer_phone: newEnquiry.buyer_phone,
      seller_id: effectiveSellerId,
      seller_name: effectiveSellerName,
      property_id: propertyId,
      property_title: effectivePropertyTitle,
      property_price: effectivePrice,
      property_location: effectiveLocation
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Enquiry submitted successfully',
      enquiry_id: enquiryId,
      conversation_id: conv.conversation_id,
      seller_name: effectiveSellerName
    });
  } catch (err) {
    console.error('Error creating enquiry:', err);
    return res.status(500).json({ error: 'Failed to create enquiry', details: err.message });
  }
}

/**
 * POST /api/seller/enquiry/:enquiryId/respond
 * Seller replies to a buyer enquiry
 */
async function respondToEnquiry(req, res) {
  try {
    const { enquiryId } = req.params;
    const { message } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Response message cannot be empty' });
    }

    const now = new Date().toISOString();

    // Find and update enquiry
    let targetEnq = enquiriesStore.find((e) => e.enquiry_id === enquiryId);
    if (targetEnq) {
      targetEnq.status = 'responded';
      targetEnq.response = message.trim();
      targetEnq.updated_at = now;
      writeJson(ENQUIRIES_FILE, enquiriesStore);
    }

    // Find or link conversation
    let conv = conversationsStore.find(
      (c) => c.enquiry_id === enquiryId || (targetEnq && c.buyer_id === targetEnq.buyer_id && c.property_id === targetEnq.property_id)
    );

    const replyMsg = {
      message_id: `msg_${Date.now()}_resp`,
      conversation_id: conv ? conv.conversation_id : `conv_${enquiryId}`,
      sender_id: targetEnq?.seller_id || 'usr_seller_01',
      sender_role: 'seller',
      sender_name: targetEnq?.seller_name || 'Prestige Developers',
      receiver_id: targetEnq?.buyer_id || 'usr_buyer_01',
      text: message.trim(),
      created_at: now,
      read_at: null,
      status: 'delivered'
    };

    if (conv) {
      conv.status = 'responded';
      conv.last_message = message.trim();
      conv.last_message_at = now;
      conv.unread_for_buyer = true;
      conv.unread_for_seller = false;
      conv.messages.push(replyMsg);
    } else if (targetEnq) {
      conv = {
        conversation_id: `conv_${enquiryId}`,
        enquiry_id: enquiryId,
        buyer_id: targetEnq.buyer_id,
        buyer_name: targetEnq.buyer_name,
        buyer_email: targetEnq.buyer_email,
        seller_id: targetEnq.seller_id,
        seller_name: targetEnq.seller_name,
        property_id: targetEnq.property_id,
        property_title: targetEnq.property_title,
        property_price: targetEnq.property_price,
        status: 'responded',
        unread_for_buyer: true,
        unread_for_seller: false,
        last_message: message.trim(),
        last_message_at: now,
        created_at: targetEnq.created_at || now,
        messages: [
          {
            message_id: `msg_${enquiryId}_01`,
            conversation_id: `conv_${enquiryId}`,
            sender_id: targetEnq.buyer_id,
            sender_role: 'buyer',
            sender_name: targetEnq.buyer_name,
            receiver_id: targetEnq.seller_id,
            text: targetEnq.message,
            created_at: targetEnq.created_at || now,
            read_at: now,
            status: 'read'
          },
          replyMsg
        ]
      };
      conversationsStore.unshift(conv);
    }

    writeJson(CONVERSATIONS_FILE, conversationsStore);

    // Update Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('enquiries')
          .update({ status: 'responded', response: message.trim(), updated_at: now })
          .eq('enquiry_id', enquiryId);
      } catch (dbErr) {
        console.warn('[EnquiryController] Supabase update enquiry notice:', dbErr.message);
      }
    }

    return res.json({
      success: true,
      enquiry_id: enquiryId,
      status: 'responded',
      response: message.trim(),
      message: replyMsg
    });
  } catch (err) {
    console.error('Error responding to enquiry:', err);
    return res.status(500).json({ error: 'Failed to send response' });
  }
}

/**
 * GET /api/conversations
 * Returns user conversations filtered by user_id and role
 */
async function getConversations(req, res) {
  try {
    const { user_id, role } = req.query;

    if (!user_id || user_id === 'undefined') {
      return res.json([]);
    }

    // Try Supabase first if configured
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from('conversations').select('*');
        if (role === 'seller') {
          query = query.eq('seller_id', user_id);
        } else if (role === 'buyer') {
          query = query.eq('buyer_id', user_id);
        }
        const { data, error } = await query.order('last_message_at', { ascending: false });
        if (!error && data && data.length > 0) {
          return res.json(data);
        }
      } catch (dbErr) {
        console.warn('[EnquiryController] Supabase conversations query note:', dbErr.message);
      }
    }

    let filtered = conversationsStore;
    if (role === 'seller') {
      filtered = filtered.filter((c) => isSellerMatch(c.seller_id, user_id));
    } else if (role === 'buyer') {
      filtered = filtered.filter((c) => c.buyer_id === user_id);
    } else {
      filtered = filtered.filter((c) => c.buyer_id === user_id || isSellerMatch(c.seller_id, user_id));
    }

    const sorted = [...filtered].sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
    return res.json(sorted);
  } catch (err) {
    console.error('Error fetching conversations:', err);
    return res.status(500).json({ error: 'Failed to fetch conversations' });
  }
}

/**
 * GET /api/conversations/:id
 * Fetches single conversation detail by ID
 */
async function getConversationById(req, res) {
  try {
    const { id } = req.params;
    const conv = conversationsStore.find(
      (c) => c.conversation_id === id || c.enquiry_id === id.replace('conv_', '')
    );
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    return res.json(conv);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch conversation' });
  }
}

/**
 * POST /api/conversations
 * Finds or creates a conversation
 */
async function createOrGetConversation(req, res) {
  try {
    const {
      buyer_id,
      buyer_name,
      buyer_email,
      seller_id,
      seller_name,
      property_id,
      property_title,
      property_image,
      property_price,
      property_location,
      initial_message
    } = req.body || {};

    const now = new Date().toISOString();

    let conv = conversationsStore.find(
      (c) => c.buyer_id === buyer_id && c.property_id === property_id
    );

    if (conv) {
      if (initial_message && initial_message.trim()) {
        const msg = {
          message_id: `msg_${Date.now()}_init`,
          conversation_id: conv.conversation_id,
          sender_id: buyer_id,
          sender_role: 'buyer',
          sender_name: buyer_name || conv.buyer_name,
          receiver_id: seller_id || conv.seller_id,
          text: initial_message.trim(),
          created_at: now,
          read_at: null,
          status: 'delivered'
        };
        conv.messages.push(msg);
        conv.last_message = initial_message.trim();
        conv.last_message_at = now;
        conv.unread_for_seller = true;
        writeJson(CONVERSATIONS_FILE, conversationsStore);
      }
      return res.json(conv);
    }

    const convId = `conv_${Date.now()}`;
    const initialMsgObj = initial_message && initial_message.trim() ? {
      message_id: `msg_${Date.now()}_01`,
      conversation_id: convId,
      sender_id: buyer_id || 'usr_buyer_01',
      sender_role: 'buyer',
      sender_name: buyer_name || 'Buyer',
      receiver_id: seller_id || 'usr_seller_01',
      text: initial_message.trim(),
      created_at: now,
      read_at: null,
      status: 'delivered'
    } : null;

    conv = {
      conversation_id: convId,
      enquiry_id: `enq_${Date.now()}`,
      buyer_id: buyer_id || 'usr_buyer_01',
      buyer_name: buyer_name || 'Aarav Sharma',
      buyer_email: buyer_email || 'aarav@smartnest.ai',
      seller_id: seller_id || 'usr_seller_01',
      seller_name: seller_name || 'Prestige Developers',
      seller_email: 'sales@prestigedevelopers.in',
      property_id: property_id || 'P01',
      property_title: property_title || 'SmartNest Property',
      property_image: property_image || '',
      property_price: property_price || 0,
      property_location: property_location || 'Coimbatore',
      status: 'active',
      unread_for_buyer: false,
      unread_for_seller: Boolean(initialMsgObj),
      last_message: initial_message || 'Conversation started',
      last_message_at: now,
      created_at: now,
      messages: initialMsgObj ? [initialMsgObj] : []
    };

    conversationsStore.unshift(conv);
    writeJson(CONVERSATIONS_FILE, conversationsStore);

    return res.status(201).json(conv);
  } catch (err) {
    console.error('Error creating conversation:', err);
    return res.status(500).json({ error: 'Failed to create conversation' });
  }
}

/**
 * POST /api/conversations/:id/messages
 * Sends a new message in an active conversation thread
 */
async function sendMessage(req, res) {
  try {
    const { id } = req.params;
    const { sender_id, sender_role = 'buyer', sender_name, text } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text cannot be empty' });
    }

    let conv = conversationsStore.find(
      (c) => c.conversation_id === id || c.enquiry_id === id.replace('conv_', '')
    );

    const now = new Date().toISOString();
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    if (!conv) {
      // Find enquiry to rebuild thread
      const enq = enquiriesStore.find((e) => e.enquiry_id === id.replace('conv_', '') || e.enquiry_id === id);
      conv = {
        conversation_id: id,
        enquiry_id: enq?.enquiry_id || null,
        buyer_id: enq?.buyer_id || (sender_role === 'buyer' ? sender_id : 'usr_buyer_01'),
        buyer_name: enq?.buyer_name || 'Aarav Sharma',
        buyer_email: enq?.buyer_email || 'aarav@smartnest.ai',
        seller_id: enq?.seller_id || (sender_role === 'seller' ? sender_id : 'usr_seller_01'),
        seller_name: enq?.seller_name || 'Prestige Developers',
        property_id: enq?.property_id || 'P01',
        property_title: enq?.property_title || 'SmartNest Property',
        property_image: '',
        property_price: enq?.property_price || 0,
        status: 'active',
        unread_for_buyer: sender_role === 'seller',
        unread_for_seller: sender_role === 'buyer',
        last_message: text.trim(),
        last_message_at: now,
        created_at: now,
        messages: []
      };
      conversationsStore.unshift(conv);
    }

    const receiverId = sender_role === 'buyer' ? conv.seller_id : conv.buyer_id;

    const newMsg = {
      message_id: msgId,
      conversation_id: conv.conversation_id,
      sender_id: sender_id || (sender_role === 'buyer' ? conv.buyer_id : conv.seller_id),
      sender_role,
      sender_name: sender_name || (sender_role === 'buyer' ? conv.buyer_name : conv.seller_name),
      receiver_id: receiverId,
      text: text.trim(),
      created_at: now,
      read_at: null,
      status: 'delivered'
    };

    conv.messages.push(newMsg);
    conv.last_message = text.trim();
    conv.last_message_at = now;

    if (sender_role === 'buyer') {
      conv.unread_for_seller = true;
      conv.unread_for_buyer = false;
    } else {
      conv.unread_for_buyer = true;
      conv.unread_for_seller = false;
    }

    writeJson(CONVERSATIONS_FILE, conversationsStore);

    return res.status(201).json({
      success: true,
      message: newMsg
    });
  } catch (err) {
    console.error('Error sending message:', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
}

/**
 * PUT /api/conversations/:id/read
 * Marks messages in conversation as read for the user
 */
async function markConversationAsRead(req, res) {
  try {
    const { id } = req.params;
    const { user_id, role = 'buyer' } = req.body || {};

    const conv = conversationsStore.find(
      (c) => c.conversation_id === id || c.enquiry_id === id.replace('conv_', '')
    );

    if (conv) {
      conv.messages.forEach((m) => {
        if (
          m.receiver_id === user_id ||
          (role === 'buyer' && m.sender_role === 'seller') ||
          (role === 'seller' && m.sender_role === 'buyer')
        ) {
          m.read_at = m.read_at || new Date().toISOString();
          m.status = 'read';
        }
      });

      if (role === 'buyer') {
        conv.unread_for_buyer = false;
      } else {
        conv.unread_for_seller = false;
      }

      writeJson(CONVERSATIONS_FILE, conversationsStore);
    }

    return res.json({ success: true });
  } catch (err) {
    return res.json({ success: true });
  }
}

/**
 * GET /api/conversations/unread-count
 * Returns number of unread conversations for user
 */
async function getUnreadCount(req, res) {
  try {
    const { user_id, role = 'buyer' } = req.query;
    if (!user_id) return res.json({ unread_count: 0 });

    const count = conversationsStore.filter((c) => {
      if (role === 'buyer') {
        return c.buyer_id === user_id && c.unread_for_buyer;
      } else {
        return isSellerMatch(c.seller_id, user_id) && c.unread_for_seller;
      }
    }).length;

    return res.json({ unread_count: count });
  } catch (err) {
    return res.json({ unread_count: 0 });
  }
}

module.exports = {
  getSellerEnquiries,
  createEnquiry,
  respondToEnquiry,
  getConversations,
  getConversationById,
  createOrGetConversation,
  sendMessage,
  markConversationAsRead,
  getUnreadCount
};
