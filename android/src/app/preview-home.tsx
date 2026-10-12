import React from 'react';
import { Redirect } from 'expo-router';
import { HomeScreen } from '../screens/HomeScreen';
import type { UseAuthReturn } from '../hooks/useAuth';

const previewAuth = {
  isAuthenticated: false,
  isLoading: false,
  user: { id: 'preview-user', fullName: 'Taylor Nuruva', email: 'taylor@example.test' },
  employee: {
    first_name: 'Taylor',
    last_name: 'Nuruva',
    employee_no: 'AICL/00042',
    position_name: 'People Operations Partner',
    department_name: 'People & Culture',
    branch_name: 'Head Office',
    employment_status: 'Active',
    hire_date: '2022-08-16',
  },
  refreshProfile: async () => {},
  logout: async () => {},
} as unknown as UseAuthReturn;

export default function PreviewHomeRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <HomeScreen auth={previewAuth} />;
}
