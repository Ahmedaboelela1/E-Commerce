import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {DashboardPreview} from '@/site/admin-preview/dashboard-preview';

export const metadata: Metadata = {
    title: 'Skillverse Commerce — Dashboard Preview',
    robots: {index: false, follow: false},
};

export default function AdminPreviewPage() {
    // Read-only pilot dashboard. It contains no private customer/order data
    // or administrative write permissions; enable only for a staging demo.
    if (process.env.SHOW_ADMIN_PREVIEW !== 'true') notFound();
    return <DashboardPreview />;
}
