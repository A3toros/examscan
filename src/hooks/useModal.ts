import { useState } from 'react';
import { ModalState } from '../types';

export const useModal = () => {
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    type: 'loading'
  });

  const openModal = (type: ModalState['type'], title?: string, message?: string, data?: any) => {
    setModalState({
      isOpen: true,
      type,
      title,
      message,
      data
    });
  };

  const closeModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  const updateModalData = (data: any) => {
    setModalState(prev => ({ ...prev, data }));
  };

  return {
    modalState,
    openModal,
    closeModal,
    updateModalData
  };
};
