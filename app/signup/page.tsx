'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import SignupModal from '@/components/SignupModal';

export default function SignupPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [showModal, setShowModal] = useState(true);

  useEffect(() => {
    // If user is already logged in, redirect to home
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleSuccess = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      {showModal && (
        <SignupModal
          onClose={() => {
            setShowModal(false);
            router.push('/');
          }}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
