import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { useUiStore } from '@/store/uiStore';

export function SuspendedModal() {
  const open = useUiStore((s) => s.openModal === 'suspended');
  const closeModal = useUiStore((s) => s.closeModal);

  return (
    <Modal open={open} onClose={closeModal} title="Suspended Drivers" wide footer={<Button variant="ghost" onClick={closeModal}>Close</Button>}>
      <table className="w-full text-xs">
        <thead className="text-bw-muted uppercase">
          <tr>
            <th className="text-left p-2">Driver</th>
            <th className="text-left p-2">Vehicle</th>
            <th className="text-left p-2">Until</th>
            <th className="text-left p-2">Reason</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={5} className="text-center text-bw-muted py-8">No suspended drivers</td>
          </tr>
        </tbody>
      </table>
    </Modal>
  );
}
