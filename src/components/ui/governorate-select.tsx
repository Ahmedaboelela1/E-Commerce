'use client';

import type {ComponentProps} from 'react';
import {cn} from '@/lib/utils';
import {egyptGovernorates, getEgyptGovernorate} from '@/config/egypt-governorates';

type GovernorateSelectProps = Omit<ComponentProps<'select'>, 'value'> & {
    value?: string;
    placeholder: string;
};

export function GovernorateSelect({value, placeholder, className, ...props}: GovernorateSelectProps) {
    return (
        <select
            {...props}
            value={getEgyptGovernorate(value)?.[1] || ''}
            className={cn('h-9 w-full min-w-0 rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive', className)}
        >
            <option value="" disabled>{placeholder}</option>
            {egyptGovernorates.map(([code, name, arabic]) => (
                <option key={code} value={name}>{arabic} / {name}</option>
            ))}
        </select>
    );
}
