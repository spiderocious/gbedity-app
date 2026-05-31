import { useSyncExternalStore } from 'react';

import { CriticalModal, CustomModal, Modal } from '../modal/modal.tsx';
import { drawerStore, type ModalEntry } from './drawer-store.ts';

/**
 * ModalHost — mounts once at the app root. Renders at most one open modal,
 * driven by DrawerService.confirm / .critical / .openModal calls. The hosted
 * Modal / CriticalModal / CustomModal handle their own createPortal.
 *
 * Shared config (position, closeOnOutsideClick, closeOnEscape, sticky) flows
 * through to whichever modal kind the entry declares.
 */
export function ModalHost() {
  const state = useSyncExternalStore(drawerStore.subscribe, drawerStore.getState);
  const m = state.modal;
  if (m === null) return null;

  const handleClose = () => {
    if (m.onCancel !== undefined) {
      m.onCancel();
    } else {
      drawerStore.closeModal();
    }
  };

  const sharedProps = pickSharedProps(m);

  if (m.kind === 'custom') {
    return (
      <CustomModal open onClose={handleClose} hideCloseButton={m.hideCloseButton} {...sharedProps}>
        {m.body}
      </CustomModal>
    );
  }

  if (m.kind === 'critical') {
    return (
      <CriticalModal
        open
        onClose={handleClose}
        onConfirm={m.onConfirm}
        title={m.title}
        {...(m.description !== undefined ? { description: m.description } : {})}
        confirmPhrase={m.confirmPhrase}
        confirmPrompt={m.confirmPrompt}
        confirmLabel={m.confirmLabel}
        {...(m.cancelLabel !== undefined ? { cancelLabel: m.cancelLabel } : {})}
        {...sharedProps}
      >
        {m.children}
      </CriticalModal>
    );
  }

  return (
    <Modal
      open
      onClose={handleClose}
      onConfirm={m.onConfirm}
      title={m.title}
      {...(m.description !== undefined ? { description: m.description } : {})}
      intent={m.kind === 'danger' ? 'danger' : 'standard'}
      confirmLabel={m.confirmLabel}
      {...(m.cancelLabel !== undefined ? { cancelLabel: m.cancelLabel } : {})}
      {...sharedProps}
    >
      {m.children}
    </Modal>
  );
}

function pickSharedProps(m: ModalEntry) {
  return {
    position: m.position,
    closeOnOutsideClick: m.closeOnOutsideClick,
    closeOnEscape: m.closeOnEscape,
    sticky: m.sticky,
  };
}
