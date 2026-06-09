/**
 * Dispatch console overhaul helpers — filter search, map tenant center, group zones.
 * Loaded after BwMessaging.js; expects Angular scope on #myangular.
 */
(function (window) {
  'use strict';

  function getScope() {
    try {
      var el = document.getElementById('myangular');
      if (!el) return null;
      return angular.element(el).scope();
    } catch (e) {
      return null;
    }
  }

  /** Geocode company city from Firebase companySettings/{cid}/city */
  function bwCenterMapOnCompanyCity(cid) {
    if (!cid || !window.DbRef || !window.google || !window.map) return;
    window.DbRef.ref('companySettings/' + cid + '/city').once('value').then(function (snap) {
      var city = (snap.val() || '').toString().trim();
      if (!city) return;
      var geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: city }, function (results, status) {
        if (status !== 'OK' || !results || !results[0]) return;
        var loc = results[0].geometry.location;
        var lat = loc.lat();
        var lng = loc.lng();
        window.genericlat = lat;
        window.genericlng = lng;
        if (window.map) window.map.setCenter({ lat: lat, lng: lng });
        console.log('[bw-overhaul] map centered on', city, lat, lng);
      });
    }).catch(function () {});
  }

  window.bwCenterMapOnCompanyCity = bwCenterMapOnCompanyCity;

  /** Populate group-message zone dropdown from ZonesArea */
  function bwRefreshGroupZoneSelect() {
    var sel = document.getElementById('ddlGroupZone');
    if (!sel) return;
    var sc = getScope();
    var zones = (sc && sc.ZonesArea && sc.ZonesArea.dt1) ? sc.ZonesArea.dt1 : [];
    if (!zones.length) return;
    var cur = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    zones.forEach(function (z) {
      var name = z.ZoneName || z.name || '';
      if (!name) return;
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var cid = window.SomeSession2 || localStorage.getItem('TT_CId') || '';
    if (cid) setTimeout(function () { bwCenterMapOnCompanyCity(cid); }, 2500);
    setInterval(bwRefreshGroupZoneSelect, 8000);
  });

  /** Wire Angular scope helpers once app is ready */
  function bwWireScopeHelpers() {
    var sc = getScope();
    if (!sc || sc._bwOverhaulWired) return;
    sc._bwOverhaulWired = true;

    sc.filterSearchQuery = sc.filterSearchQuery || '';
    sc.filterSearchResults = sc.filterSearchResults || [];

    sc.bwRunFilterSearch = function () {
      var q = (sc.filterSearchQuery || '').toString().toLowerCase().trim();
      if (!q) {
        sc.filterSearchResults = [];
        if (!sc.$$phase) sc.$applyAsync();
        return;
      }
      var pools = []
        .concat(sc.unassignedjob_list || [])
        .concat(sc.oferunassignedjob_list || [])
        .concat(sc.assignedjob_list || sc.AssignedJob || [])
        .concat(sc.ActiveJob || [])
        .concat(sc.deliveryjobs || [])
        .concat(sc.queuedJobs || []);
      var seen = {};
      sc.filterSearchResults = pools.filter(function (j) {
        if (!j || !j.Id || seen[j.Id]) return false;
        seen[j.Id] = true;
        var hay = [
          j.Id, j.passengername, j.Name, j.PhoneNo, j.passengerPhone,
          j.PickAddress, j.DropAddress, j.drivername, j.BookingStatus,
          j.CallSign, j.VehicleNo
        ].join(' ').toLowerCase();
        return hay.indexOf(q) >= 0;
      }).slice(0, 50);
      if (!sc.$$phase) sc.$applyAsync();
    };

    sc.bwOpenFilterResult = function (hit) {
      if (!hit || !hit.Id) return;
      $('#Filter-jobs').modal('hide');
      if (typeof window.ShowJobPopup === 'function') {
        window.ShowJobPopup(hit.Id);
      }
    };

    sc.quickSetPending = function (jobId) {
      if (typeof sc._quickSetPending === 'function') {
        sc._quickSetPending(jobId);
        return;
      }
      sc.$http({
        method: 'POST',
        url: 'DataManager/Data.aspx/DataProcessor',
        data: { data: [{ name: 'BookingId', Value: jobId }], action: '[QuickSetPending]' }
      }).then(function (resp) {
        if (resp.data.d === 'Operation Successfully Performed' || (resp.data.d && resp.data.d.ok)) {
          if (window.toastr) toastr.success('Set to Pending — visible to drivers', 'Done');
          if (typeof sc.getjobs === 'function') sc.getjobs();
        }
      });
    };

    if (!sc.$$phase) sc.$digest();
    bwRefreshGroupZoneSelect();
  }

  setInterval(bwWireScopeHelpers, 2000);

  /** Fix alarm time comparison — include date not just clock time */
  window.bwAlarmIncludesDate = function (alarmTimeStr) {
    if (!alarmTimeStr) return '';
    var d = new Date(alarmTimeStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    }
    return alarmTimeStr;
  };
})(window);
