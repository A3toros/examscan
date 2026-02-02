'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

type ModalType = 'button' | 'notification' | 'loading' | 'component'

interface ModalState {
  isOpen: boolean
  type: ModalType
  props: any
  component?: React.ComponentType<any>
}

interface ModalContextType {
  modalState: ModalState
  showButtonModal: (props: {
    title: string
    message?: string
    buttons: Array<{ label: string; onClick: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean }>
    size?: 'sm' | 'md' | 'lg'
  }) => void
  showNotificationModal: (props: {
    type?: 'success' | 'error' | 'warning' | 'info'
    title: string
    message?: string
    confirmText?: string
    cancelText?: string
    onConfirm?: () => void
    onCancel?: () => void
    showCancel?: boolean
  }) => void
  showLoadingModal: (props: {
    message?: string
    size?: 'sm' | 'md' | 'lg'
  }) => void
  showModal: (modal: { component: React.ComponentType<any>; props?: any } | null) => void
  hideModal: () => void
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

interface ModalProviderProps {
  children: ReactNode
}

export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    type: 'button',
    props: {},
  })

  const showButtonModal = (props: any) => {
    setModalState({
      isOpen: true,
      type: 'button',
      props: {
        ...props,
        onClose: hideModal,
      },
    })
  }

  const showNotificationModal = (props: any) => {
    setModalState({
      isOpen: true,
      type: 'notification',
      props: {
        ...props,
        onClose: hideModal,
      },
    })
  }

  const showLoadingModal = (props: any) => {
    setModalState({
      isOpen: true,
      type: 'loading',
      props: {
        ...props,
        onClose: hideModal,
      },
      component: undefined,
    })
  }

  const showModal = (modal: { component: React.ComponentType<any>; props?: any } | null) => {
    if (modal === null) {
      hideModal()
      return
    }

    setModalState({
      isOpen: true,
      type: 'component',
      props: {
        ...modal.props,
        onClose: hideModal,
      },
      component: modal.component,
    })
  }

  const hideModal = () => {
    setModalState(prev => ({
      ...prev,
      isOpen: false,
    }))
  }

  const value: ModalContextType = {
    modalState,
    showButtonModal,
    showNotificationModal,
    showLoadingModal,
    showModal,
    hideModal,
  }

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  )
}

export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext)
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider')
  }
  return context
}

// Modal renderer component
export const ModalRenderer: React.FC = () => {
  const { modalState } = useModal()

  if (!modalState.isOpen) return null

  switch (modalState.type) {
    case 'button':
      const { default: ButtonModal } = require('../components/ui/ButtonModal')
      return <ButtonModal {...modalState.props} />
    case 'notification':
      const { default: NotificationModal } = require('../components/ui/NotificationModal')
      return <NotificationModal {...modalState.props} />
    case 'loading':
      const { default: LoadingSpinnerModal } = require('../components/ui/LoadingSpinnerModal')
      return <LoadingSpinnerModal {...modalState.props} />
    case 'component':
      if (modalState.component) {
        const Component = modalState.component
        return <Component {...modalState.props} />
      }
      return null
    default:
      return null
  }
}
