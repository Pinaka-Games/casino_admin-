'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredType?: 'admin' | 'employee';
}

export function ProtectedRoute({ children, requiredType }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, userType } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (requiredType && userType !== requiredType) {
      router.push('/unauthorized');
    }
  }, [isAuthenticated, userType, requiredType, router]);

  if (!isAuthenticated || (requiredType && userType !== requiredType)) {
    return null;
  }

  return <>{children}</>;
}
