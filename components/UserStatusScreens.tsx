import React from 'react';

const StatusContainer: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
    <div className="w-full max-w-md p-8 space-y-4 bg-white dark:bg-slate-800 rounded-2xl shadow-lg text-center">
      <h1 className="text-2xl font-bold text-primary">{title}</h1>
      <div className="text-gray-600 dark:text-gray-300">
        {children}
      </div>
    </div>
  </div>
);


export const PendingScreen: React.FC = () => (
    <StatusContainer title="Approval Pending">
        <p>Your account has been created successfully.</p>
        <p>An administrator will review your request shortly. Please check back later.</p>
    </StatusContainer>
);

export const RejectedScreen: React.FC = () => (
    <StatusContainer title="Access Denied">
        <p>Your request for access has been rejected by the administrator.</p>
        <p>If you believe this is an error, please contact support.</p>
    </StatusContainer>
);

export const ExpiredScreen: React.FC = () => (
    <StatusContainer title="Access Expired">
        <p>Your access to the application has expired.</p>
        <p>Please contact the administrator to renew your access.</p>
    </StatusContainer>
);
