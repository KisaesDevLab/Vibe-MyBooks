import { type InputHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ label, error, value, onChange, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1">
        {label && <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">{label}</label>}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
          <input
            ref={ref}
            id={inputId}
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={clsx(
              'block w-full rounded-lg border px-3 py-2 pl-7 text-sm text-right font-mono shadow-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
              error ? 'border-red-300' : 'border-gray-300',
              className,
            )}
            {...props}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  },
);
MoneyInput.displayName = 'MoneyInput';
