import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aspPath = path.join(__dirname, '..', 'taxitime.co.nz', 'Dispatchthree', 'Default.aspx');

let html = fs.readFileSync(aspPath, 'utf8');
let changes = 0;

function rep(desc, from, to, all = false) {
  if (!html.includes(from) && !all) {
    console.warn('SKIP (not found):', desc);
    return;
  }
  const before = html;
  html = all ? html.split(from).join(to) : html.replace(from, to);
  if (html !== before) {
    changes++;
    console.log('OK:', desc);
  } else {
    console.warn('NO CHANGE:', desc);
  }
}

// ── 1. Filter modal → lightweight search overlay ─────────────────────────────
const filterStart = '     <div class="modal fade" id="Filter-jobs">';
const filterEnd = '    <!-- Suspended Drivers Modal -->';
const i0 = html.indexOf(filterStart);
const i1 = html.indexOf(filterEnd);
if (i0 >= 0 && i1 > i0) {
  const newFilter = `     <div class="modal fade" id="Filter-jobs">
        <div class="modal-dialog" style="max-width:720px; width:96vw; margin:24px auto;">
            <div class="modal-content" style="border:none; border-radius:10px; overflow:hidden; box-shadow:0 12px 40px rgba(0,0,0,0.28);">
                <div class="modal-header" style="background:#1a1a2e; color:#fff; padding:14px 20px; border:none; display:flex; align-items:center; justify-content:space-between;">
                    <h5 style="margin:0; font-size:15px; font-weight:600;">
                        <i class="fa fa-filter" style="color:#dfba5f; margin-right:8px;"></i>Filter Jobs
                    </h5>
                    <button class="close" data-dismiss="modal" style="color:#fff; opacity:0.7; font-size:22px;">&times;</button>
                </div>
                <div style="background:#f4f5f7; border-bottom:1px solid #e0e2e8; padding:12px 20px;">
                    <input type="text" ng-model="filterSearchQuery" ng-change="bwRunFilterSearch()" placeholder="Booking ID, passenger, phone, driver, address…" class="form-control" style="border-radius:8px; font-size:13px;">
                </div>
                <div class="modal-body" style="padding:12px; max-height:460px; overflow-y:auto;">
                    <p ng-if="!filterSearchResults.length && filterSearchQuery" style="color:#888;text-align:center;padding:24px;">No matching jobs</p>
                    <p ng-if="!filterSearchQuery" style="color:#aaa;text-align:center;padding:24px;font-size:13px;">Type to search across all job boards</p>
                    <div ng-repeat="hit in filterSearchResults | limitTo:50" ng-click="bwOpenFilterResult(hit)" style="border:1px solid #e2e8f0;border-left:4px solid #1a73e8;border-radius:8px;padding:10px 12px;margin-bottom:8px;cursor:pointer;background:#fff;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <strong style="color:#1a73e8;">#{{hit.Id}}</strong>
                            <span style="background:#475569;color:#fff;font-size:10px;padding:2px 8px;border-radius:10px;">{{hit.BookingStatus}}</span>
                        </div>
                        <div style="font-size:12px;color:#334155;margin-top:4px;"><i class="fa fa-map-marker" style="color:#16a34a;"></i> {{bwFormatAddress(hit.PickAddress, 'Hail Pickup')}}</div>
                        <div style="font-size:11px;color:#64748b;margin-top:2px;"><i class="fa fa-user"></i> {{hit.passengername || hit.Name || '—'}} &nbsp; <i class="fa fa-phone"></i> {{hit.PhoneNo || hit.passengerPhone || '—'}}</div>
                        <div ng-if="hit.drivername" style="font-size:10px;color:#94a3b8;margin-top:2px;"><i class="fa fa-car"></i> {{hit.drivername}}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

`;
  html = html.slice(0, i0) + newFilter + html.slice(i1);
  changes++;
  console.log('OK: Filter modal replaced');
} else {
  console.warn('SKIP: Filter modal markers not found');
}

// ── 2. Active tab badge bindings (value → acvalue) ───────────────────────────
rep('Active badges filter modal',
  `<span ng-if="value.Acc_job_id ">ACC</span>

                                                                    <span ng-if="value.Account_id" class="bw-mc" title="{{value.Account_Name || value.Account_id}}"><i class="fa fa-briefcase"></i> {{value.Account_Name || value.Account_id}} &middot; Account Job</span>

                                                                    <span ng-if="value.Recieve_payment  ">Paid</span><span ng-if="(value.paymentMethod||value.PaymentMethod) && (value.paymentMethod||value.PaymentMethod)!=''" class="label label-pill mt-2" style="background:#475569;color:#fff;font-size:10px;font-weight:700;" title="Payment method"><i class="fa fa-credit-card"></i> {{(value.paymentMethod||value.PaymentMethod)|uppercase}}</span><span ng-if="((value.paymentStatus||value.PaymentStatus)+'').toLowerCase()=='paid'" class="label label-pill mt-2" style="background:#16a34a;color:#fff;font-size:10px;font-weight:700;" title="Pre-paid online">PAID</span>`,
  `<span ng-if="acvalue.Acc_job_id ">ACC</span>

                                                                    <span ng-if="acvalue.Account_id" class="bw-mc" title="{{acvalue.Account_Name || acvalue.Account_id}}"><i class="fa fa-briefcase"></i> {{acvalue.Account_Name || acvalue.Account_id}} &middot; Account Job</span>

                                                                    <span ng-if="acvalue.Recieve_payment  ">Paid</span><span ng-if="(acvalue.paymentMethod||acvalue.PaymentMethod) && (acvalue.paymentMethod||acvalue.PaymentMethod)!=''" class="label label-pill mt-2" style="background:#475569;color:#fff;font-size:10px;font-weight:700;" title="Payment method"><i class="fa fa-credit-card"></i> {{(acvalue.paymentMethod||acvalue.PaymentMethod)|uppercase}}</span><span ng-if="((acvalue.paymentStatus||acvalue.PaymentStatus)+'').toLowerCase()=='paid'" class="label label-pill mt-2" style="background:#16a34a;color:#fff;font-size:10px;font-weight:700;" title="Pre-paid online">PAID</span>`,
  true
);

// ── 3. Search jobs phone field ───────────────────────────────────────────────
rep('Search jobs phone', '{{showi.AccountId}}', '{{showi.PhoneNo || showi.passengerPhone || showi.passengerno || showi.Phone || "—"}}');

// ── 4. Remove dt6 Active update from getjobs ─────────────────────────────────
rep('Remove dt6 Active dual-feed',
  `                    // dt6: active jobs list — keep Active tab in sync on every poll
                    // This eliminates the reliance on Firebase event-driven ActiveJobsdata() calls,
                    // which can silently fail when code throws inside their try/catch handlers.
                    var _dt6 = $scope.jobsdata['dt6'];
                    if (Array.isArray(_dt6)) {
                        $scope.ActiveJob   = _dt6;
                        $scope.ActiveCount = _dt6.length;
                    }`,
  `                    // Active tab: ActiveJobsdata() only (10s poll) — do not overwrite from getjobs dt6`
);

// ── 5. Duplicate IDs ─────────────────────────────────────────────────────────
rep('Zone queue table id', '<table id="example" style="width:100%;" ng-if="zonelist && zonelist.length > 0">',
  '<table id="zone-queue-table" style="width:100%;" ng-if="zonelist && zonelist.length > 0">');

rep('Remove duplicate Emergency modal',
  `                           <div class="modal fade" id="Emergency">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header" style="border-bottom: 1px solid #dfba5f;">
                                <button class="close" data-dismiss="modal">&times;</button>
                                <h5>Emergency</h5>
                            </div>
                            <div class="modal-body modal-alert-box" id="EmergencyBody">
                            </div>
                        </div>
                    </div>
                </div>`,
  '');

rep('singlediv → unique per card', 'id="singlediv"', 'id="singlediv-{{value.Id}}"', true);

// Update CSS selectors for singlediv to class-based
rep('CSS singlediv → .bw-job-card', 'div#singlediv {', 'div.bw-job-card, div[id^="singlediv-"] {', true);
rep('CSS singlediv hover', 'div#singlediv:hover {', 'div.bw-job-card:hover, div[id^="singlediv-"]:hover {');
rep('CSS singlediv alt', 'div#singlediv.bw-card-alt', 'div.bw-job-card.bw-card-alt, div[id^="singlediv-"].bw-card-alt', true);

// Add bw-job-card class to main U-A cards
rep('U-A bw-job-card class',
  `ng-class="{'bw-card-alt': $odd, 'bw-svc-food': value.serviceType==='food'`,
  `ng-class="{'bw-job-card': true, 'bw-card-alt': $odd, 'bw-svc-food': value.serviceType==='food'`);

// ── 6. Queue tab nav + pane ──────────────────────────────────────────────────
rep('Add Queue tab nav',
  `<li><a ng-click="ActiveJobsdata(0)" href="#tab7" data-toggle="tab" class="">Active <span>({{ActiveCount}})</span></a></li>
                                               <li><a href="#tab8"  ng-click="GetJobsdelivery()" data-toggle="tab" id="deliv" class=" "    >DY<span>({{deliverycount}})</span> </a></li>`,
  `<li><a ng-click="ActiveJobsdata(0)" href="#tab7" data-toggle="tab" class="">Active <span>({{ActiveCount}})</span></a></li>
                                                <li><a href="#tab-queue" ng-click="getQueuedJobs()" data-toggle="tab">Queue <span>({{queuedJobs.length || 0}})</span></a></li>
                                               <li><a href="#tab8"  ng-click="GetJobsdelivery()" data-toggle="tab" id="deliv" class=" "    >DY<span>({{deliverycount}})</span> </a></li>`);

// Move queued section to Queue tab — insert new tab pane before tab7, remove from assign
const queueSectionStart = '                                                    <!-- QUEUED JOBS (Busy-driver Pre-Queue) -->';
const queueSectionEnd = '                                                    <!-- END QUEUED JOBS -->';
const qs = html.indexOf(queueSectionStart);
const qe = html.indexOf(queueSectionEnd);
if (qs >= 0 && qe > qs) {
  const queueBlock = html.slice(qs, qe + queueSectionEnd.length);
  // Remove from assign tab
  html = html.slice(0, qs) + '                                                    <!-- Queued jobs moved to Queue tab -->' + html.slice(qe + queueSectionEnd.length);
  // Insert Queue tab before tab7
  const tab7 = '<div class="tab-pane" id="tab7">';
  const tab7i = html.indexOf(tab7);
  if (tab7i >= 0) {
    const queueTab = `
                                                <div class="tab-pane" id="tab-queue">
                                                    <div ng-if="!queuedJobs || queuedJobs.length === 0" style="text-align:center;color:#94a3b8;padding:32px;font-size:13px;">
                                                        <i class="fa fa-clock-o" style="font-size:28px;display:block;margin-bottom:8px;"></i>No queued jobs
                                                    </div>
${queueBlock.replace(/recallQueuedJob/g, 'recallQueuedJob').replace(
  '<strong style="color:#e67e22;"><i class="fa fa-clock-o"></i> Queued — Waiting for Driver to Finish</strong>',
  '<strong style="color:#e67e22;"><i class="fa fa-clock-o"></i> Driver Queue</strong>'
)}
                                                </div>
`;
    html = html.slice(0, tab7i) + queueTab + html.slice(tab7i);
    changes++;
    console.log('OK: Queue tab inserted');
  }
}

// ── 7. U-A Set Pending / No One buttons + bwFormatAddress on pickup ──────────
rep('U-A pickup address format',
  `<span class="bw-raddr">{{value.PickAddress || 'Street / Hail Pickup'}}</span>`,
  `<span class="bw-raddr">{{bwFormatAddress(value.PickAddress, 'Hail Pickup')}}</span>`);

rep('U-A Set Pending/No One buttons',
  `<span class="bw-b bw-send-pulse" style="background:#16a34a;color:#fff;cursor:pointer;padding:2px 8px;" ng-click="bwConfirmSpx(value.Id)" title="Confirm driver selection"><i class="fa fa-paper-plane"></i></span>`,
  `<span class="bw-b" style="background:#7c3aed;color:#fff;cursor:pointer;padding:2px 8px;" ng-click="quickSetPending(value.Id)" title="Broadcast to all matching drivers"><i class="fa fa-bullhorn"></i> Pending</span>
                                                                <span class="bw-b" style="background:#64748b;color:#fff;cursor:pointer;padding:2px 8px;" ng-click="quickSetNoOne(value.Id)" title="Dispatcher only — not sent to drivers"><i class="fa fa-ban"></i> No One</span>
                                                                <span class="bw-b bw-send-pulse" style="background:#16a34a;color:#fff;cursor:pointer;padding:2px 8px;" ng-click="bwConfirmSpx(value.Id)" title="Confirm driver selection"><i class="fa fa-paper-plane"></i></span>`);

// ── 8. Away tab columns parity ───────────────────────────────────────────────
rep('Away tab header columns',
  `<th class="wd-15p">Jobs</th>
                                                    <th class="wd-10p">Passenger</th>
                                                    <th class="wd-20p">Pick up</th>
                                                    <th class="wd-15p">Drop Off</th>


                                                </tr>
                                            </thead>

                                               <tr ng-repeat="driverz in driverdatarealx  "  ng-if="driverz.vehiclestatus == 'Away'`,
  `<th class="wd-10p">Jobs</th>
                                                    <th class="wd-10p">Passenger</th>
                                                    <th class="wd-10p">Phone</th>
                                                    <th class="wd-20p">Pick up</th>
                                                    <th class="wd-15p">Drop Off</th>


                                                </tr>
                                            </thead>

                                               <tr ng-repeat="driverz in driverdatarealx  "  ng-if="driverz.vehiclestatus == 'Away'`);

rep('Away tab row cells',
  `ng-if="driverz.vehiclestatus == 'Away' && checkDriverSvcFilter(driverz.driverid)"  ng-click='VehicleDetailschng(  driverz.VehicleId  )'  style="    font-weight: 600;background:{{showcolor(driverz.vehiclestatus)}}">
                                                <td><div style="height: 20px!important; overflow: hidden;">
                                                      {{driverz.zonename}}/{{driverz.vehiclenumber}} /{{driverz.vehicletype}}
                                                      <i class='fa fa-circle' id='online{{driverz.Id}}' style='float:right; ' aria-hidden='true'>

                                                      </i>

                                                    </div>
                                                   </td>
                                                <td style="overflow: hidden; width: 60px; white-space: nowrap; overflow: hidden;">{{driverz.drivername}}</td>
                                                <td style="white-space:nowrap;">
                                                    <span ng-repeat="badge in getDriverSvcBadges(driverz.driverid)" style="display:inline-block; font-size:9px; font-weight:700; padding:1px 4px; border-radius:3px; margin-right:2px;"
                                                        ng-style="{background: badge==='Taxi' ? '#1565c0' : badge==='Food' ? '#2e7d32' : badge==='Freight' ? '#e65100' : '#6a1b9a', color:'#fff'}">{{badge}}</span>
                                                    <span ng-if="isSharedDriver(driverz.PlayerId || driverz.driverid)"
                                                        style="display:inline-block; font-size:9px; font-weight:700; padding:1px 5px; border-radius:3px; background:#7b1fa2; color:#fff; margin-left:2px; letter-spacing:0.3px;"
                                                        title="Shared from {{getDriverHomeCompany(driverz.PlayerId || driverz.driverid)}}">SHARED</span>
                                                </td>
                                                <td ng-if="driverz.vehiclestatus != 'manualreject'"> 
                                                    <span ng-if="driverz.vehiclestatus == 'Picking'" > Roger</span>    
                                                   
                                                    <span  ng-if="driverz.vehiclestatus != 'Picking'   "   >  {{driverz.vehiclestatus}}</span> 
                                                </td>
                                                 
                                                <td>
                                                    <div  >  <span  >{{ driverz.jobCount }}</span><span ng-if="driverQueuedCount(driverz.driverid) > 0" style="color:#e67e22;font-weight:700;margin-left:4px;" title="{{driverQueuedCount(driverz.driverid)}} queued job(s) lined up">+{{driverQueuedCount(driverz.driverid)}}</span>
                                                    </div>

                                                </td>
                                                   <td>
                                                    <div>     
                                                        <span >{{ driverz.JobphoneNo }}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div  style=" height: 20px!important; overflow: hidden;">
                                                        <span >{{ driverz.jobpickup }}
                                                        </span>
                                                    </div>

                                                </td>
                                                <td>
                                                    <div   style="height: 20px!important; overflow: hidden;">
                                                        <span  >{{ driverz.jobdropoff }}
                                                        </span>
                                                    </div>
                                                </td>`,
  `ng-if="driverz.vehiclestatus == 'Away' && checkDriverSvcFilter(driverz.driverid)"  ng-click='VehicleDetailschng(  driverz.VehicleId  )'  style="font-weight: 600;background:{{showcolor(bwBoardStatus(driverz))}}">
                                                <td><div style="height: 20px!important; overflow: hidden;">{{bwZoneCabLabel(driverz)}}</div></td>
                                                <td style="overflow: hidden; white-space: nowrap;">{{bwDriverDisplayName(driverz)}}</td>
                                                <td style="white-space:nowrap;">
                                                    <span ng-repeat="badge in getDriverSvcBadges(driverz.driverid)" style="display:inline-block; font-size:9px; font-weight:700; padding:1px 4px; border-radius:3px; margin-right:2px;"
                                                        ng-style="{background: badge==='Taxi' ? '#1565c0' : badge==='Food' ? '#2e7d32' : badge==='Freight' ? '#e65100' : '#6a1b9a', color:'#fff'}">{{badge}}</span>
                                                </td>
                                                <td><span style="font-weight:700;color:#64748b;">{{bwBoardStatus(driverz)}}</span></td>
                                                <td><span>{{ bwJobsToday(driverz) }}</span><span ng-if="driverQueuedCount(driverz.driverid) > 0" style="color:#e67e22;font-weight:700;margin-left:4px;">+{{driverQueuedCount(driverz.driverid)}}</span></td>
                                                <td>{{ bwPassengerName(driverz) }}</td>
                                                <td>{{ bwPassengerPhone(driverz) }}</td>
                                                <td><div style="height: 20px!important; overflow: hidden;">{{ bwFormatAddress(driverz.jobpickup, 'Hail / Street Pickup') }}</div></td>
                                                <td><div style="height: 20px!important; overflow: hidden;">{{ bwFormatAddress(driverz.jobdropoff, '—') }}</div></td>`);

// ── 9. Suspended zone board → count + link only ──────────────────────────────
rep('Suspended tab simplified',
  `<div id="menu4" class="container tab-pane fade"><br>
                                          <div>
                                <div>
                                    <div class="table-responsive">
                                        <table style="width:100%;">
                                            <thead>
                                                <tr>
                                                    <th class="wd-15p">Vehicle</th>
                                                    <th class="wd-20p">Driver</th>
                                                    <th class="wd-15p">Zone</th>
                                                    <th class="wd-20p">Suspended At</th>
                                                    <th class="wd-15p">Action</th>
                                                </tr>
                                            </thead>
                                            <tr ng-repeat="susp in suspendedDriversList" style="background:#fff3f3; font-weight:600;">
                                                <td>{{susp.vehiclenumber}} / {{susp.vehicletype}}</td>
                                                <td>{{susp.drivername || '—'}}</td>
                                                <td>{{susp.zonename || '—'}}</td>
                                                <td style="font-size:11px; color:#888;">{{susp.suspendedAt | date:'HH:mm:ss dd/MM/yy'}}</td>
                                                <td>
                                                    <button class="btn btn-sm btn-success" ng-click="unsuspendDriver(susp)" title="Restore driver to active board">
                                                        <i class="fa fa-undo"></i> Restore
                                                    </button>
                                                </td>
                                            </tr>
                                            <tr ng-if="!suspendedDriversList.length">
                                                <td colspan="5" style="text-align:center; color:#aaa; padding:18px;">No suspended drivers</td>
                                            </tr>
                                        </table>
                                    </div>
                                </div>
                            </div>
                          </div>`,
  `<div id="menu4" class="container tab-pane fade"><br>
                            <div style="text-align:center;padding:24px;">
                                <p style="font-size:14px;color:#64748b;margin-bottom:12px;">
                                    <strong style="color:#c0392b;font-size:18px;">{{suspendedDriversList.length || 0}}</strong> suspended driver(s)
                                </p>
                                <button class="btn btn-danger btn-sm" data-toggle="modal" data-target="#suspended-drivers-modal" ng-click="getSuspendedDrivers()">
                                    <i class="fa fa-ban"></i> Open Suspended Drivers
                                </button>
                            </div>
                          </div>`);

// ── 10. Group messages dynamic zones ─────────────────────────────────────────
rep('Group message zones dynamic',
  `<select id="ddlGroupZone">
                                            <option value="">All Zones</option>
                                            <option value="Central Invercargill">Central Invercargill</option>
                                            <option value="Appleby">Appleby</option>
                                            <option value="Waikiwi">Waikiwi</option>
                                        </select>`,
  `<select id="ddlGroupZone">
                                            <option value="">All Zones</option>
                                            <option ng-repeat="z in (ZonesArea.dt1 || [])" value="{{z.ZoneName}}">{{z.ZoneName}}</option>
                                        </select>`);

// ── 11. DY driver dropdown ───────────────────────────────────────────────────
rep('DY driverlistx → driverdatarealx', 'ng-repeat="drivi in driverlistx"', 'ng-repeat="drivi in driverdatarealx"', true);

// ── 12. Remove dev backdoor ──────────────────────────────────────────────────
rep('Remove bwForceDriverOnline panel',
  `                                   <div id="bw-force-driver-panel" style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:10px 14px;margin-bottom:12px;">
                                       <strong style="font-size:12px;color:#856404;display:block;margin-bottom:8px;"><i class="fa fa-wrench"></i> Dev: Force Driver Online/Offline (local testing only)</strong>
                                       <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
                                           <div>
                                               <label style="font-size:11px; font-weight:600; color:#555; display:block; margin-bottom:3px;">Driver ID</label>
                                               <input id="bw-fd-driver" type="text" placeholder="e.g. 42" class="form-control input-sm" style="width:90px;" />
                                           </div>
                                           <div>
                                               <label style="font-size:11px; font-weight:600; color:#555; display:block; margin-bottom:3px;">Vehicle ID</label>
                                               <input id="bw-fd-vehicle" type="text" placeholder="e.g. D001" class="form-control input-sm" style="width:90px;" />
                                           </div>
                                           <div>
                                               <label style="font-size:11px; font-weight:600; color:#555; display:block; margin-bottom:3px;">Vehicle Type</label>
                                               <select id="bw-fd-type" class="form-control input-sm" style="width:100px;">
                                                   <option value="Sedan">Sedan</option>
                                                   <option value="SUV">SUV</option>
                                                   <option value="Van">Van</option>
                                                   <option value="Wheelchair">Wheelchair</option>
                                               </select>
                                           </div>
                                           <div>
                                               <label style="font-size:11px; font-weight:600; color:#555; display:block; margin-bottom:3px;">Zone (optional)</label>
                                               <input id="bw-fd-zone" type="text" placeholder="e.g. City" class="form-control input-sm" style="width:100px;" />
                                           </div>
                                           <button id="bw-fd-btn" class="btn btn-primary btn-sm" onclick="bwForceDriverOnline()" style="font-weight:700; white-space:nowrap;">
                                               <i class="fa fa-sign-in"></i> Force Online
                                           </button>
                                           <button class="btn btn-default btn-sm" onclick="bwForceDriverOffline()" style="font-weight:700; white-space:nowrap;">
                                               <i class="fa fa-sign-out"></i> Force Offline
                                           </button>
                                       </div>
                                       <div id="bw-fd-status" style="margin-top:8px; font-size:12px; display:none;"></div>
                                   </div>

                                   <!-- ── Existing approval table ── -->`,
  `                                   <!-- ── Existing approval table ── -->`);

// ── 13. Alarms checkbox typo ─────────────────────────────────────────────────
rep('showAllArlams → showAllAlarms', 'showAllArlams', 'showAllAlarms', true);

// ── 14. Header nav fixes ─────────────────────────────────────────────────────
rep('Acc → ACC', 'data-target="#acc">Acc</a>', 'data-target="#acc">ACC</a>');
rep('Soften notification bell', 'style="color:red; margin-top: 13px;', 'style="color:#e57373; margin-top: 13px;');
rep('Disable ChatRoom.js', '<script src="JsScripts/ChatRoom.js"></script>', '<!-- ChatRoom.js disabled — BwMessaging.js is authoritative -->');

// ── 15. VehiclesStatus dt6 → onlineDrivers (client) ──────────────────────────
rep('VehiclesStatus onlineDrivers client', 'var _onlineIds = $res["dt6"];', 'var _onlineIds = $res["onlineDrivers"] != null ? $res["onlineDrivers"] : $res["dt6"];');

// ── 16. Offer tab passengername standardization (sample) ─────────────────────
rep('Offer tab passenger name', `{{value.passengername}}`, `{{value.passengername || value.Name}}`, true);

// ── 17. Include overhaul JS ──────────────────────────────────────────────────
rep('Include bw-dispatch-overhaul.js',
  '<script src="JsScripts/BwMessaging.js"></script>',
  '<script src="JsScripts/BwMessaging.js"></script>\n     <script src="JsScripts/bw-dispatch-overhaul.js"></script>');

fs.writeFileSync(aspPath, html, 'utf8');
console.log(`\nDone — ${changes} change groups applied to Default.aspx`);
