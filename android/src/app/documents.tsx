import React from 'react';
import { api } from '../lib/api';
import { MeListScreen } from '../screens/MeListScreen';

export default function DocumentsScreen() {
  return (
    <MeListScreen
      title="My documents"
      empty="No documents uploaded yet."
      load={() => api.listMyDocuments()}
    />
  );
}
