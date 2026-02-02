import React from 'react'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string
}

const Textarea: React.FC<TextareaProps> = ({ className = '', ...props }) => {
  return (
    <textarea
      className={`w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none resize-vertical ${className}`}
      {...props}
    />
  )
}

export default Textarea
