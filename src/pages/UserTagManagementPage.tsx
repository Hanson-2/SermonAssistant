import React, { useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Navigate } from 'react-router-dom';
import './UserTagManagementPage.scss';

interface UserTag {
  id: string;
  name: string;
  color?: string;
}

export default function UserTagManagementPage() {
  return <Navigate to="/tag-management" replace />;
}
