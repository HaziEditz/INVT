import { Button } from '@/components/shared/Button';
import { acknowledgeSos, falseAlarmSos, resolveSos } from '@/lib/sosApi';
import type { SosEmergency } from '@/store/uiStore';

type Props = {
  incident: SosEmergency;
  dispatcherName: string;
  isPrimary?: boolean;
};

export function SosIncidentCard({ incident, dispatcherName, isPrimary }: Props) {
  const isActive = incident.status === 'active';

  return (
    <div
      className={[
        'px-3 py-2',
        isPrimary ? 'border-b border-red-800/50 last:border-b-0' : 'border-t border-red-800/40',
        isActive
          ? isPrimary
            ? 'bg-red-700 text-white animate-pulse'
            : 'bg-red-800/90 text-white'
          : 'bg-red-900/80 text-red-100',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-extrabold tracking-wide">SOS</span>
        <span className="text-sm">
          {incident.driverName} · {incident.vehicle || 'No vehicle'}
          {incident.driverPhone ? (
            <>
              {' · '}
              <a href={`tel:${incident.driverPhone}`} className="underline font-semibold">
                {incident.driverPhone}
              </a>
            </>
          ) : null}
        </span>
        <span className="text-xs opacity-90">
          {incident.locationAddress || `${incident.lat.toFixed(5)}, ${incident.lng.toFixed(5)}`}
        </span>
        <span className="ml-auto text-[11px] opacity-90">{incident.time}</span>
      </div>
      {!!incident.dispatchMessage && (
        <div className="text-xs mt-1 opacity-95">{incident.dispatchMessage}</div>
      )}
      {incident.responders.length > 0 && (
        <div className="text-xs mt-1">
          {incident.responders
            .sort((a, b) => (a.respondedAt || 0) - (b.respondedAt || 0))
            .map((r) => {
              const label = `${r.name}${r.vehicleNo ? ` (${r.vehicleNo})` : ''}`;
              return `${label} is on the way to help`;
            })
            .join(' · ')}
        </div>
      )}
      <div className="flex flex-wrap gap-2 mt-2">
        {isActive ? (
          <Button
            variant="danger"
            onClick={async () => {
              try {
                await acknowledgeSos(incident.sosId, dispatcherName);
              } catch (e) {
                console.error('[SOS] acknowledge failed', incident.sosId, e);
              }
            }}
          >
            Acknowledge
          </Button>
        ) : (
          <>
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  await resolveSos(incident.sosId);
                } catch (e) {
                  console.error('[SOS] resolve failed', incident.sosId, e);
                }
              }}
            >
              Resolve
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  await falseAlarmSos(incident.sosId);
                } catch (e) {
                  console.error('[SOS] false alarm failed', incident.sosId, e);
                }
              }}
            >
              False alarm
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
