import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { useUiStore } from '@/store/uiStore';

export function AccModal() {
  const open = useUiStore((s) => s.openModal === 'acc');
  const closeModal = useUiStore((s) => s.closeModal);

  return (
    <Modal open={open} onClose={closeModal} title="ACC Approvals & POs" wide footer={<Button variant="ghost" onClick={closeModal}>Close</Button>}>
      <p className="text-xs text-bw-muted mb-3">
        Manage full ACC setup in the{' '}
        <a href="#" className="text-bw-primary underline" onClick={(e) => e.preventDefault()}>
          Owner Panel
        </a>
      </p>
      <table className="w-full text-xs">
        <thead className="text-bw-muted uppercase">
          <tr>
            <th className="text-left p-2">Claim #</th>
            <th className="text-left p-2">Client</th>
            <th className="text-left p-2">PO #</th>
            <th className="text-left p-2">From</th>
            <th className="text-left p-2">To</th>
            <th className="text-left p-2">Left</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={7} className="text-center text-bw-muted py-8">No approvals loaded — connect Firebase ACC data</td>
          </tr>
        </tbody>
      </table>
    </Modal>
  );
}
