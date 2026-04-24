/* ── Secure Chat — Gun.js + SEA (ECDH / AES-GCM E2EE) ── */
(function () {
  'use strict';

  /* ── Gun init ───────────────────────────────────────── */

  /* Public relay peers. Self-host a Gun relay for guaranteed uptime:
     https://github.com/amark/gun#quickstart */
  var GUN_PEERS = [
    'https://gun-manhattan.herokuapp.com/gun',
    'https://peer.wallie.io/gun',
  ];

  var gun = Gun({ peers: GUN_PEERS, localStorage: true, radisk: false });
  var SEA = Gun.SEA;
  var guser = gun.user();

  /* ── State ──────────────────────────────────────────── */

  var me = null;           // { alias, pub }
  var activePeer = null;   // { alias, pub, epub }
  var activeSecret = null; // ECDH shared secret
  var msgListeners = [];   // Gun .on() listeners to tear down on chat switch
  var renderedKeys = new Set();
  var friendsCache = {};   // alias → { alias, pub, epub }
  var loadingChat = false;
  var lastMsgDate = null;
  var lastMsgFrom = null;

  /* ── DOM refs ───────────────────────────────────────── */

  function $(id) { return document.getElementById(id); }

  var authScreen    = $('auth-screen');
  var appEl         = $('app');
  var authForm      = $('auth-form');
  var authUsername  = $('auth-username');
  var authPassword  = $('auth-password');
  var authSubmitBtn = $('auth-submit');
  var authBtnLabel  = $('auth-btn-label');
  var authBtnSpinner= $('auth-btn-spinner');
  var authError     = $('auth-error');
  var meAliasEl     = $('me-alias');
  var logoutBtn     = $('logout-btn');
  var addFriendForm = $('add-friend-form');
  var friendInput   = $('friend-input');
  var addFriendErr  = $('add-friend-error');
  var friendsList   = $('friends-list');
  var chatEmpty     = $('chat-empty');
  var chatActive    = $('chat-active');
  var chatPeerName  = $('chat-peer-name');
  var messagesList  = $('messages-list');
  var msgForm       = $('msg-form');
  var msgInput      = $('msg-input');
  var msgSendBtn    = $('msg-send');
  var backBtn       = $('back-btn');
  var sidebar       = document.querySelector('.sidebar');
  var tabBtns       = document.querySelectorAll('.tab-btn');

  /* ── Auth mode ──────────────────────────────────────── */

  var authMode = 'login';

  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      authMode = btn.dataset.tab;
      tabBtns.forEach(function (b) {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      authBtnLabel.textContent =
        authMode === 'login' ? 'Se connecter' : 'Créer un compte';
      hideAuthError();
    });
  });

  /* ── Helpers ────────────────────────────────────────── */

  /* Deterministic chat room ID — sorted so both sides derive the same key */
  function chatId(a, b) {
    return 'sc_' + [a, b].sort().join('__');
  }

  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function fmtDate(ts) {
    var d = new Date(ts);
    var today = new Date();
    if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
    var yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return 'Hier';
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  /* ── Auth UI ────────────────────────────────────────── */

  function showAuthScreen() {
    authScreen.classList.remove('hidden');
    appEl.classList.add('hidden');
  }

  function showApp() {
    authScreen.classList.add('hidden');
    appEl.classList.remove('hidden');
    meAliasEl.textContent = me.alias;
    /* On mobile start with sidebar visible */
    sidebar.classList.add('sidebar-open');
    loadFriends();
    showEmpty();
  }

  function setAuthLoading(on) {
    authSubmitBtn.disabled = on;
    authBtnLabel.classList.toggle('hidden', on);
    authBtnSpinner.classList.toggle('hidden', !on);
  }

  function showAuthError(msg) {
    authError.textContent = msg;
    authError.classList.remove('hidden');
  }

  function hideAuthError() {
    authError.classList.add('hidden');
  }

  function showAddFriendError(msg) {
    addFriendErr.textContent = msg;
    addFriendErr.classList.remove('hidden');
    clearTimeout(addFriendErr._t);
    addFriendErr._t = setTimeout(function () {
      addFriendErr.classList.add('hidden');
    }, 4500);
  }

  function showEmpty() {
    chatEmpty.classList.remove('hidden');
    chatActive.classList.add('hidden');
    activePeer = null;
    activeSecret = null;
    document.querySelectorAll('.friend-item').forEach(function (el) {
      el.classList.remove('active');
    });
  }

  function showChatActive() {
    chatEmpty.classList.add('hidden');
    chatActive.classList.remove('hidden');
  }

  /* ── Gun auth helpers ───────────────────────────────── */

  function doRegister(alias, pass) {
    return new Promise(function (resolve, reject) {
      guser.create(alias, pass, function (ack) {
        if (ack.err) reject(new Error(ack.err));
        else resolve(ack);
      });
    });
  }

  function doLogin(alias, pass) {
    return new Promise(function (resolve, reject) {
      guser.auth(alias, pass, function (ack) {
        if (ack.err) reject(new Error(ack.err));
        else resolve(ack);
      });
    });
  }

  function doLogout() {
    tearDownListeners();
    friendsCache = {};
    me = null;
    activePeer = null;
    activeSecret = null;
    friendsList.innerHTML = '';
    messagesList.innerHTML = '';
    meAliasEl.textContent = '';
    guser.leave();
    showAuthScreen();
  }

  function tearDownListeners() {
    msgListeners.forEach(function (l) {
      try { l.off(); } catch (e) {}
    });
    msgListeners = [];
    renderedKeys = new Set();
    lastMsgDate = null;
    lastMsgFrom = null;
  }

  /* ── User lookup ────────────────────────────────────── */

  /* Returns { alias, pub, epub } or rejects with a user-facing error */
  function lookupUser(alias) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error('Utilisateur "' + alias + '" introuvable ou hors-ligne'));
      }, 8000);

      gun.get('~@' + alias).once(function (ref) {
        if (!ref) {
          clearTimeout(timer);
          reject(new Error('Utilisateur "' + alias + '" introuvable'));
          return;
        }

        /* Gun stores the user's node under a key like "~<pub>" */
        var soul = Object.keys(ref).find(function (k) {
          return k.startsWith('~') && k !== '_';
        });

        if (!soul) {
          clearTimeout(timer);
          reject(new Error('Utilisateur "' + alias + '" introuvable'));
          return;
        }

        gun.get(soul).once(function (data) {
          clearTimeout(timer);
          if (!data || !data.epub) {
            reject(new Error('Impossible de charger les clés de "' + alias + '"'));
            return;
          }
          resolve({ alias: alias, pub: data.pub, epub: data.epub });
        });
      });
    });
  }

  /* ── Friends ────────────────────────────────────────── */

  function addFriend(alias) {
    if (!me) return Promise.reject(new Error('Non connecté'));
    if (alias === me.alias)
      return Promise.reject(new Error("Tu ne peux pas t'ajouter toi-même"));
    if (friendsCache[alias])
      return Promise.reject(new Error(alias + ' est déjà dans tes contacts'));

    return lookupUser(alias).then(function (friend) {
      /* Persist in the user's Gun namespace (encrypted with their password) */
      guser.get('fr').get(alias).put({
        alias: friend.alias,
        pub: friend.pub,
        epub: friend.epub,
      });
      friendsCache[alias] = friend;
      renderFriendItem(friend);
      return friend;
    });
  }

  /* Load friends stored from previous sessions */
  function loadFriends() {
    guser.get('fr').map().on(function (data, key) {
      if (!data || typeof data !== 'object') return;
      if (key === '_' || key === '#') return;
      if (!data.alias || !data.epub) return;
      if (friendsCache[data.alias]) return;
      var friend = { alias: data.alias, pub: data.pub, epub: data.epub };
      friendsCache[data.alias] = friend;
      renderFriendItem(friend);
    });
  }

  /* ── Friends UI ─────────────────────────────────────── */

  function renderFriendItem(friend) {
    var safeId = 'fr-' + friend.alias.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (document.getElementById(safeId)) return;

    var li = document.createElement('li');
    li.className = 'friend-item';
    li.id = safeId;
    li.setAttribute('role', 'option');
    li.setAttribute('tabindex', '0');

    var av = document.createElement('div');
    av.className = 'friend-avatar';
    av.textContent = friend.alias[0].toUpperCase();
    av.setAttribute('aria-hidden', 'true');

    var nm = document.createElement('span');
    nm.className = 'friend-name';
    nm.textContent = friend.alias;

    var dot = document.createElement('span');
    dot.className = 'friend-unread hidden';
    dot.id = 'unread-' + friend.alias.replace(/[^a-zA-Z0-9_-]/g, '_');
    dot.setAttribute('aria-label', 'Nouveau message');

    li.appendChild(av);
    li.appendChild(nm);
    li.appendChild(dot);

    li.addEventListener('click', function () { openChat(friend); });
    li.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openChat(friend);
      }
    });

    friendsList.appendChild(li);
  }

  /* ── Chat ───────────────────────────────────────────── */

  function openChat(friend) {
    if (loadingChat) return;
    loadingChat = true;

    /* Sidebar active state */
    document.querySelectorAll('.friend-item').forEach(function (el) {
      el.classList.remove('active');
    });
    var safeId = 'fr-' + friend.alias.replace(/[^a-zA-Z0-9_-]/g, '_');
    var frEl = document.getElementById(safeId);
    if (frEl) frEl.classList.add('active');

    /* Clear unread indicator */
    var dotId = 'unread-' + friend.alias.replace(/[^a-zA-Z0-9_-]/g, '_');
    var dot = document.getElementById(dotId);
    if (dot) dot.classList.add('hidden');

    /* Stop previous listeners */
    tearDownListeners();
    messagesList.innerHTML = '';

    /* Update header */
    chatPeerName.textContent = friend.alias;
    showChatActive();

    /* Mobile: hide sidebar so chat fills screen */
    sidebar.classList.remove('sidebar-open');

    /* Derive ECDH shared secret:
       SEA.secret(peerEpub, myPair) == SEA.secret(myEpub, peerPair)  ← ECDH */
    SEA.secret(friend.epub, guser._.sea).then(function (secret) {
      activePeer = friend;
      activeSecret = secret;

      var cid = chatId(me.alias, friend.alias);
      var ref = gun.get('sch').get(cid).get('m');

      /* ── Two-phase load ──────────────────────────────── *
       * Phase 1 (first 700 ms): collect existing messages  *
       * Phase 2: append real-time messages directly        */
      var msgBuffer = {};
      var initialDone = false;
      var captureFriend = friend;

      var listener = ref.map().on(function (data, key) {
        if (!data || renderedKeys.has(key) || key === '_') return;

        SEA.decrypt(data.e, secret).then(function (text) {
          if (typeof text !== 'string' || renderedKeys.has(key)) return;
          renderedKeys.add(key);

          var msg = {
            key: key,
            text: text,
            from: data.f,
            time: data.t || 0,
            isMine: data.f === me.alias,
          };

          if (!initialDone) {
            msgBuffer[key] = msg;
          } else {
            /* Real-time: only append if this conversation is still active */
            if (activePeer && activePeer.alias === captureFriend.alias) {
              appendMsg(msg);
              scrollBottom();
            } else if (!msg.isMine) {
              /* Background notification */
              if (dot) dot.classList.remove('hidden');
            }
          }
        });
      });

      msgListeners.push(listener);

      /* After initial load window: render sorted, switch to live mode */
      setTimeout(function () {
        initialDone = true;
        loadingChat = false;

        var sorted = Object.values(msgBuffer).sort(function (a, b) {
          return a.time - b.time;
        });
        sorted.forEach(appendMsg);
        msgBuffer = {};
        scrollBottom();
      }, 700);
    });
  }

  function appendMsg(msg) {
    var dateLabel = fmtDate(msg.time);

    /* Date separator when day changes */
    if (dateLabel !== lastMsgDate) {
      var sep = document.createElement('div');
      sep.className = 'date-sep';
      sep.textContent = dateLabel;
      sep.setAttribute('aria-hidden', 'true');
      messagesList.appendChild(sep);
      lastMsgDate = dateLabel;
      lastMsgFrom = null; /* reset grouping after day break */
    }

    var div = document.createElement('div');
    div.className = 'msg ' + (msg.isMine ? 'msg-mine' : 'msg-theirs');
    if (msg.from === lastMsgFrom) div.classList.add('msg-grouped');
    div.dataset.key = msg.key;
    div.dataset.time = msg.time;
    lastMsgFrom = msg.from;

    var bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = msg.text; /* textContent = XSS-safe */

    var ts = document.createElement('span');
    ts.className = 'msg-time';
    ts.textContent = fmtTime(msg.time);
    ts.setAttribute('aria-label', new Date(msg.time).toLocaleString('fr-FR'));

    div.appendChild(bubble);
    div.appendChild(ts);
    messagesList.appendChild(div);
  }

  function scrollBottom() {
    messagesList.scrollTop = messagesList.scrollHeight;
  }

  function sendMessage(text) {
    if (!activePeer || !activeSecret || !text.trim()) return Promise.resolve();

    return SEA.encrypt(text.trim(), activeSecret).then(function (enc) {
      var cid = chatId(me.alias, activePeer.alias);
      gun.get('sch').get(cid).get('m').set({
        f: me.alias,
        e: enc,
        t: Date.now(),
      });
    });
  }

  /* ── Event handlers ─────────────────────────────────── */

  /* Auth form submit */
  authForm.addEventListener('submit', function (e) {
    e.preventDefault();
    hideAuthError();

    var alias = authUsername.value.trim();
    var pass  = authPassword.value;

    if (!alias || !pass) {
      showAuthError('Remplis tous les champs.');
      return;
    }
    if (pass.length < 8) {
      showAuthError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(alias)) {
      showAuthError(
        "Le nom d'utilisateur ne peut contenir que des lettres, chiffres, _ et -."
      );
      return;
    }

    setAuthLoading(true);

    var flow =
      authMode === 'register'
        ? doRegister(alias, pass).then(function () { return doLogin(alias, pass); })
        : doLogin(alias, pass);

    flow
      .then(function () {
        me = { alias: guser.is.alias, pub: guser.is.pub };
        showApp();
      })
      .catch(function (err) {
        var raw = err.message || 'Erreur inconnue. Réessaie.';
        var msg = raw.includes('already created')
          ? 'Ce nom d\'utilisateur est déjà pris.'
          : raw.includes('Wrong user or password')
          ? 'Nom d\'utilisateur ou mot de passe incorrect.'
          : raw;
        showAuthError(msg);
      })
      .finally(function () {
        setAuthLoading(false);
      });
  });

  /* Logout */
  logoutBtn.addEventListener('click', doLogout);

  /* Add friend */
  addFriendForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var alias = friendInput.value.trim();
    if (!alias) return;

    var addBtn = addFriendForm.querySelector('.add-btn');
    addBtn.disabled = true;

    addFriend(alias)
      .then(function () {
        friendInput.value = '';
      })
      .catch(function (err) {
        showAddFriendError(err.message || "Impossible d'ajouter cet ami.");
      })
      .finally(function () {
        addBtn.disabled = false;
      });
  });

  /* Send message */
  msgForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = msgInput.value;
    msgInput.value = '';
    msgInput.style.height = 'auto';
    msgSendBtn.disabled = true;
    sendMessage(text).finally(function () {
      /* re-enable only when textarea has content */
      msgSendBtn.disabled = !msgInput.value.trim();
    });
  });

  /* Auto-grow textarea */
  msgInput.addEventListener('input', function () {
    msgInput.style.height = 'auto';
    msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + 'px';
    msgSendBtn.disabled = !msgInput.value.trim();
  });

  /* Enter to send / Shift+Enter for newline */
  msgInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      msgForm.dispatchEvent(new Event('submit', { bubbles: true }));
    }
  });

  /* Back button (mobile only) */
  backBtn.addEventListener('click', function () {
    showEmpty();
    sidebar.classList.add('sidebar-open');
  });

  /* ── Session restore & initial screen ───────────────── */

  var authEventFired = false;

  gun.on('auth', function () {
    if (authEventFired || !guser.is) return;
    authEventFired = true;
    me = { alias: guser.is.alias, pub: guser.is.pub };
    showApp();
  });

  /* Try to restore a previous session (stored in sessionStorage by Gun) */
  guser.recall({ sessionStorage: true });

  /* Fallback: if Gun hasn't fired 'auth' within 1.2 s, show the auth screen */
  setTimeout(function () {
    if (!me) showAuthScreen();
  }, 1200);
})();
