// ── BwMessaging.js ────────────────────────────────────────────────────────────
// Additive Firebase messaging panel: messages/{companyId}
// Does NOT touch /chat/, /notification/, /driverMsg/ — fully independent.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
    'use strict';

    var _m = {
        companyId:      null,
        db:             null,
        storage:        null,
        ref:            null,
        allMessages:    [],
        selectedDriver: null,   // null = show all
        quickReplies:   [],
        initialized:    false,
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    function _esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function _avatarColor(name) {
        var cols = ['#e74c3c','#3498db','#2ecc71','#9b59b6','#1abc9c','#e67e22','#16a085','#8e44ad'];
        var h = 0;
        for (var i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffffff;
        return cols[h % cols.length];
    }

    function _fmtTime(ts) {
        if (!ts) return '';
        var d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function _getDrivers() {
        try {
            var sc = angular.element(document.getElementById('myangular')).scope();
            if (sc && sc.driverdatarealx && sc.driverdatarealx.length) {
                return sc.driverdatarealx.map(function (d) {
                    return {
                        id:   String(d.driverid || d.DriverId || d.VehicleId || ''),
                        name: (d.drivername || d.DriverName || d.vehiclenumber || 'Driver').toString().trim()
                    };
                }).filter(function (d) { return d.id; });
            }
        } catch (e) {}
        return [];
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    window.initBwMessaging = function (companyId) {
        if (_m.initialized) return;
        _m.initialized = true;
        _m.companyId   = String(companyId);
        _m.db          = firebase.database();
        _m.storage     = (typeof firebase.storage === 'function') ? firebase.storage() : null;
        _m.ref         = _m.db.ref('messages/' + _m.companyId);

        // Real-time listener — ordered by timestamp, newest at bottom
        _m.ref.orderByChild('timestamp').on('child_added', function (snap) {
            var msg = snap.val();
            if (!msg) return;
            msg._key = snap.key;
            _m.allMessages.push(msg);
            _renderThread();
            _updateSidebarBadges();
        });

        _m.ref.orderByChild('timestamp').on('child_changed', function (snap) {
            var msg = snap.val();
            if (!msg) return;
            msg._key = snap.key;
            var idx = _m.allMessages.findIndex(function (x) { return x._key === snap.key; });
            if (idx !== -1) _m.allMessages[idx] = msg; else _m.allMessages.push(msg);
            _renderThread();
        });

        // Quick replies
        _m.db.ref('quickReplies/' + _m.companyId + '/dispatcher').on('value', function (snap) {
            var qrs = snap.val();
            _m.quickReplies = Array.isArray(qrs) ? qrs : [];
            _renderQuickReplies();
        });

        console.log('[BwMessaging] initialized for company', _m.companyId);
    };

    // ── Driver sidebar ────────────────────────────────────────────────────────
    window.bwMsgRefreshDriverList = function () {
        var list = document.getElementById('bwMsgDriverList');
        if (!list) return;
        var drivers = _getDrivers();
        var sel     = _m.selectedDriver;

        var html = '<li class="bwm-driver-item ' + (!sel ? 'bwm-active' : '') + '" data-did="" ' +
                   'onclick="bwMsgSelectDriver(null,\'All Drivers\')">' +
                   '<span class="bwm-d-avatar" style="background:#607d8b;">📣</span>' +
                   '<span class="bwm-d-name">All Drivers</span>' +
                   '<span class="bwm-d-badge" id="bwBadge_all"></span></li>';

        drivers.forEach(function (d) {
            var active = (d.id === sel);
            var init   = (d.name[0] || '?').toUpperCase();
            html += '<li class="bwm-driver-item ' + (active ? 'bwm-active' : '') + '" data-did="' + _esc(d.id) + '" ' +
                    'onclick="bwMsgSelectDriver(\'' + _esc(d.id) + '\',\'' + _esc(d.name) + '\')">' +
                    '<span class="bwm-d-avatar" style="background:' + _avatarColor(d.name) + ';">' + _esc(init) + '</span>' +
                    '<span class="bwm-d-name">' + _esc(d.name) + '</span>' +
                    '<span class="bwm-d-badge" id="bwBadge_' + _esc(d.id) + '"></span></li>';
        });

        list.innerHTML = html;
        _updateSidebarBadges();
    };

    function _updateSidebarBadges() {
        // Count inbound messages per driver (from === 'driver')
        var counts = {};
        _m.allMessages.forEach(function (msg) {
            if (msg.from !== 'driver') return;
            var did = String(msg.to || '').replace(/^dispatcher$/, '') || String(msg.senderName || '');
            // Use 'from' field as driver ID if 'to' is dispatcher
            var key = String(msg._driverId || msg.driverid || msg.to || '');
            if (!key || key === 'dispatcher' || key === 'all') return;
        });
        // Badge per driver based on messages TO 'dispatcher' from that driver
        _m.allMessages.forEach(function (msg) {
            if (msg.from !== 'driver') return;
            // driver messages have 'to': 'dispatcher' and we identify driver by their sender info
            // For now badge on broadcast area
        });
    }

    // ── Select driver / thread ────────────────────────────────────────────────
    window.bwMsgSelectDriver = function (driverId, driverName) {
        _m.selectedDriver = driverId ? String(driverId) : null;

        // Update active state in list
        document.querySelectorAll('#bwMsgDriverList .bwm-driver-item').forEach(function (li) {
            var did = li.getAttribute('data-did') || '';
            li.classList.toggle('bwm-active', did === (_m.selectedDriver || ''));
        });

        var header = document.getElementById('bwMsgHeader');
        if (header) {
            header.textContent = driverName ? ('💬 ' + driverName) : '💬 All Drivers';
        }

        _renderThread();
    };

    // ── Thread rendering ──────────────────────────────────────────────────────
    function _renderThread() {
        var container = document.getElementById('bwMsgThread');
        if (!container) return;

        var did  = _m.selectedDriver;
        var msgs = _m.allMessages.filter(function (msg) {
            if (!did) return true; // all drivers view shows everything
            // Show messages where this driver is sender OR recipient
            var msgTo   = String(msg.to   || '');
            var msgFrom = String(msg.from || '');
            return (msgTo === did || msgFrom === did || msgTo === 'all' ||
                    (msg.from === 'dispatcher' && msgTo === did) ||
                    (msg.from === 'driver'     && msgFrom === did));
        });

        msgs.sort(function (a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });

        container.innerHTML = msgs.length
            ? msgs.map(_bubble).join('')
            : '<div class="bwm-empty"><i class="fa fa-comments-o"></i><br>No messages yet</div>';

        container.scrollTop = container.scrollHeight;
    }

    function _bubble(msg) {
        var isOut = (msg.from === 'dispatcher');
        var cls   = isOut ? 'bwm-out' : 'bwm-in';
        var name  = _esc(msg.senderName || (isOut ? 'Dispatch' : 'Driver'));
        var time  = _fmtTime(msg.timestamp);
        var bcast = (msg.to === 'all') ? ' <span class="bwm-bcast-tag">📣 All</span>' : '';

        var media = '';
        if (msg.mediaUrl && msg.mediaType === 'image') {
            media = '<a href="' + _esc(msg.mediaUrl) + '" target="_blank" rel="noopener">' +
                    '<img src="' + _esc(msg.mediaUrl) + '" class="bwm-img"></a>';
        } else if (msg.mediaUrl && msg.mediaType === 'video') {
            media = '<video src="' + _esc(msg.mediaUrl) + '" controls class="bwm-video"></video>';
        } else if (msg.mediaUrl && msg.mediaType === 'audio') {
            media = '<audio src="' + _esc(msg.mediaUrl) + '" controls class="bwm-audio"></audio>';
        }

        var text = msg.text ? '<div class="bwm-text">' + _esc(msg.text) + '</div>' : '';

        return '<div class="bwm-bubble ' + cls + '">' +
               '<div class="bwm-bubble-inner">' +
               '<div class="bwm-meta">' + name + bcast + ' <span class="bwm-time">' + time + '</span></div>' +
               text + (media ? '<div class="bwm-media">' + media + '</div>' : '') +
               '</div></div>';
    }

    // ── Quick replies ─────────────────────────────────────────────────────────
    function _renderQuickReplies() {
        var container = document.getElementById('bwMsgQuickReplies');
        if (!container) return;
        if (!_m.quickReplies.length) {
            container.style.display = 'none';
            return;
        }
        container.innerHTML = _m.quickReplies.map(function (qr) {
            return '<button class="bwm-qr-btn" onclick="bwMsgFillCompose(' + JSON.stringify(qr) + ')">' +
                   _esc(qr) + '</button>';
        }).join('');
        container.style.display = 'flex';
    }

    window.bwMsgFillCompose = function (text) {
        var inp = document.getElementById('bwMsgCompose');
        if (inp) { inp.value = text; inp.focus(); }
    };

    // ── Send message ──────────────────────────────────────────────────────────
    window.bwMsgSend = function () {
        if (!_m.ref) return;
        var inp  = document.getElementById('bwMsgCompose');
        var text = (inp ? inp.value : '').trim();
        if (!text) return;
        _push(text, _m.selectedDriver || 'all', null, null);
        if (inp) inp.value = '';
    };

    function _push(text, toId, mediaUrl, mediaType) {
        var dispName = localStorage.getItem('TT_Name') || 'Dispatcher';
        _m.ref.push({
            from:      'dispatcher',
            senderName: dispName,
            to:        toId || 'all',
            text:      text || null,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            mediaType: mediaType || null,
            mediaUrl:  mediaUrl  || null,
        }).catch(function (e) {
            console.warn('[BwMessaging] push failed:', e.code || e.message);
            toastr['error']('Message could not be sent. Check Firebase rules.', 'Messaging');
        });
    }

    // ── Media upload ──────────────────────────────────────────────────────────
    window.bwMsgAttach = function () {
        var inp = document.getElementById('bwMsgFileInput');
        if (inp) inp.click();
    };

    window.bwMsgFileSelected = function (inputEl) {
        var file = inputEl.files && inputEl.files[0];
        if (!file) return;

        if (!_m.storage) {
            toastr['warning']('Firebase Storage is not available. Add the storage SDK.', 'Upload');
            return;
        }

        var ext       = (file.name.split('.').pop() || '').toLowerCase();
        var mediaType = /^(jpg|jpeg|png|gif|webp|bmp)$/.test(ext) ? 'image' :
                        /^(mp4|mov|webm|avi)$/.test(ext)          ? 'video' :
                        /^(mp3|ogg|wav|m4a|aac)$/.test(ext)       ? 'audio' : null;

        if (!mediaType) {
            toastr['warning']('Unsupported file type.', 'Upload');
            inputEl.value = '';
            return;
        }

        var btn  = document.getElementById('bwMsgAttachBtn');
        var path = 'messages/' + _m.companyId + '/' + Date.now() + '_' + file.name;

        if (btn) btn.disabled = true;
        toastr['info']('Uploading ' + mediaType + '…', 'Media');

        _m.storage.ref(path).put(file)
            .then(function (snap) { return snap.ref.getDownloadURL(); })
            .then(function (url) {
                var inp2  = document.getElementById('bwMsgCompose');
                var text  = inp2 ? inp2.value.trim() : null;
                _push(text || null, _m.selectedDriver || 'all', url, mediaType);
                if (inp2) inp2.value = '';
                toastr['success']('Media sent!', 'Messaging');
            })
            .catch(function (e) {
                console.warn('[BwMessaging] upload failed:', e);
                toastr['error']('Upload failed: ' + (e.message || e.code || ''), 'Media');
            })
            .finally(function () {
                if (btn) btn.disabled = false;
                inputEl.value = '';
            });
    };

    // ── Panel activation (called when tab is clicked) ─────────────────────────
    window.bwMsgActivate = function () {
        var cid = localStorage.getItem('TT_CId') || '';
        if (cid && !_m.initialized) initBwMessaging(cid);
        bwMsgRefreshDriverList();
        _renderThread();
        _renderQuickReplies();
    };

    // Auto-refresh driver list every 30 s while panel might be open
    setInterval(function () {
        if (document.getElementById('ttMessages') &&
            document.getElementById('ttMessages').classList.contains('active')) {
            bwMsgRefreshDriverList();
        }
    }, 30000);

})();
