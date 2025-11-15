import React from 'react';
import { User } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const StatusContainer: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
    <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg text-center">
      <h1 className="text-2xl font-bold text-primary">{title}</h1>
      <div className="text-gray-600 dark:text-gray-300">
        {children}
      </div>
    </div>
  </div>
);


export const PendingScreen: React.FC<{ user: User | null; onSignOut: () => void; }> = ({ user, onSignOut }) => {
    const phoneNumber = "8208141447";
    const userEmail = user?.email || "your email";
    const message = `Hello, please accept my request for "${userEmail}"`;
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

    return (
    <StatusContainer title="Approval Pending">
        <div>
            <p>Your account has been created successfully.</p>
            <p>An administrator will review your request shortly. Please check back later.</p>
        </div>
        <div className="pt-4 space-y-4">
             <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-block text-center bg-green-500 text-white p-3 rounded-lg font-semibold hover:bg-green-600 transition-colors"
            >
                Message Admin on WhatsApp
            </a>
            <button
                onClick={onSignOut}
                className="w-full text-center bg-gray-200 dark:bg-slate-600 text-black dark:text-white p-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
                Go to Home / Login
            </button>
        </div>
    </StatusContainer>
    );
};

export const RejectedScreen: React.FC = () => (
    <StatusContainer title="Access Denied">
        <p>Your request for access has been rejected by the administrator.</p>
        <p>If you believe this is an error, please contact support.</p>
        <div className="pt-4">
            <button
                onClick={() => signOut(auth)}
                className="w-full text-center bg-gray-200 dark:bg-slate-600 text-black dark:text-white p-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
                Go to Home / Login
            </button>
        </div>
    </StatusContainer>
);

export const ExpiredScreen: React.FC = () => (
    <StatusContainer title="Access Expired">
        <p>Your access to the application has expired.</p>
        <p>Please contact the administrator to renew your access.</p>
    </StatusContainer>
);